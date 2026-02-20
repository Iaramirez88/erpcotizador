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
    select: { id: true, name: true, email: true, role: true, image: true, empresaId: true, createdAt: true, updatedAt: true },
  })

  // Para UI: incluir acceso efectivo (por sede) a CONFIG
  let configAccess: AccessLevel = 'NONE'
  try {
    const sede = await getActiveSedeForUser(userId)
    configAccess = await getEffectiveAccess({ userId, sedeId: sede.id, module: ModuleKey.CONFIG })
  } catch {
    // si algo falla (sede no resuelta, etc), dejamos NONE
  }

  const order: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, ADMIN: 3 }
  const canConfigWrite = order[configAccess] >= order.WRITE

  const empresaId = user?.empresaId ?? null
  const isSystemSuperAdmin = isSuperAdminEmail(user?.email)
  const isPlanOwner = Boolean(empresaId && user?.id ? await isPlanOwnerForEmpresa({ empresaId, userId: user.id }) : false)
  const canManageBilling = isSystemSuperAdmin || isPlanOwner

  return NextResponse.json({
    success: true,
    data: user
      ? {
          ...user,
          access: { config: configAccess },
          canConfigWrite,
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: name === '' ? null : name,
    },
    select: { id: true, name: true, email: true, role: true, image: true, updatedAt: true },
  })

  return NextResponse.json({ success: true, data: updated })
}
