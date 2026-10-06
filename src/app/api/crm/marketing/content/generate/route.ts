import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { generateContentDraft } from '@/lib/crm-content-agent'
import { normalizeString } from '@/lib/crm'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const seedIdea = normalizeString(body?.seedIdea).slice(0, 4000)
    const targetKeyword = normalizeString(body?.targetKeyword).slice(0, 200) || null
    const contentType = normalizeString(body?.contentType).slice(0, 80) || 'BLOG_POST'
    const websiteProjectId = normalizeString(body?.websiteProjectId) || null
    const competitorUrls = Array.isArray(body?.competitorUrls)
      ? body.competitorUrls.map(normalizeString).filter(Boolean).slice(0, 3)
      : []

    if (!seedIdea) return NextResponse.json({ error: 'Describe la idea que deseas desarrollar.' }, { status: 400 })
    if (!websiteProjectId) return NextResponse.json({ error: 'Selecciona el sitio cuyo contenido se usará como contexto.' }, { status: 400 })

    const website = await prisma.websiteProject.findFirst({
      where: { id: websiteProjectId, empresaId: access.empresaId },
      select: {
        id: true,
        nombre: true,
        seoJson: true,
        pages: {
          select: { nombre: true, slug: true, seoTitle: true, seoDescription: true, draftData: true },
          take: 30,
        },
      },
    })
    if (!website) return NextResponse.json({ error: 'El sitio web no pertenece a esta empresa.' }, { status: 404 })

    const generated = await generateContentDraft({
      seedIdea,
      targetKeyword,
      contentType,
      competitorUrls,
      currentWebsiteContent: website,
    })
    const row = await prisma.crmContentBrief.create({
      data: {
        empresaId: access.empresaId,
        websiteProjectId,
        title: generated.draft.title,
        seedIdea,
        targetKeyword: generated.draft.targetKeyword || targetKeyword,
        competitorUrls,
        status: 'DRAFT',
        contentType,
        generatedText: generated.draft.content,
        generatedContentJson: {
          ...generated.draft,
          competitorResearch: generated.competitorResearch,
        } as Prisma.InputJsonValue,
        createdById: access.userId,
      },
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el contenido.'
    console.error('Error generando contenido SEO:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
