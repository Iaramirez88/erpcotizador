import { EstadoCompra, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

type PurchaseWindowSummary = {
  count: number
  total: number
  unpaidCount: number
  unpaidBalance: number
}

type PurchasePriceSignal = {
  key: string
  descripcion: string
  currentAvg: number
  previousAvg: number
  increasePct: number
  currentCount: number
  previousCount: number
}

export type PurchasesDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  purchases: {
    current: PurchaseWindowSummary
    previous: PurchaseWindowSummary
    pendingAuthorization: Array<{
      id: string
      proveedorNombre: string
      fechaCompra: string
      total: number
      estado: EstadoCompra
    }>
    unpaid: Array<{
      id: string
      proveedorNombre: string
      fechaCompra: string
      total: number
      paid: number
      balance: number
    }>
  }
  replenishment: {
    urgentMaterials: Array<{
      id: string
      nombre: string
      proveedor: string | null
      stockActual: number
      stockMinimo: number
      shortfall: number
    }>
  }
  costSignals: {
    increasedItems: PurchasePriceSignal[]
  }
}

type CollectPurchasesFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

function clampPositive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function normalizeDescription(value: string) {
  return value.trim().toLowerCase()
}

async function loadPurchaseWindow(args: {
  prisma: PrismaClient
  empresaId: string
  sedeId?: string | null
  from: Date
  to: Date
}) {
  const purchases = await args.prisma.compra.findMany({
    where: {
      empresaId: args.empresaId,
      ...(args.sedeId ? { sedeId: args.sedeId } : {}),
      estado: { not: EstadoCompra.ANULADA },
      fechaCompra: { gte: args.from, lte: args.to },
    },
    select: {
      id: true,
      total: true,
      pagos: { select: { monto: true } },
    },
  })

  const normalized = purchases.map((purchase) => {
    const total = clampPositive(purchase.total ?? 0)
    const paid = purchase.pagos.reduce((sum, payment) => sum + clampPositive(payment.monto ?? 0), 0)
    const balance = Math.max(0, total - paid)

    return {
      total,
      balance,
    }
  })

  return {
    count: purchases.length,
    total: normalized.reduce((sum, purchase) => sum + purchase.total, 0),
    unpaidCount: normalized.filter((purchase) => purchase.balance > 0).length,
    unpaidBalance: normalized.reduce((sum, purchase) => sum + purchase.balance, 0),
  } satisfies PurchaseWindowSummary
}

function buildPriceSignals(args: {
  currentItems: Array<{ descripcion: string; precioUnitario: number }>
  previousItems: Array<{ descripcion: string; precioUnitario: number }>
}): PurchasePriceSignal[] {
  const aggregate = (items: Array<{ descripcion: string; precioUnitario: number }>) => {
    const map = new Map<string, { descripcion: string; total: number; count: number }>()
    for (const item of items) {
      const key = normalizeDescription(item.descripcion)
      if (!key) continue
      const current = map.get(key) ?? { descripcion: item.descripcion.trim(), total: 0, count: 0 }
      current.total += clampPositive(item.precioUnitario)
      current.count += 1
      map.set(key, current)
    }
    return map
  }

  const currentMap = aggregate(args.currentItems)
  const previousMap = aggregate(args.previousItems)

  return [...currentMap.entries()]
    .map(([key, current]) => {
      const previous = previousMap.get(key)
      if (!previous || previous.count === 0) return null
      const currentAvg = current.total / current.count
      const previousAvg = previous.total / previous.count
      if (previousAvg <= 0 || currentAvg <= previousAvg) return null
      const increasePct = ((currentAvg - previousAvg) / previousAvg) * 100
      return {
        key,
        descripcion: current.descripcion,
        currentAvg,
        previousAvg,
        increasePct,
        currentCount: current.count,
        previousCount: previous.count,
      }
    })
    .filter((item): item is PurchasePriceSignal => Boolean(item && item.increasePct >= 10))
    .sort((left, right) => right.increasePct - left.increasePct)
    .slice(0, 8)
}

export async function collectPurchasesFacts(args: CollectPurchasesFactsArgs): Promise<PurchasesDecisionFacts> {
  const range = resolveAnalysisDateRange(args)

  const [current, previous, pendingAuthorization, unpaidRaw, urgentMaterials, currentItems, previousItems] = await Promise.all([
    loadPurchaseWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.from, to: range.to }),
    loadPurchaseWindow({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.previousFrom, to: range.previousTo }),
    args.prisma.compra.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { in: [EstadoCompra.BORRADOR, EstadoCompra.REGISTRADA] },
        autorizado: false,
      },
      orderBy: [{ fechaCompra: 'asc' }],
      take: 8,
      select: {
        id: true,
        proveedorNombre: true,
        fechaCompra: true,
        total: true,
        estado: true,
      },
    }),
    args.prisma.compra.findMany({
      where: {
        empresaId: args.empresaId,
        ...(args.sedeId ? { sedeId: args.sedeId } : {}),
        estado: { not: EstadoCompra.ANULADA },
      },
      orderBy: [{ fechaCompra: 'asc' }],
      take: 12,
      select: {
        id: true,
        proveedorNombre: true,
        fechaCompra: true,
        total: true,
        pagos: { select: { monto: true } },
      },
    }),
    args.prisma.material.findMany({
      where: {
        empresaId: args.empresaId,
        activo: true,
        stockMinimo: { gt: 0 },
        stockActual: { lte: 0 },
      },
      orderBy: [{ stockActual: 'asc' }, { stockMinimo: 'desc' }],
      take: 8,
      select: {
        id: true,
        nombre: true,
        proveedor: true,
        stockActual: true,
        stockMinimo: true,
      },
    }),
    args.prisma.compraItem.findMany({
      where: {
        compra: {
          empresaId: args.empresaId,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
          estado: { not: EstadoCompra.ANULADA },
          fechaCompra: { gte: range.from, lte: range.to },
        },
      },
      select: {
        descripcion: true,
        precioUnitario: true,
      },
    }),
    args.prisma.compraItem.findMany({
      where: {
        compra: {
          empresaId: args.empresaId,
          ...(args.sedeId ? { sedeId: args.sedeId } : {}),
          estado: { not: EstadoCompra.ANULADA },
          fechaCompra: { gte: range.previousFrom, lte: range.previousTo },
        },
      },
      select: {
        descripcion: true,
        precioUnitario: true,
      },
    }),
  ])

  const unpaid = unpaidRaw
    .map((purchase) => {
      const total = clampPositive(purchase.total ?? 0)
      const paid = purchase.pagos.reduce((sum, payment) => sum + clampPositive(payment.monto ?? 0), 0)
      const balance = Math.max(0, total - paid)

      return {
        id: purchase.id,
        proveedorNombre: purchase.proveedorNombre,
        fechaCompra: purchase.fechaCompra.toISOString(),
        total,
        paid,
        balance,
      }
    })
    .filter((purchase) => purchase.balance > 0)
    .sort((left, right) => right.balance - left.balance)
    .slice(0, 8)

  return {
    generatedAt: new Date().toISOString(),
    scope: args.sedeId ? 'SEDE' : 'EMPRESA',
    period: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      previousFrom: range.previousFrom.toISOString(),
      previousTo: range.previousTo.toISOString(),
      durationDays: range.durationDays,
    },
    purchases: {
      current,
      previous,
      pendingAuthorization: pendingAuthorization.map((purchase) => ({
        id: purchase.id,
        proveedorNombre: purchase.proveedorNombre,
        fechaCompra: purchase.fechaCompra.toISOString(),
        total: clampPositive(purchase.total ?? 0),
        estado: purchase.estado,
      })),
      unpaid,
    },
    replenishment: {
      urgentMaterials: urgentMaterials.map((material) => ({
        id: material.id,
        nombre: material.nombre,
        proveedor: material.proveedor ?? null,
        stockActual: clampPositive(material.stockActual),
        stockMinimo: clampPositive(material.stockMinimo),
        shortfall: Math.max(0, clampPositive(material.stockMinimo) - clampPositive(material.stockActual)),
      })),
    },
    costSignals: {
      increasedItems: buildPriceSignals({
        currentItems: currentItems.map((item) => ({ descripcion: item.descripcion, precioUnitario: clampPositive(item.precioUnitario) })),
        previousItems: previousItems.map((item) => ({ descripcion: item.descripcion, precioUnitario: clampPositive(item.precioUnitario) })),
      }),
    },
  }
}