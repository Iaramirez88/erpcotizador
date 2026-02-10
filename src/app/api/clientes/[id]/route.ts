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

type ClienteSegmento = "POTENCIAL" | "OCASIONAL" | "FRECUENTE"

function normalizeSegmento(value: unknown): ClienteSegmento | null {
  if (value == null || value === "") return null
  const s = String(value).trim().toUpperCase()
  if (s === "POTENCIAL" || s === "OCASIONAL" || s === "FRECUENTE") return s
  return null
}

function computeSegment(opts: { cotizaciones: number; ordenes: number }): ClienteSegmento {
  const cot = Math.max(0, opts.cotizaciones || 0)
  const ord = Math.max(0, opts.ordenes || 0)
  if (cot === 0 && ord === 0) return "POTENCIAL"
  if (ord >= 3 || cot >= 5) return "FRECUENTE"
  return "OCASIONAL"
}

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

    const empresaId = access.empresaId

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        sede: { select: { id: true, nombre: true } },
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

    if (cliente.empresaId !== empresaId) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      )
    }

    const cotizaciones = cliente._count?.cotizaciones ?? 0
    const ordenes = cliente._count?.ordenes ?? 0
    const segmentoCalc = computeSegment({ cotizaciones, ordenes })
    const segmentoFinal = (cliente as { segmento?: ClienteSegmento | null }).segmento ?? segmentoCalc

    const inv = cliente.documento
      ? await prisma.posInvoice.findMany({
          where: {
            empresaId,
            status: 'PAID',
            clienteDocumento: cliente.documento,
          },
          select: {
            total: true,
            items: { select: { quantity: true, material: { select: { precioCompra: true } } } },
          },
        })
      : []

    let invoiceCount = 0
    let invoiceTotal = 0
    let invoiceCost = 0
    for (const invoice of inv) {
      invoiceCount += 1
      invoiceTotal += invoice.total ?? 0
      for (const item of invoice.items) {
        const pc = item.material?.precioCompra
        if (typeof pc === 'number') invoiceCost += pc * (item.quantity ?? 0)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...cliente,
        segmento: segmentoFinal,
        invoiceCount,
        invoiceTotal,
        invoiceCost,
      }
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

    const empresaId = access.empresaId

    const hasSegmento = Object.prototype.hasOwnProperty.call(body, "segmento")
    const segmentoManual = hasSegmento ? normalizeSegmento(body.segmento) : null

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

    if (clienteExistente.empresaId !== empresaId) {
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
        departamento: body.departamento,
        ...(hasSegmento ? { segmento: segmentoManual } : {}),
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

    const empresaId = access.empresaId

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

    if (cliente.empresaId !== empresaId) {
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
