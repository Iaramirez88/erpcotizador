import { InventoryMovementType, type PrismaClient } from '@prisma/client'
import type { DecisionEngineContext } from '@/lib/decision-engine/contracts'
import { resolveAnalysisDateRange } from '@/lib/decision-engine/dates'

type InventoryMovementSummary = {
  entries: number
  outputs: number
  adjustments: number
}

export type InventoryDecisionFacts = {
  generatedAt: string
  scope: 'EMPRESA' | 'SEDE'
  period: {
    from: string
    to: string
    previousFrom: string
    previousTo: string
    durationDays: number
  }
  materials: {
    activeCount: number
    withStock: number
    lowStock: Array<{
      id: string
      nombre: string
      externalId: string | null
      proveedor: string | null
      unidadMedida: string
      stockActual: number
      stockMinimo: number
      shortfall: number
    }>
    overstock: Array<{
      id: string
      nombre: string
      externalId: string | null
      proveedor: string | null
      unidadMedida: string
      stockActual: number
      stockMinimo: number
      excess: number
      lastMovementAt: string | null
    }>
  }
  movements: {
    current: InventoryMovementSummary
    previous: InventoryMovementSummary
  }
}

type CollectInventoryFactsArgs = DecisionEngineContext & {
  prisma: PrismaClient
}

function clampPositive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

async function loadMovementSummary(args: {
  prisma: PrismaClient
  empresaId: string
  sedeId?: string | null
  from: Date
  to: Date
}) {
  const rows = await args.prisma.inventoryMovement.groupBy({
    by: ['type'],
    where: {
      empresaId: args.empresaId,
      ...(args.sedeId ? { sedeId: args.sedeId } : {}),
      createdAt: { gte: args.from, lte: args.to },
    },
    _count: { _all: true },
  })

  const summary: InventoryMovementSummary = { entries: 0, outputs: 0, adjustments: 0 }
  for (const row of rows) {
    if (row.type === InventoryMovementType.IN) summary.entries = row._count._all
    if (row.type === InventoryMovementType.OUT) summary.outputs = row._count._all
    if (row.type === InventoryMovementType.ADJUST) summary.adjustments = row._count._all
  }

  return summary
}

export async function collectInventoryFacts(args: CollectInventoryFactsArgs): Promise<InventoryDecisionFacts> {
  const range = resolveAnalysisDateRange(args)
  const lastMovementRows = await args.prisma.inventoryMovement.groupBy({
    by: ['materialId'],
    where: {
      empresaId: args.empresaId,
      ...(args.sedeId ? { sedeId: args.sedeId } : {}),
      createdAt: { lte: range.to },
    },
    _max: { createdAt: true },
  })

  const lastMovementByMaterial = new Map(lastMovementRows.map((row) => [row.materialId, row._max.createdAt ?? null]))

  const [activeCount, withStockCount, lowStockMaterials, overstockCandidates, currentMovements, previousMovements] = await Promise.all([
    args.prisma.material.count({
      where: {
        empresaId: args.empresaId,
        activo: true,
      },
    }),
    args.prisma.material.count({
      where: {
        empresaId: args.empresaId,
        activo: true,
        stockActual: { gt: 0 },
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
      take: 10,
      select: {
        id: true,
        nombre: true,
        externalId: true,
        proveedor: true,
        unidadMedida: true,
        stockActual: true,
        stockMinimo: true,
      },
    }),
    args.prisma.material.findMany({
      where: {
        empresaId: args.empresaId,
        activo: true,
        stockMinimo: { gt: 0 },
        stockActual: { gt: 0 },
      },
      orderBy: { stockActual: 'desc' },
      take: 20,
      select: {
        id: true,
        nombre: true,
        externalId: true,
        proveedor: true,
        unidadMedida: true,
        stockActual: true,
        stockMinimo: true,
      },
    }),
    loadMovementSummary({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.from, to: range.to }),
    loadMovementSummary({ prisma: args.prisma, empresaId: args.empresaId, sedeId: args.sedeId, from: range.previousFrom, to: range.previousTo }),
  ])

  const lowStock = lowStockMaterials.map((material) => ({
    id: material.id,
    nombre: material.nombre,
    externalId: material.externalId ?? null,
    proveedor: material.proveedor ?? null,
    unidadMedida: material.unidadMedida,
    stockActual: clampPositive(material.stockActual),
    stockMinimo: clampPositive(material.stockMinimo),
    shortfall: Math.max(0, clampPositive(material.stockMinimo) - clampPositive(material.stockActual)),
  }))

  const overstock = overstockCandidates
    .filter((material) => {
      const currentStock = clampPositive(material.stockActual)
      const minimum = clampPositive(material.stockMinimo)
      return minimum > 0 && currentStock >= Math.max(minimum * 3, minimum + 10)
    })
    .slice(0, 10)
    .map((material) => {
      const currentStock = clampPositive(material.stockActual)
      const minimum = clampPositive(material.stockMinimo)
      const lastMovementAt = lastMovementByMaterial.get(material.id) ?? null

      return {
        id: material.id,
        nombre: material.nombre,
        externalId: material.externalId ?? null,
        proveedor: material.proveedor ?? null,
        unidadMedida: material.unidadMedida,
        stockActual: currentStock,
        stockMinimo: minimum,
        excess: Math.max(0, currentStock - minimum),
        lastMovementAt: lastMovementAt ? lastMovementAt.toISOString() : null,
      }
    })

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
    materials: {
      activeCount,
      withStock: withStockCount,
      lowStock,
      overstock,
    },
    movements: {
      current: currentMovements,
      previous: previousMovements,
    },
  }
}