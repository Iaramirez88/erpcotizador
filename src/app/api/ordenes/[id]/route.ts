import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { ModuleKey } from '@prisma/client';

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
    const { estado, fechaInicio, fechaEntrega, notas } = body;

    const before = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      select: { id: true, numero: true, estado: true, assignedToUserId: true, vendedorId: true },
    })

    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const orden = await prisma.ordenTrabajo.update({
      where: { id: before.id },
      data: {
        ...(estado && { estado }),
        ...(fechaInicio && { fechaInicio: new Date(fechaInicio) }),
        ...(fechaEntrega && { fechaEntrega: new Date(fechaEntrega) }),
        ...(notas !== undefined && { observaciones: notas }),
      },
      include: {
        cliente: true,
        vendedor: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        etapas: true,
      },
    });

    if (estado && estado !== before.estado) {
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

    return NextResponse.json({ success: true, data: orden });
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
