import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

function safeDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const estado = (searchParams.get('estado') || '').trim()
    const autorizado = (searchParams.get('autorizado') || '').trim()
    const sede = (searchParams.get('sede') || '').trim()
    const from = safeDate((searchParams.get('from') || '').trim() || null)
    const to = safeDate((searchParams.get('to') || '').trim() || null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: access.userId, sedeId: access.sedeId }

    if (search) {
      where.OR = [
        { proveedorNombre: { contains: search, mode: 'insensitive' as const } },
        { numeroFactura: { contains: search, mode: 'insensitive' as const } },
        { numeroPedido: { contains: search, mode: 'insensitive' as const } },
        { numeroOrden: { contains: search, mode: 'insensitive' as const } },
        { observaciones: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (estado) where.estado = estado
    if (sede) where.sede = { contains: sede, mode: 'insensitive' as const }
    if (autorizado) where.autorizado = autorizado === 'true'

    if (from || to) {
      where.fechaCompra = {}
      if (from) where.fechaCompra.gte = from
      if (to) where.fechaCompra.lte = to
    }

    const compras = await prisma.compra.findMany({
      where,
      include: {
        items: { orderBy: { orden: 'asc' } },
      },
      orderBy: { fechaCompra: 'desc' },
      take: 5000,
    })

    const compraIds = compras.map((c) => c.id)
    const pagosByCompra = compraIds.length
      ? await prisma.compraPago.groupBy({
          by: ['compraId'],
          where: { compraId: { in: compraIds } },
          _sum: { monto: true },
        })
      : []

    const paidMap = new Map(pagosByCompra.map((g) => [g.compraId, g._sum.monto ?? 0]))

    const rows = compras.map((c) => {
      const pagado = paidMap.get(c.id) ?? 0
      const total = n((c as { total?: unknown }).total, 0)
      const saldo = total - pagado

      return {
        ID: c.id,
        FechaCompra: c.fechaCompra,
        Estado: (c as { estado?: string | null }).estado ?? '',
        Proveedor: c.proveedorNombre,
        TelefonoProveedor: c.proveedorTelefono ?? '',
        DireccionProveedor: c.proveedorDireccion ?? '',
        RecibidoPor: c.recibidoPorNombre ?? '',
        NumeroFactura: c.numeroFactura ?? '',
        NumeroOrden: c.numeroOrden ?? '',
        NumeroPedido: c.numeroPedido ?? '',
        Sede: c.sede ?? '',
        Autorizado: c.autorizado ? 'SI' : 'NO',
        SubtotalSinIva: n(c.subtotalSinIva, 0),
        IVA: n(c.iva, 0),
        DescuentoTotal: n(c.descuentoTotal, 0),
        SubtotalConIva: n(c.subtotalConIva, 0),
        Total: total,
        Pagado: n(pagado, 0),
        Saldo: n(saldo, 0),
        Observaciones: c.observaciones ?? '',
        ItemsCount: Array.isArray(c.items) ? c.items.length : 0,
      }
    })

    const buffer = buildXlsxBuffer([{ name: 'Compras', rows }])
    const filename = `compras-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando compras:', error)
    return NextResponse.json({ success: false, error: 'Error exportando compras' }, { status: 500 })
  }
}
