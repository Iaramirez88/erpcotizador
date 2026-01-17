import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pdf } from '@react-pdf/renderer';
import CotizacionPDF from '@/lib/pdf-template';
import { requireApiAccess } from '@/lib/api-rbac';
import { ModuleKey } from '@prisma/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ');
    if (!access.ok) return access.response;

    const { id } = await context.params;

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
    const cotizacionTemplateDelegate = (prisma as unknown as { cotizacionTemplate?: { findUnique?: unknown } })
      .cotizacionTemplate;
    const userTemplate = typeof cotizacionTemplateDelegate?.findUnique === 'function'
      ? await prisma.cotizacionTemplate.findUnique({
          where: { userId },
          select: { settings: true },
        })
      : null;

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
        items: cotizacion.items.map(item => ({
          cantidad: item.cantidad,
          ancho: item.ancho,
          alto: item.alto,
          metrosCuadrados: (item.ancho || 0) * (item.alto || 0) * item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          laminado: item.laminado,
          troquelado: item.troquelado,
          instalacion: item.instalacion,
          material: item.material ? {
            nombre: item.material.nombre,
            tipo: item.material.tipo,
          } : null,
        })),
        subtotal: cotizacion.subtotal,
        iva: cotizacion.iva,
        total: cotizacion.total,
      },
      template: userTemplate?.settings,
    });
    const pdfBlob = await pdf(pdfDoc).toBlob();
    const arrayBuffer = await pdfBlob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Cotizacion-${cotizacion.numero}.pdf"`,
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
