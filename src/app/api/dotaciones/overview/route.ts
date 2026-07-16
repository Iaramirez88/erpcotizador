import { NextResponse } from 'next/server'
import { DotacionPedidoStatus, EstadoCotizacion, PayrollEmployeeStatus } from '@prisma/client'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName } from '@/lib/payroll'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'DOTACIONES', action: 'READ', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const currentSedeId = access.sedeId

    const [clientes, sedes, employees, materials, warehouses, recentRemisiones, activePedido, recentPedidos, approvedCotizaciones] = await Promise.all([
      prisma.cliente.findMany({
        where: { empresaId },
        orderBy: [{ nombre: 'asc' }],
        take: 150,
        select: {
          id: true,
          nombre: true,
          documento: true,
          sedeId: true,
          sede: { select: { nombre: true } },
        },
      }),
      prisma.sede.findMany({
        where: { empresaId },
        orderBy: [{ nombre: 'asc' }],
        select: { id: true, nombre: true, codigo: true },
      }),
      prisma.payrollEmployee.findMany({
        where: { empresaId, status: PayrollEmployeeStatus.ACTIVE },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 300,
        select: {
          id: true,
          sedeId: true,
          code: true,
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
          jobTitle: true,
          documentNumber: true,
          status: true,
          sede: { select: { nombre: true } },
        },
      }),
      prisma.material.findMany({
        where: { empresaId, activo: true, unidadMedida: 'unidad' },
        orderBy: [{ nombre: 'asc' }],
        take: 200,
        select: {
          id: true,
          externalId: true,
          nombre: true,
          categoria: true,
          color: true,
          unidadMedida: true,
          stockActual: true,
        },
      }),
      prisma.inventoryWarehouse.findMany({
        where: {
          empresaId,
          OR: [{ sedeId: currentSedeId }, { sedeId: null }],
        },
        orderBy: [{ isDefault: 'desc' }, { nombre: 'asc' }],
        select: {
          id: true,
          nombre: true,
          codigo: true,
          sedeId: true,
          isDefault: true,
          sede: { select: { nombre: true } },
        },
      }),
      prisma.remision.findMany({
        where: { empresaId, sedeId: currentSedeId },
        orderBy: [{ createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          numero: true,
          status: true,
          clienteNombre: true,
          note: true,
          createdAt: true,
          warehouse: { select: { id: true, nombre: true } },
          items: {
            select: {
              id: true,
              quantity: true,
              note: true,
              material: { select: { id: true, nombre: true, unidadMedida: true } },
            },
          },
        },
      }),
      prisma.dotacionPedido.findFirst({
        where: {
          empresaId,
          sedeId: currentSedeId,
          status: { in: [DotacionPedidoStatus.BORRADOR, DotacionPedidoStatus.EN_PREPARACION, DotacionPedidoStatus.ENTREGA_PARCIAL] },
        },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          clienteId: true,
          clienteNombre: true,
          cotizacionId: true,
          cotizacionNumero: true,
          warehouseId: true,
          title: true,
          batchNote: true,
          status: true,
          updatedAt: true,
          items: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              employeeId: true,
              employeeName: true,
              sedeId: true,
              sedeName: true,
              materialId: true,
              materialName: true,
              talla: true,
              color: true,
              quantity: true,
              note: true,
              selected: true,
              status: true,
              deliveredAt: true,
              remisionId: true,
              remisionNumero: true,
            },
          },
        },
      }),
      prisma.dotacionPedido.findMany({
        where: { empresaId, sedeId: currentSedeId },
        orderBy: [{ updatedAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          clienteId: true,
          clienteNombre: true,
          cotizacionId: true,
          cotizacionNumero: true,
          warehouseId: true,
          title: true,
          batchNote: true,
          status: true,
          updatedAt: true,
          items: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              employeeId: true,
              employeeName: true,
              sedeId: true,
              sedeName: true,
              materialId: true,
              materialName: true,
              talla: true,
              color: true,
              quantity: true,
              note: true,
              selected: true,
              status: true,
              deliveredAt: true,
              remisionId: true,
              remisionNumero: true,
            },
          },
        },
      }),
      prisma.cotizacion.findMany({
        where: {
          estado: EstadoCotizacion.APROBADA,
          OR: [{ sedeId: currentSedeId }, { sedeId: null }],
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 15,
        select: {
          id: true,
          numero: true,
          createdAt: true,
          total: true,
          observaciones: true,
          clienteId: true,
          cliente: {
            select: {
              nombre: true,
              documento: true,
              sedeId: true,
              sede: { select: { nombre: true } },
            },
          },
          items: {
            orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              descripcion: true,
              cantidad: true,
              unidad: true,
              observaciones: true,
              materialId: true,
              material: { select: { id: true, nombre: true, color: true, unidadMedida: true } },
            },
          },
        },
      }),
    ])

    const mapPedido = (pedido: (typeof activePedido) | (typeof recentPedidos)[number] | null) => {
      if (!pedido) return null
      const deliveredCount = pedido.items.filter((item) => item.status === 'REMITIDA').length
      return {
        ...pedido,
        itemCount: pedido.items.length,
        deliveredCount,
        pendingCount: pedido.items.length - deliveredCount,
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        currentSedeId,
        clientes,
        sedes,
        employees: employees.map((employee) => ({
          id: employee.id,
          sedeId: employee.sedeId,
          code: employee.code,
          fullName: buildPayrollEmployeeFullName(employee),
          role: employee.jobTitle,
          documentNumber: employee.documentNumber,
          status: employee.status,
          sede: employee.sede.nombre,
        })),
        materials,
        warehouses,
        recentRemisiones,
        activePedido: mapPedido(activePedido),
        recentPedidos: recentPedidos.map((pedido) => mapPedido(pedido)),
        approvedCotizaciones,
      },
    })
  } catch (error) {
    console.error('GET /api/dotaciones/overview error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar la estación de dotaciones' }, { status: 500 })
  }
}