import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  defaultWebsiteBuilderData,
  normalizeString,
  serializeWebsiteProjectPage,
  slugifyWebsiteBuilderValue,
} from '@/lib/website-builder'
import { requireWebsiteBuilderAccess, toWebsiteBuilderInputJsonValue } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

async function loadProject(projectId: string, empresaId: string) {
  return prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId },
    select: { id: true },
  })
}

async function buildUniquePageSlug(projectId: string, value: string) {
  const base = slugifyWebsiteBuilderValue(value)

  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`
    const existing = await prisma.websiteProjectPage.findFirst({
      where: { websiteProjectId: projectId, slug: candidate },
      select: { id: true },
    })
    if (!existing?.id) return candidate
  }

  return `${base}-${Date.now()}`
}

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { projectId } = await context.params
  const project = await loadProject(projectId, guard.access.empresaId!)
  if (!project?.id) {
    return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })
  }

  const pages = await prisma.websiteProjectPage.findMany({
    where: { websiteProjectId: projectId },
    orderBy: [{ isHome: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      nombre: true,
      slug: true,
      isHome: true,
      status: true,
      draftData: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, items: pages.map(serializeWebsiteProjectPage) })
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { projectId } = await context.params
  const project = await loadProject(projectId, guard.access.empresaId!)
  if (!project?.id) {
    return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const nombre = normalizeString(body?.nombre)
  if (!nombre) {
    return NextResponse.json({ ok: false, error: 'El nombre de la página es obligatorio.' }, { status: 400 })
  }

  const slug = await buildUniquePageSlug(projectId, nombre)

  const created = await prisma.websiteProjectPage.create({
    data: {
      websiteProjectId: projectId,
      nombre,
      slug,
      status: 'DRAFT',
      draftData: toWebsiteBuilderInputJsonValue(defaultWebsiteBuilderData()),
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      isHome: true,
      status: true,
      draftData: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, item: serializeWebsiteProjectPage(created) })
}