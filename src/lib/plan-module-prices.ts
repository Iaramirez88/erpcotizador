import { prisma } from '@/lib/prisma'
import type { ModuleKey } from '@prisma/client'
import { ALL_MODULE_KEYS, getDefaultModulePriceMap, type ModulePriceMap } from '@/lib/plan-catalog'

export type ModulePriceRow = {
  module: ModuleKey
  priceCOP: number
  updatedAt?: Date
}

export async function ensurePlanModulePriceDefaults(): Promise<void> {
  const defaults = getDefaultModulePriceMap()
  try {
    await prisma.$transaction(async (tx) => {
      for (const moduleKey of ALL_MODULE_KEYS) {
        const priceCOP = defaults[moduleKey] ?? 0
        await tx.planModulePriceSetting.upsert({
          where: { module: moduleKey },
          create: { module: moduleKey, priceCOP },
          update: {},
          select: { id: true },
        })
      }
    })
  } catch {
    // Si la tabla no existe todavía, la app cae a defaults.
  }
}

export async function getPlanModulePriceRows(): Promise<ModulePriceRow[]> {
  const defaults = getDefaultModulePriceMap()
  try {
    await ensurePlanModulePriceDefaults()
    const rows = await prisma.planModulePriceSetting.findMany({
      select: { module: true, priceCOP: true, updatedAt: true },
      orderBy: { module: 'asc' },
    })
    if (!rows.length) {
      return ALL_MODULE_KEYS.map((module) => ({ module, priceCOP: defaults[module] ?? 0 }))
    }
    return rows
  } catch {
    return ALL_MODULE_KEYS.map((module) => ({ module, priceCOP: defaults[module] ?? 0 }))
  }
}

export async function getPlanModulePriceMap(): Promise<Record<ModuleKey, number>> {
  const rows = await getPlanModulePriceRows()
  const defaults = getDefaultModulePriceMap()
  const map = { ...defaults } as Record<ModuleKey, number>
  for (const row of rows) {
    map[row.module] = row.priceCOP
  }
  return map
}

export async function savePlanModulePrice(args: { module: ModuleKey; priceCOP: number }): Promise<ModulePriceRow> {
  const row = await prisma.planModulePriceSetting.upsert({
    where: { module: args.module },
    create: { module: args.module, priceCOP: args.priceCOP },
    update: { priceCOP: args.priceCOP },
    select: { module: true, priceCOP: true, updatedAt: true },
  })
  return row
}

export function mergeModulePriceMap(base: ModulePriceMap | undefined, rows: ModulePriceRow[]): Record<ModuleKey, number> {
  const next = { ...getDefaultModulePriceMap(), ...(base ?? {}) } as Record<ModuleKey, number>
  for (const row of rows) {
    next[row.module] = row.priceCOP
  }
  return next
}