import { prisma } from '@/lib/prisma'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function parsePositiveInteger(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export type OutboundMessagingLimitConfig = {
  perChannelDaily: number | null
  perChannelMonthly: number | null
  perEmpresaDaily: number | null
  perEmpresaMonthly: number | null
}

export type OutboundMessagingUsageSnapshot = {
  perChannelDaily: number
  perChannelMonthly: number
  perEmpresaDaily: number
  perEmpresaMonthly: number
}

export type OutboundMessagingLimitViolation = {
  scope: 'CHANNEL' | 'EMPRESA'
  window: 'DAILY' | 'MONTHLY'
  limit: number
  used: number
}

export type OutboundMessagingUsageMeter = {
  key: 'perChannelDaily' | 'perChannelMonthly' | 'perEmpresaDaily' | 'perEmpresaMonthly'
  label: string
  limit: number
  used: number
  percentage: number
}

export function getOutboundMessagingLimitConfig(settingsJson: unknown): OutboundMessagingLimitConfig {
  const settings = asRecord(settingsJson)
  return {
    perChannelDaily: parsePositiveInteger(settings?.outboundLimitPerChannelDay),
    perChannelMonthly: parsePositiveInteger(settings?.outboundLimitPerChannelMonth),
    perEmpresaDaily: parsePositiveInteger(settings?.outboundLimitPerEmpresaDay),
    perEmpresaMonthly: parsePositiveInteger(settings?.outboundLimitPerEmpresaMonth),
  }
}

export function hasOutboundMessagingLimits(config: OutboundMessagingLimitConfig) {
  return Boolean(config.perChannelDaily || config.perChannelMonthly || config.perEmpresaDaily || config.perEmpresaMonthly)
}

export async function getOutboundMessagingUsageSnapshot(args: {
  empresaId: string
  channelConnectionId: string
  occurredAt?: Date
}) {
  const now = args.occurredAt ?? new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [perChannelDaily, perChannelMonthly, perEmpresaDaily, perEmpresaMonthly] = await Promise.all([
    prisma.crmMessage.count({
      where: {
        empresaId: args.empresaId,
        direction: 'OUTBOUND',
        providerMessageId: { not: null },
        occurredAt: { gte: startOfDay },
        conversation: { channelConnectionId: args.channelConnectionId },
      },
    }),
    prisma.crmMessage.count({
      where: {
        empresaId: args.empresaId,
        direction: 'OUTBOUND',
        providerMessageId: { not: null },
        occurredAt: { gte: startOfMonth },
        conversation: { channelConnectionId: args.channelConnectionId },
      },
    }),
    prisma.crmMessage.count({
      where: {
        empresaId: args.empresaId,
        direction: 'OUTBOUND',
        providerMessageId: { not: null },
        occurredAt: { gte: startOfDay },
      },
    }),
    prisma.crmMessage.count({
      where: {
        empresaId: args.empresaId,
        direction: 'OUTBOUND',
        providerMessageId: { not: null },
        occurredAt: { gte: startOfMonth },
      },
    }),
  ])

  return {
    perChannelDaily,
    perChannelMonthly,
    perEmpresaDaily,
    perEmpresaMonthly,
  } satisfies OutboundMessagingUsageSnapshot
}

export function findOutboundMessagingLimitViolation(config: OutboundMessagingLimitConfig, usage: OutboundMessagingUsageSnapshot): OutboundMessagingLimitViolation | null {
  if (config.perChannelDaily && usage.perChannelDaily >= config.perChannelDaily) {
    return { scope: 'CHANNEL', window: 'DAILY', limit: config.perChannelDaily, used: usage.perChannelDaily }
  }
  if (config.perChannelMonthly && usage.perChannelMonthly >= config.perChannelMonthly) {
    return { scope: 'CHANNEL', window: 'MONTHLY', limit: config.perChannelMonthly, used: usage.perChannelMonthly }
  }
  if (config.perEmpresaDaily && usage.perEmpresaDaily >= config.perEmpresaDaily) {
    return { scope: 'EMPRESA', window: 'DAILY', limit: config.perEmpresaDaily, used: usage.perEmpresaDaily }
  }
  if (config.perEmpresaMonthly && usage.perEmpresaMonthly >= config.perEmpresaMonthly) {
    return { scope: 'EMPRESA', window: 'MONTHLY', limit: config.perEmpresaMonthly, used: usage.perEmpresaMonthly }
  }
  return null
}

export function formatOutboundMessagingLimitViolation(violation: OutboundMessagingLimitViolation) {
  const scope = violation.scope === 'CHANNEL' ? 'del canal' : 'de la empresa'
  const window = violation.window === 'DAILY' ? 'diario' : 'mensual'
  return `Se alcanzó el límite ${window} ${scope} de ${violation.limit} mensajes salientes con costo.`
}

export function buildOutboundMessagingUsageMeters(config: OutboundMessagingLimitConfig, usage: OutboundMessagingUsageSnapshot) {
  const meters: OutboundMessagingUsageMeter[] = []

  if (config.perChannelDaily) {
    meters.push({
      key: 'perChannelDaily',
      label: 'Canal diario',
      limit: config.perChannelDaily,
      used: usage.perChannelDaily,
      percentage: Math.min(100, Math.round((usage.perChannelDaily / config.perChannelDaily) * 100)),
    })
  }

  if (config.perChannelMonthly) {
    meters.push({
      key: 'perChannelMonthly',
      label: 'Canal mensual',
      limit: config.perChannelMonthly,
      used: usage.perChannelMonthly,
      percentage: Math.min(100, Math.round((usage.perChannelMonthly / config.perChannelMonthly) * 100)),
    })
  }

  if (config.perEmpresaDaily) {
    meters.push({
      key: 'perEmpresaDaily',
      label: 'Empresa diario',
      limit: config.perEmpresaDaily,
      used: usage.perEmpresaDaily,
      percentage: Math.min(100, Math.round((usage.perEmpresaDaily / config.perEmpresaDaily) * 100)),
    })
  }

  if (config.perEmpresaMonthly) {
    meters.push({
      key: 'perEmpresaMonthly',
      label: 'Empresa mensual',
      limit: config.perEmpresaMonthly,
      used: usage.perEmpresaMonthly,
      percentage: Math.min(100, Math.round((usage.perEmpresaMonthly / config.perEmpresaMonthly) * 100)),
    })
  }

  return meters
}