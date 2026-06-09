import { NextRequest, NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { listExternalStorageItems, type CrmExternalStorageProvider } from '@/lib/crm-external-storage'

export const runtime = 'nodejs'

function parseProvider(value: unknown): CrmExternalStorageProvider | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'GOOGLE_DRIVE' || raw === 'ONEDRIVE' ? raw : null
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const provider = parseProvider(request.nextUrl.searchParams.get('provider'))
    const query = String(request.nextUrl.searchParams.get('q') || '').trim()
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Proveedor externo no válido.' }, { status: 400 })
    }

    const result = await listExternalStorageItems({ userId: access.userId, provider, query, origin: request.nextUrl.origin })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}