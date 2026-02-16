import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { resolvePaywallState } from '@/lib/plan-access'

export const runtime = 'nodejs'

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const now = new Date()
  const empresaId = await requireEmpresaIdForUser(session.user.id)

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nit: true,
      registrationCodeHash: true,
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  if (!empresa) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const isPersonal = (empresa.nit ?? '').startsWith('PERS-')
  if (!isPersonal) return NextResponse.json({ ok: false, error: 'Trial no disponible' }, { status: 403 })

  if (empresa.registrationCodeHash) {
    return NextResponse.json({ ok: false, error: 'Trial no disponible' }, { status: 403 })
  }

  if (empresa.planValidUntil && empresa.planValidUntil > now) {
    return NextResponse.json({ ok: false, error: 'Ya tienes un plan vigente' }, { status: 400 })
  }

  if (empresa.trialStartedAt) {
    return NextResponse.json({ ok: false, error: 'El trial ya fue usado' }, { status: 400 })
  }

  const updated = await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      trialTier: 'INTERMEDIO',
      trialStartedAt: now,
      trialValidUntil: addDays(now, 7),
    },
    select: {
      nit: true,
      registrationCodeHash: true,
      planTier: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  const state = resolvePaywallState(updated, now)

  return NextResponse.json({
    ok: true,
    effectiveTier: state.effectiveTier,
    paywall: {
      show: state.show,
      blocking: state.blocking,
      reason: state.reason,
    },
    trial: {
      tier: state.trial.tier,
      startedAt: state.trial.startedAt ? state.trial.startedAt.toISOString() : null,
      validUntil: state.trial.validUntil ? state.trial.validUntil.toISOString() : null,
      isActive: state.trial.isActive,
      isExpired: state.trial.isExpired,
      daysLeft: state.trial.daysLeft,
    },
  })
}
