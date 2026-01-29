import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pdf } from '@react-pdf/renderer'
import CotizacionPDF from '@/lib/pdf-template'
import { verifyCotizacionShareToken } from '@/lib/share-token'

export const runtime = 'nodejs'

function normalizePublicUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return raw
}

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

  const template = await prisma.cotizacionTemplate.findUnique({
    where: { userId: cotizacion.vendedor.id },
    select: { settings: true },
  })

  const origin = new URL(request.url).origin

  const pdfDoc = CotizacionPDF({
    cotizacion: {
      numero: cotizacion.numero,
      createdAt: cotizacion.createdAt,
      validezDias: cotizacion.validezDias,
      estado: cotizacion.estado,
      observaciones: cotizacion.observaciones,
      garantia: cotizacion.garantia ?? null,
      paymentMethods: cotizacion.paymentMethods ?? [],
      boldCheckoutUrl: cotizacion.boldCheckoutUrl ?? null,
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
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        ancho: typeof item.ancho === 'number' ? item.ancho / 100 : null,
        alto: typeof item.alto === 'number' ? item.alto / 100 : null,
        metrosCuadrados: (() => {
          const unidad = String(item.unidad || '').trim().toLowerCase()
          const anchoM = typeof item.ancho === 'number' ? item.ancho / 100 : null
          const altoM = typeof item.alto === 'number' ? item.alto / 100 : null
          return unidad === 'ml'
            ? (anchoM ?? 0)
            : unidad === 'm2'
              ? (typeof item.area === 'number' ? item.area : (anchoM ?? 0) * (altoM ?? 0))
              : 0
        })(),
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        laminado: item.laminado,
        troquelado: item.troquelado,
        instalacion: item.instalacion,
        costoInstalacion: item.costoInstalacion,
        imagenUrl:
          (item.material
            ? normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin)
            : null) || `${origin}/api/assets/placeholder-product?s=64`,
        material: item.material
          ? {
              nombre: item.material.nombre,
              tipo: item.material.tipo,
              imagenUrl: normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin),
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
