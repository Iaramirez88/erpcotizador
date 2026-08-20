import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeWebsiteBuilderData,
  serializeWebsiteProjectVersion,
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
      websiteProjectId: true,
    },
  })
}

export async function POST(req: NextRequest, context: { params: Promise<{ pageId: string }> }) {
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
  const editorJson = toWebsiteBuilderInputJsonValue(normalizeWebsiteBuilderData(body?.data))

  const version = await prisma.$transaction(async (tx) => {
    const lastVersion = await tx.websiteProjectPageVersion.findFirst({
      where: { websiteProjectPageId: pageId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })

    await tx.websiteProjectPageVersion.updateMany({
      where: { websiteProjectPageId: pageId, isPublished: true },
      data: { isPublished: false },
    })

    const created = await tx.websiteProjectPageVersion.create({
      data: {
        websiteProjectPageId: pageId,
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        editorJson,
        isPublished: true,
        createdByUserId: guard.userId,
      },
      select: {
        id: true,
        versionNumber: true,
        editorJson: true,
        isPublished: true,
        createdAt: true,
      },
    })

    await tx.websiteProjectPage.update({
      where: { id: pageId },
      data: {
        draftData: editorJson,
        status: 'PUBLISHED',
      },
    })

    await tx.websiteProject.update({
      where: { id: page.websiteProjectId },
      data: { status: 'PUBLISHED', updatedByUserId: guard.userId },
    })

    return created
  })

  return NextResponse.json({ ok: true, item: serializeWebsiteProjectVersion(version) })
}