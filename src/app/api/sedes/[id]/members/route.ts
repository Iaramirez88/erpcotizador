import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SedeRole } from '@prisma/client'

export const runtime = 'nodejs'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: sedeId } = await ctx.params

  // Solo miembros pueden ver
  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { id: true },
  })

  if (!membership && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const members = await prisma.sedeMembership.findMany({
    where: { sedeId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  return NextResponse.json({ success: true, data: members })
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: sedeId } = await ctx.params

  const admin = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })

  if (session.user.role !== 'ADMIN' && admin?.role !== 'ADMIN' && admin?.role !== 'MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null
  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  const roleStr = typeof body?.role === 'string' ? body.role : 'READER'
  const role: SedeRole = ['ADMIN', 'MANAGER', 'MEMBER', 'READER'].includes(roleStr)
    ? (roleStr as SedeRole)
    : 'READER'

  if (!email) return NextResponse.json({ error: 'email es requerido' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const membership = await prisma.sedeMembership.upsert({
    where: { sedeId_userId: { sedeId, userId: user.id } },
    create: { sedeId, userId: user.id, role },
    update: { role },
    select: { id: true },
  })

  return NextResponse.json({ success: true, data: membership }, { status: 201 })
}
