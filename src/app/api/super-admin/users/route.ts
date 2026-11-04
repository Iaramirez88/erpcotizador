import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import type { BillingCycle, ModuleKey, PlanTier } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ALL_MODULE_KEYS, ALL_PLAN_TIERS, CORE_MODULE_KEYS } from '@/lib/plan-catalog'
import { validatePassword } from '@/lib/password-policy'
import { ensureDefaultSedeForEmpresa } from '@/lib/rbac'
import { generateWorkspaceCode } from '@/lib/workspace-code'
import { provisionDefaultAdminAccessForNewUser, syncEnabledVerticalGrantsForUser } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function asInt(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function lastDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
}

type UserSegment = 'ALL' | 'NEW' | 'TRIAL' | 'NO_COMPANY' | 'WITH_COMPANY'

function isUserSegment(value: string | null): value is UserSegment {
  return value === 'ALL' || value === 'NEW' || value === 'TRIAL' || value === 'NO_COMPANY' || value === 'WITH_COMPANY'
}

export async function GET(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, asInt(searchParams.get('page'), 1))
  const limit = Math.min(50, Math.max(1, asInt(searchParams.get('limit'), 10)))
  const search = (searchParams.get('search') ?? '').trim()
  const segment = isUserSegment(searchParams.get('segment')) ? searchParams.get('segment') : 'ALL'
  const recentThreshold = lastDays(new Date(), 7)

  const where = {
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(segment === 'NEW'
      ? { createdAt: { gte: recentThreshold } }
      : segment === 'NO_COMPANY'
        ? { empresaId: null }
        : segment === 'WITH_COMPANY'
          ? { empresaId: { not: null } }
          : segment === 'TRIAL'
            ? { empresa: { trialValidUntil: { gt: new Date() } } }
            : {}),
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        empresa: {
          select: {
            id: true,
            nombre: true,
            nit: true,
            planTier: true,
            planValidUntil: true,
            trialTier: true,
            trialValidUntil: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total,
    segment,
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      isNew: u.createdAt >= recentThreshold,
      empresa: u.empresa
        ? {
            id: u.empresa.id,
            nombre: u.empresa.nombre,
            nit: u.empresa.nit,
            planTier: u.empresa.planTier,
            planValidUntil: u.empresa.planValidUntil?.toISOString() ?? null,
            trialTier: u.empresa.trialTier,
            trialValidUntil: u.empresa.trialValidUntil?.toISOString() ?? null,
          }
        : null,
    })),
  })
}

function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === 'string' && ALL_PLAN_TIERS.includes(value as PlanTier)
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'YEARLY'
}

function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && ALL_MODULE_KEYS.includes(value as ModuleKey)
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value.trim())
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

type CreateBody = {
  name?: unknown
  email?: unknown
  password?: unknown
  empresaNombre?: unknown
  nit?: unknown
  telefono?: unknown
  /** 'PLAN' = plan con precio base + módulos incluidos; 'MODULE_ONLY' = solo se cobran los módulos asignados. */
  billingMode?: unknown
  planTier?: unknown
  billingCycle?: unknown
  planValidUntil?: unknown
  modules?: unknown
}


/**
 * Crea un acceso de administrador + su espacio de trabajo en un solo paso (solo super admin).
 *
 * El modo de facturación decide cómo nace la empresa:
 * - `MODULE_ONLY`: `moduleOnlyBilling = true`, sin plan base; solo quedan habilitados los módulos
 *   seleccionados (más los módulos base no facturables).
 * - `PLAN`: hereda los módulos del plan efectivo; los módulos enviados se guardan como extras.
 */
export async function POST(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as CreateBody

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const rawPassword = typeof body.password === 'string' ? body.password : ''
  const empresaNombre = normalizeNullableString(body.empresaNombre)
  const nit = normalizeNullableString(body.nit)
  const name = normalizeNullableString(body.name)
  const telefono = normalizeNullableString(body.telefono)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Indica un email válido' }, { status: 400 })
  }

  if (!empresaNombre) {
    return NextResponse.json({ ok: false, error: 'El nombre de la empresa es requerido' }, { status: 400 })
  }

  if (!nit) {
    return NextResponse.json({ ok: false, error: 'El NIT de la empresa es requerido' }, { status: 400 })
  }

  const passwordError = validatePassword(rawPassword)
  if (passwordError) {
    return NextResponse.json({ ok: false, error: passwordError }, { status: 400 })
  }

  const billingMode = body.billingMode === 'MODULE_ONLY' ? 'MODULE_ONLY' : 'PLAN'
  const planTier: PlanTier = isPlanTier(body.planTier) ? body.planTier : 'FULL'
  const billingCycle: BillingCycle = isBillingCycle(body.billingCycle) ? body.billingCycle : 'MONTHLY'
  const planValidUntil = billingMode === 'PLAN' ? parseOptionalDate(body.planValidUntil) : null

  // Los módulos base no se venden: siguen activos salvo que se apaguen explícitamente.
  const requestedModules = Array.isArray(body.modules) ? body.modules.filter(isModuleKey) : []
  const billableModules = Array.from(
    new Set(requestedModules.filter((module) => !CORE_MODULE_KEYS.includes(module)))
  )

  const [existingUser, existingNit] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.empresa.findUnique({ where: { nit }, select: { id: true } }),
  ])

  if (existingUser) {
    return NextResponse.json({ ok: false, error: 'Ese email ya está registrado' }, { status: 409 })
  }

  if (existingNit) {
    return NextResponse.json({ ok: false, error: 'Ese NIT ya está registrado' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(rawPassword, 12)
  const now = new Date()
  let empresaId: string | null = null


  try {
    const empresa = await prisma.empresa.create({
      data: {
        nombre: empresaNombre,
        nit,
        email,
        telefono,
        workspaceCode: generateWorkspaceCode(),
        registrationCodeHash: null,
        // El cliente creado por ventas completa su configuración en el onboarding.
        onboardingStatus: 'PENDING',
        onboardingData: {},
        dashboardConfig: {},
        planTier,
        billingCycle,
        moduleOnlyBilling: billingMode === 'MODULE_ONLY',
        planValidUntil,
      },
      select: { id: true, nombre: true, nit: true, workspaceCode: true },
    })
    empresaId = empresa.id

    const user = await prisma.user.create({
      data: {
        name: name ?? empresaNombre,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        empresaId: empresa.id,
        // Alta hecha por super admin: no requiere verificación de correo.
        emailVerified: now,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { planOwnerUserId: user.id },
      select: { id: true },
    })

    await ensureDefaultSedeForEmpresa(empresa.id, user.id)

    if (billableModules.length) {
      await prisma.$transaction(
        billableModules.map((module) =>
          prisma.empresaModuleOverride.upsert({
            where: { empresaId_module: { empresaId: empresa.id, module } },
            create: { empresaId: empresa.id, module, enabled: true },
            update: { enabled: true },
          })
        )
      )
    }

    // Se ejecuta después de aplicar los módulos: provisiona accesos con los módulos vigentes.
    const enabledModules = await provisionDefaultAdminAccessForNewUser({
      empresaId: empresa.id,
      userId: user.id,
      grantedByUserId: user.id,
    })

    await syncEnabledVerticalGrantsForUser({
      empresaId: empresa.id,
      userId: user.id,
      grantedByUserId: user.id,
    })

    return NextResponse.json(
      {
        ok: true,
        user,
        empresa: {
          id: empresa.id,
          nombre: empresa.nombre,
          nit: empresa.nit,
          workspaceCode: empresa.workspaceCode,
          planTier,
          billingCycle,
          planValidUntil: planValidUntil?.toISOString() ?? null,
          moduleOnlyBilling: billingMode === 'MODULE_ONLY',
        },
        enabledModules,
      },
      { status: 201 }
    )
  } catch (error) {
    if (empresaId) {
      await rollbackCreatedWorkspace(empresaId)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '')
      const field = /nit/i.test(target) ? 'NIT' : 'email'
      return NextResponse.json({ ok: false, error: `Ese ${field} ya está registrado` }, { status: 409 })
    }

    console.error('Error creando usuario desde super admin:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo crear el usuario' }, { status: 500 })
  }
}

/** Limpia lo creado si el alta falla a mitad de camino (no deja empresas huérfanas). */
async function rollbackCreatedWorkspace(empresaId: string) {
  try {
    const sedes = await prisma.sede.findMany({ where: { empresaId }, select: { id: true } })
    const sedeIds = sedes.map((sede) => sede.id)

    if (sedeIds.length) {
      await prisma.sedeMembership.deleteMany({ where: { sedeId: { in: sedeIds } } })
    }

    await prisma.empresaModuleOverride.deleteMany({ where: { empresaId } })
    await prisma.user.deleteMany({ where: { empresaId } })
    await prisma.sede.deleteMany({ where: { empresaId } })
    await prisma.empresa.deleteMany({ where: { id: empresaId } })
  } catch (cleanupError) {
    console.error('Error limpiando el espacio de trabajo creado:', cleanupError)
  }
}

