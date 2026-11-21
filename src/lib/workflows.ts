import { prisma } from '@/lib/prisma'
import { normalizeString, parseOpportunityStage } from '@/lib/crm'
import { upsertLeadFromInbound } from '@/lib/crm-lead-capture'
import { sendEmail } from '@/lib/email'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { checkOutboundQuota, formatViolation, recordOutboundUsageEvent, releaseOutboundQuota } from '@/lib/messaging-quota'
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

function resolveContextPath(context: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return (acc as Record<string, unknown>)[part]
    return undefined
  }, context)
}

function interpolateWorkflowVariables(template: string, context: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = resolveContextPath(context, key)
    if (value === undefined || value === null) return ''
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  })
}

function parseHeaderMap(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const map: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (key) map[key] = String(value)
      }
      return map
    }
  } catch {
    // Se ignora JSON inválido.
  }
  return {}
}

function evaluateCondition(left: string, operator: string, right: string): boolean {
  switch (operator) {
    case 'neq':
      return left !== right
    case 'gt':
      return Number(left) > Number(right)
    case 'gte':
      return Number(left) >= Number(right)
    case 'lt':
      return Number(left) < Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    case 'contains':
      return left.toLowerCase().includes(right.toLowerCase())
    case 'not_contains':
      return !left.toLowerCase().includes(right.toLowerCase())
    case 'empty':
      return left.trim() === ''
    case 'not_empty':
      return left.trim() !== ''
    case 'eq':
    default:
      return left === right
  }
}

function normalizeEdgeBranchLabel(label: string | null): 'true' | 'false' | null {
  if (!label) return null
  const value = label.trim().toLowerCase()
  if (['true', 'verdadero', 'si', 'sí', 'yes'].includes(value)) return 'true'
  if (['false', 'falso', 'no', 'not'].includes(value)) return 'false'
  return null
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

  // Prepara el grafo para la ejecución por aristas. Si no hay aristas, se
  // conserva el flujo secuencial (compatibilidad con workflows anteriores).
  const hasEdges = definition.edges.length > 0
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]))
  const nodeIndex = new Map(definition.nodes.map((node, index) => [node.id, index]))
  const outgoing = new Map<string, WorkflowEdge[]>()
  const incomingCount = new Map<string, number>()
  for (const edge of definition.edges) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge)
    outgoing.set(edge.from, list)
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
  }

  const startIds = hasEdges
    ? definition.nodes.filter((node) => !(incomingCount.get(node.id) ?? 0)).map((node) => node.id)
    : definition.nodes.slice(0, 1).map((node) => node.id)
  const queue = [...startIds]
  const visited = new Set<string>()

  try {
    while (queue.length) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      visited.add(nodeId)
      const node = nodeById.get(nodeId)
      if (!node) continue

      const startedAt = new Date()
      let outputJson: Record<string, unknown> = {}
      let stepError: string | null = null
      let conditionMatched: boolean | null = null
      let conditionStopped = false

      if (node.kind === 'HTTP_REQUEST') {
        const method = (normalizeString(node.config.method) || 'GET').toUpperCase()
        let url = interpolateWorkflowVariables(normalizeString(node.config.url) || '', context)
        const authType = normalizeString(node.config.authType) || 'none'
        const timeoutSeconds = Number(node.config.timeoutSeconds) || 15

        if (!url) {
          stepError = 'Falta la URL del nodo HTTP'
        } else {
          const headers: Record<string, string> = { Accept: 'application/json' }
          for (const [key, value] of Object.entries(parseHeaderMap(node.config.headers))) {
            const headerValue = interpolateWorkflowVariables(value, context)
            if (key && headerValue) headers[key] = headerValue
          }
          if (authType === 'bearer') {
            const token = interpolateWorkflowVariables(normalizeString(node.config.authToken) || '', context)
            if (token) headers.Authorization = `Bearer ${token}`
          } else if (authType === 'basic') {
            const username = interpolateWorkflowVariables(normalizeString(node.config.authUsername) || '', context)
            const password = interpolateWorkflowVariables(normalizeString(node.config.authPassword) || '', context)
            headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
          }

          const queryEntries = Object.entries(parseHeaderMap(node.config.query))
          if (queryEntries.length) {
            const params = new URLSearchParams()
            for (const [key, value] of queryEntries) params.append(key, interpolateWorkflowVariables(value, context))
            url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
          }

          const bodyText = normalizeString(node.config.body) ?? ''
          const body = ['POST', 'PUT', 'PATCH'].includes(method) && bodyText.trim()
            ? interpolateWorkflowVariables(bodyText, context)
            : undefined

          try {
            const response = await fetch(url, {
              method,
              signal: AbortSignal.timeout(Math.min(Math.max(timeoutSeconds, 1), 120) * 1000),
              headers,
              body,
            })
            const text = await response.text()
            outputJson = { status: response.status, ok: response.ok, body: text.slice(0, 4000) }
            const responseVariable = normalizeString(node.config.responseVariable)
            if (responseVariable) {
              context[responseVariable] = text
              context[`${responseVariable}Status`] = response.status
            }
            if (!response.ok) stepError = `HTTP ${response.status}`
          } catch (error) {
            stepError = error instanceof Error ? error.message : 'Fallo la solicitud HTTP'
          }
        }
      } else if (node.kind === 'CONDITION') {
        const field = interpolateWorkflowVariables(normalizeString(node.config.field) || '', context)
        const operator = normalizeString(node.config.operator) || 'eq'
        const value = interpolateWorkflowVariables(normalizeString(node.config.value) || '', context)
        const matched = evaluateCondition(field, operator, value)
        conditionMatched = matched
        conditionStopped = !matched && Boolean(node.config.stopWhenFalse ?? true)
        outputJson = { matched, left: field, operator, right: value }
      } else if (node.kind === 'DELAY') {
        const rawValue = Number(node.config.value ?? node.config.seconds)
        const unit = normalizeString(node.config.unit) || 'seconds'
        const multiplier = unit === 'minutes' ? 60_000 : unit === 'hours' ? 3_600_000 : 1_000
        const ms = Math.min(Math.max((Number.isFinite(rawValue) ? rawValue : 0) * multiplier, 0), 3_600_000)
        if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
        outputJson = { waitedMs: ms }
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
              const quotaCheck = await checkOutboundQuota({ empresaId: args.workflow.empresaId, channelConnectionId: channel.id, provider: channel.provider, settingsJson: channel.settingsJson })
              if (!quotaCheck.allowed) {
                stepError = quotaCheck.violation ? formatViolation(quotaCheck.violation) : 'Límite de mensajería alcanzado'
              } else {
                try {
                  const result = await sendWhatsAppTextMessage({ config: getWhatsAppDispatchConfig(channel), to, bodyText: pick('message', '{{mensaje}}') || '' })
                  await recordOutboundUsageEvent({ empresaId: args.workflow.empresaId, channelConnectionId: channel.id, provider: channel.provider, status: result.providerMessageId ? 'SENT' : 'FAILED', providerMessageId: result.providerMessageId })
                  outputJson = { ok: true }
                } catch {
                  await releaseOutboundQuota({ empresaId: args.workflow.empresaId, channelConnectionId: channel.id, provider: channel.provider })
                  stepError = 'No se pudo enviar el mensaje por WhatsApp'
                }
              }
            }
          }
        } else if (action === 'send_notification') {
          const notification = await prisma.notification.create({
            data: {
              type: 'INFO',
              title: pick('title', '{{titulo}}') || 'Notificación de workflow',
              body: pick('body', '{{mensaje}}'),
              actionUrl: pick('actionUrl') ?? null,
              actionLabel: pick('actionLabel') ?? null,
              empresaId: args.workflow.empresaId,
              userId: pick('userId') || args.workflow.createdById,
            },
          })
          outputJson = { notificationId: notification.id }
        } else if (action === 'create_task') {
          const priorityRaw = (normalizeString(fields.priority) || 'NORMAL').toUpperCase()
          const priority = (['LOW', 'NORMAL', 'HIGH'].includes(priorityRaw) ? priorityRaw : 'NORMAL') as 'LOW' | 'NORMAL' | 'HIGH'
          const task = await prisma.crmTask.create({
            data: {
              empresaId: args.workflow.empresaId,
              title: pick('title', '{{titulo}}') || 'Tarea desde workflow',
              description: pick('description', '{{descripcion}}'),
              priority,
              assignedToUserId: pick('assignedToUserId') || args.workflow.createdById,
              createdById: args.workflow.createdById,
            },
          })
          outputJson = { taskId: task.id }
        } else if (action === 'set_variable') {
          const variableKey = normalizeString(fields.variableKey)
          if (!variableKey) {
            stepError = 'Falta el nombre de la variable'
          } else {
            const variableValue = interpolateWorkflowVariables(normalizeString(fields.variableValue) || '', context)
            context[variableKey] = variableValue
            outputJson = { [variableKey]: variableValue }
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

      // Encamina al siguiente nodo según las aristas del grafo.
      const nextEdges = outgoing.get(nodeId) ?? []
      const linearNext = definition.nodes[(nodeIndex.get(nodeId) ?? -1) + 1]
      if (node.kind === 'CONDITION') {
        if (conditionMatched) {
          for (const edge of nextEdges) {
            if (normalizeEdgeBranchLabel(edge.label) !== 'false') queue.push(edge.to)
          }
          if (!hasEdges && linearNext) queue.push(linearNext.id)
        } else {
          const falseEdges = nextEdges.filter((edge) => normalizeEdgeBranchLabel(edge.label) === 'false')
          if (falseEdges.length) {
            for (const edge of falseEdges) queue.push(edge.to)
          } else if (!conditionStopped) {
            for (const edge of nextEdges) {
              if (!normalizeEdgeBranchLabel(edge.label)) queue.push(edge.to)
            }
            if (!hasEdges && linearNext) queue.push(linearNext.id)
          }
        }
      } else {
        for (const edge of nextEdges) queue.push(edge.to)
        if (!hasEdges && linearNext) queue.push(linearNext.id)
      }
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
