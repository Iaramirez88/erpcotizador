import { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'
import { auditWebsitePage } from '@/lib/website-seo-audit'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const projects = await prisma.websiteProject.findMany({
    where: {
      OR: [
        { seoAudits: { none: {} } },
        { seoAudits: { none: { createdAt: { gt: cutoff } } } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: 20,
    select: { id: true, empresaId: true, seoJson: true },
  })

  let completed = 0
  const failures: Array<{ projectId: string; error: string }> = []
  for (const project of projects) {
    const targetUrl = String(parseJsonObject(project.seoJson).siteUrl || '').trim()
    if (!targetUrl) continue
    try {
      const audit = await auditWebsitePage(targetUrl)
      await prisma.websiteSeoAudit.create({
        data: {
          empresaId: project.empresaId,
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
      completed += 1
    } catch (error) {
      failures.push({ projectId: project.id, error: error instanceof Error ? error.message.slice(0, 300) : 'Error desconocido' })
    }
  }

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), data: { inspected: projects.length, completed, failures } })
}

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({
    endpoint: '/api/admin/jobs/seo-audits',
    method: 'POST',
    description: 'Audita hasta 20 sitios que no tengan una auditoría en los últimos siete días.',
    authentication: 'Requiere X-API-Key o Authorization: Bearer.',
    cronSetup: '15 3 * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/seo-audits -H "X-API-Key: YOUR_KEY"',
  })
}