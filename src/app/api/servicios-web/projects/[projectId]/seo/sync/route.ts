import { NextResponse } from 'next/server'
import { syncWebsiteProjectSearchConsole } from '@/lib/seo-search-console'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    const { projectId } = await context.params
    const result = await syncWebsiteProjectSearchConsole({ empresaId: guard.access.empresaId!, projectId })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error sincronizando SEO del sitio:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el SEO del sitio.' }, { status: 500 })
  }
}
