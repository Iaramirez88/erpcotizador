import { NextRequest, NextResponse } from 'next/server'
import {
  BillingCycle,
  ModuleKey,
  PlanTier,
  RbacGrantSource,
  RbacScopeType,
  SedeRole,
  UserRole,
} from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS } from '@/lib/plan-modules'
import { detachPermissionProfileAssignment, publishPermissionUpdateNotification } from '@/lib/rbac-permission-sync'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { sedeRoleToBaseAccess } from '@/lib/rbac'
import { buildUserPermissionSnapshot } from '@/lib/user-permission-snapshot'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null; id?: string } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'CRM' || value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'YEARLY'
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'USER' || value === 'VENDEDOR' || value === 'PRODUCCION' || value === 'CLIENTE'
}

function isSedeRole(value: unknown): value is SedeRole {
  return value === 'ADMIN' || value === 'MANAGER' || value === 'MEMBER' || value === 'READER'
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

function parsePlanValidUntil(value: unknown): Date | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'string') return 'invalid'
  const normalized = value.trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const next = new Date(`${normalized}T23:59:59`)
    return Number.isNaN(next.getTime()) ? 'invalid' : next
  }

  const next = new Date(normalized)
  return Number.isNaN(next.getTime()) ? 'invalid' : next
}

type PatchBody = {
  name?: unknown
  role?: unknown
  planTier?: unknown
  billingCycle?: unknown
  planValidUntil?: unknown
  clearTrial?: unknown
  isPaid?: unknown
  sedeAccesses?: unknown
}

type SedeAccessInput = {
  sedeId: string
  sedeRole: SedeRole
  modules: Partial<Record<ModuleKey, boolean>>
}

function parseSedeAccesses(value: unknown): SedeAccessInput[] | 'invalid' {
  if (!Array.isArray(value)) return []

  const rows: SedeAccessInput[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return 'invalid'
    const record = item as Record<string, unknown>
    const sedeId = typeof record.sedeId === 'string' ? record.sedeId.trim() : ''
    const sedeRole = record.sedeRole
    const modulesRaw = record.modules
    if (!sedeId || !isSedeRole(sedeRole) || !modulesRaw || typeof modulesRaw !== 'object' || Array.isArray(modulesRaw)) {
      return 'invalid'
    }

    const modules: Partial<Record<ModuleKey, boolean>> = {}
    for (const moduleKey of ALL_MODULE_KEYS) {
      const next = (modulesRaw as Record<string, unknown>)[moduleKey]
      if (typeof next === 'boolean') modules[moduleKey] = next
    }

    rows.push({ sedeId, sedeRole, modules })
  }

  return rows
}

async function buildUserManagement(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
          billingCycle: true,
          planValidUntil: true,
          trialTier: true,
          trialValidUntil: true,
        },
      },
      sedeDefaultId: true,
      sedeMemberships: {
        orderBy: [{ sede: { nombre: 'asc' } }],
        select: {
          sedeId: true,
          role: true,
          sede: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  if (!user) return null

  const globalSnapshot = user.empresa?.id
    ? await buildUserPermissionSnapshot({
        empresaId: user.empresa.id,
        sedeId: null,
        userIds: [user.id],
      })
    : null

  const sedes = await Promise.all(user.sedeMemberships.map(async (membership) => {
    const snapshot = user.empresa?.id
      ? await buildUserPermissionSnapshot({
          empresaId: user.empresa.id,
          sedeId: membership.sedeId,
          userIds: [user.id],
        })
      : {
          membershipByUserId: {},
          moduleAccessByUserId: {},
          globalAccessByUserId: {},
          capabilityAccessByUserId: {},
          permissionProfileByUserId: {},
        }

    return {
      sedeId: membership.sedeId,
      sedeNombre: membership.sede.nombre,
      sedeRole: snapshot.membershipByUserId[user.id] ?? membership.role,
      initialAccess: snapshot.moduleAccessByUserId[user.id] ?? {},
      initialCapabilities: snapshot.capabilityAccessByUserId[user.id] ?? {},
      permissionProfile: snapshot.permissionProfileByUserId[user.id] ?? null,
    }
  }))

  const selectedSedeId = user.sedeDefaultId && sedes.some((item) => item.sedeId === user.sedeDefaultId)
    ? user.sedeDefaultId
    : sedes[0]?.sedeId ?? null

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      globalAccessLevel: globalSnapshot?.globalAccessByUserId[user.id] ?? 'NONE',
      sedeDefaultId: user.sedeDefaultId,
      empresa: user.empresa
        ? {
            id: user.empresa.id,
            nombre: user.empresa.nombre,
            nit: user.empresa.nit,
            planTier: user.empresa.planTier,
            billingCycle: user.empresa.billingCycle,
            planValidUntil: user.empresa.planValidUntil?.toISOString() ?? null,
            trialTier: user.empresa.trialTier,
            trialValidUntil: user.empresa.trialValidUntil?.toISOString() ?? null,
          }
        : null,
      sedes,
      selectedSedeId,
    },
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const result = await buildUserManagement((id ?? '').trim())
  if (!result) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, ...result })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const userId = (id ?? '').trim()
  if (!userId) return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as PatchBody
  const parsedPlanValidUntil = parsePlanValidUntil(body.planValidUntil)
  if (parsedPlanValidUntil === 'invalid') {
    return NextResponse.json({ ok: false, error: 'Fecha de vigencia inválida.' }, { status: 400 })
  }

  const parsedSedeAccesses = parseSedeAccesses(body.sedeAccesses)
  if (parsedSedeAccesses === 'invalid') {
    return NextResponse.json({ ok: false, error: 'Accesos por sede inválidos.' }, { status: 400 })
  }

  try {
    const touchedSedeIds = new Set<string>()
    let targetEmpresaId: string | null = null

    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, empresaId: true },
      })
      if (!current) throw new Error('USER_NOT_FOUND')
      targetEmpresaId = current.empresaId

      const userData: { name?: string | null; role?: UserRole } = {}
      if (typeof body.name === 'string' || body.name === null) userData.name = body.name

      if (body.role !== undefined) {
        if (!isUserRole(body.role)) throw new Error('INVALID_USER_ROLE')
        if (body.role === 'ADMIN' && !isSuperAdminEmail(current.email)) throw new Error('INVALID_ADMIN_ROLE')
        userData.role = body.role
      }

      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: userId }, data: userData })
      }

      if (current.empresaId) {
        const empresa = await tx.empresa.findUnique({
          where: { id: current.empresaId },
          select: { billingCycle: true },
        })
        if (!empresa) throw new Error('EMPRESA_NOT_FOUND')

        const empresaData: {
          planTier?: PlanTier
          billingCycle?: BillingCycle
          planValidUntil?: Date | null
          trialTier?: PlanTier | null
          trialStartedAt?: Date | null
          trialValidUntil?: Date | null
        } = {}

        if (body.planTier !== undefined) {
          if (!isPlanTier(body.planTier)) throw new Error('INVALID_PLAN_TIER')
          empresaData.planTier = body.planTier
        }
        if (body.billingCycle !== undefined) {
          if (!isBillingCycle(body.billingCycle)) throw new Error('INVALID_BILLING_CYCLE')
          empresaData.billingCycle = body.billingCycle
        }

        if ('planValidUntil' in body) {
          empresaData.planValidUntil = parsedPlanValidUntil
          if (parsedPlanValidUntil) {
            empresaData.trialTier = null
            empresaData.trialStartedAt = null
            empresaData.trialValidUntil = null
          }
        }

        if (body.isPaid === true && !('planValidUntil' in body)) {
          const cycle = empresaData.billingCycle ?? empresa.billingCycle ?? 'MONTHLY'
          empresaData.planValidUntil = cycle === 'YEARLY' ? addYears(new Date(), 1) : addMonths(new Date(), 1)
          empresaData.trialTier = null
          empresaData.trialStartedAt = null
          empresaData.trialValidUntil = null
        }
        if (body.isPaid === false && !('planValidUntil' in body)) {
          empresaData.planValidUntil = null
        }

        if (body.clearTrial === true) {
          empresaData.trialTier = null
          empresaData.trialStartedAt = null
          empresaData.trialValidUntil = null
        }

        if (Object.keys(empresaData).length) {
          await tx.empresa.update({ where: { id: current.empresaId }, data: empresaData })
        }
      }

      for (const sedeAccess of parsedSedeAccesses) {
        const membership = await tx.sedeMembership.findUnique({
          where: { sedeId_userId: { sedeId: sedeAccess.sedeId, userId } },
          select: { id: true },
        })
        if (!membership?.id) continue

        if (current.empresaId) {
          await detachPermissionProfileAssignment({ client: tx, empresaId: current.empresaId, sedeId: sedeAccess.sedeId, userId })
          await tx.userCapabilityGrant.deleteMany({
            where: {
              empresaId: current.empresaId,
              userId,
              scopeType: RbacScopeType.SEDE,
              scopeValue: sedeAccess.sedeId,
              source: RbacGrantSource.DIRECT,
            },
          })
        }

        await tx.sedeMembership.update({
          where: { sedeId_userId: { sedeId: sedeAccess.sedeId, userId } },
          data: { role: sedeAccess.sedeRole },
        })
        touchedSedeIds.add(sedeAccess.sedeId)

        const baseLevel = sedeRoleToBaseAccess(sedeAccess.sedeRole)
        for (const moduleKey of ALL_MODULE_KEYS) {
          const enabled = sedeAccess.modules[moduleKey]
          if (enabled === undefined) continue

          await tx.userModuleAccess.upsert({
            where: { sedeId_userId_module: { sedeId: sedeAccess.sedeId, userId, module: moduleKey } },
            create: { sedeId: sedeAccess.sedeId, userId, module: moduleKey, level: enabled ? baseLevel : 'NONE' },
            update: { level: enabled ? baseLevel : 'NONE' },
          })
        }
      }
    })

    const result = await buildUserManagement(userId)
    if (!result) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })

    if (targetEmpresaId && touchedSedeIds.size > 0) {
      await publishPermissionUpdateNotification({
        client: prisma,
        userId,
        empresaId: targetEmpresaId,
        sedeId: [...touchedSedeIds][0] ?? null,
        title: 'Permisos actualizados',
        body: 'Super Admin actualizó tus accesos y se resincronizaron tus reglas manuales para evitar conflictos.',
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'USER_NOT_FOUND') return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
      if (error.message === 'EMPRESA_NOT_FOUND') return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
      if (error.message === 'INVALID_USER_ROLE') return NextResponse.json({ ok: false, error: 'Rol inválido' }, { status: 400 })
      if (error.message === 'INVALID_ADMIN_ROLE') return NextResponse.json({ ok: false, error: 'Solo el Super Admin puede ser ADMIN' }, { status: 400 })
      if (error.message === 'INVALID_PLAN_TIER') return NextResponse.json({ ok: false, error: 'Plan inválido' }, { status: 400 })
      if (error.message === 'INVALID_BILLING_CYCLE') return NextResponse.json({ ok: false, error: 'Ciclo inválido' }, { status: 400 })
    }

    return NextResponse.json({ ok: false, error: 'No se pudo actualizar el usuario.' }, { status: 500 })
  }
}