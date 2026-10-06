import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { collectSerpResults, enqueueSerpChecks, findDueSeoKeywords } from '@/lib/seo-rank-tracker'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const collected = await collectSerpResults({ limit: 100 })
    const dueKeywords = await findDueSeoKeywords({ days: 7, limit: 100 })
    const queued = await enqueueSerpChecks(dueKeywords)
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), data: { collected, queued } })
  } catch (error) {
    console.error('Error en job SEO Rank Tracker:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error inesperado', timestamp: new Date().toISOString() }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({
    endpoint: '/api/admin/jobs/seo-rank-tracker',
    method: 'POST',
    description: 'Recoge resultados pendientes y encola keywords sin rastrear durante los últimos siete días.',
    authentication: 'Requiere X-API-Key o Authorization: Bearer.',
    cron_setup: '0 */2 * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/seo-rank-tracker -H "X-API-Key: YOUR_KEY"',
  })
}
