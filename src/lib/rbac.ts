import { prisma } from '@/lib/prisma'
import type { Empresa, Sede } from '@prisma/client'
import { AccessLevel, ModuleKey, SedeRole, UserRole } from '@prisma/client'
import { isSuperAdminEmail } from '@/lib/super-admin'

function maxAccess(a: AccessLevel, b: AccessLevel): AccessLevel {
  const order: Record<AccessLevel, number> = {
    NONE: 0,
    READ: 1,
    WRITE: 2,
    ADMIN: 3,
  }
  return order[a] >= order[b] ? a : b
}

export function sedeRoleToBaseAccess(role: SedeRole): AccessLevel {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN'
    case 'MANAGER':
      return 'WRITE'
    case 'MEMBER':
      return 'WRITE'
    case 'READER':
    default:
      return 'READ'
  }
}

export type DefaultEmpresa = Pick<
  Empresa,
  'id' | 'nombre' | 'nit' | 'direccion' | 'telefono' | 'email' | 'logo' | 'createdAt' | 'updatedAt'
>

const DEFAULT_EMPRESA_SELECT = {
  id: true,
  nombre: true,
  nit: true,
  direccion: true,
  telefono: true,
  email: true,
  logo: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function requireEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, empresaId: true },
  })

  if (!user?.id) throw new Error('USER_NOT_FOUND')
  if (user.empresaId) return user.empresaId

  const normalizedEmail = (user.email || '').trim().toLowerCase()
  const personalNit = `PERS-${user.id}`
  const personalNombre = `Espacio personal${normalizedEmail ? ` (${normalizedEmail})` : ''}`

  const empresaId = await prisma.$transaction(async (tx) => {
    const existing = await tx.empresa.findUnique({ where: { nit: personalNit }, select: { id: true } })
    const empresa = existing
      ? existing
      : await tx.empresa.create({
          data: {
            nombre: personalNombre,
            nit: personalNit,
            email: normalizedEmail || null,
            planTier: 'BASIC',
            billingCycle: 'MONTHLY',
            planValidUntil: null,
          },
          select: { id: true },
        })

    await tx.user.update({ where: { id: user.id }, data: { empresaId: empresa.id }, select: { id: true } })
    return empresa.id
  })

  await ensureDefaultSedeForEmpresa(empresaId, userId)

  return empresaId
}

export async function ensureDefaultSedeForEmpresa(empresaId: string, userId: string): Promise<Sede> {
  const sede =
    (await prisma.sede.findFirst({ where: { empresaId }, orderBy: { createdAt: 'asc' } })) ??
    (await prisma.sede.create({
      data: {
        empresaId,
        nombre: 'Principal',
        codigo: 'PRIN',
      },
    }))

  const membershipCount = await prisma.sedeMembership.count({ where: { sedeId: sede.id } })
  const existingMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: sede.id, userId } },
  })

  if (!existingMembership) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, globalAccess: { select: { level: true } } },
    })

    const globalLevel = user?.globalAccess?.level ?? 'NONE'
    const roleFromGlobal: SedeRole =
      globalLevel === 'ADMIN' ? 'ADMIN' : globalLevel === 'WRITE' ? 'MEMBER' : globalLevel === 'READ' ? 'READER' : 'READER'

    await prisma.sedeMembership.create({
      data: {
        sedeId: sede.id,
        userId,
        role: membershipCount === 0 || user?.role === UserRole.ADMIN ? 'ADMIN' : roleFromGlobal,
      },
    })
  }

  return sede
}

export async function getActiveSedeForUser(userId: string): Promise<Sede> {
  const empresaId = await requireEmpresaIdForUser(userId)

  const memberSede = await prisma.sedeMembership.findFirst({
    where: { userId, sede: { empresaId } },
    include: { sede: true },
    orderBy: { createdAt: 'asc' },
  })

  if (memberSede?.sede) return memberSede.sede

  return ensureDefaultSedeForEmpresa(empresaId, userId)
}

export async function getEffectiveAccess(args: {
  userId: string
  sedeId: string
  module: ModuleKey
}): Promise<AccessLevel> {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { role: true, email: true, globalAccess: { select: { level: true } } },
  })

  if (user?.role === UserRole.ADMIN && isSuperAdminEmail(user.email)) return 'ADMIN'

  const globalBase: AccessLevel = user?.globalAccess?.level ?? 'NONE'

  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } },
    select: { role: true },
  })

  // Regla: si hay rol por sede, ese manda; si no, aplica el nivel general.
  const base = membership ? sedeRoleToBaseAccess(membership.role) : globalBase

  const explicit = await prisma.userModuleAccess.findUnique({
    where: {
      sedeId_userId_module: {
        sedeId: args.sedeId,
        userId: args.userId,
        module: args.module,
      },
    },
    select: { level: true },
  })

  if (explicit?.level) {
    return explicit.level
  }

  // Algunas pantallas deberían ser accesibles si tienes acceso base.
  return base
}

export async function requireSedeAccess(args: {
  userId: string
  sedeId: string
  module: ModuleKey
  minLevel: AccessLevel
}): Promise<void> {
  const level = await getEffectiveAccess({
    userId: args.userId,
    sedeId: args.sedeId,
    module: args.module,
  })

  const effective = maxAccess(level, 'NONE')

  const order: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, ADMIN: 3 }
  if (order[effective] < order[args.minLevel]) {
    throw new Error('FORBIDDEN')
  }
}
