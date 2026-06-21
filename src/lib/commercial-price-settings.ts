import { prisma } from '@/lib/prisma'
import { COMMERCIAL_PRICE_CATALOG, getDefaultCommercialPriceMap, type CommercialPriceMap } from '@/lib/commercial-price-catalog'

export type CommercialPriceRow = {
  code: string
  priceCOP: number
  updatedAt?: Date
}

export async function ensureCommercialPriceDefaults(): Promise<void> {
  const defaults = getDefaultCommercialPriceMap()
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of COMMERCIAL_PRICE_CATALOG) {
        await tx.planCommercialPriceSetting.upsert({
          where: { code: item.code },
          create: { code: item.code, priceCOP: defaults[item.code] ?? 0 },
          update: {},
          select: { id: true },
        })
      }
    })
  } catch {
    // Si la tabla no existe aún, la app cae a defaults.
  }
}

export async function getCommercialPriceRows(): Promise<CommercialPriceRow[]> {
  const defaults = getDefaultCommercialPriceMap()
  try {
    await ensureCommercialPriceDefaults()
    const rows = await prisma.planCommercialPriceSetting.findMany({
      select: { code: true, priceCOP: true, updatedAt: true },
      orderBy: { code: 'asc' },
    })
    if (!rows.length) {
      return COMMERCIAL_PRICE_CATALOG.map((item) => ({ code: item.code, priceCOP: defaults[item.code] ?? 0 }))
    }
    return rows
  } catch {
    return COMMERCIAL_PRICE_CATALOG.map((item) => ({ code: item.code, priceCOP: defaults[item.code] ?? 0 }))
  }
}

export async function getCommercialPriceMap(): Promise<CommercialPriceMap> {
  const rows = await getCommercialPriceRows()
  const defaults = getDefaultCommercialPriceMap()
  const map = { ...defaults }
  for (const row of rows) {
    map[row.code] = row.priceCOP
  }
  return map
}

export async function saveCommercialPrice(args: { code: string; priceCOP: number }): Promise<CommercialPriceRow> {
  const row = await prisma.planCommercialPriceSetting.upsert({
    where: { code: args.code },
    create: { code: args.code, priceCOP: args.priceCOP },
    update: { priceCOP: args.priceCOP },
    select: { code: true, priceCOP: true, updatedAt: true },
  })
  return row
}

export function mergeCommercialPriceMap(base: CommercialPriceMap | undefined, rows: CommercialPriceRow[]): CommercialPriceMap {
  const next = { ...getDefaultCommercialPriceMap(), ...(base ?? {}) }
  for (const row of rows) {
    next[row.code] = row.priceCOP
  }
  return next
}