import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BillingCycle as PrismaBillingCycle, PlanTier as PrismaPlanTier } from '@prisma/client'
import { auth } from '@/lib/auth'
import { createBoldPaymentLink } from '@/lib/bold'
import { ANNUAL_DISCOUNT_PCT, type BillingCycle, getPlanPriceCOP, type PlanTier } from '@/lib/plans'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ensurePlanOwnerUserIdForEmpresa } from '@/lib/plan-owner'
import { isSuperAdminEmail } from '@/lib/super-admin'

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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    const userId = await resolveUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Sesión inválida. Vuelve a iniciar sesión.' }, { status: 401 })
    }

    if (!process.env.BOLD_API_KEY && !process.env.BOLD_IDENTITY_KEY) {
      return NextResponse.json(
        { ok: false, error: 'BOLD_API_KEY (o BOLD_IDENTITY_KEY) no configurada en el servidor.' },
        { status: 503 }
      )
    }

    const body = (await request.json().catch(() => null)) as Partial<Body> | null
    if (!body || !isPlanTier(body.tier) || !isBillingCycle(body.cycle)) {
      return NextResponse.json({ ok: false, error: 'Body inválido. Esperado: { tier, cycle }' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, empresaId: true },
    })

    const empresaId = user?.empresaId
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada para el usuario.' }, { status: 400 })
    }

    const isSystemSuperAdmin = isSuperAdminEmail(user?.email)
    if (!isSystemSuperAdmin) {
      const ownerUserId = await ensurePlanOwnerUserIdForEmpresa(empresaId)
      if (!ownerUserId || ownerUserId !== userId) {
        return NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 })
      }
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
    const message = e instanceof Error ? e.message : 'Error inesperado'
    const status = /no configurad/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
