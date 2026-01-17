import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { BillingCycle as PrismaBillingCycle, ModuleKey, PlanTier as PrismaPlanTier } from '@prisma/client'
import { createBoldPaymentLink } from '@/lib/bold'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { ANNUAL_DISCOUNT_PCT, type BillingCycle, getPlanPriceCOP, type PlanTier } from '@/lib/plans'

export const runtime = 'nodejs'

type Body = {
  tier: PlanTier
  cycle: BillingCycle
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'YEARLY'
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Partial<Body> | null
    if (!body || !isPlanTier(body.tier) || !isBillingCycle(body.cycle)) {
      return NextResponse.json({ ok: false, error: 'Body inválido. Esperado: { tier, cycle }' }, { status: 400 })
    }

    const userId = access.userId
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true, email: true } })

    let empresaId = user?.empresaId ?? null
    if (!empresaId) {
      const empresa = await getOrCreateDefaultEmpresa()
      await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } })
      empresaId = empresa.id
    }

    const tier = body.tier
    const cycle = body.cycle

    const amountCOP = getPlanPriceCOP(tier, cycle)
    const discountPct = cycle === 'YEARLY' ? ANNUAL_DISCOUNT_PCT : 0

    const ts = Date.now()
    const reference = `PLAN-${empresaId.slice(0, 8)}-${tier}-${cycle}-${ts}`.slice(0, 60)

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const expirationNanoseconds = Math.floor(expiresAt.getTime() * 1e6)

    const callbackBase = process.env.APP_URL
    const callbackUrl = callbackBase ? `${callbackBase.replace(/\/$/, '')}/dashboard/configuracion/plan?ref=${encodeURIComponent(reference)}` : undefined

    const { paymentLinkId, url } = await createBoldPaymentLink({
      reference,
      amountCOP,
      description: `SGDigital - Plan ${tier} (${cycle === 'YEARLY' ? 'Anual' : 'Mensual'})`,
      payerEmail: user?.email ?? undefined,
      callbackUrl,
      expirationNanoseconds,
    })

    await prisma.billingInvoice.create({
      data: {
        empresaId,
        provider: 'BOLD',
        status: 'PENDING',
        planTier: tier as PrismaPlanTier,
        billingCycle: cycle as PrismaBillingCycle,
        currency: 'COP',
        amountCOP,
        discountPct,
        externalReference: reference,
        boldPaymentLinkId: paymentLinkId,
        boldCheckoutUrl: url,
        expiresAt,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, provider: 'BOLD', reference, paymentLinkId, url })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 })
  }
}
