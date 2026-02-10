/**
 * API Route: Materiales
 * GET /api/materiales - Lista todos los materiales
 * POST /api/materiales - Crea un nuevo material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { ModuleKey } from "@prisma/client"

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

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

function normalizeUnidadMedidaFilter(value: string | null): 'm2' | 'ml' | 'unidad' | null {
  if (!value) return null
  const u = value.trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
  if (u === 'unidad' || u === 'und' || u === 'u') return 'unidad'
  return null
}

// GET - Listar todos los materiales
export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)

    const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { id: true } })
    const sedeId = sede?.id ?? access.sedeId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const activo = searchParams.get('activo')
    const unidadMedida = searchParams.get('unidadMedida')

    // Construir filtros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { empresaId }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { categoria: { contains: search, mode: 'insensitive' as const } },
        { proveedor: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (tipo) {
      where.tipo = tipo
    }

    const unidadFilter = normalizeUnidadMedidaFilter(unidadMedida)
    if (unidadFilter) {
      where.unidadMedida = unidadFilter
    }

    if (activo !== null && activo !== undefined) {
      where.activo = activo === 'true'
    }

    const materiales = await prisma.material.findMany({
      where,
      include: {
        quantityDiscounts: {
          orderBy: { minQty: 'asc' }
        },
        // “Anclaje” por bodega: traemos 1 stock, priorizando la bodega principal de la sede.
        // Si el material solo tiene stocks globales (sedeId null), también lo consideramos.
        stocks: {
          where: {
            warehouse: {
              OR: [{ sedeId }, { sedeId: null }],
            },
          },
          take: 1,
          orderBy: [{ warehouse: { isDefault: 'desc' } }, { updatedAt: 'desc' }],
          include: {
            warehouse: {
              select: { id: true, nombre: true, codigo: true, isDefault: true, sedeId: true },
            },
          },
        },
      },
      orderBy: {
        nombre: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: materiales
    })

  } catch (error) {
    console.error("Error al obtener materiales:", error)
    return NextResponse.json(
      { error: "Error al obtener materiales" },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo material
export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)

    const body = await request.json()
    const {
      nombre,
      tipo,
      categoria,
      imagenUrl,
      ancho,
      largo,
      espesor,
      color,
      precioM2,
      precioMetro,
      precioUnidad,
      precioCompra,
      stockActual,
      stockMinimo,
      unidadMedida,
      proveedor,
      observaciones,
      activo,
      warehouseId: warehouseIdInput,
    } = body

    const imagenUrlNorm = typeof imagenUrl === 'string' ? imagenUrl.trim() : null

    const quantityDiscounts = Array.isArray(body.quantityDiscounts) ? body.quantityDiscounts : []

    const quantityDiscountData = quantityDiscounts
      .map((d: { minQty?: unknown; discountPct?: unknown }) => ({
        minQty: Number(d.minQty),
        discountPct: Number(d.discountPct),
      }))
      .filter((d: { minQty: number; discountPct: number }) =>
        Number.isFinite(d.minQty) &&
        d.minQty > 0 &&
        Number.isFinite(d.discountPct) &&
        d.discountPct >= 0 &&
        d.discountPct <= 100
      )

    // Validar campos requeridos
    if (!nombre || !tipo || !unidadMedida) {
      return NextResponse.json(
        { error: "Nombre, tipo y unidad de medida son requeridos" },
        { status: 400 }
      )
    }

    const unidad = normalizeUnidadMedida(unidadMedida)
    const isActive = activo !== false

    const stockActualNRaw = typeof stockActual === 'number' ? stockActual : Number(stockActual)
    const stockActualN = Number.isFinite(stockActualNRaw) ? Math.max(0, stockActualNRaw) : 0

    const precioM2N = unidad === 'm2' ? toPositiveNumberOrNull(precioM2) : null
    const precioMetroN = unidad === 'ml' ? toPositiveNumberOrNull(precioMetro) : null
    const precioUnidadN = unidad === 'unidad' ? toPositiveNumberOrNull(precioUnidad) : null

    const precioCobro = precioM2N ?? precioMetroN ?? precioUnidadN
    if (isActive && !(precioCobro !== null && precioCobro > 0)) {
      return NextResponse.json(
        { error: "Debes indicar un precio de venta válido según la unidad de cobro (m², ml o unidad)." },
        { status: 400 }
      )
    }

    // Crear material
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({
        data: {
          nombre,
          tipo,
          categoria,
          imagenUrl: imagenUrlNorm || null,
          ancho: ancho ? parseFloat(ancho) : null,
          largo: largo ? parseFloat(largo) : null,
          espesor: espesor ? parseFloat(espesor) : null,
          color,
          precioM2: precioM2N,
          precioMetro: precioMetroN,
          precioUnidad: precioUnidadN,
          precioCompra: precioCompra ? parseFloat(precioCompra) : null,
          stockActual: stockActualN,
          stockMinimo: stockMinimo ? parseFloat(stockMinimo) : 0,
          unidadMedida: unidad,
          proveedor,
          observaciones,
          activo: isActive,
          empresaId,
          ...(quantityDiscountData.length > 0
            ? {
                quantityDiscounts: {
                  createMany: { data: quantityDiscountData },
                },
              }
            : {}),
        },
        include: {
          quantityDiscounts: { orderBy: { minQty: 'asc' } },
        },
      })

      // Inicializar inventario por bodega.
      // - Si el cliente envía warehouseId, usamos esa bodega (si pertenece a la sede/empresa).
      // - Si no, usamos la bodega default de la sede (o la primera existente) o creamos “Principal”.
      // Esto evita que el stock por bodega quede en 0 y luego falle al facturar.
      let warehouseId: string | null = null
      const sedeId = access.sedeId

      const requestedWarehouseId = typeof warehouseIdInput === 'string' ? warehouseIdInput.trim() : ''
      if (requestedWarehouseId) {
        const whRequested = await tx.inventoryWarehouse.findFirst({
          where: {
            id: requestedWarehouseId,
            empresaId,
            OR: [{ sedeId }, { sedeId: null }],
          },
          select: { id: true },
        })
        if (whRequested?.id) warehouseId = whRequested.id
      }

      const whDefault = await tx.inventoryWarehouse.findFirst({
        where: { empresaId, sedeId, isDefault: true },
        select: { id: true },
      })
      if (!warehouseId && whDefault?.id) warehouseId = whDefault.id

      if (!warehouseId) {
        const whAny = await tx.inventoryWarehouse.findFirst({
          where: { empresaId, sedeId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        if (whAny?.id) warehouseId = whAny.id
      }

      if (!warehouseId) {
        const whCreated = await tx.inventoryWarehouse.create({
          data: {
            empresaId,
            sedeId,
            nombre: 'Principal',
            codigo: 'PRIN',
            isDefault: true,
          },
          select: { id: true },
        })
        warehouseId = whCreated.id
      }

      if (warehouseId) {
        await tx.inventoryStock.upsert({
          where: { warehouseId_materialId: { warehouseId, materialId: created.id } },
          create: { warehouseId, materialId: created.id, quantity: stockActualN },
          update: { quantity: stockActualN },
          select: { id: true },
        })
      }

      return created
    })

    return NextResponse.json(
      {
        success: true,
        message: "Material creado exitosamente",
        data: material
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Error al crear material:", error)
    return NextResponse.json(
      { error: "Error al crear material" },
      { status: 500 }
    )
  }
}
