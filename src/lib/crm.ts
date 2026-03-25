import { NextResponse } from 'next/server'
import {
  AccessLevel,
  CrmActivityType,
  CrmChannelConnectionStatus,
  CrmChannelProvider,
  CrmConversationStatus,
  CrmLeadSource,
  CrmLeadCaptureType,
  CrmLeadStatus,
  CrmMessageDirection,
  CrmMessageStatus,
  CrmMessageType,
  CrmOpportunityStage,
  Prisma,
  CrmTaskPriority,
  CrmTaskStatus,
  ModuleKey,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSedeAccess } from '@/lib/rbac'

export const CRM_LEAD_STATUSES: CrmLeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED']
export const CRM_LEAD_SOURCES: CrmLeadSource[] = ['WEB', 'REFERIDO', 'WHATSAPP', 'LLAMADA', 'IMPORT', 'OTRO']
export const CRM_OPPORTUNITY_STAGES: CrmOpportunityStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']
export const CRM_ACTIVITY_TYPES: CrmActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'TASK_DONE', 'STAGE_CHANGE', 'QUOTE_SENT', 'OTHER']
export const CRM_TASK_STATUSES: CrmTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED']
export const CRM_TASK_PRIORITIES: CrmTaskPriority[] = ['LOW', 'NORMAL', 'HIGH']
export const CRM_CHANNEL_PROVIDERS: CrmChannelProvider[] = ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'FACEBOOK_PAGE', 'MESSENGER', 'WEB_FORM', 'WEB_CHATBOT', 'INSTAGRAM_DM']
export const CRM_CHANNEL_CONNECTION_STATUSES: CrmChannelConnectionStatus[] = ['DRAFT', 'TESTING', 'ACTIVE', 'DISABLED', 'ERROR']
export const CRM_CONVERSATION_STATUSES: CrmConversationStatus[] = ['OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'RESOLVED', 'SPAM']
export const CRM_MESSAGE_DIRECTIONS: CrmMessageDirection[] = ['INBOUND', 'OUTBOUND', 'SYSTEM']
export const CRM_MESSAGE_TYPES: CrmMessageType[] = ['TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'TEMPLATE', 'FORM_SUBMISSION', 'EVENT']
export const CRM_MESSAGE_STATUSES: CrmMessageStatus[] = ['RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']
export const CRM_LEAD_CAPTURE_TYPES: CrmLeadCaptureType[] = ['WEB_FORM', 'META_LEAD_AD', 'WHATSAPP_INBOUND', 'MESSENGER_INBOUND', 'CHATBOT_START', 'MANUAL_IMPORT']

export type CrmStageSettingInput = {
  key: CrmOpportunityStage
  label: string
  color: string | null
  sortOrder: number
}

export const DEFAULT_CRM_STAGE_SETTINGS: CrmStageSettingInput[] = [
  { key: 'NEW', label: 'Nuevo', color: '#64748b', sortOrder: 10 },
  { key: 'QUALIFIED', label: 'Calificada', color: '#0f766e', sortOrder: 20 },
  { key: 'PROPOSAL', label: 'Propuesta', color: '#2563eb', sortOrder: 30 },
  { key: 'NEGOTIATION', label: 'Negociación', color: '#d97706', sortOrder: 40 },
  { key: 'WON', label: 'Ganada', color: '#16a34a', sortOrder: 50 },
  { key: 'LOST', label: 'Perdida', color: '#dc2626', sortOrder: 60 },
]

type PrismaStageClient = Prisma.TransactionClient | typeof prisma

export function getDefaultCrmStageSettings(): CrmStageSettingInput[] {
  return DEFAULT_CRM_STAGE_SETTINGS.map((item) => ({ ...item }))
}

export async function ensureCrmStageSettings(client: PrismaStageClient, empresaId: string) {
  const existing = await client.crmStageSetting.findMany({
    where: { empresaId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  if (existing.length >= DEFAULT_CRM_STAGE_SETTINGS.length) {
    return existing
  }

  for (const stage of DEFAULT_CRM_STAGE_SETTINGS) {
    await client.crmStageSetting.upsert({
      where: { empresaId_key: { empresaId, key: stage.key } },
      create: {
        empresaId,
        key: stage.key,
        label: stage.label,
        color: stage.color,
        sortOrder: stage.sortOrder,
      },
      update: {},
    })
  }

  return client.crmStageSetting.findMany({
    where: { empresaId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

function describeAutomationTrigger(trigger: OpportunityAutomationTrigger) {
  switch (trigger) {
    case 'QUOTE_LINKED':
      return 'cotización vinculada'
    case 'QUOTE_SENT':
      return 'cotización enviada'
    case 'QUOTE_APPROVED':
      return 'cotización aprobada'
    case 'SALE_REALIZED_SET':
      return 'venta realizada'
    case 'SALE_REALIZED_UNSET':
      return 'venta realizada revertida'
    default:
      return 'evento ERP'
  }
}

export type OpportunityAutomationTrigger =
  | 'QUOTE_LINKED'
  | 'QUOTE_SENT'
  | 'QUOTE_APPROVED'
  | 'SALE_REALIZED_SET'
  | 'SALE_REALIZED_UNSET'

export function resolveAutomatedOpportunityStage(
  currentStage: CrmOpportunityStage,
  trigger: OpportunityAutomationTrigger
): CrmOpportunityStage | null {
  switch (trigger) {
    case 'QUOTE_LINKED':
    case 'QUOTE_SENT':
      if (currentStage === 'NEW' || currentStage === 'QUALIFIED') return 'PROPOSAL'
      return null
    case 'QUOTE_APPROVED':
      if (currentStage === 'WON' || currentStage === 'LOST' || currentStage === 'NEGOTIATION') return null
      return 'NEGOTIATION'
    case 'SALE_REALIZED_SET':
      return currentStage === 'WON' ? null : 'WON'
    case 'SALE_REALIZED_UNSET':
      return currentStage === 'WON' ? 'NEGOTIATION' : null
    default:
      return null
  }
}

export async function applyOpportunityStageAutomation(args: {
  client: PrismaStageClient
  empresaId: string
  userId: string
  cotizacionId: string
  trigger: OpportunityAutomationTrigger
  details?: string | null
}) {
  const opportunity = await args.client.crmOpportunity.findFirst({
    where: { empresaId: args.empresaId, cotizacionId: args.cotizacionId },
    select: {
      id: true,
      title: true,
      stage: true,
      sedeId: true,
      leadId: true,
      clienteId: true,
      wonAt: true,
      lostAt: true,
      cotizacion: { select: { numero: true } },
    },
  })

  if (!opportunity) return null

  const nextStage = resolveAutomatedOpportunityStage(opportunity.stage, args.trigger)
  if (!nextStage || nextStage === opportunity.stage) return null

  const updated = await args.client.crmOpportunity.update({
    where: { id: opportunity.id },
    data: {
      stage: nextStage,
      ...(nextStage === 'WON' ? { wonAt: opportunity.wonAt ?? new Date(), lostAt: null } : {}),
      ...(nextStage === 'LOST' ? { lostAt: opportunity.lostAt ?? new Date(), wonAt: null } : {}),
      ...(nextStage !== 'WON' && nextStage !== 'LOST' ? { wonAt: null, lostAt: null } : {}),
    },
    select: { id: true, stage: true },
  })

  const detailParts = [
    `Automático por ${describeAutomationTrigger(args.trigger)}`,
    opportunity.cotizacion?.numero ? `Cotización ${opportunity.cotizacion.numero}` : '',
    normalizeString(args.details),
  ].filter(Boolean)

  await args.client.crmActivity.create({
    data: {
      empresaId: args.empresaId,
      sedeId: opportunity.sedeId,
      type: 'STAGE_CHANGE',
      summary: `Cambio de etapa automático: ${opportunity.stage} → ${nextStage}`,
      details: detailParts.join(' · ') || null,
      opportunityId: opportunity.id,
      leadId: opportunity.leadId,
      clienteId: opportunity.clienteId,
      occurredAt: new Date(),
      createdById: args.userId,
    },
  })

  return updated
}

export function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const raw = normalizeString(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const normalized = normalizeString(value).replace(/\s/g, '').replace(/\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseOptionalInt(value: unknown): number | null | undefined {
  const parsed = parseOptionalFloat(value)
  if (parsed === undefined || parsed === null) return parsed
  return Number.isInteger(parsed) ? parsed : undefined
}

export function parseLeadStatus(value: unknown): CrmLeadStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmLeadStatus
  return CRM_LEAD_STATUSES.includes(raw) ? raw : null
}

export function parseLeadSource(value: unknown): CrmLeadSource | null {
  const raw = normalizeString(value).toUpperCase() as CrmLeadSource
  return CRM_LEAD_SOURCES.includes(raw) ? raw : null
}

export function parseOpportunityStage(value: unknown): CrmOpportunityStage | null {
  const raw = normalizeString(value).toUpperCase() as CrmOpportunityStage
  return CRM_OPPORTUNITY_STAGES.includes(raw) ? raw : null
}

export function parseActivityType(value: unknown): CrmActivityType | null {
  const raw = normalizeString(value).toUpperCase() as CrmActivityType
  return CRM_ACTIVITY_TYPES.includes(raw) ? raw : null
}

export function parseTaskStatus(value: unknown): CrmTaskStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmTaskStatus
  return CRM_TASK_STATUSES.includes(raw) ? raw : null
}

export function parseTaskPriority(value: unknown): CrmTaskPriority | null {
  const raw = normalizeString(value).toUpperCase() as CrmTaskPriority
  return CRM_TASK_PRIORITIES.includes(raw) ? raw : null
}

export function parseChannelProvider(value: unknown): CrmChannelProvider | null {
  const raw = normalizeString(value).toUpperCase() as CrmChannelProvider
  return CRM_CHANNEL_PROVIDERS.includes(raw) ? raw : null
}

export function parseChannelConnectionStatus(value: unknown): CrmChannelConnectionStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmChannelConnectionStatus
  return CRM_CHANNEL_CONNECTION_STATUSES.includes(raw) ? raw : null
}

export function parseConversationStatus(value: unknown): CrmConversationStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmConversationStatus
  return CRM_CONVERSATION_STATUSES.includes(raw) ? raw : null
}

export function parseMessageDirection(value: unknown): CrmMessageDirection | null {
  const raw = normalizeString(value).toUpperCase() as CrmMessageDirection
  return CRM_MESSAGE_DIRECTIONS.includes(raw) ? raw : null
}

export function parseMessageType(value: unknown): CrmMessageType | null {
  const raw = normalizeString(value).toUpperCase() as CrmMessageType
  return CRM_MESSAGE_TYPES.includes(raw) ? raw : null
}

export function parseMessageStatus(value: unknown): CrmMessageStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmMessageStatus
  return CRM_MESSAGE_STATUSES.includes(raw) ? raw : null
}

export function parseLeadCaptureType(value: unknown): CrmLeadCaptureType | null {
  const raw = normalizeString(value).toUpperCase() as CrmLeadCaptureType
  return CRM_LEAD_CAPTURE_TYPES.includes(raw) ? raw : null
}

export function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => normalizeString(item)).filter(Boolean)))
}

export async function assertCrmSedeAccess(args: {
  sedeId: string
  empresaId: string
  userId: string
  minLevel: AccessLevel
}) {
  const sede = await prisma.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) {
    return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
  }

  try {
    await requireSedeAccess({ userId: args.userId, sedeId: sede.id, module: ModuleKey.CRM, minLevel: args.minLevel })
    return null
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    throw error
  }
}