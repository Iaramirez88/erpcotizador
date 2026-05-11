import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject } from '@/lib/crm-omnichannel'

export type CalendarBridgeDispatchResult = {
  channelId: string
  channelName: string
  bridgeKind: 'GOOGLE_CALENDAR' | 'MICROSOFT_365_CALENDAR'
  ok: boolean
  message: string
}

type DispatchCalendarBridgeArgs = {
  empresaId: string
  sedeId?: string | null
  eventName: 'crm.task.created' | 'crm.task.booked'
  task: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    dueAt: Date | null
    workspaceId?: string | null
    leadId?: string | null
    opportunityId?: string | null
    clienteId?: string | null
    assignedToUserId?: string | null
    createdById?: string | null
    colorHex?: string | null
  }
  lead?: {
    id: string
    nombre: string | null
    email?: string | null
    phone?: string | null
  } | null
  opportunity?: {
    id: string
    title: string | null
  } | null
  cliente?: {
    id: string
    nombre: string | null
  } | null
  meta?: Record<string, unknown>
}

const CALENDAR_BRIDGE_KINDS = new Set(['GOOGLE_CALENDAR', 'MICROSOFT_365_CALENDAR'])

function buildEndAt(dueAt: Date) {
  return new Date(dueAt.getTime() + 45 * 60 * 1000)
}

export async function dispatchCrmTaskCalendarBridges(args: DispatchCalendarBridgeArgs): Promise<CalendarBridgeDispatchResult[]> {
  if (!args.task.dueAt) return []

  const rows = await prisma.crmChannelConnection.findMany({
    where: {
      empresaId: args.empresaId,
      provider: 'WEB_FORM',
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: args.sedeId ? [{ sedeId: args.sedeId }, { sedeId: null }] : [{ sedeId: null }, {}],
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
  })

  const bridgeRows = rows
    .map((row) => ({ row, settings: parseJsonObject(row.settingsJson) }))
    .filter(({ settings }) => CALENDAR_BRIDGE_KINDS.has(normalizeString(settings.bridgeKind).toUpperCase()))

  if (!bridgeRows.length) return []

  const dueAt = args.task.dueAt
  const endsAt = buildEndAt(dueAt)

  return Promise.all(bridgeRows.map(async ({ row, settings }) => {
    const bridgeKind = normalizeString(settings.bridgeKind).toUpperCase() as 'GOOGLE_CALENDAR' | 'MICROSOFT_365_CALENDAR'
    const webhookUrl = normalizeString(settings.outgoingWebhookUrl || settings.webhookUrl)
    if (!webhookUrl) {
      return {
        channelId: row.id,
        channelName: row.name,
        bridgeKind,
        ok: false,
        message: 'No tiene webhook configurado.',
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: args.eventName,
        provider: bridgeKind,
        calendarChannelId: row.id,
        calendarChannelName: row.name,
        task: {
          ...args.task,
          dueAt: dueAt.toISOString(),
          endAt: endsAt.toISOString(),
        },
        lead: args.lead ?? null,
        opportunity: args.opportunity ?? null,
        cliente: args.cliente ?? null,
        meta: args.meta ?? {},
      }),
    })

    if (!response.ok) {
      return {
        channelId: row.id,
        channelName: row.name,
        bridgeKind,
        ok: false,
        message: `Respondio ${response.status}.`,
      }
    }

    return {
      channelId: row.id,
      channelName: row.name,
      bridgeKind,
      ok: true,
      message: 'Evento enviado al bridge de calendario.',
    }
  }))
}
