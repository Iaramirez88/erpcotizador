import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeWebsiteBuilderData,
  serializeWebsiteProjectPage,
} from '@/lib/website-builder'
import { requireWebsiteBuilderAccess, toWebsiteBuilderInputJsonValue } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

async function loadPage(pageId: string, empresaId: string) {
  return prisma.websiteProjectPage.findFirst({
    where: {
      id: pageId,
      websiteProject: {
        empresaId,
      },
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
}

export async function GET(_req: NextRequest, context: { params: Promise<{ pageId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { pageId } = await context.params
  const page = await loadPage(pageId, guard.access.empresaId!)
  if (!page?.id) {
    return NextResponse.json({ ok: false, error: 'Página no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, item: serializeWebsiteProjectPage(page) })
}

export async function PUT(req: NextRequest, context: { params: Promise<{ pageId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  }

  const { pageId } = await context.params
  const page = await loadPage(pageId, guard.access.empresaId!)
  if (!page?.id) {
    return NextResponse.json({ ok: false, error: 'Página no encontrada.' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)

  const updated = await prisma.websiteProjectPage.update({
    where: { id: pageId },
    data: {
      draftData: toWebsiteBuilderInputJsonValue(normalizeWebsiteBuilderData(body?.data)),
      status: 'DRAFT',
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

  return NextResponse.json({ ok: true, item: serializeWebsiteProjectPage(updated) })
}