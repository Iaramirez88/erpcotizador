import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, getOrCreateDefaultEmpresa } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const empresa = await getOrCreateDefaultEmpresa()
  await ensureDefaultSedeForEmpresa(empresa.id, session.user.id)

  const sedes = await prisma.sede.findMany({
    where: { empresaId: empresa.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { memberships: true, teams: true } },
    },
  })

  return NextResponse.json({ success: true, data: sedes })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { nombre?: unknown; codigo?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : undefined

  if (!nombre) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }

  const empresa = await getOrCreateDefaultEmpresa()

  // Permiso: rol sistema ADMIN o ser ADMIN/MANAGER en alguna sede de la empresa.
  const isSystemAdmin = session.user.role === 'ADMIN'
  const anyAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: session.user.id,
      sede: { empresaId: empresa.id },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  if (!isSystemAdmin && !anyAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const sede = await prisma.sede.create({
    data: {
      empresaId: empresa.id,
      nombre,
      codigo: codigo || null,
    },
  })

  return NextResponse.json({ success: true, data: sede }, { status: 201 })
}
