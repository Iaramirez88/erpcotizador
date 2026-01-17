import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultPlanTier, PLANES } from '@/lib/plans'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user.id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { empresaId: true },
  })

  const empresa = user?.empresaId
    ? await prisma.empresa.findUnique({
        where: { id: user.empresaId },
        select: { planTier: true, billingCycle: true, planValidUntil: true },
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

  const tier = empresa?.planTier ?? null

  const resolvedTier = (tier ?? getDefaultPlanTier()) as string
  const plan = PLANES.find((p) => p.tier === resolvedTier) ?? PLANES[PLANES.length - 1]

  return NextResponse.json({
    ok: true,
    current: plan,
    empresa: empresa
      ? {
          planTier: empresa.planTier,
          billingCycle: empresa.billingCycle,
          planValidUntil: empresa.planValidUntil ? empresa.planValidUntil.toISOString() : null,
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
}
