import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

const ALLOWED_STATUSES = new Set(['DRAFT', 'DISABLED'])

async function loadOwnedProject(projectId: string, empresaId: string) {
  return prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId },
    select: { id: true, nombre: true, status: true },
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project?.id) {
    return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const status = String(body?.status ?? '').trim().toUpperCase()
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: 'Estado de sitio no válido.' }, { status: 400 })
  }

  const updated = await prisma.websiteProject.update({
    where: { id: projectId },
    data: { status, updatedByUserId: guard.userId },
    select: { id: true, status: true, updatedAt: true },
  })

  return NextResponse.json({
    ok: true,
    item: { ...updated, updatedAt: updated.updatedAt.toISOString() },
  })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project?.id) {
    return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })
  }

  await prisma.websiteProject.delete({ where: { id: projectId } })

  return NextResponse.json({ ok: true, deletedId: project.id, deletedName: project.nombre })
}
