import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'
import { getSerpProvider } from '@/lib/seo-serp-provider'
import { getSerpBudgetUsage } from '@/lib/seo-rank-tracker'
import { buildSeoIntelligence } from '@/lib/seo-intelligence'

export const runtime = 'nodejs'

type Context = { params: Promise<{ projectId: string }> }

export async function GET(_request: Request, context: Context) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const [project, connection, pendingSerpTasks, serpBudget] = await Promise.all([
    prisma.websiteProject.findFirst({
      where: { id: projectId, empresaId: guard.access.empresaId! },
      select: {
        id: true,
        nombre: true,
        slug: true,
        subdomain: true,
        primaryDomain: true,
        seoJson: true,
        seoKeywords: {
          orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
          include: { positions: { orderBy: { checkedAt: 'desc' }, take: 12 } },
        },
        seoAudits: { orderBy: { createdAt: 'desc' }, take: 12 },
      },
    }),
    prisma.crmMarketingConnection.findFirst({
      where: { empresaId: guard.access.empresaId! },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, googleEmail: true, scopes: true, lastSyncAt: true },
    }),
    prisma.crmSeoSerpTask.count({
      where: {
        empresaId: guard.access.empresaId!,
        status: { in: ['QUEUED', 'PROCESSING'] },
        keyword: { websiteProjectId: projectId },
      },
    }),
    getSerpBudgetUsage(),
  ])
  if (!project) return NextResponse.json({ error: 'Sitio no encontrado.' }, { status: 404 })

  const serpProvider = getSerpProvider()
  const intelligence = buildSeoIntelligence(project.seoKeywords)
  return NextResponse.json({ success: true, data: {
    project: { ...project, seoJson: parseJsonObject(project.seoJson) },
    connection,
    serp: { provider: serpProvider.name, configured: serpProvider.isConfigured(), pendingTasks: pendingSerpTasks, budget: serpBudget },
    intelligence,
  } })
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId: guard.access.empresaId! },
    select: { id: true, seoJson: true },
  })
  if (!project) return NextResponse.json({ error: 'Sitio no encontrado.' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const siteUrl = normalizeString(body?.siteUrl).slice(0, 2048)
  const searchConsoleSiteUrl = normalizeString(body?.searchConsoleSiteUrl).slice(0, 2048)
  try {
    const parsed = new URL(siteUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    if (searchConsoleSiteUrl && !searchConsoleSiteUrl.startsWith('sc-domain:')) {
      const property = new URL(searchConsoleSiteUrl)
      if (!['http:', 'https:'].includes(property.protocol)) throw new Error()
    }
  } catch {
    return NextResponse.json({ error: 'Indica una URL pública y una propiedad de Search Console válidas.' }, { status: 400 })
  }

  const seoJson = {
    ...parseJsonObject(project.seoJson),
    siteUrl,
    searchConsoleSiteUrl: searchConsoleSiteUrl || siteUrl,
    updatedAt: new Date().toISOString(),
  } as Prisma.InputJsonValue
  await prisma.websiteProject.update({
    where: { id: project.id },
    data: { seoJson, updatedByUserId: guard.userId },
  })
  return NextResponse.json({ success: true, data: seoJson })
}
