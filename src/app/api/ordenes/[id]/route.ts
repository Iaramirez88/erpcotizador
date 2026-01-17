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

    const orden = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        cotizacion: {
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
    const { estado, fechaEntrega, notas } = body;

    const orden = await prisma.ordenTrabajo.update({
      where: { id },
      data: {
        ...(estado && { estado }),
        ...(fechaEntrega && { fechaEntrega: new Date(fechaEntrega) }),
        ...(notas !== undefined && { observaciones: notas }),
      },
      include: {
        cliente: true,
        vendedor: true,
        etapas: true,
      },
    });

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
    const access = await requireApiAccess(ModuleKey.ORDENES, 'WRITE');
    if (!access.ok) return access.response;

    const { id } = await context.params;

    // Verificar que la orden existe
    const orden = await prisma.ordenTrabajo.findUnique({
      where: { id },
      include: { cotizacion: true },
    });

    if (!orden) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Solo se pueden eliminar órdenes PENDIENTE o CANCELADA
    if (orden.estado !== 'PENDIENTE' && orden.estado !== 'CANCELADA') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se pueden eliminar órdenes pendientes o canceladas',
        },
        { status: 400 }
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
