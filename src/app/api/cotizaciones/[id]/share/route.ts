import { NextRequest, NextResponse } from 'next/server'
import { createCotizacionShareToken } from '@/lib/share-token'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await context.params

  const body = (await request.json().catch(() => ({}))) as { ttlSeconds?: number }
  const ttlSeconds = typeof body.ttlSeconds === 'number' ? body.ttlSeconds : 60 * 60 * 24 * 7

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Falta configurar SHARE_TOKEN_SECRET (o NEXTAUTH_SECRET).' },
      { status: 500 }
    )
  }

  const token = createCotizacionShareToken({ cotizacionId: id, ttlSeconds, secret })

  try {
    await prisma.cotizacion.update({
      where: { id },
      data: {
        whatsappSentCount: { increment: 1 },
        lastWhatsappSentAt: new Date()
      }
    })
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    if (code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Cotización no encontrada' },
        { status: 404 }
      )
    }
    throw e
  }

  const baseUrlRaw =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.nextUrl.origin
  const baseUrl = String(baseUrlRaw || '').replace(/\/+$/, '')

  const url = `${baseUrl}/api/public/cotizaciones/pdf?token=${encodeURIComponent(token)}`

  return NextResponse.json({ success: true, data: { url, token, expSeconds: ttlSeconds } })
}
