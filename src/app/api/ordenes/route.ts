import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { checkPlanLimit } from '@/lib/plan-limits';
import { ModuleKey, Prioridad } from '@prisma/client';
import { ensureInvoiceFromQuote, QuoteInvoiceError } from '@/lib/quote-invoicing';
import { ensureWorkOrderFromInvoice, ensureWorkOrderFromQuote, WorkOrderClientResolutionError } from '@/lib/work-orders';

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ');
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get('busqueda');
    const estado = searchParams.get('estado');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sedeId: access.sedeId };

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda, mode: 'insensitive' } },
        { cliente: { nombre: { contains: busqueda, mode: 'insensitive' } } },
        { posInvoice: { numero: { contains: busqueda, mode: 'insensitive' } } },
      ];
    }

    if (estado) {
      where.estado = estado;
    }

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      select: {
        id: true,
        numero: true,
        estado: true,
        prioridad: true,
        fechaEntrega: true,
        fechaInicio: true,
        total: true,
        observaciones: true,
        sourceType: true,
        sourceId: true,
        itemsSnapshot: true,
        createdAt: true,
        assignedAt: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
          },
        },
        vendedor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cotizacion: {
          select: {
            id: true,
            numero: true,
            _count: {
              select: {
                items: true,
              },
            },
          },
        },
        posInvoice: {
          select: {
            id: true,
            numero: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: ordenes });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'WRITE');
    if (!access.ok) return access.response;

    const limit = await checkPlanLimit(access.empresaId, 'ORDENES_PER_MONTH');
    if (!limit.ok) {
      return NextResponse.json(limit, { status: 402 });
    }

    const { cotizacionId, invoiceId, priority } = await request.json();

    if (!cotizacionId && !invoiceId) {
      return NextResponse.json(
        { error: 'Se requiere una cotización o una factura POS' },
        { status: 400 }
      );
    }

    const normalizedPriority = typeof priority === 'string' && priority in Prioridad
      ? (priority as Prioridad)
      : Prioridad.NORMAL;

    const orden = await prisma.$transaction(async (tx) => {
      if (cotizacionId) {
        const approved = await tx.cotizacion.updateMany({
          where: {
            id: cotizacionId,
            OR: [{ sedeId: access.sedeId }, { sedeId: null }],
          },
          data: { estado: 'APROBADA', sedeId: access.sedeId },
        });

        if (approved.count === 0) {
          throw new QuoteInvoiceError('COTIZACION_NOT_FOUND');
        }

        const invoice = await ensureInvoiceFromQuote(tx, {
          cotizacionId,
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          createdById: access.userId,
        });

        return ensureWorkOrderFromQuote(tx, {
          cotizacionId,
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          createdById: access.userId,
          posInvoiceId: invoice.id,
          priority: normalizedPriority,
        });
      }

      return ensureWorkOrderFromInvoice(tx, {
        invoiceId,
        empresaId: access.empresaId,
        sedeId: access.sedeId,
        createdById: access.userId,
        priority: normalizedPriority,
      });
    });

    if (!orden) {
      return NextResponse.json(
        { success: false, error: 'Ningún ítem requiere orden de trabajo' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: orden });
  } catch (error) {
    if (error instanceof QuoteInvoiceError) {
      if (error.message === 'COTIZACION_NOT_FOUND') {
        return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 });
      }
      if (error.message === 'NO_ITEMS') {
        return NextResponse.json({ success: false, error: 'La cotización no tiene ítems válidos para facturar' }, { status: 400 });
      }
    }

    if (error instanceof WorkOrderClientResolutionError) {
      return NextResponse.json(
        { success: false, error: 'La factura requiere una orden de trabajo, pero el cliente no pudo identificarse.' },
        { status: 400 }
      );
    }

    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al crear orden de trabajo' },
      { status: 500 }
    );
  }
}
