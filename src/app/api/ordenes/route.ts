import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { ModuleKey } from '@prisma/client';

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
        total: true,
        observaciones: true,
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

    const { cotizacionId } = await request.json();

    if (!cotizacionId) {
      return NextResponse.json(
        { error: 'ID de cotización requerido' },
        { status: 400 }
      );
    }

    // Buscar la cotización
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id: cotizacionId, sedeId: access.sedeId },
      include: {
        items: true,
      },
    });

    if (!cotizacion) {
      return NextResponse.json(
        { success: false, error: 'Cotización no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya tiene una orden
    const ordenExistente = await prisma.ordenTrabajo.findFirst({
      where: {
        cotizacion: {
          id: cotizacion.id,
        },
      },
    });

    if (ordenExistente) {
      return NextResponse.json(
        { success: false, error: 'Esta cotización ya tiene una orden de trabajo' },
        { status: 400 }
      );
    }

    // Generar número de orden (ORD-00001)
    const ultimaOrden = await prisma.ordenTrabajo.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });

    let numeroOrden = 'ORD-00001';
    if (ultimaOrden) {
      const ultimoNumero = parseInt(ultimaOrden.numero.split('-')[1]);
      numeroOrden = `ORD-${String(ultimoNumero + 1).padStart(5, '0')}`;
    }

    // Crear orden de trabajo con los datos de la cotización
    const orden = await prisma.ordenTrabajo.create({
      data: {
        numero: numeroOrden,
        sedeId: cotizacion.sedeId ?? access.sedeId,
        clienteId: cotizacion.clienteId,
        vendedorId: cotizacion.vendedorId,
        cotizacionId: cotizacion.id,
        subtotal: cotizacion.subtotal,
        iva: cotizacion.iva,
        total: cotizacion.total,
        estado: 'PENDIENTE',
      },
      include: {
        cliente: true,
        vendedor: {
          select: {
            name: true,
            email: true,
          },
        },
        cotizacion: {
          select: {
            numero: true,
          },
        },
      },
    });

    // Actualizar estado de la cotización
    await prisma.cotizacion.update({
      where: { id: cotizacionId },
      data: {
        estado: 'APROBADA',
      },
    });

    return NextResponse.json({ success: true, data: orden });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al crear orden de trabajo' },
      { status: 500 }
    );
  }
}
