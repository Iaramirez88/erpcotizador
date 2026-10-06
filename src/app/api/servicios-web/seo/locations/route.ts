import { NextRequest, NextResponse } from 'next/server'
import { getSerpProvider } from '@/lib/seo-serp-provider'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    const provider = getSerpProvider()
    if (!provider.isConfigured()) return NextResponse.json({ error: 'DataForSEO no está configurado.' }, { status: 409 })
    const country = (request.nextUrl.searchParams.get('country') || 'COL').toUpperCase().slice(0, 3)
    const search = (request.nextUrl.searchParams.get('q') || '').trim().toLocaleLowerCase('es')
    const locations = await provider.getLocations(country)
    const filtered = search ? locations.filter((item) => item.name.toLocaleLowerCase('es').includes(search)) : locations
    return NextResponse.json({ success: true, data: filtered.slice(0, 50) })
  } catch (error) {
    console.error('Error consultando ubicaciones SERP:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron consultar las ubicaciones.' }, { status: 500 })
  }
}