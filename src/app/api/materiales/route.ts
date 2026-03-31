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

    const me = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { role: true },
    })

    const isAdmin = me?.role === 'ADMIN'

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
    const sortRaw = (searchParams.get('sort') || '').trim()
    const sort = sortRaw === 'costDesc' ? 'priceDesc' : sortRaw === 'costAsc' ? 'priceAsc' : sortRaw
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
        if (access.session.user.role !== 'ADMIN') {
          try {
            await requireSedeAccess({
              userId: access.userId,
              sedeId: sedeTarget.id,
              module: ModuleKey.MATERIALES,
              minLevel: AccessLevel.READ,
            })
          } catch (error) {
            if (error instanceof Error && error.message === 'FORBIDDEN') {
              return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
            }
            throw error
          }
        }

        sedeId = sedeTarget.id
      }
    }

    if (warehouseId) {
      const warehouse = await prisma.inventoryWarehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, empresaId: true, sedeId: true },
      })

      if (!warehouse || warehouse.empresaId !== empresaId) {
        return NextResponse.json({ error: 'Bodega inválida' }, { status: 404 })
      }

      if (warehouse.sedeId && access.session.user.role !== 'ADMIN') {
        try {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: warehouse.sedeId,
            module: ModuleKey.MATERIALES,
            minLevel: AccessLevel.READ,
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
          }
          throw error
        }
      }

      if (warehouse.sedeId) {
        sedeId = warehouse.sedeId
      }
    }

    // Construir filtros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { empresaId }

    const andFilters: unknown[] = []

    // Productos personalizados: visibles solo para su creador (usuario+sede), excepto ADMIN.
    if (!isAdmin) {
      andFilters.push({
        OR: [
          { isCustom: false },
          { isCustom: true, customOwnerUserId: access.userId, customSedeId: access.sedeId },
        ],
      })
    }

    if (search) {
      andFilters.push({
        OR: [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { tipoNombre: { contains: search, mode: 'insensitive' as const } },
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
      'priceDesc',
      'priceAsc',
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
            : ({ nombre: 'asc' } as const)

    const getPrecioForSort = (m: { unidadMedida?: string | null; precioM2?: unknown; precioMetro?: unknown; precioUnidad?: unknown }) => {
      const unidad = String(m.unidadMedida ?? '').trim().toLowerCase()
      const raw =
        unidad === 'm2'
          ? m.precioM2
          : unidad === 'ml'
            ? m.precioMetro
            : unidad === 'unidad'
              ? m.precioUnidad
              : (m.precioM2 ?? m.precioMetro ?? m.precioUnidad)
      const n = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(n) ? n : null
    }

    const stockMinN = parseNumberParam(stockMin)
    const stockMaxN = parseNumberParam(stockMax)

    const needsInMemory =
      sortMode === 'mostSold' ||
      sortMode === 'mostQuoted' ||
      sortMode === 'priceDesc' ||
      sortMode === 'priceAsc' ||
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
            : (sortMode === 'priceDesc' || sortMode === 'priceAsc')
              ? [...materiales].sort((a, b) => {
                  const ap = getPrecioForSort(a)
                  const bp = getPrecioForSort(b)
                  if (ap === null && bp === null) return a.nombre.localeCompare(b.nombre)
                  if (ap === null) return 1
                  if (bp === null) return -1
                  if (ap !== bp) return sortMode === 'priceAsc' ? ap - bp : bp - ap
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
          : (sortMode === 'priceDesc' || sortMode === 'priceAsc')
            ? [...materiales].sort((a, b) => {
                const ap = getPrecioForSort(a)
                const bp = getPrecioForSort(b)
                if (ap === null && bp === null) return a.nombre.localeCompare(b.nombre)
                if (ap === null) return 1
                if (bp === null) return -1
                if (ap !== bp) return sortMode === 'priceAsc' ? ap - bp : bp - ap
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
      tipoNombre,
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
      requiresWorkOrder,
      extraFields,
      activo,
      warehouseId: warehouseIdInput,
      stockScope: stockScopeInput,
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

    const stockScopeRaw = typeof stockScopeInput === 'string' ? stockScopeInput.trim() : ''
    const stockScope: 'warehouse' | 'allSedes' = stockScopeRaw === 'allSedes' ? 'allSedes' : 'warehouse'

    const requestedWarehouseId = typeof warehouseIdInput === 'string' ? warehouseIdInput.trim() : ''

    const canUseRequestedWarehouse = async () => {
      if (!requestedWarehouseId) return null
      const warehouse = await prisma.inventoryWarehouse.findUnique({
        where: { id: requestedWarehouseId },
        select: { id: true, empresaId: true, sedeId: true },
      })

      if (!warehouse || warehouse.empresaId !== empresaId) return null

      if (warehouse.sedeId && access.session.user.role !== 'ADMIN') {
        await requireSedeAccess({
          userId: access.userId,
          sedeId: warehouse.sedeId,
          module: ModuleKey.MATERIALES,
          minLevel: AccessLevel.WRITE,
        })
      }

      return warehouse
    }

    // Regla: si el stock aplica a una bodega específica, debe venir explícita (no auto-asignamos).
    if (stockActualN > 0 && stockScope === 'warehouse' && !requestedWarehouseId) {
      return NextResponse.json(
        { error: 'Para registrar stock en una sede específica debes seleccionar una bodega, o elegir “Todas las sedes”.' },
        { status: 400 }
      )
    }

    let whValidated: Awaited<ReturnType<typeof canUseRequestedWarehouse>> = null

    if (stockActualN > 0 && stockScope === 'warehouse') {
      try {
        whValidated = await canUseRequestedWarehouse()
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN') {
          return NextResponse.json(
            { error: 'Bodega inválida o sin acceso para registrar stock.' },
            { status: 403 }
          )
        }
        throw error
      }
    }

    if (stockActualN > 0 && stockScope === 'warehouse' && !whValidated?.id) {
      return NextResponse.json(
        { error: 'Bodega inválida o sin acceso para registrar stock.' },
        { status: 400 }
      )
    }

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
          tipoNombre: typeof tipoNombre === 'string' ? tipoNombre.trim() || null : null,
          categoria,
          extraFields: extraFields && typeof extraFields === 'object' && !Array.isArray(extraFields) ? extraFields : {},
          imagenUrl: imagenUrlNorm || null,
          ancho: ancho ? parseFloat(ancho) : null,
          largo: largo ? parseFloat(largo) : null,
          espesor: espesor ? parseFloat(espesor) : null,
          color,
          precioM2: precioM2N,
          precioMetro: precioMetroN,
          precioUnidad: precioUnidadN,
          precioCompra: precioCompra ? parseFloat(precioCompra) : null,
          stockActual: 0,
          stockMinimo: stockMinimo ? parseFloat(stockMinimo) : 0,
          unidadMedida: unidad,
          proveedor,
          observaciones,
          requiresWorkOrder: requiresWorkOrder === true,
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

      if (stockActualN > 0) {
        if (stockScope === 'warehouse') {
          await tx.inventoryStock.upsert({
            where: { warehouseId_materialId: { warehouseId: whValidated!.id, materialId: created.id } },
            create: { warehouseId: whValidated!.id, materialId: created.id, quantity: stockActualN },
            update: { quantity: stockActualN },
            select: { id: true },
          })
        } else {
          const sedes = await tx.sede.findMany({ where: { empresaId }, select: { id: true } })
          for (const s of sedes) {
            let whId: string | null = null
            const whDefault = await tx.inventoryWarehouse.findFirst({
              where: { empresaId, sedeId: s.id, isDefault: true },
              select: { id: true },
            })
            if (whDefault?.id) whId = whDefault.id

            if (!whId) {
              const whAny = await tx.inventoryWarehouse.findFirst({
                where: { empresaId, sedeId: s.id },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
              })
              if (whAny?.id) whId = whAny.id
            }

            if (!whId) {
              const whCreated = await tx.inventoryWarehouse.create({
                data: {
                  empresaId,
                  sedeId: s.id,
                  nombre: 'Principal',
                  codigo: 'PRIN',
                  isDefault: true,
                },
                select: { id: true },
              })
              whId = whCreated.id
            }

            await tx.inventoryStock.upsert({
              where: { warehouseId_materialId: { warehouseId: whId, materialId: created.id } },
              create: { warehouseId: whId, materialId: created.id, quantity: stockActualN },
              update: { quantity: stockActualN },
              select: { id: true },
            })
          }
        }
      }

      const agg = await tx.inventoryStock.aggregate({
        where: { materialId: created.id },
        _sum: { quantity: true },
      })

      const globalStock = Number(agg._sum.quantity ?? 0)
      await tx.material.update({
        where: { id: created.id },
        data: { stockActual: Number.isFinite(globalStock) ? Math.max(0, globalStock) : 0 },
        select: { id: true },
      })

      const final = await tx.material.findUnique({
        where: { id: created.id },
        include: {
          quantityDiscounts: { orderBy: { minQty: 'asc' } },
        },
      })

      return final!
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
    const detail = error instanceof Error ? error.message : null
    return NextResponse.json(
      {
        error: "Error al crear producto",
        ...(process.env.NODE_ENV !== 'production' && detail ? { detail } : {}),
      },
      { status: 500 }
    )
  }
}
