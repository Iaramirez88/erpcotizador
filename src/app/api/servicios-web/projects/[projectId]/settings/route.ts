import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'
import { normalizeWebsiteSiteSettings, websiteSiteSettingsSchema } from '@/lib/website-site-settings'

export const runtime = 'nodejs'

async function loadOwnedProject(projectId: string, empresaId: string) {
  return prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId },
    select: { id: true, themeJson: true },
  })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project?.id) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  return NextResponse.json({
    ok: true,
    settings: normalizeWebsiteSiteSettings(project.themeJson),
    isSuperAdmin: guard.access.isSuperAdmin,
  })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project?.id) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = websiteSiteSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Los ajustes recibidos no son válidos.' }, { status: 400 })
  }

  let settings = parsed.data
  if (!guard.access.isSuperAdmin) {
    // El código JavaScript personalizado solo lo puede editar el superadmin.
    settings = { ...settings, customJsHead: '', customJsBody: '' }
  }

  const updated = await prisma.websiteProject.update({
    where: { id: projectId },
    data: {
      themeJson: settings as unknown as Prisma.InputJsonValue,
      updatedByUserId: guard.userId,
    },
    select: { id: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, settings, updatedAt: updated.updatedAt.toISOString() })
}
