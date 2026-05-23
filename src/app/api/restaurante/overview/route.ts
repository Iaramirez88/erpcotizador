import { NextResponse } from 'next/server'
import { ModuleKey, PosInvoiceStatus, RestauranteTurnoStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { computeRestaurantBoardSummary, sanitizeRestaurantBoard } from '@/lib/restaurante'

export const runtime = 'nodejs'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = addDays(todayStart, -6)
    const productWindowStart = addDays(todayStart, -13)

    const [sede, currentTurno, todayInvoices, productInvoices, weekPurchases, materials, wasteOverrides] = await Promise.all([
      prisma.sede.findUnique({
        where: { id: access.sedeId },
        select: { id: true, nombre: true, desperdicioPctDefault: true },
      }),
      prisma.restauranteTurno.findFirst({
        where: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          status: RestauranteTurnoStatus.ABIERTO,
        },
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          status: true,
          boardData: true,
          summaryData: true,
          closingNotes: true,
          openedAt: true,
          closedAt: true,
          updatedAt: true,
        },
      }),
      prisma.posInvoice.findMany({
        where: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          status: { in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED] },
          createdAt: { gte: todayStart },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          numero: true,
          total: true,
          status: true,
          createdAt: true,
          clienteNombre: true,
          items: {
            select: {
              id: true,
              materialId: true,
              descripcion: true,
              quantity: true,
              total: true,
            },
          },
          returns: {
            select: { total: true },
          },
        },
      }),
      prisma.posInvoice.findMany({
        where: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          status: { in: [PosInvoiceStatus.PAID, PosInvoiceStatus.PARTIALLY_REFUNDED, PosInvoiceStatus.REFUNDED] },
          createdAt: { gte: productWindowStart },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 80,
        select: {
          id: true,
          items: {
            select: {
              materialId: true,
              descripcion: true,
              quantity: true,
              total: true,
            },
          },
        },
      }),
      prisma.compra.findMany({
        where: {
          empresaId: access.empresaId,
          fechaCompra: { gte: weekStart },
          OR: [{ sedeId: access.sedeId }, { sedeId: null }],
        },
        orderBy: [{ fechaCompra: 'desc' }],
        take: 8,
        select: {
          id: true,
          fechaCompra: true,
          proveedorNombre: true,
          total: true,
          autorizado: true,
          numeroFactura: true,
          observaciones: true,
        },
      }),
      prisma.material.findMany({
        where: { empresaId: access.empresaId, activo: true },
        orderBy: [{ stockActual: 'asc' }, { nombre: 'asc' }],
        take: 120,
        select: {
          id: true,
          nombre: true,
          categoria: true,
          unidadMedida: true,
          stockActual: true,
          stockMinimo: true,
          precioCompra: true,
          precioUnidad: true,
        },
      }),
      prisma.sedeMaterialWaste.findMany({
        where: { sedeId: access.sedeId },
        select: { materialId: true, desperdicioPct: true },
      }),
    ])

    const wasteMap = new Map(wasteOverrides.map((item) => [item.materialId, item.desperdicioPct]))
    const defaultWastePct = sede?.desperdicioPctDefault ?? 0

    const sales = todayInvoices.map((invoice) => {
      const returnedTotal = invoice.returns.reduce((sum, item) => sum + (item.total ?? 0), 0)
      const grossTotal = invoice.total ?? 0
      const netTotal = invoice.status === PosInvoiceStatus.REFUNDED ? 0 : Math.max(0, grossTotal - returnedTotal)
      return {
        id: invoice.id,
        numero: invoice.numero,
        createdAt: invoice.createdAt,
        clienteNombre: invoice.clienteNombre,
        total: netTotal,
        items: invoice.items,
      }
    })

    const productMap = new Map<string, { key: string; label: string; materialId: string | null; quantity: number; total: number }>()

    for (const invoice of productInvoices) {
      for (const item of invoice.items) {
        const key = item.materialId ?? item.descripcion.trim().toLowerCase()
        const current = productMap.get(key)
        if (current) {
          current.quantity += item.quantity ?? 0
          current.total += item.total ?? 0
          continue
        }

        productMap.set(key, {
          key,
          label: item.descripcion,
          materialId: item.materialId,
          quantity: item.quantity ?? 0,
          total: item.total ?? 0,
        })
      }
    }

    const materialsWithWaste = materials.map((material) => {
      const wastePct = wasteMap.get(material.id) ?? defaultWastePct
      return {
        ...material,
        wastePct,
      }
    })

    const stockAlerts = materialsWithWaste
      .filter((material) => material.stockActual <= Math.max(material.stockMinimo || 0, 5))
      .slice(0, 8)
      .map((material) => ({
        id: material.id,
        nombre: material.nombre,
        categoria: material.categoria,
        unidadMedida: material.unidadMedida,
        stockActual: material.stockActual,
        stockMinimo: material.stockMinimo,
        wastePct: material.wastePct,
        severity: material.stockActual <= (material.stockMinimo || 0) ? 'critical' : 'warning',
      }))

    const wasteAlerts = materialsWithWaste
      .filter((material) => material.wastePct >= 8)
      .sort((left, right) => right.wastePct - left.wastePct)
      .slice(0, 8)
      .map((material) => ({
        id: material.id,
        nombre: material.nombre,
        categoria: material.categoria,
        wastePct: material.wastePct,
        stockActual: material.stockActual,
        stockMinimo: material.stockMinimo,
      }))

    const purchaseTotal = weekPurchases.reduce((sum, purchase) => sum + (purchase.total ?? 0), 0)
    const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0)

    const normalizedBoard = currentTurno ? sanitizeRestaurantBoard(currentTurno.boardData) : null

    return NextResponse.json({
      ok: true,
      data: {
        sede: {
          id: access.sedeId,
          nombre: sede?.nombre ?? 'Sede actual',
        },
        currentTurno: currentTurno
          ? {
              id: currentTurno.id,
              title: currentTurno.title,
              status: currentTurno.status,
              closingNotes: currentTurno.closingNotes,
              openedAt: currentTurno.openedAt,
              closedAt: currentTurno.closedAt,
              updatedAt: currentTurno.updatedAt,
              board: normalizedBoard,
              summary: computeRestaurantBoardSummary(normalizedBoard ?? sanitizeRestaurantBoard(null)),
            }
          : null,
        salesToday: {
          total: salesTotal,
          count: sales.length,
          average: sales.length ? salesTotal / sales.length : 0,
          tickets: sales,
        },
        purchasesWeek: {
          total: purchaseTotal,
          count: weekPurchases.length,
          authorizedCount: weekPurchases.filter((purchase) => purchase.autorizado).length,
          items: weekPurchases,
        },
        topProducts: Array.from(productMap.values())
          .sort((left, right) => right.quantity - left.quantity || right.total - left.total)
          .slice(0, 8),
        materials: materialsWithWaste,
        stockAlerts,
        wasteAlerts,
      },
    })
  } catch (error) {
    console.error('GET /api/restaurante/overview error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el panel restaurante' }, { status: 500 })
  }
}