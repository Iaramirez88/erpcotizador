import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireSedeAccess } from '@/lib/rbac'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

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

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

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
    const warehouseIdParam = (searchParams.get('warehouseId') || '').trim() || null
    const sedeIdParam = (searchParams.get('sedeId') || '').trim() || null
    const precioMin = searchParams.get('precioMin')
    const precioMax = searchParams.get('precioMax')
    const stockMin = searchParams.get('stockMin')
    const stockMax = searchParams.get('stockMax')

    let sedeId = access.sedeId
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

    let warehouseId: string | null = warehouseIdParam
    if (warehouseId) {
      const wh = await prisma.inventoryWarehouse.findFirst({
        where: {
          id: warehouseId,
          empresaId,
          OR: [{ sedeId }, { sedeId: null }],
        },
        select: { id: true },
      })
      if (!wh?.id) warehouseId = null
    }

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

    if (tipo) where.tipo = tipo

    const unidadFilter = normalizeUnidadMedidaFilter(unidadMedida)
    if (unidadFilter) where.unidadMedida = unidadFilter

    if (activo !== null && activo !== undefined && activo !== '') {
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

    let materiales = await prisma.material.findMany({
      where,
      include: {
        quantityDiscounts: { orderBy: { minQty: 'asc' } },
        stocks: {
          ...(warehouseId
            ? { where: { warehouseId }, take: 1, orderBy: [{ updatedAt: 'desc' }] }
            : {
                where: {
                  warehouse: {
                    OR: [{ sedeId }, { sedeId: null }],
                  },
                },
                take: 1,
                orderBy: [{ warehouse: { isDefault: 'desc' } }, { updatedAt: 'desc' }],
              }),
          include: {
            warehouse: {
              select: { id: true, nombre: true, codigo: true, isDefault: true, sedeId: true },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
      take: 5000,
    })

    const stockMinN = parseNumberParam(stockMin)
    const stockMaxN = parseNumberParam(stockMax)
    if (Number.isFinite(stockMinN) || Number.isFinite(stockMaxN)) {
      materiales = materiales.filter((m) => {
        const stockForView = warehouseId ? (m.stocks?.[0]?.quantity ?? 0) : (m.stockActual ?? 0)
        if (Number.isFinite(stockMinN) && stockForView < (stockMinN as number)) return false
        if (Number.isFinite(stockMaxN) && stockForView > (stockMaxN as number)) return false
        return true
      })
    }

    const rows = materiales.map((m) => ({
      ID: m.id,
      CodigoExterno: m.externalId ?? '',
      Nombre: m.nombre,
      Tipo: m.tipo,
      Categoria: m.categoria ?? '',
      UnidadMedida: m.unidadMedida,
      PrecioM2: m.precioM2 ?? '',
      PrecioMetro: m.precioMetro ?? '',
      PrecioUnidad: m.precioUnidad ?? '',
      PrecioCompra: m.precioCompra ?? '',
      StockActual: m.stockActual ?? 0,
      StockEnBodega: m.stocks?.[0]?.quantity ?? 0,
      Bodega: m.stocks?.[0]?.warehouse?.nombre ?? '',
      SedeBodega: m.stocks?.[0]?.warehouse?.sedeId ?? '',
      StockMinimo: m.stockMinimo ?? 0,
      Proveedor: m.proveedor ?? '',
      Activo: m.activo ? 'SI' : 'NO',
      Creado: m.createdAt,
    }))

    const buffer = buildXlsxBuffer([{ name: 'Materiales', rows }])
    const filename = `productos-materiales-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando materiales:', error)
    return NextResponse.json({ success: false, error: 'Error exportando materiales' }, { status: 500 })
  }
}
