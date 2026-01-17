/**
 * API Route: Cliente individual
 * GET /api/clientes/[id] - Obtiene un cliente específico
 * PUT /api/clientes/[id] - Actualiza un cliente
 * DELETE /api/clientes/[id] - Elimina un cliente
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET - Obtener cliente por ID
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        cotizaciones: {
          orderBy: {
            fecha: 'desc'
          },
          take: 10
        },
        _count: {
          select: {
            cotizaciones: true,
            ordenes: true
          }
        }
      }
    })

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: cliente
    })

  } catch (error) {
    console.error("Error al obtener cliente:", error)
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    )
  }
}

// PUT - Actualizar cliente
export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = await request.json()

    // Verificar si el cliente existe
    const clienteExistente = await prisma.cliente.findUnique({
      where: { id }
    })

    if (!clienteExistente) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    // Si se está cambiando el documento, verificar que no exista otro con el mismo
    if (body.documento && body.documento !== clienteExistente.documento) {
      const documentoDuplicado = await prisma.cliente.findUnique({
        where: { documento: body.documento }
      })

      if (documentoDuplicado) {
        return NextResponse.json(
          { error: "Ya existe un cliente con este documento" },
          { status: 400 }
        )
      }
    }

    // Actualizar cliente
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: body.nombre,
        tipoDocumento: body.tipoDocumento,
        documento: body.documento,
        email: body.email,
        telefono: body.telefono,
        celular: body.celular,
        direccion: body.direccion,
        ciudad: body.ciudad,
        departamento: body.departamento
      }
    })

    return NextResponse.json({
      success: true,
      message: "Cliente actualizado exitosamente",
      data: cliente
    })

  } catch (error) {
    console.error("Error al actualizar cliente:", error)
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar cliente
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params

    // Verificar si el cliente tiene cotizaciones
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cotizaciones: true,
            ordenes: true
          }
        }
      }
    })

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    // Verificar si tiene cotizaciones u órdenes
    if (cliente._count.cotizaciones > 0 || cliente._count.ordenes > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar un cliente con cotizaciones u órdenes asociadas",
          suggestion: "Considera desactivarlo en lugar de eliminarlo"
        },
        { status: 400 }
      )
    }

    // Eliminar cliente
    await prisma.cliente.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "Cliente eliminado exitosamente"
    })

  } catch (error) {
    console.error("Error al eliminar cliente:", error)
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    )
  }
}
