import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma, type SedeRole, type UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ALL_MODULE_KEYS } from '@/lib/plan-catalog'
import { getEnabledModulesForEmpresa } from '@/lib/plan-modules'
import { validatePassword } from '@/lib/password-policy'
import { ensureDefaultSedeForEmpresa } from '@/lib/rbac'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import {
  provisionDefaultAdminAccessForNewUser,
  syncEnabledVerticalGrantsForUser,
} from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null; id?: string } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'USER' || value === 'VENDEDOR' || value === 'PRODUCCION' || value === 'CLIENTE'
}

function isSedeRole(value: unknown): value is SedeRole {
  return value === 'ADMIN' || value === 'MANAGER' || value === 'MEMBER' || value === 'READER'
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

type SedeAccessInput = { sedeId: string; role: SedeRole }

function parseSedeAccesses(value: unknown): SedeAccessInput[] | 'invalid' {
  if (value == null) return []
  if (!Array.isArray(value)) return 'invalid'

  const rows: SedeAccessInput[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return 'invalid'
    const record = item as Record<string, unknown>
    const sedeId = typeof record.sedeId === 'string' ? record.sedeId.trim() : ''
    const role = record.role
    if (!sedeId || !isSedeRole(role)) return 'invalid'
    rows.push({ sedeId, role })
  }

  return rows
}

async function loadEmpresaContext(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nombre: true,
      nit: true,
      workspaceCode: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      registrationCodeHash: true,
      moduleOnlyBilling: true,
    },
  })

  if (!empresa) return null

  const planTier = resolveEffectivePlanTier(empresa, new Date())
  const enabledModules = await getEnabledModulesForEmpresa({
    empresaId,
    planTier,
    moduleOnlyBilling: empresa.moduleOnlyBilling,
  })

  const sedes = await prisma.sede.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, nombre: true, codigo: true },
  })

  return { empresa, planTier, enabledModules, sedes }
}

/**
 * Usuarios de una empresa (incluye a quienes entran solo por sede) + módulos realmente
 * contratados. Es la fuente de la pestaña "Usuarios y permisos" del super admin.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const context = await loadEmpresaContext(empresaId)
  if (!context) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { empresaId },
        { sedeMemberships: { some: { sede: { empresaId } } } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      sedeDefaultId: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: {
        where: { sede: { empresaId } },
        orderBy: [{ sede: { nombre: 'asc' } }],
        select: {
          role: true,
          sedeId: true,
          sede: { select: { nombre: true } },
        },
      },
    },
  })

  return NextResponse.json({
    ok: true,
    empresa: {
      id: context.empresa.id,
      nombre: context.empresa.nombre,
      nit: context.empresa.nit,
      workspaceCode: context.empresa.workspaceCode,
      planTier: context.empresa.planTier,
      effectivePlanTier: context.planTier,
      billingCycle: context.empresa.billingCycle,
      planValidUntil: context.empresa.planValidUntil?.toISOString() ?? null,
      moduleOnlyBilling: context.empresa.moduleOnlyBilling,
    },
    enabledModules: context.enabledModules,
    allModules: ALL_MODULE_KEYS,
    sedes: context.sedes,
    items: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      sedeDefaultId: user.sedeDefaultId,
      globalAccessLevel: user.globalAccess?.level ?? 'NONE',
      sedes: user.sedeMemberships.map((membership) => ({
        sedeId: membership.sedeId,
        sedeNombre: membership.sede.nombre,
        role: membership.role,
      })),
    })),
  })
}

type CreateBody = {
  name?: unknown
  email?: unknown
  password?: unknown
  role?: unknown
  /** `ADMIN` aprovisiona acceso total en todas las sedes; `CUSTOM` entra como READER + permisos a medida. */
  accessMode?: unknown
  sedeAccesses?: unknown
}

/**
 * Crea un usuario dentro de una empresa existente. Con `accessMode: 'ADMIN'` replica el
 * aprovisionamiento del propietario (acceso total + capacidades) y con `CUSTOM` deja al
 * usuario listo para configurar módulo por módulo desde el mismo panel.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as CreateBody
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const rawPassword = typeof body.password === 'string' ? body.password : ''
  const name = normalizeNullableString(body.name)
  const accessMode = body.accessMode === 'ADMIN' ? 'ADMIN' : 'CUSTOM'
  const requestedRole: UserRole = isUserRole(body.role) ? body.role : accessMode === 'ADMIN' ? 'ADMIN' : 'USER'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Indica un email válido' }, { status: 400 })
  }

  const passwordError = validatePassword(rawPassword)
  if (passwordError) {
    return NextResponse.json({ ok: false, error: passwordError }, { status: 400 })
  }

  const parsedSedeAccesses = parseSedeAccesses(body.sedeAccesses)
  if (parsedSedeAccesses === 'invalid') {
    return NextResponse.json({ ok: false, error: 'Accesos por sede inválidos.' }, { status: 400 })
  }

  const context = await loadEmpresaContext(empresaId)
  if (!context) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const sedeIds = new Set(context.sedes.map((sede) => sede.id))
  const invalidSede = parsedSedeAccesses.find((item) => !sedeIds.has(item.sedeId))
  if (invalidSede) {
    return NextResponse.json({ ok: false, error: 'La sede indicada no pertenece a la empresa.' }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    return NextResponse.json({ ok: false, error: 'Ese email ya está registrado' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(rawPassword, 12)
  let createdUserId: string | null = null

  try {
    const created = await prisma.user.create({
      data: {
        name: name ?? email,
        email,
        password: hashedPassword,
        role: requestedRole,
        empresaId,
        // Alta hecha por super admin: no requiere verificación de correo.
        emailVerified: new Date(),
      },
      select: { id: true, email: true, name: true, role: true },
    })
    createdUserId = created.id

    await ensureDefaultSedeForEmpresa(empresaId, created.id)

    if (accessMode === 'ADMIN') {
      await provisionDefaultAdminAccessForNewUser({
        empresaId,
        userId: created.id,
        grantedByUserId: session.user?.id ?? null,
      })
    }

    for (const sedeAccess of parsedSedeAccesses) {
      await prisma.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: sedeAccess.sedeId, userId: created.id } },
        create: { sedeId: sedeAccess.sedeId, userId: created.id, role: sedeAccess.role },
        update: { role: sedeAccess.role },
      })
    }

    await syncEnabledVerticalGrantsForUser({
      empresaId,
      userId: created.id,
      grantedByUserId: session.user?.id ?? null,
    })

    return NextResponse.json({ ok: true, user: created }, { status: 201 })
  } catch (error) {
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } }).catch(() => null)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Ese email ya está registrado' }, { status: 409 })
    }

    console.error('Error creando usuario de empresa desde super admin:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo crear el usuario' }, { status: 500 })
  }
}
