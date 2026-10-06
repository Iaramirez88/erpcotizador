import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncWebsiteProjectSearchConsole } from '@/lib/seo-search-console'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projects = await prisma.websiteProject.findMany({ where: { seoKeywords: { some: { active: true } } }, orderBy: { updatedAt: 'asc' }, take: 20, select: { id: true, empresaId: true } })
  let completed = 0
  const failures: Array<{ projectId: string; error: string }> = []
  for (const project of projects) {
    try {
      await syncWebsiteProjectSearchConsole({ empresaId: project.empresaId, projectId: project.id })
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
  return NextResponse.json({ endpoint: '/api/admin/jobs/seo-search-console', method: 'POST', description: 'Sincroniza diariamente hasta 20 sitios conectados a Search Console.', authentication: 'Requiere X-API-Key o Authorization: Bearer.', cronSetup: '30 4 * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/seo-search-console -H "X-API-Key: YOUR_KEY"' })
}