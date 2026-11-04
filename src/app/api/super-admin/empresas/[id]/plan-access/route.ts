import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import {
  appendPlanAccessHistory,
  isBillingCycleValue,
  isPlanAccessAction,
  isPlanTierValue,
  type PlanAccessAction,
} from '@/lib/company-plan-access-history'
import type { BillingCycle, PlanTier } from '@prisma/client'

export const runtime = 'nodejs'

const MAX_TRIAL_DAYS = 365
const MIN_TRIAL_DAYS = 1
const MAX_PERIODS = 36
const MIN_PERIODS = 1
const MAX_NOTE_LENGTH = 280

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return null
}

/**
 * Acepta `YYYY-MM-DD` (fin de día) o un ISO completo, igual que el PATCH de empresas.
 */
function parseValidUntil(value: unknown): Date | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'string') return 'invalid'
  const normalized = value.trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const next = new Date(`${normalized}T23:59:59`)
    return Number.isNaN(next.getTime()) ? 'invalid' : next
  }

  const next = new Date(normalized)
  return Number.isNaN(next.getTime()) ? 'invalid' : next
}

function normalizeNote(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const note = value.trim()
  if (!note) return null
  return note.slice(0, MAX_NOTE_LENGTH)
}

function isAccessActive(planValidUntil: Date | null, trialValidUntil: Date | null, now: Date): boolean {
  return Boolean((planValidUntil && planValidUntil > now) || (trialValidUntil && trialValidUntil > now))
}

type GrantTrialBody = {
  action: 'GRANT_TRIAL'
  days: number
  tier: PlanTier
  extendFromCurrent: boolean
  note: string | null
}

type GrantPlanBody = {
  action: 'GRANT_PLAN'
  tier: PlanTier
  billingCycle: BillingCycle
  periods: number | null
  validUntil: Date | null
  extendFromCurrent: boolean
  note: string | null
}

type RevokePlanBody = {
  action: 'REVOKE_PLAN'
  tier: PlanTier
  note: string | null
}

type ParseResult = { ok: true; body: GrantTrialBody | GrantPlanBody | RevokePlanBody } | { ok: false; error: string }

function parseBody(
  raw: Record<string, unknown>,
  current: { planTier: PlanTier; billingCycle: BillingCycle; trialTier: PlanTier | null },
): ParseResult {
  if (!isPlanAccessAction(raw.action)) {
    return { ok: false, error: 'Acción inválida.' }
  }

  const action: PlanAccessAction = raw.action
  const note = normalizeNote(raw.note)

  if (action === 'REVOKE_PLAN') {
    return { ok: true, body: { action, tier: current.planTier, note } }
  }

  const tier = raw.tier == null ? null : raw.tier
  if (tier != null && !isPlanTierValue(tier)) {
    return { ok: false, error: 'Plan inválido.' }
  }

  if (action === 'GRANT_TRIAL') {
    const days = parsePositiveInt(raw.days) ?? 7
    if (days < MIN_TRIAL_DAYS || days > MAX_TRIAL_DAYS) {
      return { ok: false, error: `Indica entre ${MIN_TRIAL_DAYS} y ${MAX_TRIAL_DAYS} días de prueba.` }
    }

    return {
      ok: true,
      body: {
        action,
        days,
        tier: tier ?? current.trialTier ?? current.planTier,
        extendFromCurrent: raw.extendFromCurrent === true,
        note,
      },
    }
  }

  const billingCycle = raw.billingCycle == null ? current.billingCycle : raw.billingCycle
  if (!isBillingCycleValue(billingCycle)) {
    return { ok: false, error: 'Ciclo de facturación inválido.' }
  }

  const validUntil = parseValidUntil(raw.validUntil)
  if (validUntil === 'invalid') {
    return { ok: false, error: 'Fecha de vigencia inválida.' }
  }

  const parsedPeriods = raw.periods == null ? null : parsePositiveInt(raw.periods)
  if (raw.periods != null && parsedPeriods == null) {
    return { ok: false, error: 'Número de periodos inválido.' }
  }
  if (parsedPeriods != null && (parsedPeriods < MIN_PERIODS || parsedPeriods > MAX_PERIODS)) {
    return { ok: false, error: `Indica entre ${MIN_PERIODS} y ${MAX_PERIODS} periodos.` }
  }

  return {
    ok: true,
    body: {
      action,
      tier: tier ?? current.planTier,
      billingCycle,
      periods: parsedPeriods,
      validUntil,
      extendFromCurrent: raw.extendFromCurrent !== false,
      note,
    },
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      dashboardConfig: true,
    },
  })

  if (!empresa) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const parsed = parseBody(raw, {
    planTier: empresa.planTier,
    billingCycle: empresa.billingCycle,
    trialTier: empresa.trialTier,
  })

  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })

  const now = new Date()
  const body = parsed.body
  const data: Record<string, unknown> = {}

  let nextPlanValidUntil: Date | null = empresa.planValidUntil
  let nextTrialValidUntil: Date | null = empresa.trialValidUntil
  let nextPlanTier: PlanTier = empresa.planTier

  if (body.action === 'GRANT_TRIAL') {
    const base =
      body.extendFromCurrent && empresa.trialValidUntil && empresa.trialValidUntil > now
        ? empresa.trialValidUntil
        : now

    nextTrialValidUntil = addDays(base, body.days)

    data.trialTier = body.tier
    data.trialStartedAt = empresa.trialStartedAt ?? now
    data.trialValidUntil = nextTrialValidUntil
  }

  if (body.action === 'GRANT_PLAN') {
    let planValidUntil: Date

    if (body.validUntil) {
      planValidUntil = body.validUntil
    } else {
      const base =
        body.extendFromCurrent && empresa.planValidUntil && empresa.planValidUntil > now
          ? empresa.planValidUntil
          : now
      const periods = body.periods ?? 1
      planValidUntil = body.billingCycle === 'YEARLY' ? addYears(base, periods) : addMonths(base, periods)
    }

    if (planValidUntil <= now) {
      return NextResponse.json(
        { ok: false, error: 'La fecha de vigencia debe ser posterior a hoy.' },
        { status: 400 },
      )
    }

    nextPlanValidUntil = planValidUntil
    nextTrialValidUntil = null
    nextPlanTier = body.tier

    data.planTier = body.tier
    data.billingCycle = body.billingCycle
    data.planValidUntil = planValidUntil
    data.trialTier = null
    data.trialStartedAt = null
    data.trialValidUntil = null
  }

  if (body.action === 'REVOKE_PLAN') {
    nextPlanValidUntil = null
    nextTrialValidUntil = null

    data.planValidUntil = null
    data.trialTier = null
    data.trialStartedAt = null
    data.trialValidUntil = null
  }

  data.dashboardConfig = appendPlanAccessHistory(empresa.dashboardConfig, {
    at: now.toISOString(),
    action: body.action,
    byEmail: session.user?.email ?? null,
    tier: body.action === 'GRANT_TRIAL' ? body.tier : nextPlanTier,
    billingCycle: body.action === 'GRANT_PLAN' ? body.billingCycle : null,
    days: body.action === 'GRANT_TRIAL' ? body.days : null,
    validUntil:
      body.action === 'REVOKE_PLAN'
        ? null
        : (nextPlanValidUntil ?? nextTrialValidUntil)?.toISOString() ?? null,
    note: body.note,
  })

  try {
    const updated = await prisma.empresa.update({
      where: { id: empresaId },
      data: data as never,
      select: {
        planTier: true,
        billingCycle: true,
        planValidUntil: true,
        trialTier: true,
        trialStartedAt: true,
        trialValidUntil: true,
      },
    })

    return NextResponse.json({
      ok: true,
      access: {
        planTier: updated.planTier,
        billingCycle: updated.billingCycle,
        planValidUntil: updated.planValidUntil ? updated.planValidUntil.toISOString() : null,
        trialTier: updated.trialTier,
        trialStartedAt: updated.trialStartedAt ? updated.trialStartedAt.toISOString() : null,
        trialValidUntil: updated.trialValidUntil ? updated.trialValidUntil.toISOString() : null,
        isActive: isAccessActive(updated.planValidUntil, updated.trialValidUntil, now),
      },
    })
  } catch (error) {
    console.error('No se pudo actualizar la vigencia de la empresa', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo actualizar la vigencia de la empresa.' },
      { status: 500 },
    )
  }
}
