import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'READ')
  if (!access.ok) return access.response

  const sedes = await prisma.sede.findMany({
    where: { empresaId: access.empresaId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { memberships: true, teams: true } },
    },
  })

  return NextResponse.json({ success: true, data: sedes })
}

export async function POST(request: Request) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as { nombre?: unknown; codigo?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : undefined

  if (!nombre) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }

  // Permiso: rol sistema ADMIN o ser ADMIN/MANAGER en alguna sede de la empresa.
  const isSystemAdmin = access.session.user.role === 'ADMIN'
  const anyAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: access.userId,
      sede: { empresaId: access.empresaId },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  if (!isSystemAdmin && !anyAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const sede = await prisma.sede.create({
    data: {
      empresaId: access.empresaId,
      nombre,
      codigo: codigo || null,
    },
  })

  return NextResponse.json({ success: true, data: sede }, { status: 201 })
}
