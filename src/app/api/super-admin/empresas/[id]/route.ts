import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      workspaceCode: true,
      nombre: true,
      nit: true,
      direccion: true,
      telefono: true,
      email: true,
      logo: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
      stripeCancelAtPeriodEnd: true,
      createdAt: true,
      updatedAt: true,
      registrationCodeHash: true,
      billingInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          provider: true,
          status: true,
          amountCOP: true,
          currency: true,
          planTier: true,
          billingCycle: true,
          paidAt: true,
          expiresAt: true,
          externalReference: true,
          boldPaymentLinkId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!empresa?.id) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const workspaceCode = empresa.workspaceCode || (await ensureWorkspaceCodeForEmpresa(empresa.id))

  return NextResponse.json({
    ok: true,
    empresa: {
      ...empresa,
      workspaceCode,
      hasCompanyCode: Boolean(empresa.registrationCodeHash),
    },
  })
}
