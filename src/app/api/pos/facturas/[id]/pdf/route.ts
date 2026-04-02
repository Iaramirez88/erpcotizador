import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { renderPosInvoicePdf } from '@/lib/pos-invoice-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const origin = getRequestBaseUrl(request) || new URL(request.url).origin

    const template = await prisma.posInvoiceTemplate.findUnique({ where: { userId: access.userId }, select: { settings: true } })
    const rendered = await renderPosInvoicePdf({ invoiceId: id, origin, templateSettings: template?.settings })

    if (!rendered || rendered.invoice.empresaId !== access.empresaId || rendered.invoice.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const wantsDownload = new URL(request.url).searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    if (wantsDownload) {
      await prisma.posInvoiceAuditEvent.create({
        data: {
          invoiceId: rendered.invoice.id,
          action: 'PDF_DOWNLOADED',
          performedById: access.userId,
          after: { channel: 'internal_download' },
        },
      }).catch(() => null)
    }

    return new NextResponse(rendered.arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Factura-${rendered.invoice.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF POS:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}