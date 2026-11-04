import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { BillingCycle, PlanTier } from '@prisma/client'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'
import { validatePassword } from '@/lib/password-policy'
import { ensureDefaultSedeForEmpresa } from '@/lib/rbac'
import { provisionDefaultAdminAccessForNewUser, syncEnabledVerticalGrantsForUser } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { id?: string; role?: string; email?: string | null } } | null) {
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
  return value === 'CRM' || value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
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
  /** Usuario administrador opcional: alta de cliente completa en un solo paso. */
  adminUser?: unknown
}

type AdminUserInput = { name: string | null; email: string; password: string }

function parseAdminUser(value: unknown): AdminUserInput | 'invalid' | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return 'invalid'
  const record = value as Record<string, unknown>
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : ''
  const password = typeof record.password === 'string' ? record.password : ''
  const name = normalizeNullableString(record.name)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return 'invalid'
  return { name, email, password }
}

function lastDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
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
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      workspaceCode: true,
      planOwnerUserId: true,
      nombre: true,
      nit: true,
      direccion: true,
      telefono: true,
      whatsapp: true,
      email: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
      createdAt: true,
      updatedAt: true,
      registrationCodeHash: true,
      billingInvoices: {
        where: { paidAt: { not: null } },
        orderBy: { paidAt: 'desc' },
        take: 1,
        select: { paidAt: true, amountCOP: true, status: true, paymentMethod: true },
      },
    },
  })

  const ownerIds = empresas
    .map((empresa) => empresa.planOwnerUserId)
    .filter((value): value is string => Boolean(value))

  const ownerEmailById = new Map<string, string>()
  if (ownerIds.length) {
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, email: true },
    })
    for (const owner of owners) {
      if (owner.email) ownerEmailById.set(owner.id, owner.email)
    }
  }

  const recentThreshold = lastDays(new Date(), 7)

  return NextResponse.json({
    ok: true,
    items: await Promise.all(
      empresas.map(async (e) => ({
      id: e.id,
      workspaceCode: e.workspaceCode || (await ensureWorkspaceCodeForEmpresa(e.id)),
      nombre: e.nombre,
      nit: e.nit,
      email: e.email,
      planOwnerEmail: e.planOwnerUserId ? ownerEmailById.get(e.planOwnerUserId) ?? null : null,
      planTier: e.planTier,
      billingCycle: e.billingCycle,
      planValidUntil: e.planValidUntil,
      trialTier: e.trialTier,
      trialStartedAt: e.trialStartedAt,
      trialValidUntil: e.trialValidUntil,
      isNew: e.createdAt >= recentThreshold,
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

  const parsedAdminUser = parseAdminUser(body.adminUser)
  if (parsedAdminUser === 'invalid') {
    return NextResponse.json({ ok: false, error: 'Datos del usuario administrador inválidos.' }, { status: 400 })
  }

  if (parsedAdminUser) {
    const passwordError = validatePassword(parsedAdminUser.password)
    if (passwordError) {
      return NextResponse.json({ ok: false, error: passwordError }, { status: 400 })
    }

    const duplicatedEmail = await prisma.user.findUnique({
      where: { email: parsedAdminUser.email },
      select: { id: true },
    })
    if (duplicatedEmail) {
      return NextResponse.json({ ok: false, error: 'Ese email ya está registrado' }, { status: 409 })
    }
  }

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

    let adminUserEmail: string | null = null
    if (parsedAdminUser) {
      const hashedPassword = await bcrypt.hash(parsedAdminUser.password, 12)
      let createdUserId: string | null = null

      try {
        const adminUser = await prisma.user.create({
          data: {
            name: parsedAdminUser.name ?? nombre,
            email: parsedAdminUser.email,
            password: hashedPassword,
            role: 'ADMIN',
            empresaId: created.id,
            // Alta hecha por super admin: no requiere verificación de correo.
            emailVerified: new Date(),
          },
          select: { id: true, email: true },
        })
        createdUserId = adminUser.id

        await ensureDefaultSedeForEmpresa(created.id, adminUser.id)
        await prisma.empresa.updateMany({
          where: { id: created.id, planOwnerUserId: null },
          data: { planOwnerUserId: adminUser.id },
        })

        await provisionDefaultAdminAccessForNewUser({
          empresaId: created.id,
          userId: adminUser.id,
          grantedByUserId: session.user?.id ?? null,
        })
        await syncEnabledVerticalGrantsForUser({
          empresaId: created.id,
          userId: adminUser.id,
          grantedByUserId: session.user?.id ?? null,
        })

        adminUserEmail = adminUser.email
      } catch (adminError) {
        if (createdUserId) {
          await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => null)
        }
        console.error('Error creando el usuario administrador de la empresa:', adminError)
        return NextResponse.json(
          {
            ok: false,
            error:
              'La empresa se creó, pero no se pudo crear el usuario administrador. Créalo desde la pestaña “Usuarios y permisos”.',
            empresaId: created.id,
            workspaceCode,
          },
          { status: 500 }
        )
      }
    }

    if (planOwnerEmail) {
      const owner = await prisma.user.findUnique({ where: { email: planOwnerEmail }, select: { id: true } })
      if (owner?.id) {
        await syncEnabledVerticalGrantsForUser({
          empresaId: created.id,
          userId: owner.id,
          grantedByUserId: owner.id,
        })
      }
    }

    return NextResponse.json({ ok: true, empresaId: created.id, workspaceCode, adminUserEmail })
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
