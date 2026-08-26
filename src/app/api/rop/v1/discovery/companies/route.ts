import { NextRequest, NextResponse } from 'next/server'
import { listRopDiscoveryCompaniesForUser } from '@/lib/rop'
import { requireRopReadAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

function parseNumber(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireRopReadAccess()
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const data = await listRopDiscoveryCompaniesForUser(access.userId, {
      serviceCatalogId: searchParams.get('serviceCatalogId') || undefined,
      city: searchParams.get('city') || undefined,
      coverageScope: (searchParams.get('coverageScope') as 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null) || undefined,
      minTrustScore: parseNumber(searchParams.get('minTrustScore')) ?? undefined,
      availabilityStatus: (searchParams.get('availabilityStatus') as 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null) || undefined,
      clusterId: searchParams.get('clusterId') || undefined,
      search: searchParams.get('search') || undefined,
    })

    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_DISCOVERY_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar discovery.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}