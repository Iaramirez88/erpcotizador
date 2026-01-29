import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pdf } from '@react-pdf/renderer';
import CotizacionPDF from '@/lib/pdf-template';
import { requireApiAccess } from '@/lib/api-rbac';
import { ModuleKey } from '@prisma/client';

function normalizePublicUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return raw
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ');
    if (!access.ok) return access.response;

    const { id } = await context.params;

    const origin = new URL(request.url).origin

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const userId = access.userId;
    const userTemplate = await prisma.cotizacionTemplate.findUnique({
      where: { userId },
      select: { settings: true },
    });

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
        items: cotizacion.items.map((item) => {
          const unidad = String(item.unidad || '').trim().toLowerCase()
          const anchoM = typeof item.ancho === 'number' ? item.ancho / 100 : null
          const altoM = typeof item.alto === 'number' ? item.alto / 100 : null

          const medida =
            unidad === 'ml'
              ? (anchoM ?? 0)
              : unidad === 'm2'
                ? (typeof item.area === 'number' ? item.area : (anchoM ?? 0) * (altoM ?? 0))
                : 0

          const placeholder = `${origin}/api/assets/placeholder-product?s=64`
          const materialImage = item.material
            ? normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin)
            : null

          return {
            descripcion: item.descripcion,
            unidad: item.unidad,
            cantidad: item.cantidad,
            ancho: anchoM,
            alto: altoM,
            metrosCuadrados: medida,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            laminado: item.laminado,
            troquelado: item.troquelado,
            instalacion: item.instalacion,
            costoInstalacion: item.costoInstalacion,
            imagenUrl: materialImage || placeholder,
            material: item.material
              ? {
                  nombre: item.material.nombre,
                  tipo: item.material.tipo,
                  imagenUrl: materialImage,
                }
              : null,
          }
        }),
        subtotal: cotizacion.subtotal,
        iva: cotizacion.iva,
        total: cotizacion.total,
      },
      template: userTemplate?.settings,
    });
    const pdfBlob = await pdf(pdfDoc).toBlob();
    const arrayBuffer = await pdfBlob.arrayBuffer();

    const { searchParams } = new URL(request.url)
    const wantsDownload = searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Cotizacion-${cotizacion.numero}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generando PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    );
  }
}
