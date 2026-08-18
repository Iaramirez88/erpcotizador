/**
 * API Route: Material individual
 * GET /api/materiales/[id] - Obtiene un material específico
 * PUT /api/materiales/[id] - Actualiza un material
 * DELETE /api/materiales/[id] - Elimina un material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { InventoryMovementSourceType, InventoryMovementType, ModuleKey, type Prisma } from "@prisma/client"
import { requireSedeAccess } from "@/lib/rbac"

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

function normalizeWarehouseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)))
}

async function ensureDefaultWarehouse(tx: Prisma.TransactionClient, args: { empresaId: string; sedeId: string }) {
  const existingDefault = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })
  if (existingDefault?.id) return existingDefault.id

  const existingAny = await tx.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existingAny?.id) return existingAny.id

  const created = await tx.inventoryWarehouse.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      nombre: 'Principal',
      codigo: 'PRIN',
      isDefault: true,
    },
    select: { id: true },
  })

  return created.id
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

    const me = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { role: true },
    })

    const isAdmin = me?.role === 'ADMIN'

    const material = await prisma.material.findFirst({
      where: {
        id,
        empresaId: access.empresaId,
        ...(isAdmin
          ? {}
          : {
              OR: [
                { isCustom: false },
                { isCustom: true, customOwnerUserId: access.userId, customSedeId: access.sedeId },
              ],
            }),
      },
      include: {
        quantityDiscounts: { orderBy: { minQty: 'asc' } }
      }
    })

    if (!material) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
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

    const me = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { role: true },
    })

    const isAdmin = me?.role === 'ADMIN'

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

    if (
      materialExistente.isCustom &&
      !isAdmin &&
      !(materialExistente.customOwnerUserId === access.userId && materialExistente.customSedeId === access.sedeId)
    ) {
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
    const stockScope: 'warehouse' | 'selectedSedes' | 'allSedes' = stockScopeRaw === 'allSedes' ? 'allSedes' : stockScopeRaw === 'selectedSedes' ? 'selectedSedes' : 'warehouse'
    const requestedWarehouseId = typeof body.warehouseId === 'string' ? body.warehouseId.trim() : ''
    const requestedWarehouseIds = normalizeWarehouseIds(body.warehouseIds)

    if (stockScope === 'warehouse' && !requestedWarehouseId) {
      return NextResponse.json(
        { error: 'Para registrar stock en una sede específica debes seleccionar una bodega, o elegir “Todas las sedes”.' },
        { status: 400 }
      )
    }

    if (stockScope === 'selectedSedes' && !requestedWarehouseIds.length) {
      return NextResponse.json(
        { error: 'Selecciona al menos una sede para aplicar el stock.' },
        { status: 400 }
      )
    }

    const validateRequestedWarehouses = async (warehouseIds: string[]) => {
      const validated: Array<{ id: string; sedeId: string | null }> = []
      for (const warehouseId of warehouseIds) {
        const warehouse = await prisma.inventoryWarehouse.findUnique({
          where: { id: warehouseId },
          select: { id: true, empresaId: true, sedeId: true },
        })

        if (!warehouse || warehouse.empresaId !== access.empresaId) return null

        if (warehouse.sedeId && access.session.user.role !== 'ADMIN') {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: warehouse.sedeId,
            module: ModuleKey.MATERIALES,
            minLevel: 'WRITE' as never,
          })
        }

        validated.push({ id: warehouse.id, sedeId: warehouse.sedeId ?? null })
      }

      return validated
    }

    let whValidated: Array<{ id: string; sedeId: string | null }> = []
    if (nextStock > 0 && stockScope === 'warehouse') {
      const validated = await validateRequestedWarehouses([requestedWarehouseId])
      whValidated = validated ?? []
    }
    if (nextStock > 0 && stockScope === 'selectedSedes') {
      const validated = await validateRequestedWarehouses(requestedWarehouseIds)
      whValidated = validated ?? []
    }

    if (nextStock > 0 && stockScope === 'warehouse' && !whValidated[0]?.id) {
      return NextResponse.json(
        { error: 'Bodega inválida o sin acceso para registrar stock.' },
        { status: 400 }
      )
    }

    if (nextStock > 0 && stockScope === 'selectedSedes' && !whValidated.length) {
      return NextResponse.json(
        { error: 'Una o más sedes no son válidas o no tienes acceso para registrar stock.' },
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
        const warehouseId = whValidated[0]?.id ?? null
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
      } else if (stockScope === 'selectedSedes') {
        const currentRows = await tx.inventoryStock.findMany({
          where: { materialId: id },
          select: {
            warehouseId: true,
            quantity: true,
            warehouse: { select: { sedeId: true, isDefault: true } },
          },
        })

        const manageableWarehouseIds = new Set<string>([
          ...currentRows
            .filter((row) => row.warehouse?.sedeId && row.warehouse.isDefault)
            .map((row) => row.warehouseId),
          ...whValidated.map((warehouse) => warehouse.id),
        ])

        let deltaTotal = 0
        for (const warehouseId of manageableWarehouseIds) {
          const current = currentRows.find((row) => row.warehouseId === warehouseId)
          const stockBeforeWarehouse = current?.quantity ?? 0
          const stockAfterWarehouse = whValidated.some((warehouse) => warehouse.id === warehouseId) ? nextStock : 0
          const delta = stockAfterWarehouse - stockBeforeWarehouse
          deltaTotal += delta

          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId: id } },
            create: { warehouseId, materialId: id, quantity: stockAfterWarehouse },
            update: { quantity: stockAfterWarehouse },
            select: { id: true },
          })
        }

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
              note: 'Ajuste manual desde Productos (sedes seleccionadas)',
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
          const whId = await ensureDefaultWarehouse(tx, { empresaId: access.empresaId, sedeId: s.id })

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
          tipoNombre: typeof body.tipoNombre === 'string' ? body.tipoNombre.trim() || null : null,
          categoria: body.categoria,
          extraFields: body.extraFields && typeof body.extraFields === 'object' && !Array.isArray(body.extraFields) ? body.extraFields : {},
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
          requiresWorkOrder: body.requiresWorkOrder === true,
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
              actionUrl: '/dashboard/productos',
              actionLabel: 'Ver producto',
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
      message: "Producto actualizado exitosamente",
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
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    if (material._count.items > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar un producto usado en cotizaciones",
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
      message: "Producto eliminado exitosamente"
    })

  } catch (error) {
    console.error("Error al eliminar material:", error)
    return NextResponse.json(
      { error: "Error al eliminar material" },
      { status: 500 }
    )
  }
}
