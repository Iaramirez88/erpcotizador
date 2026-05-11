import { NextRequest, NextResponse } from 'next/server'
import { saveExternalStorageConnection, verifySignedExternalStorageState, type CrmExternalStorageProvider } from '@/lib/crm-external-storage'

export const runtime = 'nodejs'

function parseProvider(value: unknown): CrmExternalStorageProvider | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'GOOGLE_DRIVE' || raw === 'ONEDRIVE' ? raw : null
}

function popupHtml(status: 'success' | 'error', message: string) {
  const safeMessage = JSON.stringify(message)
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>${status === 'success' ? 'Conexión lista' : 'Conexión fallida'}</title></head><body style="font-family:system-ui,sans-serif;padding:24px"><p>${message}</p><script>try{window.opener&&window.opener.postMessage({type:'crm-external-storage-${status}',message:${safeMessage}}, window.location.origin)}catch(e){};setTimeout(function(){window.close()},300);</script></body></html>`
}

export async function GET(request: NextRequest) {
  const provider = parseProvider(request.nextUrl.searchParams.get('provider'))
  const state = String(request.nextUrl.searchParams.get('state') || '').trim()
  const code = String(request.nextUrl.searchParams.get('code') || '').trim()
  const oauthError = String(request.nextUrl.searchParams.get('error') || '').trim()

  if (!provider) {
    return new NextResponse(popupHtml('error', 'Proveedor OAuth no válido.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const verified = verifySignedExternalStorageState(state)
  if (!verified || verified.provider !== provider) {
    return new NextResponse(popupHtml('error', 'El estado OAuth expiró o no es válido.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (oauthError) {
    return new NextResponse(popupHtml('error', `El proveedor devolvió: ${oauthError}`), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (!code) {
    return new NextResponse(popupHtml('error', 'No se recibió el código de autorización.'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  try {
    const result = await saveExternalStorageConnection({ provider, userId: verified.userId, code, origin: request.nextUrl.origin })
    return new NextResponse(popupHtml('success', `Conexión lista con ${result.accountLabel}.`), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return new NextResponse(popupHtml('error', detail), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}