import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const busqueda = (searchParams.get('busqueda') || '').trim()
    const estado = (searchParams.get('estado') || '').trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sedeId: access.sedeId }

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda, mode: 'insensitive' as const } },
        { cliente: { nombre: { contains: busqueda, mode: 'insensitive' as const } } },
      ]
    }

    if (estado) where.estado = estado

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        id: true,
        numero: true,
        estado: true,
        prioridad: true,
        areaResponsable: true,
        fechaEntrega: true,
        subtotal: true,
        iva: true,
        total: true,
        observaciones: true,
        createdAt: true,
        assignedAt: true,
        assignedTo: { select: { name: true, email: true } },
        cliente: { select: { nombre: true, email: true, telefono: true } },
        vendedor: { select: { name: true, email: true } },
        cotizacion: { select: { numero: true } },
      },
    })

    const rows = ordenes.map((o) => ({
      ID: o.id,
      Numero: o.numero,
      Estado: o.estado,
      Prioridad: o.prioridad ?? '',
      FechaEntrega: o.fechaEntrega ?? '',
      Subtotal: o.subtotal ?? 0,
      IVA: o.iva ?? 0,
      Total: o.total ?? 0,
      Observaciones: o.observaciones ?? '',
      Creado: o.createdAt,
      AsignadoAt: o.assignedAt ?? '',
      AsignadoA: o.assignedTo?.name ?? o.assignedTo?.email ?? '',
      AreaResponsable: o.areaResponsable ?? '',
      Cliente: o.cliente?.nombre ?? '',
      ClienteEmail: o.cliente?.email ?? '',
      ClienteTelefono: o.cliente?.telefono ?? '',
      Vendedor: o.vendedor?.name ?? o.vendedor?.email ?? '',
      CotizacionNumero: o.cotizacion?.numero ?? '',
    }))

    const buffer = buildXlsxBuffer([{ name: 'Ordenes', rows }])
    const filename = `ordenes-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando órdenes:', error)
    return NextResponse.json({ success: false, error: 'Error exportando órdenes' }, { status: 500 })
  }
}
