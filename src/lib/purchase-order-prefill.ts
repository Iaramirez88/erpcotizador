export type PurchaseWorkbenchMode = 'purchase' | 'order'

export type PurchaseOrderPrefillItem = {
  descripcion: string
  cantidad?: number
  precioUnitario?: number
  descuento?: number
  iva?: number
}

export type PurchaseOrderPrefill = {
  mode?: PurchaseWorkbenchMode
  source?: 'supplier' | 'inventory'
  supplierName?: string
  supplierPhone?: string
  supplierAddress?: string
  site?: string
  orderNumber?: string
  requestNumber?: string
  notes?: string
  items?: PurchaseOrderPrefillItem[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function normalizePurchaseOrderPrefill(input: unknown): PurchaseOrderPrefill | null {
  if (!isPlainObject(input)) return null

  const normalizedItems: PurchaseOrderPrefillItem[] = Array.isArray(input.items)
    ? input.items.reduce<PurchaseOrderPrefillItem[]>((acc, item) => {
        if (!isPlainObject(item)) return acc
        const descripcion = asString(item.descripcion)
        if (!descripcion) return acc
        acc.push({
          descripcion,
          cantidad: Math.max(0, asNumber(item.cantidad, 1)),
          precioUnitario: Math.max(0, asNumber(item.precioUnitario, 0)),
          descuento: Math.max(0, asNumber(item.descuento, 0)),
          iva: Math.max(0, asNumber(item.iva, 0)),
        })
        return acc
      }, [])
    : []

  const normalized: PurchaseOrderPrefill = {
    mode: input.mode === 'purchase' ? 'purchase' : 'order',
    source: input.source === 'inventory' ? 'inventory' : input.source === 'supplier' ? 'supplier' : undefined,
    supplierName: asString(input.supplierName) || undefined,
    supplierPhone: asString(input.supplierPhone) || undefined,
    supplierAddress: asString(input.supplierAddress) || undefined,
    site: asString(input.site) || undefined,
    orderNumber: asString(input.orderNumber) || undefined,
    requestNumber: asString(input.requestNumber) || undefined,
    notes: asString(input.notes) || undefined,
    items: normalizedItems.length ? normalizedItems : undefined,
  }

  return normalized
}

export function parsePurchaseOrderPrefillParam(raw: string | null | undefined): PurchaseOrderPrefill | null {
  if (!raw) return null
  try {
    return normalizePurchaseOrderPrefill(JSON.parse(raw))
  } catch {
    return null
  }
}

export function buildPurchaseOrderPrefillHref(prefill: PurchaseOrderPrefill): string {
  const normalized = normalizePurchaseOrderPrefill(prefill)
  if (!normalized) return '/dashboard/compras'

  const params = new URLSearchParams()
  params.set('prefill', JSON.stringify(normalized))
  return `/dashboard/compras?${params.toString()}`
}