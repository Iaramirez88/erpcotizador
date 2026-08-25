import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { EstadoOrden, ModuleKey, Prisma } from '@prisma/client';
import { recomputeRopTrustScoreForEmpresa } from '@/lib/rop-trust';
import { syncInternalTaskForWorkOrder } from '@/lib/work-order-task-sync';

const TERMINAL_ORDER_STATES = new Set<EstadoOrden>([
  EstadoOrden.LISTA_ENTREGA,
  EstadoOrden.ENTREGADA,
  EstadoOrden.FACTURADO,
  EstadoOrden.CERRADO,
  EstadoOrden.CANCELADA,
])

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOrderStatus(value: unknown) {
  if (typeof value !== 'string') return null
  if (value === 'PENDIENTE') return EstadoOrden.PENDIENTE
  if (value === 'EN_PROCESO') return EstadoOrden.EN_PRODUCCION
  if (value === 'FINALIZADO' || value === 'TERMINADO') return EstadoOrden.LISTA_ENTREGA
  if (value === 'ENTREGADO') return EstadoOrden.ENTREGADA
  if (value === 'CANCELADO') return EstadoOrden.CANCELADA
  return Object.values(EstadoOrden).includes(value as EstadoOrden) ? (value as EstadoOrden) : null
}

// GET /api/ordenes/[id] - Obtener una orden específica
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ');
    if (!access.ok) return access.response;

    const { id } = await context.params;

    const orden = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      include: {
        cliente: true,
        vendedor: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tareaSeguimiento: {
          select: {
            id: true,
            title: true,
            status: true,
            assignedToUserId: true,
          },
        },
        cotizacion: {
          include: {
            items: {
              include: {
                material: true,
              },
            },
          },
        },
        posInvoice: {
          include: {
            items: {
              include: {
                material: true,
              },
            },
          },
        },
        etapas: true,
      },
    });

    if (!orden) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: orden });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener orden' },
      { status: 500 }
    );
  }
}

// PUT /api/ordenes/[id] - Actualizar estado de orden
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'WRITE');
    if (!access.ok) return access.response;

    const { id } = await context.params;
    const body = await request.json();
    const hasEstado = Object.prototype.hasOwnProperty.call(body ?? {}, 'estado')
    const hasFechaInicio = Object.prototype.hasOwnProperty.call(body ?? {}, 'fechaInicio')
    const hasFechaEntrega = Object.prototype.hasOwnProperty.call(body ?? {}, 'fechaEntrega')
    const hasNotas = Object.prototype.hasOwnProperty.call(body ?? {}, 'notas')
    const hasAssignedToUserId = Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId')
    const hasAreaResponsable = Object.prototype.hasOwnProperty.call(body ?? {}, 'areaResponsable')

    const estado = normalizeOrderStatus(body?.estado)
    const fechaInicio = normalizeOptionalString(body?.fechaInicio)
    const fechaEntrega = normalizeOptionalString(body?.fechaEntrega)
    const notas = normalizeOptionalString(body?.notas)
    const assignedToUserId = normalizeOptionalString(body?.assignedToUserId)
    const areaResponsable = normalizeOptionalString(body?.areaResponsable)

    if (hasEstado && !estado) {
      return NextResponse.json(
        { success: false, error: 'Estado inválido' },
        { status: 400 }
      )
    }

    const before = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      select: { id: true, numero: true, estado: true, fechaInicio: true, assignedToUserId: true, vendedorId: true },
    })

    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    if (hasAssignedToUserId && assignedToUserId) {
      const membership = await prisma.sedeMembership.findUnique({
        where: { sedeId_userId: { sedeId: access.sedeId, userId: assignedToUserId } },
        select: { id: true },
      })

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'El responsable seleccionado no pertenece a esta sede' },
          { status: 400 }
        )
      }
    }

    const data: Prisma.OrdenTrabajoUncheckedUpdateInput = {}

    if (hasEstado && estado) {
      data.estado = estado
    }
    if (hasFechaInicio) {
      data.fechaInicio = fechaInicio ? new Date(fechaInicio) : null
    }
    if (hasFechaEntrega) {
      data.fechaEntrega = fechaEntrega ? new Date(fechaEntrega) : null
    }
    if (hasNotas) {
      data.observaciones = notas
    }
    if (hasAreaResponsable) {
      data.areaResponsable = areaResponsable
    }
    if (hasAssignedToUserId) {
      data.assignedToUserId = assignedToUserId
      data.assignedAt = assignedToUserId ? new Date() : null
    }
    if (!hasFechaInicio && estado === EstadoOrden.EN_PRODUCCION && !before.fechaInicio) {
      data.fechaInicio = new Date()
    }

    const orden = await prisma.ordenTrabajo.update({
      where: { id: before.id },
      data,
      include: {
        cliente: true,
        vendedor: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        etapas: true,
      },
    });

    if (hasEstado && estado && estado !== before.estado) {
      const recipients = new Set<string>()
      if (before.assignedToUserId) recipients.add(before.assignedToUserId)
      if (before.vendedorId) recipients.add(before.vendedorId)
      recipients.delete(access.userId)

      const items = Array.from(recipients).map((userId) => ({
        userId,
        type: 'INFO' as const,
        title: `Orden ${before.numero}: cambio de estado`,
        body: `Nuevo estado: ${estado}.`,
        actionUrl: '/dashboard/ordenes',
        actionLabel: 'Ver órdenes',
      }))

      if (items.length) {
        await prisma.notification.createMany({ data: items })
      }
    }

    if (hasAssignedToUserId && assignedToUserId && assignedToUserId !== before.assignedToUserId && assignedToUserId !== access.userId) {
      await prisma.notification.create({
        data: {
          userId: assignedToUserId,
          type: 'INFO',
          title: `Te asignaron la orden ${before.numero}`,
          body: 'Tienes una orden de trabajo asignada para gestionar.',
          actionUrl: '/dashboard/ordenes',
          actionLabel: 'Ver órdenes',
        },
      })
    }

    await syncInternalTaskForWorkOrder(prisma, {
      ordenId: before.id,
      empresaId: access.empresaId,
      actorUserId: access.userId,
    })

    let trustImpact: Awaited<ReturnType<typeof recomputeRopTrustScoreForEmpresa>>['summary'] | null = null;

    if (hasEstado && estado && estado !== before.estado && TERMINAL_ORDER_STATES.has(estado)) {
      const recompute = await recomputeRopTrustScoreForEmpresa({
        empresaId: access.empresaId,
        reason: 'WORK_ORDER_CLOSED',
        sourceRef: `orden:${before.id}`,
      });
      trustImpact = recompute.summary;
    }

    return NextResponse.json({ success: true, data: orden, trustImpact });
  } catch (error) {
    console.error('Error al actualizar orden:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar orden' },
      { status: 500 }
    );
  }
}

// DELETE /api/ordenes/[id] - Eliminar orden
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Borrado solo para ADMIN del módulo (y superadmin por email, vía RBAC)
    const access = await requireApiAccess(ModuleKey.ORDENES, 'ADMIN');
    if (!access.ok) return access.response;

    const { id } = await context.params;

    // Verificar que la orden existe
    const orden = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      include: { cotizacion: true },
    });

    if (!orden) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar etapas de producción
    await prisma.etapaProduccion.deleteMany({
      where: { ordenId: id },
    });

    // La relación se elimina automáticamente con onDelete: Cascade en el schema

    // Eliminar la orden
    await prisma.ordenTrabajo.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Orden eliminada correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar orden' },
      { status: 500 }
    );
  }
}
