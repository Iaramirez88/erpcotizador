import { prisma } from '@/lib/prisma'
import { normalizeString, parseOpportunityStage } from '@/lib/crm'
import { upsertLeadFromInbound } from '@/lib/crm-lead-capture'
import { sendEmail } from '@/lib/email'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import type { Prisma, WorkflowNodeKind, WorkflowTriggerKind } from '@prisma/client'

/**
 * Módulo Workflows (esqueleto).
 *
 * A diferencia del Chatbot Studio (anclado a una conversación), un Workflow se
 * dispara por un evento externo (webhook/cron/evento) y ejecuta un grafo de
 * nodos. El ejecutor actual es mínimo: recorre los nodos en orden y soporta
 * `HTTP_REQUEST`; el resto de nodos queda como marcadores para las siguientes
 * fases (condiciones, delays, acciones de CRM, etc.).
 */

export type WorkflowTriggerConfig = {
  kind: WorkflowTriggerKind
  cronExpression: string | null
  eventName: string | null
}

export type WorkflowNode = {
  id: string
  kind: WorkflowNodeKind
  label: string
  config: Record<string, unknown>
}

export type WorkflowEdge = {
  id: string
  from: string
  to: string
  label: string | null
}

export type WorkflowDefinition = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, unknown>
}

export const WORKFLOW_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const
export const WORKFLOW_TRIGGER_KINDS = ['WEBHOOK', 'CRON', 'MANUAL', 'EVENT'] as const
export const WORKFLOW_NODE_KINDS = ['TRIGGER', 'HTTP_REQUEST', 'CONDITION', 'DELAY', 'NOTE', 'ACTION'] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function parseWorkflowTriggerJson(value: unknown): WorkflowTriggerConfig {
  const raw = asRecord(value)
  const kind = normalizeString(raw?.kind).toUpperCase() as WorkflowTriggerKind
  return {
    kind: (WORKFLOW_TRIGGER_KINDS as readonly string[]).includes(kind) ? kind : 'WEBHOOK',
    cronExpression: normalizeString(raw?.cronExpression) || null,
    eventName: normalizeString(raw?.eventName) || null,
  }
}

export function parseWorkflowDefinitionJson(value: unknown): WorkflowDefinition {
  const raw = asRecord(value)

  const nodes = Array.isArray(raw?.nodes)
    ? raw.nodes
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => {
          const kind = normalizeString(item.kind).toUpperCase() as WorkflowNodeKind
          return {
            id: normalizeString(item.id),
            kind: (WORKFLOW_NODE_KINDS as readonly string[]).includes(kind) ? kind : 'NOTE',
            label: normalizeString(item.label),
            config: asRecord(item.config) ?? {},
          } satisfies WorkflowNode
        })
        .filter((item) => item.id)
    : []

  const edges = Array.isArray(raw?.edges)
    ? raw.edges
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          id: normalizeString(item.id),
          from: normalizeString(item.from),
          to: normalizeString(item.to),
          label: normalizeString(item.label) || null,
        } satisfies WorkflowEdge))
        .filter((item) => item.id && item.from && item.to)
    : []

  return { nodes, edges, variables: asRecord(raw?.variables) ?? {} }
}

export function buildWorkflowWebhookUrl(baseUrl: string, webhookToken: string) {
  return `${baseUrl.replace(/\/+$/, '')}/api/workflows/webhook/${encodeURIComponent(webhookToken)}`
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function interpolateWorkflowVariables(template: string, context: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = context[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

export type WorkflowRunInput = {
  workflow: { id: string; empresaId: string; createdById: string; triggerJson: unknown; definitionJson: unknown }
  triggerKind: WorkflowTriggerKind
  triggerPayload?: Record<string, unknown>
}

export async function executeWorkflowRun(args: WorkflowRunInput) {
  const trigger = parseWorkflowTriggerJson(args.workflow.triggerJson)
  const definition = parseWorkflowDefinitionJson(args.workflow.definitionJson)
  const payload = args.triggerPayload ?? {}

  const run = await prisma.workflowRun.create({
    data: {
      empresaId: args.workflow.empresaId,
      workflowId: args.workflow.id,
      status: 'RUNNING',
      triggerKind: args.triggerKind,
      triggerPayloadJson: toInputJson(payload),
    },
  })

  const context: Record<string, unknown> = { ...definition.variables, ...payload, trigger: trigger.kind }

  try {
    for (const node of definition.nodes) {
      const startedAt = new Date()
      let outputJson: Record<string, unknown> = {}
      let stepError: string | null = null

      if (node.kind === 'HTTP_REQUEST') {
        const url = interpolateWorkflowVariables(normalizeString(node.config.url) || '', context)
        const method = (normalizeString(node.config.method) || 'GET').toUpperCase()
        if (!url) {
          stepError = 'Falta la URL del nodo HTTP'
        } else {
          try {
            const response = await fetch(url, {
              method,
              signal: AbortSignal.timeout(15_000),
              headers: { Accept: 'application/json' },
            })
            const text = await response.text()
            outputJson = { status: response.status, body: text.slice(0, 4000) }
            if (!response.ok) stepError = `HTTP ${response.status}`
          } catch (error) {
            stepError = error instanceof Error ? error.message : 'Fallo la solicitud HTTP'
          }
        }
      } else if (node.kind === 'CONDITION') {
        outputJson = { evaluated: true, skipped: true }
      } else if (node.kind === 'DELAY') {
        outputJson = { skipped: true }
      } else if (node.kind === 'ACTION') {
        const action = normalizeString(node.config.action)
        const fields = asRecord(node.config.fields) ?? {}
        const pick = (key: string, fallback = '') => {
          const template = normalizeString(fields[key]) || fallback
          return interpolateWorkflowVariables(template, context) || null
        }

        if (action === 'create_lead') {
          const result = await upsertLeadFromInbound({
            client: prisma,
            empresaId: args.workflow.empresaId,
            createdById: args.workflow.createdById,
            source: 'API',
            nombre: pick('nombre', '{{nombre}}') || '(desde workflow)',
            empresaNombre: pick('empresaNombre', '{{empresa}}'),
            email: pick('email', '{{email}}'),
            phone: pick('phone', '{{telefono}}'),
            document: pick('document', '{{documento}}'),
            ciudad: pick('ciudad', '{{ciudad}}'),
            notes: pick('message', '{{mensaje}}'),
            origin: { sourceKey: 'WORKFLOW', sourceLabel: 'Workflow', serviceInterest: pick('producto', '{{producto}}') },
            eventAt: new Date(),
          })
          outputJson = { leadId: result.lead.id, isFirstTouch: result.isFirstTouch }
        } else if (action === 'create_opportunity') {
          const opportunity = await prisma.crmOpportunity.create({
            data: {
              empresaId: args.workflow.empresaId,
              title: pick('title', '{{titulo}}') || 'Oportunidad desde workflow',
              description: pick('description', '{{descripcion}}') || null,
              stage: parseOpportunityStage(fields.stage) ?? 'NEW',
              expectedValue: Number(pick('expectedValue', '0')) || 0,
              probabilityPct: 0,
              assignedToUserId: args.workflow.createdById,
              createdById: args.workflow.createdById,
            },
          })
          outputJson = { opportunityId: opportunity.id }
        } else if (action === 'send_email') {
          const to = pick('to')
          if (!to) {
            stepError = 'Falta el destinatario (to)'
          } else {
            const sent = await sendEmail({ to, subject: pick('subject', '{{asunto}}') || 'Notificación', html: pick('body', '{{mensaje}}') || '' })
            outputJson = { ok: sent.ok, status: sent.status }
            if (!sent.ok) stepError = sent.error || 'Fallo el envío de correo'
          }
        } else if (action === 'send_whatsapp') {
          const to = normalizeWhatsAppRecipient(pick('to', '') || '')
          if (!to) {
            stepError = 'Falta el teléfono (to)'
          } else {
            const channels = await prisma.crmChannelConnection.findMany({
              where: { empresaId: args.workflow.empresaId, provider: { in: ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX'] }, status: { in: ['TESTING', 'ACTIVE'] } },
              orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
            })
            const channel = channels.find((item) => getWhatsAppDispatchConfig(item).enabled)
            if (!channel) {
              stepError = 'No hay canal de WhatsApp activo para enviar el mensaje'
            } else {
              await sendWhatsAppTextMessage({ config: getWhatsAppDispatchConfig(channel), to, bodyText: pick('message', '{{mensaje}}') || '' })
              outputJson = { ok: true }
            }
          }
        } else {
          outputJson = { node: node.label }
        }
      } else {
        outputJson = { node: node.label }
      }

      await prisma.workflowRunStep.create({
        data: {
          empresaId: args.workflow.empresaId,
          runId: run.id,
          nodeId: node.id,
          nodeKind: node.kind,
          status: stepError ? 'FAILED' : 'SUCCEEDED',
          inputJson: toInputJson(context),
          outputJson: toInputJson(outputJson),
          errorMessage: stepError,
          durationMs: Date.now() - startedAt.getTime(),
          startedAt,
          finishedAt: new Date(),
        },
      })

      if (stepError) throw new Error(stepError)
    }

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'SUCCEEDED', outputJson: toInputJson(context), finishedAt: new Date() },
    })

    return { ok: true as const, runId: run.id, output: context }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fallo la ejecución'
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', errorMessage: message, finishedAt: new Date() },
    }).catch(() => undefined)
    return { ok: false as const, runId: run.id, error: message }
  }
}

function matchCronField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true
  for (const part of field.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue

    let range = trimmed
    let step = 1
    if (trimmed.includes('/')) {
      const [rangePart, stepPart] = trimmed.split('/')
      range = rangePart || '*'
      step = Number.parseInt(stepPart, 10)
      if (!Number.isFinite(step) || step <= 0) continue
    }

    let start = min
    let end = max
    if (range !== '*') {
      const [a, b] = range.split('-').map((n) => Number.parseInt(n, 10))
      start = Number.isFinite(a) ? a : min
      if (range.includes('-')) {
        end = Number.isFinite(b) ? b : max
      } else {
        end = start
      }
    }

    for (let current = start; current <= end && current <= max; current += step) {
      if (current === value) return true
    }
  }
  return false
}

export function matchesCronExpression(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const [minute, hour, dom, month, dow] = parts
  return matchCronField(minute, date.getMinutes(), 0, 59)
    && matchCronField(hour, date.getHours(), 0, 23)
    && matchCronField(dom, date.getDate(), 1, 31)
    && matchCronField(month, date.getMonth() + 1, 1, 12)
    && matchCronField(dow, date.getDay(), 0, 6)
}
