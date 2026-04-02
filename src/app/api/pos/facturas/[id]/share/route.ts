import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { createPosInvoiceShareToken } from '@/lib/share-token'
import { getRequestBaseUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as { ttlSeconds?: number }
  const ttlSeconds = typeof body.ttlSeconds === 'number' ? body.ttlSeconds : 60 * 60 * 24 * 14

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Falta configurar SHARE_TOKEN_SECRET (o NEXTAUTH_SECRET).' },
      { status: 500 },
    )
  }

  const invoice = await prisma.posInvoice.findUnique({
    where: { id },
    select: { id: true, empresaId: true, sedeId: true },
  })

  if (!invoice || invoice.empresaId !== access.empresaId || invoice.sedeId !== access.sedeId) {
    return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
  }

  const token = createPosInvoiceShareToken({ posInvoiceId: id, ttlSeconds, secret })
  const baseUrlRaw = getRequestBaseUrl(request) || request.nextUrl.origin
  const baseUrl = String(baseUrlRaw || '').replace(/\/+$/, '')
  const url = `${baseUrl}/api/public/pos/facturas/pdf?token=${encodeURIComponent(token)}`

  await prisma.posInvoiceAuditEvent.create({
    data: {
      invoiceId: invoice.id,
      action: 'SHARED_WHATSAPP',
      performedById: access.userId,
      after: {
        url,
        ttlSeconds,
      },
    },
  }).catch(() => null)

  return NextResponse.json({ success: true, data: { url, token, expSeconds: ttlSeconds } })
}