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

export async function GET(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const search = (req.nextUrl.searchParams.get('search') ?? '').trim()

  const empresas = await prisma.empresa.findMany({
    where: search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' } },
            { nit: { contains: search, mode: 'insensitive' } },
            { id: { contains: search, mode: 'insensitive' } },
            { workspaceCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      workspaceCode: true,
      nombre: true,
      nit: true,
      email: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
      createdAt: true,
      updatedAt: true,
      registrationCodeHash: true,
      billingInvoices: {
        where: { paidAt: { not: null } },
        orderBy: { paidAt: 'desc' },
        take: 1,
        select: { paidAt: true, amountCOP: true, status: true },
      },
    },
  })

  return NextResponse.json({
    ok: true,
    items: await Promise.all(
      empresas.map(async (e) => ({
      id: e.id,
      workspaceCode: e.workspaceCode || (await ensureWorkspaceCodeForEmpresa(e.id)),
      nombre: e.nombre,
      nit: e.nit,
      email: e.email,
      planTier: e.planTier,
      billingCycle: e.billingCycle,
      planValidUntil: e.planValidUntil,
      stripeSubscriptionStatus: e.stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: e.stripeCurrentPeriodEnd,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      hasCompanyCode: Boolean(e.registrationCodeHash),
      lastPaid: e.billingInvoices?.[0] ?? null,
      }))
    ),
  })
}
