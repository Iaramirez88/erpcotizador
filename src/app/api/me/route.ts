import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, getEffectiveAccess } from '@/lib/rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      empresaId: true,
      telefono: true,
      cargo: true,
      sedeDefaultId: true,
      sedeDefault: { select: { id: true, nombre: true, codigo: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  // Para UI: incluir acceso efectivo (por sede) a CONFIG
  let configAccess: AccessLevel = 'NONE'
  let ordersAccess: AccessLevel = 'NONE'
  let materialsAccess: AccessLevel = 'NONE'
  let canManageCustomProductRequests = false
  try {
    const sede = await getActiveSedeForUser(userId)
    configAccess = await getEffectiveAccess({ userId, sedeId: sede.id, module: ModuleKey.CONFIG })
    ordersAccess = await getEffectiveAccess({ userId, sedeId: sede.id, module: ModuleKey.ORDENES })
    materialsAccess = await getEffectiveAccess({ userId, sedeId: sede.id, module: ModuleKey.MATERIALES })
    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: sede.id, userId } },
      select: { role: true },
    })
    canManageCustomProductRequests = membership?.role === 'ADMIN' || membership?.role === 'MANAGER'
  } catch {
    // si algo falla (sede no resuelta, etc), dejamos NONE
  }

  const order: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, ADMIN: 3 }
  const canConfigWrite = order[configAccess] >= order.WRITE
  const canDeleteOrders = order[ordersAccess] >= order.ADMIN

  const empresaId = user?.empresaId ?? null
  const isSystemSuperAdmin = isSuperAdminEmail(user?.email)
  const isPlanOwner = Boolean(empresaId && user?.id ? await isPlanOwnerForEmpresa({ empresaId, userId: user.id }) : false)
  const canManageBilling = isSystemSuperAdmin || isPlanOwner

  return NextResponse.json({
    success: true,
    data: user
      ? {
          ...user,
          access: { config: configAccess, orders: ordersAccess, materials: materialsAccess },
          canConfigWrite,
          canDeleteOrders,
          canManageCustomProductRequests,
          empresaId,
          isPlanOwner,
          canManageBilling,
        }
      : null,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  if (name !== undefined && name.length > 80) {
    return NextResponse.json({ success: false, error: 'Nombre demasiado largo.' }, { status: 400 })
  }

  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : undefined
  if (telefono !== undefined && telefono.length > 40) {
    return NextResponse.json({ success: false, error: 'Teléfono demasiado largo.' }, { status: 400 })
  }

  const cargo = typeof body.cargo === 'string' ? body.cargo.trim() : undefined
  if (cargo !== undefined && cargo.length > 80) {
    return NextResponse.json({ success: false, error: 'Cargo demasiado largo.' }, { status: 400 })
  }

  const sedeDefaultIdRaw = typeof body.sedeDefaultId === 'string' ? body.sedeDefaultId.trim() : undefined
  const sedeDefaultId = sedeDefaultIdRaw === undefined ? undefined : (sedeDefaultIdRaw || null)

  if (sedeDefaultId !== undefined && sedeDefaultId !== null) {
    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: sedeDefaultId, userId } },
      select: { id: true },
    })
    if (!membership?.id) {
      return NextResponse.json({ success: false, error: 'La sede seleccionada no está asignada a tu usuario.' }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: name === '' ? null : name,
      telefono: telefono === undefined ? undefined : (telefono === '' ? null : telefono),
      cargo: cargo === undefined ? undefined : (cargo === '' ? null : cargo),
      sedeDefaultId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      telefono: true,
      cargo: true,
      sedeDefaultId: true,
      sedeDefault: { select: { id: true, nombre: true, codigo: true } },
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
