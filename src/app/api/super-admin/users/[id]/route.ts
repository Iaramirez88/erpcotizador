import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { UserRole } from '@prisma/client'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null; id?: string } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || session.user.role !== 'ADMIN' || !isSuperAdminEmail(email)) return null
  return session
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'ADMIN' ||
    value === 'USER' ||
    value === 'VENDEDOR' ||
    value === 'PRODUCCION' ||
    value === 'CLIENTE'
  )
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const nameRaw = body.name
  const roleRaw = body.role

  const data: { name?: string | null; role?: UserRole } = {}
  if (typeof nameRaw === 'string' || nameRaw === null) data.name = nameRaw

  if (roleRaw !== undefined) {
    if (!isUserRole(roleRaw)) {
      return NextResponse.json({ ok: false, error: 'Rol inválido' }, { status: 400 })
    }

    // Evita confusión: solo el super admin email puede tener ADMIN.
    const current = await prisma.user.findUnique({ where: { id }, select: { email: true } })
    if (!current) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
    if (roleRaw === 'ADMIN' && !isSuperAdminEmail(current.email)) {
      return NextResponse.json({ ok: false, error: 'Solo el Super Admin puede ser ADMIN' }, { status: 400 })
    }

    data.role = roleRaw
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      empresa: { select: { id: true, nombre: true, planTier: true } },
    },
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
      empresa: updated.empresa
        ? { id: updated.empresa.id, nombre: updated.empresa.nombre, planTier: updated.empresa.planTier }
        : null,
    },
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params

  if (session.user?.id && session.user.id === id) {
    return NextResponse.json({ ok: false, error: 'No puedes eliminar tu propio usuario' }, { status: 400 })
  }

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado'
    return NextResponse.json(
      {
        ok: false,
        error: `No se pudo eliminar. Puede tener registros asociados. (${msg})`,
      },
      { status: 400 }
    )
  }
}
