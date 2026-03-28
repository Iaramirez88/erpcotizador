import { NextRequest, NextResponse } from 'next/server'
import { createCotizacionShareToken } from '@/lib/share-token'
import { getRequestBaseUrl } from '@/lib/app-url'
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
    const before = await prisma.cotizacion.findFirst({
      where: {
        id,
        cliente: { is: { empresaId: access.empresaId } },
        AND: [{ OR: [{ sedeId: access.sedeId }, { sedeId: null }] }],
      },
      select: {
        id: true,
        estado: true,
        sedeId: true,
        emailSentCount: true,
        whatsappSentCount: true,
        lastEmailSentAt: true,
        lastWhatsappSentAt: true,
      },
    })

    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Cotización no encontrada' },
        { status: 404 }
      )
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.cotizacion.update({
        where: { id },
        data: {
          whatsappSentCount: { increment: 1 },
          lastWhatsappSentAt: new Date(),
        },
        select: {
          id: true,
          estado: true,
          emailSentCount: true,
          whatsappSentCount: true,
          lastEmailSentAt: true,
          lastWhatsappSentAt: true,
          subtotal: true,
          iva: true,
          total: true,
          descuento: true,
        },
      })

      await tx.cotizacionAuditEvent.create({
        data: {
          cotizacionId: updated.id,
          action: 'SENT',
          effect: 'NONE',
          performedById: access.userId,
          requestedById: access.userId,
          before: {
            estado: before.estado,
            emailSentCount: before.emailSentCount,
            whatsappSentCount: before.whatsappSentCount,
            lastEmailSentAt: before.lastEmailSentAt,
            lastWhatsappSentAt: before.lastWhatsappSentAt,
          },
          after: {
            estado: updated.estado,
            emailSentCount: updated.emailSentCount,
            whatsappSentCount: updated.whatsappSentCount,
            lastEmailSentAt: updated.lastEmailSentAt,
            lastWhatsappSentAt: updated.lastWhatsappSentAt,
            channel: 'whatsapp',
            expSeconds: ttlSeconds,
            subtotal: updated.subtotal,
            iva: updated.iva,
            total: updated.total,
            descuento: updated.descuento,
          },
        },
      })
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
    getRequestBaseUrl(request) ||
    request.nextUrl.origin
  const baseUrl = String(baseUrlRaw || '').replace(/\/+$/, '')

  const url = `${baseUrl}/api/public/cotizaciones/pdf?token=${encodeURIComponent(token)}`

  return NextResponse.json({ success: true, data: { url, token, expSeconds: ttlSeconds } })
}
