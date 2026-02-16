import type { PlanTier } from '@prisma/client'

export type EmpresaPlanContext = {
  nit: string
  registrationCodeHash: string | null
  planTier: PlanTier
  planValidUntil: Date | null
  trialTier: PlanTier | null
  trialStartedAt: Date | null
  trialValidUntil: Date | null
}

type TrialState = {
  tier: PlanTier | null
  startedAt: Date | null
  validUntil: Date | null
  isActive: boolean
  isExpired: boolean
  daysLeft: number | null
}

export type PaywallState = {
  show: boolean
  blocking: boolean
  reason: 'NONE' | 'PERSONAL_NO_PLAN' | 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED'
  effectiveTier: PlanTier
  trial: TrialState
}

const DAY_MS = 24 * 60 * 60 * 1000

function isPersonalEmpresa(empresa: Pick<EmpresaPlanContext, 'nit'>): boolean {
  return (empresa.nit ?? '').startsWith('PERS-')
}

function hasEmpresaAccessCode(empresa: Pick<EmpresaPlanContext, 'registrationCodeHash'>): boolean {
  return Boolean(empresa.registrationCodeHash)
}

function getTrialState(empresa: EmpresaPlanContext, now: Date): TrialState {
  const validUntil = empresa.trialValidUntil
  const startedAt = empresa.trialStartedAt
  const tier = empresa.trialTier

  const isActive = Boolean(validUntil && tier && validUntil > now)
  const isExpired = Boolean(validUntil && validUntil <= now)

  const daysLeft = isActive && validUntil
    ? Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / DAY_MS))
    : null

  return {
    tier: tier ?? null,
    startedAt: startedAt ?? null,
    validUntil: validUntil ?? null,
    isActive,
    isExpired,
    daysLeft,
  }
}

function isPaidActive(empresa: Pick<EmpresaPlanContext, 'planValidUntil'>, now: Date): boolean {
  return Boolean(empresa.planValidUntil && empresa.planValidUntil > now)
}

export function resolvePaywallState(empresa: EmpresaPlanContext, now: Date): PaywallState {
  const personal = isPersonalEmpresa(empresa)
  const bypass = hasEmpresaAccessCode(empresa)
  const paid = isPaidActive(empresa, now)
  const trial = getTrialState(empresa, now)

  // Bypass por código de empresa (o empresas no-personales): no mostramos modal.
  if (!personal || bypass || paid) {
    return {
      show: false,
      blocking: false,
      reason: 'NONE',
      effectiveTier: paid ? empresa.planTier : empresa.planTier,
      trial,
    }
  }

  if (trial.isActive && trial.tier) {
    return {
      show: true,
      blocking: false,
      reason: 'TRIAL_ACTIVE',
      effectiveTier: trial.tier,
      trial,
    }
  }

  if (trial.isExpired) {
    return {
      show: true,
      blocking: true,
      reason: 'TRIAL_EXPIRED',
      effectiveTier: 'BASIC',
      trial,
    }
  }

  // Personal sin plan y sin trial iniciada.
  return {
    show: true,
    blocking: false,
    reason: 'PERSONAL_NO_PLAN',
    effectiveTier: 'BASIC',
    trial,
  }
}

export function resolveEffectivePlanTier(empresa: EmpresaPlanContext, now: Date): PlanTier {
  const state = resolvePaywallState(empresa, now)
  return state.effectiveTier
}
