import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { getOutboundMessagingLimitConfig, getOutboundMessagingUsageSnapshot } from '@/lib/crm-channel-limits'

/**
 * Control centralizado de consumo y cuotas de mensajería saliente.
 * Cuotas COMERCIALES internas de Joinclap (no son límites de Meta).
 */

export const EMPRESA_COUNTER_KEY = '__EMPRESA__'
export const EMPRESA_PROVIDER_KEY = 'AGGREGATE'

export type MessagingWindow = 'DAILY' | 'MONTHLY'
export type MessagingOveragePolicy = 'BLOCK' | 'SOFT' | 'ALLOW'

export type ResolvedMessagingQuota = {
  perChannelDaily: number | null
  perChannelMonthly: number | null
  perEmpresaDaily: number | null
  perEmpresaMonthly: number | null
  timezone: string
  warningPct: number
  criticalPct: number
  blockPct: number
  overagePolicy: MessagingOveragePolicy
}

export type MessagingUsageSnapshot = {
  perChannelDaily: number
  perChannelMonthly: number
  perEmpresaDaily: number
  perEmpresaMonthly: number
}

export type MessagingUsageMeter = {
  key: keyof MessagingUsageSnapshot
  label: string
  limit: number
  used: number
  remaining: number
  percentage: number
}

export type MessagingQuotaAlert = {
  key: keyof MessagingUsageSnapshot
  label: string
  level: 'WARNING' | 'CRITICAL' | 'BLOCKED'
  limit: number
  used: number
  percentage: number
}

export type MessagingQuotaViolation = {
  scope: 'CHANNEL' | 'EMPRESA'
  window: MessagingWindow
  limit: number
  used: number
}

const DEFAULT_QUOTA: ResolvedMessagingQuota = {
  perChannelDaily: 200,
  perChannelMonthly: 3000,
  perEmpresaDaily: 500,
  perEmpresaMonthly: 10000,
  timezone: 'America/Bogota',
  warningPct: 70,
  criticalPct: 85,
  blockPct: 100,
  overagePolicy: 'BLOCK',
}

function positiveInt(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** Clave de periodo ("YYYY-MM-DD" | "YYYY-MM") según la zona horaria. */
export function computePeriodKey(date: Date, window: MessagingWindow, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')

  return window === 'DAILY' ? `${year}-${month}-${day}` : `${year}-${month}`
}

function policySpecificity(policy: { scope: string; provider: string | null }, provider: string): number {
  let score = 0
  if (policy.scope === 'EMPRESA') score += 10
  if (policy.scope === 'CHANNEL') score += 20
  if (policy.provider && policy.provider === provider) score += 2
  return score
}

/** Resuelve la política efectiva: DB (GLOBAL -> EMPRESA -> CHANNEL) -> settingsJson legacy -> defaults. */
export async function resolveMessagingQuota(args: {
  empresaId: string
  channelConnectionId?: string | null
  provider: string
  settingsJson?: unknown
}): Promise<ResolvedMessagingQuota> {
  const legacy = getOutboundMessagingLimitConfig(args.settingsJson)

  const quota: ResolvedMessagingQuota = {
    perChannelDaily: legacy.perChannelDaily ?? DEFAULT_QUOTA.perChannelDaily,
    perChannelMonthly: legacy.perChannelMonthly ?? DEFAULT_QUOTA.perChannelMonthly,
    perEmpresaDaily: legacy.perEmpresaDaily ?? DEFAULT_QUOTA.perEmpresaDaily,
    perEmpresaMonthly: legacy.perEmpresaMonthly ?? DEFAULT_QUOTA.perEmpresaMonthly,
    timezone: DEFAULT_QUOTA.timezone,
    warningPct: DEFAULT_QUOTA.warningPct,
    criticalPct: DEFAULT_QUOTA.criticalPct,
    blockPct: DEFAULT_QUOTA.blockPct,
    overagePolicy: DEFAULT_QUOTA.overagePolicy,
  }

  const provider = normalizeString(args.provider)

  const policies = await prisma.messagingQuotaPolicy.findMany({
    where: {
      enabled: true,
      AND: [
        { OR: [{ empresaId: null }, { empresaId: args.empresaId }] },
        { OR: [{ channelConnectionId: null }, ...(args.channelConnectionId ? [{ channelConnectionId: args.channelConnectionId }] : [])] },
        { OR: [{ provider: null }, ...(provider ? [{ provider }] : [])] },
      ],
    },
  })

  policies
    .sort((a, b) => policySpecificity(a, provider) - policySpecificity(b, provider))
    .forEach((policy) => {
      if (policy.window === 'DAILY') {
        if (policy.scope === 'CHANNEL') quota.perChannelDaily = positiveInt(policy.limitValue) ?? quota.perChannelDaily
        else quota.perEmpresaDaily = positiveInt(policy.limitValue) ?? quota.perEmpresaDaily
      } else {
        if (policy.scope === 'CHANNEL') quota.perChannelMonthly = positiveInt(policy.limitValue) ?? quota.perChannelMonthly
        else quota.perEmpresaMonthly = positiveInt(policy.limitValue) ?? quota.perEmpresaMonthly
      }

      if (policy.timezone) quota.timezone = policy.timezone
      quota.warningPct = policy.warningPct
      quota.criticalPct = policy.criticalPct
      quota.blockPct = policy.blockPct
      quota.overagePolicy = (policy.overagePolicy as MessagingOveragePolicy) || quota.overagePolicy
    })

  return quota
}
/** Lee el consumo actual desde los contadores atómicos. */
export async function readUsageSnapshot(args: {
  empresaId: string
  channelConnectionId: string
  provider: string
  now?: Date
  timezone?: string
}): Promise<MessagingUsageSnapshot> {
  const now = args.now ?? new Date()
  const timezone = args.timezone || DEFAULT_QUOTA.timezone
  const provider = normalizeString(args.provider) || EMPRESA_PROVIDER_KEY
  const dailyKey = computePeriodKey(now, 'DAILY', timezone)
  const monthlyKey = computePeriodKey(now, 'MONTHLY', timezone)

  const counters = await prisma.messagingUsageCounter.findMany({
    where: {
      empresaId: args.empresaId,
      window: { in: ['DAILY', 'MONTHLY'] },
      OR: [
        { channelConnectionId: args.channelConnectionId, provider, periodKey: dailyKey },
        { channelConnectionId: args.channelConnectionId, provider, periodKey: monthlyKey },
        { channelConnectionId: EMPRESA_COUNTER_KEY, provider: EMPRESA_PROVIDER_KEY, periodKey: dailyKey },
        { channelConnectionId: EMPRESA_COUNTER_KEY, provider: EMPRESA_PROVIDER_KEY, periodKey: monthlyKey },
      ],
    },
    select: { channelConnectionId: true, provider: true, window: true, count: true },
  })

  const get = (channelConnectionId: string, window: string, prov: string) =>
    counters.find((c) => c.channelConnectionId === channelConnectionId && c.window === window && c.provider === prov)?.count ?? 0

  return {
    perChannelDaily: get(args.channelConnectionId, 'DAILY', provider),
    perChannelMonthly: get(args.channelConnectionId, 'MONTHLY', provider),
    perEmpresaDaily: get(EMPRESA_COUNTER_KEY, 'DAILY', EMPRESA_PROVIDER_KEY),
    perEmpresaMonthly: get(EMPRESA_COUNTER_KEY, 'MONTHLY', EMPRESA_PROVIDER_KEY),
  }
}

export function findViolation(quota: ResolvedMessagingQuota, usage: MessagingUsageSnapshot): MessagingQuotaViolation | null {
  if (quota.perChannelDaily && usage.perChannelDaily >= quota.perChannelDaily) {
    return { scope: 'CHANNEL', window: 'DAILY', limit: quota.perChannelDaily, used: usage.perChannelDaily }
  }
  if (quota.perChannelMonthly && usage.perChannelMonthly >= quota.perChannelMonthly) {
    return { scope: 'CHANNEL', window: 'MONTHLY', limit: quota.perChannelMonthly, used: usage.perChannelMonthly }
  }
  if (quota.perEmpresaDaily && usage.perEmpresaDaily >= quota.perEmpresaDaily) {
    return { scope: 'EMPRESA', window: 'DAILY', limit: quota.perEmpresaDaily, used: usage.perEmpresaDaily }
  }
  if (quota.perEmpresaMonthly && usage.perEmpresaMonthly >= quota.perEmpresaMonthly) {
    return { scope: 'EMPRESA', window: 'MONTHLY', limit: quota.perEmpresaMonthly, used: usage.perEmpresaMonthly }
  }
  return null
}

export function formatViolation(violation: MessagingQuotaViolation): string {
  const scope = violation.scope === 'CHANNEL' ? 'del canal' : 'de la empresa'
  const window = violation.window === 'DAILY' ? 'diario' : 'mensual'
  return `Se alcanzó el límite ${window} ${scope} de ${violation.limit} mensajes salientes.`
}

/** Medidores para la UI (barras de consumo). */
export function buildUsageMeters(quota: ResolvedMessagingQuota, usage: MessagingUsageSnapshot): MessagingUsageMeter[] {
  const meters: MessagingUsageMeter[] = []

  const push = (key: keyof MessagingUsageSnapshot, label: string, limit: number | null) => {
    if (!limit) return
    const used = usage[key]
    meters.push({
      key,
      label,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      percentage: Math.min(100, Math.round((used / limit) * 100)),
    })
  }

  push('perChannelDaily', 'Canal · diario', quota.perChannelDaily)
  push('perChannelMonthly', 'Canal · mensual', quota.perChannelMonthly)
  push('perEmpresaDaily', 'Empresa · diario', quota.perEmpresaDaily)
  push('perEmpresaMonthly', 'Empresa · mensual', quota.perEmpresaMonthly)

  return meters
}

/** Alertas en 70% / 85% / 100% (configurables). */
export function buildQuotaAlerts(quota: ResolvedMessagingQuota, usage: MessagingUsageSnapshot): MessagingQuotaAlert[] {
  return buildUsageMeters(quota, usage)
    .map((meter) => {
      let level: MessagingQuotaAlert['level'] | null = null
      if (meter.percentage >= quota.blockPct) level = 'BLOCKED'
      else if (meter.percentage >= quota.criticalPct) level = 'CRITICAL'
      else if (meter.percentage >= quota.warningPct) level = 'WARNING'
      return level ? { key: meter.key, label: meter.label, level, limit: meter.limit, used: meter.used, percentage: meter.percentage } : null
    })
    .filter((item): item is MessagingQuotaAlert => item !== null)
}

type CounterSlot = {
  key: keyof MessagingUsageSnapshot
  channelConnectionId: string
  provider: string
  window: MessagingWindow
  periodKey: string
}

function buildCounterSlots(args: { channelConnectionId: string; provider: string; now: Date; timezone: string }): CounterSlot[] {
  const provider = normalizeString(args.provider)
  const dailyKey = computePeriodKey(args.now, 'DAILY', args.timezone)
  const monthlyKey = computePeriodKey(args.now, 'MONTHLY', args.timezone)

  return [
    { key: 'perChannelDaily', channelConnectionId: args.channelConnectionId, provider, window: 'DAILY', periodKey: dailyKey },
    { key: 'perChannelMonthly', channelConnectionId: args.channelConnectionId, provider, window: 'MONTHLY', periodKey: monthlyKey },
    { key: 'perEmpresaDaily', channelConnectionId: EMPRESA_COUNTER_KEY, provider: EMPRESA_PROVIDER_KEY, window: 'DAILY', periodKey: dailyKey },
    { key: 'perEmpresaMonthly', channelConnectionId: EMPRESA_COUNTER_KEY, provider: EMPRESA_PROVIDER_KEY, window: 'MONTHLY', periodKey: monthlyKey },
  ]
}
/**
 * Reserva atómica de un envío saliente. Bloquea las filas del contador con
 * `FOR UPDATE` para que envíos simultáneos no superen el límite.
 */
export async function checkOutboundQuota(args: {
  empresaId: string
  channelConnectionId: string
  provider: string
  settingsJson?: unknown
  now?: Date
  client?: Prisma.TransactionClient
}): Promise<{ allowed: boolean; violation: MessagingQuotaViolation | null; usage: MessagingUsageSnapshot }> {
  const quota = await resolveMessagingQuota({
    empresaId: args.empresaId,
    channelConnectionId: args.channelConnectionId,
    provider: args.provider,
    settingsJson: args.settingsJson,
  })

  const now = args.now ?? new Date()
  const slots = buildCounterSlots({
    channelConnectionId: args.channelConnectionId,
    provider: args.provider,
    now,
    timezone: quota.timezone,
  })

  const run = async (tx: Prisma.TransactionClient) => {
    const counts: Record<CounterSlot['key'], number> = {
      perChannelDaily: 0,
      perChannelMonthly: 0,
      perEmpresaDaily: 0,
      perEmpresaMonthly: 0,
    }

    // Lock en orden consistente para evitar deadlocks.
    for (const slot of slots) {
      await tx.messagingUsageCounter.upsert({
        where: {
          usage_counter_period_key: {
            empresaId: args.empresaId,
            channelConnectionId: slot.channelConnectionId,
            provider: slot.provider,
            window: slot.window,
            periodKey: slot.periodKey,
          },
        },
        create: {
          empresaId: args.empresaId,
          channelConnectionId: slot.channelConnectionId,
          provider: slot.provider,
          window: slot.window,
          periodKey: slot.periodKey,
          count: 0,
        },
        update: {},
      })

      const locked = await tx.$queryRaw<Array<{ count: number }>>`SELECT "count" FROM "messaging_usage_counters" WHERE "empresaId" = ${args.empresaId} AND "channelConnectionId" = ${slot.channelConnectionId} AND "provider" = ${slot.provider} AND "window" = ${slot.window} AND "periodKey" = ${slot.periodKey} FOR UPDATE`
      counts[slot.key] = locked[0]?.count ?? 0
    }

    const usage: MessagingUsageSnapshot = counts
    const violation = findViolation(quota, usage)

    if (violation && quota.overagePolicy === 'BLOCK') {
      return { allowed: false, violation, usage }
    }

    for (const slot of slots) {
      await tx.messagingUsageCounter.updateMany({
        where: {
          empresaId: args.empresaId,
          channelConnectionId: slot.channelConnectionId,
          provider: slot.provider,
          window: slot.window,
          periodKey: slot.periodKey,
        },
        data: { count: { increment: 1 } },
      })
    }

    return { allowed: true, violation: null, usage }
  }

  return args.client ? run(args.client) : prisma.$transaction(run)
}

/** Libera una reserva (decrementa contadores) cuando el envío falló después de reservar. */
export async function releaseOutboundQuota(args: {
  empresaId: string
  channelConnectionId: string
  provider: string
  now?: Date
  timezone?: string
  client?: Prisma.TransactionClient
}): Promise<void> {
  const db = args.client ?? prisma
  const now = args.now ?? new Date()
  const timezone = args.timezone || DEFAULT_QUOTA.timezone
  const slots = buildCounterSlots({ channelConnectionId: args.channelConnectionId, provider: args.provider, now, timezone })

  for (const slot of slots) {
    await db.messagingUsageCounter.updateMany({
      where: {
        empresaId: args.empresaId,
        channelConnectionId: slot.channelConnectionId,
        provider: slot.provider,
        window: slot.window,
        periodKey: slot.periodKey,
        count: { gt: 0 },
      },
      data: { count: { decrement: 1 } },
    })
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/** Registra un evento de consumo (dedup por providerMessageId único). */
export async function recordOutboundUsageEvent(args: {
  empresaId: string
  channelConnectionId: string
  provider: string
  category?: string | null
  countryCode?: string | null
  status?: string
  estimatedCost?: number | null
  providerMessageId?: string | null
  messageId?: string | null
  occurredAt?: Date
  client?: Prisma.TransactionClient
}): Promise<void> {
  const db = args.client ?? prisma
  try {
    await db.messagingUsageEvent.create({
      data: {
        empresaId: args.empresaId,
        channelConnectionId: args.channelConnectionId,
        provider: normalizeString(args.provider) || 'GENERIC',
        category: normalizeString(args.category) || null,
        countryCode: normalizeString(args.countryCode) || null,
        status: normalizeString(args.status) || 'SENT',
        estimatedCost: typeof args.estimatedCost === 'number' ? args.estimatedCost : null,
        providerMessageId: normalizeString(args.providerMessageId) || null,
        messageId: normalizeString(args.messageId) || null,
        occurredAt: args.occurredAt ?? new Date(),
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return
    const message = error instanceof Error ? error.message : 'Error inesperado'
    console.warn('[messaging-quota] No se pudo registrar el evento de consumo.', { error: message })
  }
}

/** Reconciliación (solo incrementa) de contadores a partir de los mensajes ya persistidos. */
export async function reconcileUsageCounters(args: {
  empresaId: string
  channelConnectionId: string
  provider: string
  now?: Date
  timezone?: string
}): Promise<void> {
  const now = args.now ?? new Date()
  const timezone = args.timezone || DEFAULT_QUOTA.timezone

  const slots = buildCounterSlots({
    channelConnectionId: args.channelConnectionId,
    provider: args.provider,
    now,
    timezone,
  })

  const snapshot = await getOutboundMessagingUsageSnapshot({
    empresaId: args.empresaId,
    channelConnectionId: args.channelConnectionId,
    occurredAt: now,
  })

  const counts: Record<CounterSlot['key'], number> = {
    perChannelDaily: snapshot.perChannelDaily,
    perChannelMonthly: snapshot.perChannelMonthly,
    perEmpresaDaily: snapshot.perEmpresaDaily,
    perEmpresaMonthly: snapshot.perEmpresaMonthly,
  }

  for (const slot of slots) {
    await prisma.$executeRaw`
      INSERT INTO "messaging_usage_counters" ("id", "empresaId", "channelConnectionId", "provider", "window", "periodKey", "count", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${args.empresaId}, ${slot.channelConnectionId}, ${slot.provider}, ${slot.window}, ${slot.periodKey}, ${counts[slot.key]}, now())
      ON CONFLICT ("empresaId", "channelConnectionId", "provider", "window", "periodKey")
      DO UPDATE SET "count" = GREATEST("messaging_usage_counters"."count", EXCLUDED."count"), "updatedAt" = now()
    `
  }
}

