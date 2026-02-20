import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'
type BillingCycle = 'MONTHLY' | 'YEARLY'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v : null
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'YEARLY'
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function addYears(date: Date, years: number) {
  const copy = new Date(date)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

type CreateBody = {
  nombre?: unknown
  nit?: unknown
  direccion?: unknown
  telefono?: unknown
  whatsapp?: unknown
  email?: unknown
  logo?: unknown
  planTier?: unknown
  billingCycle?: unknown
  isPaid?: unknown
  planOwnerEmail?: unknown
  companyEmail?: unknown
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
      direccion: true,
      telefono: true,
      whatsapp: true,
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

export async function POST(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as CreateBody

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const nit = typeof body.nit === 'string' ? body.nit.trim() : ''
  if (!nombre || !nit) {
    return NextResponse.json({ ok: false, error: 'Nombre y NIT son requeridos.' }, { status: 400 })
  }

  const direccion = normalizeNullableString(body.direccion)
  const telefono = normalizeNullableString(body.telefono)
  const whatsapp = normalizeNullableString(body.whatsapp)
  const logo = normalizeNullableString(body.logo)

  const empresaEmail = normalizeNullableString(body.companyEmail ?? body.email)
  const planOwnerEmailRaw = normalizeNullableString(body.planOwnerEmail)
  const planOwnerEmail = planOwnerEmailRaw ? planOwnerEmailRaw.toLowerCase() : null

  const planTier = isPlanTier(body.planTier) ? body.planTier : undefined
  const billingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : undefined
  const isPaid = body.isPaid === true

  const now = new Date()
  const planValidUntil = isPaid
    ? (billingCycle ?? 'MONTHLY') === 'YEARLY'
      ? addYears(now, 1)
      : addMonths(now, 1)
    : null

  try {
    const created = await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre,
          nit,
          direccion,
          telefono,
          whatsapp,
          email: empresaEmail,
          logo,
          ...(planTier ? { planTier } : {}),
          ...(billingCycle ? { billingCycle } : {}),
          planValidUntil,
          trialTier: null,
          trialStartedAt: null,
          trialValidUntil: null,
        },
        select: { id: true },
      })

      if (planOwnerEmail) {
        const user = await tx.user.findUnique({ where: { email: planOwnerEmail }, select: { id: true, empresaId: true } })
        if (!user?.id) {
          throw new Error('PLAN_OWNER_USER_NOT_FOUND')
        }
        if (user.empresaId && user.empresaId !== empresa.id) {
          throw new Error('PLAN_OWNER_USER_ALREADY_IN_OTHER_EMPRESA')
        }

        if (!user.empresaId) {
          await tx.user.update({ where: { id: user.id }, data: { empresaId: empresa.id }, select: { id: true } })
        }

        await tx.empresa.update({ where: { id: empresa.id }, data: { planOwnerUserId: user.id }, select: { id: true } })

        await tx.userGlobalAccess.upsert({
          where: { userId: user.id },
          create: { userId: user.id, empresaId: empresa.id, level: 'ADMIN' },
          update: { empresaId: empresa.id, level: 'ADMIN' },
        })
      }

      return empresa
    })

    const workspaceCode = await ensureWorkspaceCodeForEmpresa(created.id)

    return NextResponse.json({ ok: true, empresaId: created.id, workspaceCode })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    if (message === 'PLAN_OWNER_USER_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'El usuario (email) asignado como propietario no existe. Debe registrarse primero.' },
        { status: 400 }
      )
    }
    if (message === 'PLAN_OWNER_USER_ALREADY_IN_OTHER_EMPRESA') {
      return NextResponse.json(
        { ok: false, error: 'El usuario (email) asignado ya pertenece a otra empresa.' },
        { status: 400 }
      )
    }
    if (/unique|duplicate/i.test(message)) {
      return NextResponse.json({ ok: false, error: 'NIT ya existe (duplicado).' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'No se pudo crear la empresa.' }, { status: 500 })
  }
}
