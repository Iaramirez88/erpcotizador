import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccessLevel, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

const moduleKeys = new Set<ModuleKey>([
  'DASHBOARD',
  'COTIZADOR',
  'COTIZACIONES',
  'CLIENTES',
  'MATERIALES',
  'INVENTARIO',
  'REMISIONES',
  'POS',
  'PROVEEDORES',
  'COMPRAS',
  'ORDENES',
  'ESCANEOS',
  'REPORTES',
  'NOTIFICACIONES',
  'CONFIG',
])

const accessLevels = new Set<AccessLevel>(['NONE', 'READ', 'WRITE', 'ADMIN'])

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: sedeId } = await ctx.params

  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { id: true },
  })

  if (!membership && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const permisos = await prisma.userModuleAccess.findMany({
    where: { sedeId },
    orderBy: [{ userId: 'asc' }, { module: 'asc' }],
    select: {
      id: true,
      module: true,
      level: true,
      user: { select: { id: true, email: true, name: true } },
    },
  })

  return NextResponse.json({ success: true, data: permisos })
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

  const body = (await request.json().catch(() => null)) as {
    userId?: unknown
    email?: unknown
    module?: unknown
    level?: unknown
  } | null

  const moduleKey = typeof body?.module === 'string' ? (body.module as ModuleKey) : undefined
  const level = typeof body?.level === 'string' ? (body.level as AccessLevel) : undefined

  if (!moduleKey || !moduleKeys.has(moduleKey)) {
    return NextResponse.json({ error: 'module inválido' }, { status: 400 })
  }
  if (!level || !accessLevels.has(level)) {
    return NextResponse.json({ error: 'level inválido' }, { status: 400 })
  }

  let userId: string | undefined
  if (typeof body?.userId === 'string' && body.userId) userId = body.userId

  if (!userId && typeof body?.email === 'string' && body.email) {
    const email = body.email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    userId = user.id
  }

  if (!userId) return NextResponse.json({ error: 'userId o email es requerido' }, { status: 400 })

  const upserted = await prisma.userModuleAccess.upsert({
    where: { sedeId_userId_module: { sedeId, userId, module: moduleKey } },
    create: { sedeId, userId, module: moduleKey, level },
    update: { level },
  })

  return NextResponse.json({ success: true, data: upserted }, { status: 201 })
}
