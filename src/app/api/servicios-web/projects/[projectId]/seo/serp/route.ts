import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { collectSerpResults, enqueueSerpChecks } from '@/lib/seo-rank-tracker'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

    const { projectId } = await context.params
    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, empresaId: guard.access.empresaId! },
      select: { id: true, seoKeywords: { where: { active: true } } },
    })
    if (!project) return NextResponse.json({ error: 'Sitio no encontrado.' }, { status: 404 })
    if (!project.seoKeywords.length) return NextResponse.json({ error: 'Agrega al menos una palabra clave.' }, { status: 400 })

    const collected = await collectSerpResults({ empresaId: guard.access.empresaId!, limit: 100 })
    const queued = await enqueueSerpChecks(project.seoKeywords)
    return NextResponse.json({ success: true, data: { collected, queued } })
  } catch (error) {
    console.error('Error ejecutando Rank Tracker:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo ejecutar el Rank Tracker.' }, { status: 500 })
  }
}
