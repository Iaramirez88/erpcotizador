export type LitografiaTarifarioRateLike = {
  id?: string
  tirajeMin: number
  tirajeMax: number
  precioTotal: number
}

export type LitografiaTarifarioPoint = {
  qty: number
  precioTotal: number
  rate?: LitografiaTarifarioRateLike
}

export type LitografiaTarifarioInterpolatedResult =
  | {
      ok: true
      precioTotal: number
      mode: 'clamp_min' | 'interpolate' | 'extrapolate' | 'single_point'
      lower: LitografiaTarifarioPoint
      upper: LitografiaTarifarioPoint
    }
  | { ok: false; error: string }

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

function toMoney(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(n)) return 0
  return n
}

/**
 * Construye puntos (qty, precioTotal) a partir de rangos del tarifario.
 * Convención: cada rango aporta un punto en su `tirajeMax` con `precioTotal`.
 */
export function buildLitografiaTarifarioPoints(rates: LitografiaTarifarioRateLike[]): LitografiaTarifarioPoint[] {
  const bestByQty = new Map<number, LitografiaTarifarioPoint>()

  for (const r of rates) {
    const tirajeMin = toInt(r.tirajeMin)
    const tirajeMax = toInt(r.tirajeMax)
    const precioTotal = toMoney(r.precioTotal)
    if (tirajeMax <= 0) continue
    if (!isFiniteNumber(precioTotal) || precioTotal < 0) continue

    const next: LitografiaTarifarioPoint = { qty: tirajeMax, precioTotal, rate: r }
    const prev = bestByQty.get(tirajeMax)
    if (!prev) {
      bestByQty.set(tirajeMax, next)
      continue
    }

    // Si hay duplicados, preferimos el rango más "específico":
    // - mayor tirajeMin (más cercano al qty)
    // - en empate, rango más estrecho
    const prevMin = toInt(prev.rate?.tirajeMin)
    const prevMax = toInt(prev.rate?.tirajeMax)
    const prevWidth = prevMax > 0 ? prevMax - prevMin : Number.POSITIVE_INFINITY
    const nextWidth = tirajeMax - tirajeMin

    if (tirajeMin > prevMin || (tirajeMin === prevMin && nextWidth < prevWidth)) {
      bestByQty.set(tirajeMax, next)
    }
  }

  return Array.from(bestByQty.values()).sort((a, b) => a.qty - b.qty)
}

/** Estrategia actual: devuelve la tarifa cuyo rango contiene a `cantidad` (si existe). */
export function matchLitografiaTarifaByRange(args: {
  rates: LitografiaTarifarioRateLike[]
  cantidad: number
}): LitografiaTarifarioRateLike | null {
  const qty = Math.trunc(Number(args.cantidad) || 0)
  if (qty <= 0) return null

  const candidates = args.rates
    .map((r) => ({
      rate: r,
      min: toInt(r.tirajeMin),
      max: toInt(r.tirajeMax),
      price: toMoney(r.precioTotal),
    }))
    .filter((x) => x.min > 0 && x.max > 0 && x.min <= qty && x.max >= qty)
    .filter((x) => Number.isFinite(x.price) && x.price >= 0)

  if (!candidates.length) return null
  // Preferimos el rango con mayor tirajeMin (más específico). En empate, el más estrecho.
  candidates.sort((a, b) => {
    if (a.min !== b.min) return b.min - a.min
    const wa = a.max - a.min
    const wb = b.max - b.min
    return wa - wb
  })

  return candidates[0]!.rate
}

/**
 * Estrategia proporcional: interpola entre puntos (tirajeMax, precioTotal) por tramos.
 * - Si qty <= primer punto: clamp al mínimo.
 * - Si qty entre 2 puntos: interpolación lineal.
 * - Si qty > último punto: extrapolación usando los últimos 2 puntos.
 */
export function computeLitografiaTarifarioInterpolatedTotal(args: {
  rates: LitografiaTarifarioRateLike[]
  cantidad: number
}): LitografiaTarifarioInterpolatedResult {
  const qty = Math.trunc(Number(args.cantidad) || 0)
  if (qty <= 0) return { ok: false, error: 'cantidad inválida' }

  const points = buildLitografiaTarifarioPoints(args.rates)
  if (!points.length) return { ok: false, error: 'no hay puntos tarifarios' }

  if (points.length === 1) {
    const p = points[0]!
    return { ok: true, precioTotal: p.precioTotal, mode: 'single_point', lower: p, upper: p }
  }

  const first = points[0]!
  if (qty <= first.qty) {
    return { ok: true, precioTotal: first.precioTotal, mode: 'clamp_min', lower: first, upper: first }
  }

  for (let i = 1; i < points.length; i++) {
    const upper = points[i]!
    if (qty <= upper.qty) {
      const lower = points[i - 1]!
      const span = upper.qty - lower.qty
      if (span <= 0) {
        return { ok: true, precioTotal: upper.precioTotal, mode: 'interpolate', lower, upper }
      }
      const t = (qty - lower.qty) / span
      const precioTotal = lower.precioTotal + t * (upper.precioTotal - lower.precioTotal)
      return { ok: true, precioTotal, mode: 'interpolate', lower, upper }
    }
  }

  // Extrapolación con el último segmento
  const lower = points[points.length - 2]!
  const upper = points[points.length - 1]!
  const span = upper.qty - lower.qty
  if (span <= 0) {
    return { ok: true, precioTotal: upper.precioTotal, mode: 'extrapolate', lower: upper, upper }
  }
  const t = (qty - lower.qty) / span
  const precioTotal = lower.precioTotal + t * (upper.precioTotal - lower.precioTotal)
  return { ok: true, precioTotal, mode: 'extrapolate', lower, upper }
}

/**
 * Estrategia "mínimo + adicional por unidad":
 * - Si qty <= minQty => minTotal
 * - Si qty > minQty  => minTotal + (qty-minQty) * unitAdditional
 */
export function computeLitografiaMinPlusUnitTotal(args: {
  cantidad: number
  minQty: number
  minTotal: number
  unitAdditional: number
}): number {
  const qty = Math.trunc(Number(args.cantidad) || 0)
  const minQty = Math.trunc(Number(args.minQty) || 0)
  const minTotal = Number(args.minTotal) || 0
  const unitAdditional = Number(args.unitAdditional) || 0

  if (qty <= 0) return 0
  if (minQty <= 0) return Math.max(0, minTotal + qty * unitAdditional)
  if (qty <= minQty) return Math.max(0, minTotal)
  return Math.max(0, minTotal + (qty - minQty) * unitAdditional)
}
