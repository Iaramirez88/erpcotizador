import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { checkPlanLimit } from '@/lib/plan-limits';
import { AccessLevel, EstadoOrden, ModuleKey, Prioridad } from '@prisma/client';
import { ensureInvoiceFromQuote, QuoteInvoiceError } from '@/lib/quote-invoicing';
import { createManualWorkOrder, ensureWorkOrderFromInvoice, ensureWorkOrderFromQuote, WorkOrderClientResolutionError } from '@/lib/work-orders';
import { requireSedeAccess } from '@/lib/rbac';

const IN_PROGRESS_ORDER_STATES: EstadoOrden[] = [
  'RECIBIDO',
  'COTIZADO',
  'APROBADO',
  'EN_DISENO',
  'EN_CORRECCION',
  'APROBADO_PRODUCCION',
  'EN_IMPRESION',
  'EN_PRODUCCION',
  'EN_ACONDICIONAMIENTO',
  'EN_ACABADOS',
  'EN_ENTREGA',
]

const FINISHED_ORDER_STATES: EstadoOrden[] = ['LISTA_ENTREGA', 'FACTURADO', 'CERRADO']

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ');
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get('busqueda');
    const estado = searchParams.get('estado');
    const requestedSedeId = (searchParams.get('sedeId') || '').trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sedeId: requestedSedeId || access.sedeId };

    if (requestedSedeId && requestedSedeId !== access.sedeId) {
      try {
        await requireSedeAccess({
          userId: access.userId,
          sedeId: requestedSedeId,
          module: ModuleKey.ORDENES,
          minLevel: AccessLevel.READ,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN') {
          return NextResponse.json({ success: false, error: 'No tienes acceso a la sede solicitada.' }, { status: 403 });
        }
        throw error;
      }
    }

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda, mode: 'insensitive' } },
        { cliente: { nombre: { contains: busqueda, mode: 'insensitive' } } },
        { posInvoice: { numero: { contains: busqueda, mode: 'insensitive' } } },
      ];
    }

    if (estado) {
      if (estado === 'PAUSADA') {
        where.etapas = { some: { estado: 'DETENIDA' } };
      } else if (estado === 'CALIDAD') {
        where.etapas = {
          some: {
            nombre: { contains: 'calidad', mode: 'insensitive' },
            estado: 'EN_PROCESO',
          },
        };
      } else if (estado === 'EN_PROCESO') {
        where.estado = { in: IN_PROGRESS_ORDER_STATES };
      } else if (estado === 'FINALIZADO') {
        where.estado = { in: FINISHED_ORDER_STATES };
      } else if (estado === 'TERMINADO') {
        where.estado = { in: FINISHED_ORDER_STATES };
      } else if (estado === 'ENTREGADO') {
        where.estado = 'ENTREGADA';
      } else if (estado === 'CANCELADO') {
        where.estado = 'CANCELADA';
      } else {
        where.estado = estado;
      }
    }

    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      select: {
        id: true,
        sedeId: true,
        numero: true,
        estado: true,
        prioridad: true,
        areaResponsable: true,
        fechaEntrega: true,
        fechaInicio: true,
        total: true,
        observaciones: true,
        sourceType: true,
        sourceId: true,
        itemsSnapshot: true,
        createdAt: true,
        assignedAt: true,
        etapas: {
          orderBy: { secuencia: 'asc' },
          select: {
            id: true,
            nombre: true,
            secuencia: true,
            estado: true,
          },
        },
        tareaSeguimiento: {
          select: {
            id: true,
            title: true,
            status: true,
            workspaceId: true,
          },
        },
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

    const body = (await request.json().catch(() => null)) as {
      sourceType?: unknown;
      cotizacionId?: unknown;
      invoiceId?: unknown;
      priority?: unknown;
      clienteId?: unknown;
      assignedToUserId?: unknown;
      fechaEntrega?: unknown;
      areaResponsable?: unknown;
      observaciones?: unknown;
      items?: unknown;
    } | null;
    const sourceType = body?.sourceType === 'manual' ? 'manual' : null;
    const cotizacionId = typeof body?.cotizacionId === 'string' ? body.cotizacionId : '';
    const invoiceId = typeof body?.invoiceId === 'string' ? body.invoiceId : '';
    const priority = typeof body?.priority === 'string' ? body.priority : '';
    const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
    const assignedToUserId = typeof body?.assignedToUserId === 'string' ? body.assignedToUserId : '';
    const areaResponsable = typeof body?.areaResponsable === 'string' ? body.areaResponsable.trim() : '';
    const observaciones = typeof body?.observaciones === 'string' ? body.observaciones.trim() : '';
    const manualItems = Array.isArray(body?.items)
      ? body.items.map((item) => {
          const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
          return {
            descripcion: typeof value.descripcion === 'string' ? value.descripcion : '',
            cantidad: typeof value.cantidad === 'number' || typeof value.cantidad === 'string' ? Number(value.cantidad) : 0,
            especificaciones: typeof value.especificaciones === 'string' ? value.especificaciones : '',
          };
        })
      : [];
    const parsedDueDate = typeof body?.fechaEntrega === 'string' && body.fechaEntrega
      ? new Date(body.fechaEntrega)
      : null;

    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: 'La fecha de entrega no es válida' }, { status: 400 });
    }

    if (!sourceType && !cotizacionId && !invoiceId) {
      return NextResponse.json(
        { error: 'Se requiere una cotización o una factura POS' },
        { status: 400 }
      );
    }

    if (sourceType === 'manual' && (!clienteId || !manualItems.some((item) => item.descripcion.trim() && item.cantidad > 0))) {
      return NextResponse.json(
        { error: 'Selecciona un cliente y agrega al menos un ítem válido' },
        { status: 400 }
      );
    }

    const normalizedPriority = typeof priority === 'string' && priority in Prioridad
      ? (priority as Prioridad)
      : Prioridad.NORMAL;

    const orden = await prisma.$transaction(async (tx) => {
      if (sourceType === 'manual') {
        return createManualWorkOrder(tx, {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          createdById: access.userId,
          clienteId,
          assignedToUserId: assignedToUserId || null,
          priority: normalizedPriority,
          fechaEntrega: parsedDueDate,
          areaResponsable,
          observaciones,
          items: manualItems,
        });
      }

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
          force: true,
        });
      }

      return ensureWorkOrderFromInvoice(tx, {
        invoiceId,
        empresaId: access.empresaId,
        sedeId: access.sedeId,
        createdById: access.userId,
        priority: normalizedPriority,
        force: true,
      });
    });

    if (!orden) {
      return NextResponse.json(
        { success: false, error: 'Ningún ítem requiere orden de trabajo' },
        { status: 400 }
      );
    }

    if (sourceType === 'manual' && assignedToUserId && assignedToUserId !== access.userId) {
      await prisma.notification.create({
        data: {
          userId: assignedToUserId,
          type: 'INFO',
          title: `Te asignaron la orden ${orden.numero}`,
          body: 'Tienes una nueva orden de trabajo para gestionar.',
          actionUrl: '/dashboard/ordenes',
          actionLabel: 'Ver órdenes',
        },
      });
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

    if (error instanceof Error && error.message.startsWith('MANUAL_WORK_ORDER_')) {
      const message = error.message === 'MANUAL_WORK_ORDER_CLIENT_NOT_FOUND'
        ? 'El cliente no existe o no pertenece a la empresa.'
        : error.message === 'MANUAL_WORK_ORDER_ASSIGNEE_INVALID'
          ? 'El responsable no pertenece a la sede actual.'
          : 'Agrega al menos un ítem válido a la orden.';
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al crear orden de trabajo' },
      { status: 500 }
    );
  }
}
