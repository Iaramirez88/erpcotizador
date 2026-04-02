import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestBaseUrl } from '@/lib/app-url'
import { verifyPosInvoiceShareToken } from '@/lib/share-token'
import { renderPosInvoicePdf } from '@/lib/pos-invoice-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Falta token' }, { status: 400 })
  }

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Falta configurar SHARE_TOKEN_SECRET (o NEXTAUTH_SECRET).' },
      { status: 500 },
    )
  }

  const verified = verifyPosInvoiceShareToken(token, secret)
  if (!verified) {
    return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
  }

  const origin = getRequestBaseUrl(request) || new URL(request.url).origin
  const rendered = await renderPosInvoicePdf({ invoiceId: verified.posInvoiceId, origin })
  if (!rendered) {
    return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
  }

  await prisma.posInvoiceAuditEvent.create({
    data: {
      invoiceId: rendered.invoice.id,
      action: 'PDF_DOWNLOADED',
      note: 'El PDF público de la factura fue abierto desde un enlace compartido.',
      after: { channel: 'public_link' },
    },
  }).catch(() => null)

  return new NextResponse(rendered.arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Factura-${rendered.invoice.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}