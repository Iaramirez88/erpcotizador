import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pdf } from '@react-pdf/renderer'
import CotizacionPDF from '@/lib/pdf-template'
import { verifyCotizacionShareToken } from '@/lib/share-token'

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
      { status: 500 }
    )
  }

  const verified = verifyCotizacionShareToken(token, secret)
  if (!verified) {
    return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
  }

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: verified.cotizacionId },
    include: {
      cliente: true,
      vendedor: { select: { id: true, name: true, email: true } },
      items: { include: { material: true } },
    },
  })

  if (!cotizacion) {
    return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
  }

  const cotizacionTemplateDelegate = (prisma as unknown as { cotizacionTemplate?: { findUnique?: unknown } })
    .cotizacionTemplate
  const template = typeof cotizacionTemplateDelegate?.findUnique === 'function'
    ? await prisma.cotizacionTemplate.findUnique({
        where: { userId: cotizacion.vendedor.id },
        select: { settings: true },
      })
    : null

  const pdfDoc = CotizacionPDF({
    cotizacion: {
      numero: cotizacion.numero,
      createdAt: cotizacion.createdAt,
      validezDias: cotizacion.validezDias,
      estado: cotizacion.estado,
      observaciones: cotizacion.observaciones,
      cliente: {
        nombre: cotizacion.cliente.nombre,
        email: cotizacion.cliente.email,
        telefono: cotizacion.cliente.telefono,
      },
      vendedor: {
        name: cotizacion.vendedor.name,
        email: cotizacion.vendedor.email,
      },
      items: cotizacion.items.map((item) => ({
        cantidad: item.cantidad,
        ancho: item.ancho,
        alto: item.alto,
        metrosCuadrados: (item.ancho || 0) * (item.alto || 0) * item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        laminado: item.laminado,
        troquelado: item.troquelado,
        instalacion: item.instalacion,
        material: item.material
          ? {
              nombre: item.material.nombre,
              tipo: item.material.tipo,
            }
          : null,
      })),
      subtotal: cotizacion.subtotal,
      iva: cotizacion.iva,
      total: cotizacion.total,
    },
    template: template?.settings,
  })

  const pdfBlob = await pdf(pdfDoc).toBlob()
  const arrayBuffer = await pdfBlob.arrayBuffer()

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Cotizacion-${cotizacion.numero}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
