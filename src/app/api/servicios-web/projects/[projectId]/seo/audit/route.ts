import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'
import { auditWebsitePage } from '@/lib/website-seo-audit'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    const { projectId } = await context.params
    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, empresaId: guard.access.empresaId! },
      select: { id: true, seoJson: true },
    })
    if (!project) return NextResponse.json({ error: 'Sitio no encontrado.' }, { status: 404 })
    const targetUrl = String(parseJsonObject(project.seoJson).siteUrl || '').trim()
    if (!targetUrl) return NextResponse.json({ error: 'Guarda primero la URL pública del sitio.' }, { status: 409 })

    const audit = await auditWebsitePage(targetUrl)
    const saved = await prisma.websiteSeoAudit.create({
      data: {
        empresaId: guard.access.empresaId!,
        websiteProjectId: project.id,
        targetUrl: audit.targetUrl,
        finalUrl: audit.finalUrl,
        statusCode: audit.statusCode,
        healthScore: audit.healthScore,
        indexable: audit.indexable,
        checksJson: audit.checks as unknown as Prisma.InputJsonValue,
        recommendationsJson: audit.recommendations as Prisma.InputJsonValue,
        metricsJson: audit.metrics as unknown as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json({ success: true, data: saved })
  } catch (error) {
    console.error('Error auditando sitio web:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo auditar el sitio.' }, { status: 500 })
  }
}