import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { buildExternalStorageAuthUrl, createSignedExternalStorageState, type CrmExternalStorageProvider } from '@/lib/crm-external-storage'

export const runtime = 'nodejs'

function parseProvider(value: unknown): CrmExternalStorageProvider | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'GOOGLE_DRIVE' || raw === 'ONEDRIVE' ? raw : null
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const provider = parseProvider(request.nextUrl.searchParams.get('provider'))
    if (!provider) {
      return NextResponse.json({ success: false, error: 'Proveedor externo no válido.' }, { status: 400 })
    }

    const state = createSignedExternalStorageState({
      provider,
      userId: access.userId,
      issuedAt: Math.floor(Date.now() / 1000),
    })
    return NextResponse.redirect(buildExternalStorageAuthUrl({ provider, state, origin: request.nextUrl.origin }))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}