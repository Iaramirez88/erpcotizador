import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  defaultWebsiteBuilderData,
  normalizeString,
  serializeWebsiteProject,
  slugifyWebsiteBuilderValue,
} from '@/lib/website-builder'
import { requireWebsiteBuilderAccess, toWebsiteBuilderInputJsonValue } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

async function buildUniqueProjectSlug(empresaId: string, value: string) {
  const base = slugifyWebsiteBuilderValue(value)

  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`
    const existing = await prisma.websiteProject.findFirst({
      where: { empresaId, slug: candidate },
      select: { id: true },
    })
    if (!existing?.id) return candidate
  }

  return `${base}-${Date.now()}`
}

export async function GET() {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const projects = await prisma.websiteProject.findMany({
    where: { empresaId: guard.access.empresaId },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      nombre: true,
      slug: true,
      subdomain: true,
      primaryDomain: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      pages: {
        orderBy: [{ isHome: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          nombre: true,
          slug: true,
          isHome: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  return NextResponse.json({ ok: true, items: projects.map(serializeWebsiteProject) })
}

export async function POST(req: NextRequest) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const body = await req.json().catch(() => null)
  const nombre = normalizeString(body?.nombre)
  if (!nombre) {
    return NextResponse.json({ ok: false, error: 'El nombre del sitio es obligatorio.' }, { status: 400 })
  }

  const slug = await buildUniqueProjectSlug(guard.access.empresaId!, nombre)
  const homeData = toWebsiteBuilderInputJsonValue(defaultWebsiteBuilderData())

  const created = await prisma.websiteProject.create({
    data: {
      empresaId: guard.access.empresaId!,
      nombre,
      slug,
      subdomain: slug,
      status: 'DRAFT',
      createdByUserId: guard.userId,
      updatedByUserId: guard.userId,
      pages: {
        create: {
          nombre: 'Inicio',
          slug: 'inicio',
          isHome: true,
          status: 'DRAFT',
          draftData: homeData,
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      subdomain: true,
      primaryDomain: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      pages: {
        orderBy: [{ isHome: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          nombre: true,
          slug: true,
          isHome: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  return NextResponse.json({ ok: true, item: serializeWebsiteProject(created) })
}