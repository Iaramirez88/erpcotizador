/**
 * API Route: Materiales
 * GET /api/materiales - Lista todos los materiales
 * POST /api/materiales - Crea un nuevo material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { checkPlanLimit } from "@/lib/plan-limits"
import { AccessLevel, ModuleKey } from "@prisma/client"
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

function normalizeUnidadMedidaFilter(value: string | null): 'm2' | 'ml' | 'unidad' | null {
  if (!value) return null
  const u = value.trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
  if (u === 'unidad' || u === 'und' || u === 'u') return 'unidad'
  return null
}

function parseNumberParam(value: string | null): number | null {
  if (value === null || value === undefined) return null
  const v = String(value).trim()
  if (!v) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

// GET - Listar todos los materiales
export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { id: true } })
    let sedeId = sede?.id ?? access.sedeId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const activo = searchParams.get('activo')
    const unidadMedida = searchParams.get('unidadMedida')
    const categoria = searchParams.get('categoria')
    const proveedor = searchParams.get('proveedor')
    const withDiscount = searchParams.get('withDiscount')
    const costoMin = searchParams.get('costoMin')
    const costoMax = searchParams.get('costoMax')
    const createdFrom = searchParams.get('createdFrom')
    const createdTo = searchParams.get('createdTo')
    const sort = (searchParams.get('sort') || '').trim()
    const warehouseId = (searchParams.get('warehouseId') || '').trim() || null
    const sedeIdParam = (searchParams.get('sedeId') || '').trim() || null
    const precioMin = searchParams.get('precioMin')
    const precioMax = searchParams.get('precioMax')
    const stockMin = searchParams.get('stockMin')
    const stockMax = searchParams.get('stockMax')

    const pageRaw = searchParams.get('page')
    const pageSizeRaw = (searchParams.get('pageSize') || '').trim()

    const pageParsed = pageRaw ? Number(String(pageRaw).trim()) : 1
    const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1

    const pageSizeParsed = pageSizeRaw && pageSizeRaw !== 'all' ? Number(pageSizeRaw) : null
    const wantsPagination =
      pageSizeRaw !== '' &&
      pageSizeRaw !== 'all' &&
      Number.isFinite(pageSizeParsed) &&
      (pageSizeParsed as number) > 0
    const take = wantsPagination ? Math.min(500, Math.floor(pageSizeParsed as number)) : null

    if (sedeIdParam) {
      const sedeTarget = await prisma.sede.findFirst({ where: { id: sedeIdParam, empresaId }, select: { id: true } })
      if (sedeTarget?.id) {
        try {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: sedeTarget.id,
            module: ModuleKey.MATERIALES,
            minLevel: AccessLevel.READ,
          })
          sedeId = sedeTarget.id
        } catch (error) {
          if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
          }
          throw error
        }
      }
    }

    // Construir filtros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { empresaId }

    const andFilters: unknown[] = []

    if (search) {
      andFilters.push({
        OR: [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { externalId: { contains: search, mode: 'insensitive' as const } },
        { categoria: { contains: search, mode: 'insensitive' as const } },
        { proveedor: { contains: search, mode: 'insensitive' as const } },
        ],
      })
    }

    if (categoria && categoria.trim()) {
      where.categoria = { contains: categoria.trim(), mode: 'insensitive' as const }
    }

    if (proveedor && proveedor.trim()) {
      where.proveedor = { contains: proveedor.trim(), mode: 'insensitive' as const }
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

    if (withDiscount === 'true') {
      where.quantityDiscounts = { some: {} }
    } else if (withDiscount === 'false') {
      where.quantityDiscounts = { none: {} }
    }

    const costoMinN = costoMin ? Number(costoMin) : null
    const costoMaxN = costoMax ? Number(costoMax) : null
    if (Number.isFinite(costoMinN) || Number.isFinite(costoMaxN)) {
      where.precioCompra = {
        ...(Number.isFinite(costoMinN) ? { gte: Math.max(0, costoMinN as number) } : {}),
        ...(Number.isFinite(costoMaxN) ? { lte: Math.max(0, costoMaxN as number) } : {}),
      }
    }

    if (createdFrom || createdTo) {
      const createdAt: { gte?: Date; lt?: Date } = {}

      if (createdFrom) {
        const fromDate = new Date(`${createdFrom}T00:00:00`)
        if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate
      }

      if (createdTo) {
        const toDate = new Date(`${createdTo}T00:00:00`)
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setDate(toDate.getDate() + 1)
          createdAt.lt = toDate
        }
      }

      if (createdAt.gte || createdAt.lt) where.createdAt = createdAt
    }

    const precioMinN = parseNumberParam(precioMin)
    const precioMaxN = parseNumberParam(precioMax)
    if (Number.isFinite(precioMinN) || Number.isFinite(precioMaxN)) {
      const buildRange = () => ({
        ...(Number.isFinite(precioMinN) ? { gte: Math.max(0, precioMinN as number) } : {}),
        ...(Number.isFinite(precioMaxN) ? { lte: Math.max(0, precioMaxN as number) } : {}),
      })

      andFilters.push({
        OR: [
          { unidadMedida: 'm2', precioM2: buildRange() },
          { unidadMedida: 'ml', precioMetro: buildRange() },
          { unidadMedida: 'unidad', precioUnidad: buildRange() },
        ],
      })
    }

    if (andFilters.length) where.AND = andFilters

    const sortMode = new Set([
      'nameAsc',
      'stockDesc',
      'createdDesc',
      'createdAsc',
      'costDesc',
      'costAsc',
      'mostSold',
      'mostQuoted',
    ]).has(sort)
      ? sort
      : 'nameAsc'

    const mostSoldAgg =
      sortMode === 'mostSold'
        ? await prisma.posInvoiceItem
            .groupBy({
              by: ['materialId'],
              where: {
                materialId: { not: null },
                invoice: { empresaId, status: 'PAID' },
              },
              _sum: { quantity: true },
              orderBy: { _sum: { quantity: 'desc' } },
              take: 500,
            })
            .catch(() => [])
        : null

    const mostQuotedAgg =
      sortMode === 'mostQuoted'
        ? await prisma.itemCotizacion
            .groupBy({
              by: ['materialId'],
              where: {
                materialId: { not: null },
                cotizacion: { cliente: { empresaId } },
              },
              _count: { id: true },
              orderBy: { _count: { id: 'desc' } },
              take: 500,
            })
            .catch(() => [])
        : null

    const soldMap = mostSoldAgg
      ? new Map(mostSoldAgg.map((x) => [String(x.materialId), Number(x._sum.quantity ?? 0)]))
      : null

    const quotedMap = mostQuotedAgg
      ? new Map(mostQuotedAgg.map((x) => [String(x.materialId), Number(x._count?.id ?? 0)]))
      : null

    const include = {
      quantityDiscounts: {
        orderBy: { minQty: 'asc' as const },
      },
      // “Anclaje” por bodega: traemos 1 stock, priorizando la bodega principal de la sede.
      // Si el material solo tiene stocks globales (sedeId null), también lo consideramos.
      stocks: {
        ...(warehouseId
          ? { where: { warehouseId }, take: 1, orderBy: [{ updatedAt: 'desc' as const }] }
          : {
              where: {
                warehouse: {
                  OR: [{ sedeId }, { sedeId: null }],
                },
              },
              take: 1,
              orderBy: [{ warehouse: { isDefault: 'desc' as const } }, { updatedAt: 'desc' as const }],
            }),
        include: {
          warehouse: {
            select: { id: true, nombre: true, codigo: true, isDefault: true, sedeId: true },
          },
        },
      },
    }

    const orderBy =
      sortMode === 'stockDesc'
        ? ({ stockActual: 'desc' } as const)
        : sortMode === 'createdDesc'
          ? ({ createdAt: 'desc' } as const)
          : sortMode === 'createdAsc'
            ? ({ createdAt: 'asc' } as const)
            : sortMode === 'costDesc'
              ? ({ precioCompra: 'desc' } as const)
              : sortMode === 'costAsc'
                ? ({ precioCompra: 'asc' } as const)
                : ({ nombre: 'asc' } as const)

    const stockMinN = parseNumberParam(stockMin)
    const stockMaxN = parseNumberParam(stockMax)

    const needsInMemory =
      sortMode === 'mostSold' ||
      sortMode === 'mostQuoted' ||
      Number.isFinite(stockMinN) ||
      Number.isFinite(stockMaxN)

    // Si piden paginación pero necesitamos procesar en memoria (filtros/sorts especiales),
    // traemos todo y paginamos al final.
    if (wantsPagination && take && needsInMemory) {
      let materiales = await prisma.material.findMany({
        where,
        include,
        orderBy,
      })

      if (Number.isFinite(stockMinN) || Number.isFinite(stockMaxN)) {
        materiales = materiales.filter((m) => {
          const stockForView = warehouseId ? (m.stocks?.[0]?.quantity ?? 0) : (m.stockActual ?? 0)
          if (Number.isFinite(stockMinN) && stockForView < (stockMinN as number)) return false
          if (Number.isFinite(stockMaxN) && stockForView > (stockMaxN as number)) return false
          return true
        })
      }

      const sorted =
        sortMode === 'mostSold' && soldMap
          ? [...materiales].sort((a, b) => {
              const av = soldMap.get(a.id) ?? 0
              const bv = soldMap.get(b.id) ?? 0
              if (bv !== av) return bv - av
              return a.nombre.localeCompare(b.nombre)
            })
          : sortMode === 'mostQuoted' && quotedMap
            ? [...materiales].sort((a, b) => {
                const av = quotedMap.get(a.id) ?? 0
                const bv = quotedMap.get(b.id) ?? 0
                if (bv !== av) return bv - av
                return a.nombre.localeCompare(b.nombre)
              })
            : materiales

      const total = sorted.length
      const pageCount = Math.max(1, Math.ceil(total / take))
      const safePage = Math.min(Math.max(1, page), pageCount)
      const sliceFrom = (safePage - 1) * take
      const sliceTo = sliceFrom + take
      const data = sorted.slice(sliceFrom, sliceTo)

      return NextResponse.json({
        success: true,
        data,
        meta: {
          total,
          page: safePage,
          pageSize: take,
          pageCount,
        },
      })
    }

    // Paginación a nivel DB cuando es posible.
    if (wantsPagination && take && !needsInMemory) {
      const total = await prisma.material.count({ where })
      const pageCount = Math.max(1, Math.ceil(total / take))
      const safePage = Math.min(Math.max(1, page), pageCount)
      const safeSkip = (safePage - 1) * take

      const data = await prisma.material.findMany({
        where,
        include,
        orderBy,
        skip: safeSkip,
        take,
      })

      return NextResponse.json({
        success: true,
        data,
        meta: {
          total,
          page: safePage,
          pageSize: take,
          pageCount,
        },
      })
    }

    // Sin paginación (o pageSize=all).
    let materiales = await prisma.material.findMany({
      where,
      include,
      orderBy,
    })

    if (Number.isFinite(stockMinN) || Number.isFinite(stockMaxN)) {
      materiales = materiales.filter((m) => {
        const stockForView = warehouseId ? (m.stocks?.[0]?.quantity ?? 0) : (m.stockActual ?? 0)
        if (Number.isFinite(stockMinN) && stockForView < (stockMinN as number)) return false
        if (Number.isFinite(stockMaxN) && stockForView > (stockMaxN as number)) return false
        return true
      })
    }

    const sorted =
      sortMode === 'mostSold' && soldMap
        ? [...materiales].sort((a, b) => {
            const av = soldMap.get(a.id) ?? 0
            const bv = soldMap.get(b.id) ?? 0
            if (bv !== av) return bv - av
            return a.nombre.localeCompare(b.nombre)
          })
        : sortMode === 'mostQuoted' && quotedMap
          ? [...materiales].sort((a, b) => {
              const av = quotedMap.get(a.id) ?? 0
              const bv = quotedMap.get(b.id) ?? 0
              if (bv !== av) return bv - av
              return a.nombre.localeCompare(b.nombre)
            })
          : materiales

    return NextResponse.json({
      success: true,
      data: sorted,
      ...(pageSizeRaw
        ? {
            meta: {
              total: sorted.length,
              page: 1,
              pageSize: pageSizeRaw === 'all' ? 'all' : null,
              pageCount: 1,
            },
          }
        : {}),
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

    const empresaId = access.empresaId

    const limit = await checkPlanLimit(empresaId, 'PRODUCTOS_MAX')
    if (!limit.ok) {
      return NextResponse.json(limit, { status: 402 })
    }

    const body = await request.json()
    const {
      externalId,
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

    const externalIdNorm = typeof externalId === 'string' ? externalId.trim() : ''
    const externalIdValue = externalIdNorm ? externalIdNorm : null

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

    if (externalIdValue) {
      const dup = await prisma.material.findFirst({
        where: { empresaId, externalId: externalIdValue },
        select: { id: true },
      })

      if (dup?.id) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese código/ID externo en tu empresa.' },
          { status: 409 }
        )
      }
    }

    // Crear material
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({
        data: {
          externalId: externalIdValue,
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
    // Prisma: constraint unique (empresaId, externalId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (error as any)?.code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese código/ID externo en tu empresa.' },
        { status: 409 }
      )
    }

    console.error("Error al crear material:", error)
    return NextResponse.json({ error: "Error al crear material" }, { status: 500 })
  }
}
