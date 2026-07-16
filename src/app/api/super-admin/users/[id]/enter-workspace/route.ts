import { NextRequest, NextResponse } from 'next/server'
import { SedeRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { email?: string | null; id?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user?.id || !isSuperAdminEmail(email)) return null
  return session
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const sessionUserId = session.user!.id!

  const { id } = await ctx.params
  const targetUserId = (id ?? '').trim()
  if (!targetUserId) return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 400 })

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      empresaId: true,
      sedeDefaultId: true,
      empresa: { select: { id: true, nombre: true } },
    },
  })

  if (!target?.id) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
  if (!target.empresaId || !target.empresa?.id) {
    return NextResponse.json({ ok: false, error: 'El usuario no tiene espacio de trabajo asignado.' }, { status: 409 })
  }

  const targetMemberships = await prisma.sedeMembership.findMany({
    where: { userId: target.id, sede: { empresaId: target.empresaId } },
    orderBy: [{ createdAt: 'asc' }],
    select: { sedeId: true },
  })

  const preferredSedeId = target.sedeDefaultId && targetMemberships.some((row) => row.sedeId === target.sedeDefaultId)
    ? target.sedeDefaultId
    : targetMemberships[0]?.sedeId ?? null

  const fallbackSede = preferredSedeId
    ? null
    : await prisma.sede.findFirst({
        where: { empresaId: target.empresaId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })

  const activeSedeId = preferredSedeId ?? fallbackSede?.id ?? null
  if (!activeSedeId) {
    return NextResponse.json({ ok: false, error: 'La empresa del usuario no tiene sedes disponibles.' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: sessionUserId },
      data: { empresaId: target.empresaId, sedeDefaultId: activeSedeId },
      select: { id: true },
    })

    await tx.sedeMembership.upsert({
      where: { sedeId_userId: { sedeId: activeSedeId, userId: sessionUserId } },
      create: { sedeId: activeSedeId, userId: sessionUserId, role: SedeRole.ADMIN },
      update: { role: SedeRole.ADMIN },
      select: { sedeId: true },
    })
  })

  return NextResponse.json({ ok: true, redirectTo: '/dashboard' })
}