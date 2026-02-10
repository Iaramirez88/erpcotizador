import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const limit = Math.min(5000, Math.max(1, Number(searchParams.get('limit') || 5000)))

    const [invoices, returns] = await Promise.all([
      prisma.posInvoice.findMany({
        where: { empresaId, sedeId: access.sedeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          numero: true,
          status: true,
          clienteNombre: true,
          clienteDocumento: true,
          subtotal: true,
          iva: true,
          total: true,
          createdAt: true,
          warehouse: { select: { nombre: true } },
        },
      }),
      prisma.posReturn.findMany({
        where: { empresaId, sedeId: access.sedeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          numero: true,
          motivo: true,
          subtotal: true,
          iva: true,
          total: true,
          createdAt: true,
          invoice: { select: { numero: true } },
          warehouse: { select: { nombre: true } },
        },
      }),
    ])

    const invoiceRows = invoices.map((inv) => ({
      ID: inv.id,
      Numero: inv.numero,
      Estado: inv.status,
      Cliente: inv.clienteNombre,
      ClienteDocumento: inv.clienteDocumento ?? '',
      Sede: inv.warehouse?.nombre ?? '',
      Subtotal: inv.subtotal ?? 0,
      IVA: inv.iva ?? 0,
      Total: inv.total ?? 0,
      Creado: inv.createdAt,
    }))

    const returnRows = returns.map((r) => ({
      ID: r.id,
      Numero: r.numero,
      Factura: r.invoice?.numero ?? '',
      Sede: r.warehouse?.nombre ?? '',
      Motivo: r.motivo ?? '',
      Subtotal: r.subtotal ?? 0,
      IVA: r.iva ?? 0,
      Total: r.total ?? 0,
      Creado: r.createdAt,
    }))

    const buffer = buildXlsxBuffer([
      { name: 'Facturas', rows: invoiceRows },
      { name: 'Devoluciones', rows: returnRows },
    ])

    const filename = `pos-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando POS:', error)
    return NextResponse.json({ success: false, error: 'Error exportando POS' }, { status: 500 })
  }
}
