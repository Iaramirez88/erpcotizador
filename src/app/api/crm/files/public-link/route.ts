import { NextRequest, NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { createCrmFileShareToken } from '@/lib/share-token'

export const runtime = 'nodejs'

const PUBLIC_LINK_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días

function isSafeFilePath(path: string) {
  if (!path.trim()) return false
  return path.split('/').every((segment) => segment && segment !== '.' && segment !== '..' && !segment.includes('\\'))
}

/**
 * Genera un enlace público firmado para un archivo del Drive CRM.
 *
 * A diferencia de `/uploads/crm-files/...` (que el proxy reescribe a
 * `/api/uploads/...` y exige sesión), `/api/public/crm-files?token=...` es
 * público y no requiere login.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const path = (request.nextUrl.searchParams.get('path') ?? '').trim()
    if (!isSafeFilePath(path)) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })
    }

    const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Falta SHARE_TOKEN_SECRET o NEXTAUTH_SECRET' }, { status: 503 })
    }

    const token = createCrmFileShareToken({
      empresaId: access.empresaId,
      filePath: path,
      disposition: 'attachment',
      ttlSeconds: PUBLIC_LINK_TTL_SECONDS,
      secret,
    })

    const base = (getRequestBaseUrl(request) || request.nextUrl.origin).replace(/\/+$/, '')
    const url = `${base}/api/public/crm-files?token=${encodeURIComponent(token)}`

    return NextResponse.json({ success: true, data: { url } })
  } catch (error) {
    console.error('Error generando enlace público:', error)
    return NextResponse.json({ error: 'Error generando enlace público' }, { status: 500 })
  }
}
