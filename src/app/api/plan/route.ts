import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultPlanTier, PLANES } from '@/lib/plans'
import { resolvePaywallState } from '@/lib/plan-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const userId = session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true },
    })

    const empresa = user?.empresaId
      ? await prisma.empresa.findUnique({
          where: { id: user.empresaId },
          select: {
            nit: true,
            registrationCodeHash: true,
            planTier: true,
            billingCycle: true,
            planValidUntil: true,
            trialTier: true,
            trialStartedAt: true,
            trialValidUntil: true,
          },
        })
      : null

    const lastInvoice = user?.empresaId
      ? await prisma.billingInvoice.findFirst({
          where: { empresaId: user.empresaId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            provider: true,
            status: true,
            planTier: true,
            billingCycle: true,
            currency: true,
            amountCOP: true,
            discountPct: true,
            externalReference: true,
            boldCheckoutUrl: true,
            expiresAt: true,
            paidAt: true,
            createdAt: true,
          },
        })
      : null

    const paywall = empresa ? resolvePaywallState(empresa, new Date()) : null

    const resolvedTier = (paywall?.effectiveTier ?? empresa?.planTier ?? getDefaultPlanTier()) as string
    const plan = PLANES.find((p) => p.tier === resolvedTier) ?? PLANES[PLANES.length - 1]

    return NextResponse.json({
      ok: true,
      current: plan,
      effective: paywall
        ? {
            planTier: paywall.effectiveTier,
            paywall: {
              show: paywall.show,
              blocking: paywall.blocking,
              reason: paywall.reason,
            },
            trial: {
              tier: paywall.trial.tier,
              startedAt: paywall.trial.startedAt ? paywall.trial.startedAt.toISOString() : null,
              validUntil: paywall.trial.validUntil ? paywall.trial.validUntil.toISOString() : null,
              isActive: paywall.trial.isActive,
              isExpired: paywall.trial.isExpired,
              daysLeft: paywall.trial.daysLeft,
            },
          }
        : null,
      empresa: empresa
        ? {
            planTier: empresa.planTier,
            billingCycle: empresa.billingCycle,
            planValidUntil: empresa.planValidUntil ? empresa.planValidUntil.toISOString() : null,
            trialTier: empresa.trialTier,
            trialStartedAt: empresa.trialStartedAt ? empresa.trialStartedAt.toISOString() : null,
            trialValidUntil: empresa.trialValidUntil ? empresa.trialValidUntil.toISOString() : null,
          }
        : null,
      lastInvoice: lastInvoice
        ? {
            id: lastInvoice.id,
            provider: lastInvoice.provider,
            status: lastInvoice.status,
            planTier: lastInvoice.planTier,
            billingCycle: lastInvoice.billingCycle,
            currency: lastInvoice.currency,
            amountCOP: lastInvoice.amountCOP,
            discountPct: lastInvoice.discountPct,
            externalReference: lastInvoice.externalReference,
            checkoutUrl: lastInvoice.boldCheckoutUrl,
            expiresAt: lastInvoice.expiresAt ? lastInvoice.expiresAt.toISOString() : null,
            paidAt: lastInvoice.paidAt ? lastInvoice.paidAt.toISOString() : null,
            createdAt: lastInvoice.createdAt.toISOString(),
          }
        : null,
      all: PLANES,
      devDefault: getDefaultPlanTier(),
    })
  } catch (error: unknown) {
    console.error('GET /api/plan error:', error)
    const msg = error instanceof Error ? error.message : 'Error inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
