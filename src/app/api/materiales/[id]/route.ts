/**
 * API Route: Material individual
 * GET /api/materiales/[id] - Obtiene un material específico
 * PUT /api/materiales/[id] - Actualiza un material
 * DELETE /api/materiales/[id] - Elimina un material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

function normalizeUnidadMedida(value: unknown): 'm2' | 'ml' | 'unidad' {
  const u = String(value ?? '').trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
  return 'unidad'
}

function toPositiveNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET - Obtener material por ID
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        quantityDiscounts: { orderBy: { minQty: 'asc' } }
      }
    })

    if (!material) {
      return NextResponse.json(
        { error: "Material no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: material
    })

  } catch (error) {
    console.error("Error al obtener material:", error)
    return NextResponse.json(
      { error: "Error al obtener material" },
      { status: 500 }
    )
  }
}

// PUT - Actualizar material
export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = await request.json()

    const imagenUrlNorm = typeof body.imagenUrl === 'string' ? body.imagenUrl.trim() : null

    const unidad = normalizeUnidadMedida(body.unidadMedida)
    const isActive = body.activo !== false

    const precioM2N = unidad === 'm2' ? toPositiveNumberOrNull(body.precioM2) : null
    const precioMetroN = unidad === 'ml' ? toPositiveNumberOrNull(body.precioMetro) : null
    const precioUnidadN = unidad === 'unidad' ? toPositiveNumberOrNull(body.precioUnidad) : null

    const precioCobro = precioM2N ?? precioMetroN ?? precioUnidadN
    if (isActive && !(precioCobro !== null && precioCobro > 0)) {
      return NextResponse.json(
        { error: "Debes indicar un precio de venta válido según la unidad de cobro (m², ml o unidad)." },
        { status: 400 }
      )
    }

    const materialExistente = await prisma.material.findUnique({
      where: { id }
    })

    if (!materialExistente) {
      return NextResponse.json(
        { error: "Material no encontrado" },
        { status: 404 }
      )
    }

    const quantityDiscounts = Array.isArray(body.quantityDiscounts) ? body.quantityDiscounts : null

    const material = await prisma.$transaction(async (tx) => {
      if (quantityDiscounts) {
        await tx.materialQuantityDiscount.deleteMany({ where: { materialId: id } })
      }

      const updated = await tx.material.update({
        where: { id },
        data: {
          nombre: body.nombre,
          tipo: body.tipo,
          categoria: body.categoria,
          imagenUrl: imagenUrlNorm || null,
          ancho: body.ancho ? parseFloat(body.ancho) : null,
          largo: body.largo ? parseFloat(body.largo) : null,
          espesor: body.espesor ? parseFloat(body.espesor) : null,
          color: body.color,
          precioM2: precioM2N,
          precioMetro: precioMetroN,
          precioUnidad: precioUnidadN,
          precioCompra: body.precioCompra ? parseFloat(body.precioCompra) : null,
          stockActual: body.stockActual ? parseFloat(body.stockActual) : 0,
          stockMinimo: body.stockMinimo ? parseFloat(body.stockMinimo) : 0,
          unidadMedida: unidad,
          proveedor: body.proveedor,
          observaciones: body.observaciones,
          activo: isActive
        },
        include: {
          quantityDiscounts: { orderBy: { minQty: 'asc' } }
        }
      })

      if (quantityDiscounts) {
        const data = quantityDiscounts
          .map((d: { minQty?: unknown; discountPct?: unknown }) => ({
            materialId: id,
            minQty: Number(d.minQty),
            discountPct: Number(d.discountPct),
          }))
          .filter((d: { materialId: string; minQty: number; discountPct: number }) =>
            Number.isFinite(d.minQty) &&
            d.minQty > 0 &&
            Number.isFinite(d.discountPct) &&
            d.discountPct >= 0 &&
            d.discountPct <= 100
          )

        if (data.length > 0) {
          await tx.materialQuantityDiscount.createMany({ data })
        }

        return tx.material.findUnique({
          where: { id },
          include: { quantityDiscounts: { orderBy: { minQty: 'asc' } } }
        })
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      message: "Material actualizado exitosamente",
      data: material
    })

  } catch (error) {
    console.error("Error al actualizar material:", error)
    return NextResponse.json(
      { error: "Error al actualizar material" },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar material
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            items: true
          }
        }
      }
    })

    if (!material) {
      return NextResponse.json(
        { error: "Material no encontrado" },
        { status: 404 }
      )
    }

    if (material._count.items > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar un material usado en cotizaciones",
          suggestion: "Considera desactivarlo en lugar de eliminarlo"
        },
        { status: 400 }
      )
    }

    await prisma.material.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "Material eliminado exitosamente"
    })

  } catch (error) {
    console.error("Error al eliminar material:", error)
    return NextResponse.json(
      { error: "Error al eliminar material" },
      { status: 500 }
    )
  }
}
