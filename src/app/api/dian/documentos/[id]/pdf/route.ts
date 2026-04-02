import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { getRequestBaseUrl } from '@/lib/app-url'
import { renderDianDocumentPdf } from '@/lib/dian-document-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const origin = getRequestBaseUrl(request)
    const rendered = await renderDianDocumentPdf({ documentId: id, origin })

    if (!rendered || rendered.document.empresaId !== access.empresaId || rendered.document.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Documento DIAN no encontrado' }, { status: 404 })
    }

    const wantsDownload = request.nextUrl.searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(rendered.arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="DIAN-${rendered.document.numero || rendered.document.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF DIAN:', error)
    return NextResponse.json({ error: 'Error al generar PDF DIAN' }, { status: 500 })
  }
}