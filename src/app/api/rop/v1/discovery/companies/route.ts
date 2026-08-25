import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { listRopDiscoveryCompaniesForUser } from '@/lib/rop'

export const runtime = 'nodejs'

function parseNumber(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    const userId = await resolveUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const data = await listRopDiscoveryCompaniesForUser(userId, {
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