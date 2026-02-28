/**
 * API Route: Material individual
 * GET /api/materiales/[id] - Obtiene un material específico
 * PUT /api/materiales/[id] - Actualiza un material
 * DELETE /api/materiales/[id] - Elimina un material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { InventoryMovementSourceType, InventoryMovementType, ModuleKey } from "@prisma/client"

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

    const externalIdNorm = typeof body.externalId === 'string' ? body.externalId.trim() : ''
    const externalIdValue = externalIdNorm ? externalIdNorm : null

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

    if (materialExistente.empresaId !== access.empresaId) {
      return NextResponse.json(
        { error: "Material no encontrado" },
        { status: 404 }
      )
    }

    if (externalIdValue) {
      const dup = await prisma.material.findFirst({
        where: {
          empresaId: access.empresaId,
          externalId: externalIdValue,
          NOT: { id },
        },
        select: { id: true },
      })

      if (dup?.id) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese código/ID externo en tu empresa.' },
          { status: 409 }
        )
      }
    }

    const quantityDiscounts = Array.isArray(body.quantityDiscounts) ? body.quantityDiscounts : null

    const nextPrecioCompra = body.precioCompra ? parseFloat(body.precioCompra) : null
    const precioCompraChanged = (materialExistente.precioCompra ?? null) !== (nextPrecioCompra ?? null)

    const nextStockRaw = body.stockActual === null || body.stockActual === undefined || body.stockActual === ''
      ? 0
      : typeof body.stockActual === 'number'
        ? body.stockActual
        : Number(body.stockActual)
    const nextStock = Number.isFinite(nextStockRaw) ? Math.max(0, nextStockRaw) : 0

    const stockScopeRaw = typeof body.stockScope === 'string' ? body.stockScope.trim() : ''
    const stockScope: 'warehouse' | 'allSedes' = stockScopeRaw === 'allSedes' ? 'allSedes' : 'warehouse'
    const requestedWarehouseId = typeof body.warehouseId === 'string' ? body.warehouseId.trim() : ''

    if (stockScope === 'warehouse' && !requestedWarehouseId) {
      return NextResponse.json(
        { error: 'Para registrar stock en una sede específica debes seleccionar una bodega, o elegir “Todas las sedes”.' },
        { status: 400 }
      )
    }

    const whValidated = nextStock > 0 && stockScope === 'warehouse'
      ? await prisma.inventoryWarehouse.findFirst({
          where: {
            id: requestedWarehouseId,
            empresaId: access.empresaId,
            OR: [{ sedeId: access.sedeId }, { sedeId: null }],
          },
          select: { id: true },
        })
      : null

    if (nextStock > 0 && stockScope === 'warehouse' && !whValidated?.id) {
      return NextResponse.json(
        { error: 'Bodega inválida o sin acceso para registrar stock.' },
        { status: 400 }
      )
    }

    const material = await prisma.$transaction(async (tx) => {
      const beforeStock = await tx.material.findUnique({
        where: { id },
        select: { stockActual: true },
      })

      const stockBeforeGlobal = beforeStock?.stockActual ?? materialExistente.stockActual

      let globalAfter = stockBeforeGlobal

      if (quantityDiscounts) {
        await tx.materialQuantityDiscount.deleteMany({ where: { materialId: id } })
      }

      // Aplicar regla de stock por bodega o por todas las sedes.
      if (stockScope === 'warehouse') {
        const warehouseId = whValidated?.id ?? null
        const current = warehouseId
          ? await tx.inventoryStock.findUnique({
              where: { warehouseId_materialId: { warehouseId, materialId: id } },
              select: { quantity: true },
            })
          : null

        const stockBeforeWarehouse = current?.quantity ?? 0
        const delta = nextStock - stockBeforeWarehouse
        globalAfter = stockBeforeGlobal + delta

        if (globalAfter < 0) {
          throw new Error('INVALID_GLOBAL_STOCK')
        }

        if (warehouseId) {
          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId: id } },
            create: { warehouseId, materialId: id, quantity: nextStock },
            update: { quantity: nextStock },
            select: { id: true },
          })
        }

        if (delta !== 0) {
          await tx.inventoryMovement.create({
            data: {
              empresaId: access.empresaId,
              sedeId: access.sedeId,
              warehouseId,
              materialId: id,
              type: InventoryMovementType.ADJUST,
              quantity: delta,
              stockBefore: stockBeforeWarehouse,
              stockAfter: nextStock,
              note: 'Ajuste manual desde Productos',
              sourceType: InventoryMovementSourceType.MANUAL,
              sourceId: id,
              createdById: access.userId,
            },
          })
        }
      } else {
        const sedes = await tx.sede.findMany({
          where: { empresaId: access.empresaId },
          select: { id: true },
        })

        let sumBefore = 0
        for (const s of sedes) {
          let whId: string | null = null
          const whDefault = await tx.inventoryWarehouse.findFirst({
            where: { empresaId: access.empresaId, sedeId: s.id, isDefault: true },
            select: { id: true },
          })
          if (whDefault?.id) whId = whDefault.id

          if (!whId) {
            const whAny = await tx.inventoryWarehouse.findFirst({
              where: { empresaId: access.empresaId, sedeId: s.id },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
            if (whAny?.id) whId = whAny.id
          }

          if (!whId) {
            const whCreated = await tx.inventoryWarehouse.create({
              data: {
                empresaId: access.empresaId,
                sedeId: s.id,
                nombre: 'Principal',
                codigo: 'PRIN',
                isDefault: true,
              },
              select: { id: true },
            })
            whId = whCreated.id
          }

          const current = await tx.inventoryStock.findUnique({
            where: { warehouseId_materialId: { warehouseId: whId, materialId: id } },
            select: { quantity: true },
          })
          sumBefore += current?.quantity ?? 0

          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId: whId, materialId: id } },
            create: { warehouseId: whId, materialId: id, quantity: nextStock },
            update: { quantity: nextStock },
            select: { id: true },
          })
        }

        const sumAfter = nextStock * sedes.length
        const deltaTotal = sumAfter - sumBefore
        globalAfter = stockBeforeGlobal + deltaTotal

        if (globalAfter < 0) {
          throw new Error('INVALID_GLOBAL_STOCK')
        }

        if (deltaTotal !== 0) {
          await tx.inventoryMovement.create({
            data: {
              empresaId: access.empresaId,
              sedeId: access.sedeId,
              warehouseId: null,
              materialId: id,
              type: InventoryMovementType.ADJUST,
              quantity: deltaTotal,
              stockBefore: stockBeforeGlobal,
              stockAfter: globalAfter,
              note: 'Ajuste manual desde Productos (todas las sedes)',
              sourceType: InventoryMovementSourceType.MANUAL,
              sourceId: id,
              createdById: access.userId,
            },
          })
        }
      }

      const updated = await tx.material.update({
        where: { id },
        data: {
          externalId: externalIdValue,
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
          precioCompra: nextPrecioCompra,
          stockActual: globalAfter,
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

      if (precioCompraChanged) {
        const sede = await tx.sede.findUnique({ where: { id: access.sedeId }, select: { empresaId: true } })
        const empresaId = sede?.empresaId ?? null

        const memberships = await tx.sedeMembership.findMany({
          where: { sedeId: access.sedeId },
          select: { userId: true },
        })

        const recipients = Array.from(new Set(memberships.map((m) => m.userId))).filter(
          (uid) => uid && uid !== access.userId
        )

        if (recipients.length) {
          const beforeValue = materialExistente.precioCompra ?? null
          const afterValue = nextPrecioCompra ?? null

          await tx.notification.createMany({
            data: recipients.map((uid) => ({
              userId: uid,
              sedeId: access.sedeId,
              empresaId: empresaId ?? undefined,
              type: 'INFO',
              title: `Costo actualizado: ${updated.nombre}`,
              body: `Costo de compra: ${beforeValue ?? '—'} → ${afterValue ?? '—'}`,
            })),
          })
        }
      }

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
    if (error instanceof Error && error.message === 'INVALID_GLOBAL_STOCK') {
      return NextResponse.json({ error: 'Stock global resultante inválido' }, { status: 400 })
    }

    // Prisma: constraint unique (empresaId, externalId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (error as any)?.code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese código/ID externo en tu empresa.' },
        { status: 409 }
      )
    }

    console.error("Error al actualizar material:", error)
    return NextResponse.json({ error: "Error al actualizar material" }, { status: 500 })
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
