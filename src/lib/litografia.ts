export type LitografiaParams = {
  cantidad: number
  colores: number
  desperdicioPct: number

  costoPlanchaPorColor: number
  costoTintaPorColor: number
  costoPapelUnidad: number

  // Opcional: si se provee, calcula papel por pliego (imposición) en lugar de por unidad
  papelModo?: "unidad" | "pliego"
  papelTipo?: "bond" | "propalcote" | "periodico" | "otro"
  papelPliegoWidthCm?: number
  papelPliegoHeightCm?: number
  papelFormatoWidthCm?: number
  papelFormatoHeightCm?: number
  costoPliego?: number
  costoCorte: number
  costoAcabados: number
  costoTransporte: number

  margenPct: number
}

export type LitografiaResult = {
  qty: number
  k: number
  waste: number

  papelModo: "unidad" | "pliego"
  papelTipo?: "bond" | "propalcote" | "periodico" | "otro"
  qtyConDesperdicio: number
  piezasPorPliego?: number
  pliegosNecesarios?: number
  papelPliegoWidthCm?: number
  papelPliegoHeightCm?: number
  papelFormatoWidthCm?: number
  papelFormatoHeightCm?: number

  plancha: number
  tinta: number
  papel: number
  corte: number
  acabados: number
  transporte: number

  costoProduccion: number
  precioVenta: number
  costoUnitario: number
  precioUnitario: number
}

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function computePiecesPerSheet(pliegoW: number, pliegoH: number, piezaW: number, piezaH: number) {
  const w1 = Math.floor(pliegoW / piezaW)
  const h1 = Math.floor(pliegoH / piezaH)
  const direct = w1 * h1

  const w2 = Math.floor(pliegoW / piezaH)
  const h2 = Math.floor(pliegoH / piezaW)
  const rotated = w2 * h2

  return Math.max(direct, rotated)
}

export function computeLitografia(params: LitografiaParams): LitografiaResult {
  const qty = clampNumber(Number(params.cantidad) || 0, 1, 1_000_000_000)
  const k = clampNumber(Number(params.colores) || 1, 1, 12)
  const waste = clampNumber(Number(params.desperdicioPct) || 0, 0, 100)
  const factor = 1 + waste / 100
  const qtyConDesperdicio = qty * factor

  const plancha = (Number(params.costoPlanchaPorColor) || 0) * k
  const tinta = (Number(params.costoTintaPorColor) || 0) * k

  const requestedPapelModo = params.papelModo === "pliego" ? "pliego" : "unidad"
  const paperType = params.papelTipo
  const pliegoW = Number(params.papelPliegoWidthCm) || 0
  const pliegoH = Number(params.papelPliegoHeightCm) || 0
  const formatoW = Number(params.papelFormatoWidthCm) || 0
  const formatoH = Number(params.papelFormatoHeightCm) || 0
  const costoPliego = Number(params.costoPliego) || 0

  let papelModo: "unidad" | "pliego" = requestedPapelModo
  let piezasPorPliego: number | undefined
  let pliegosNecesarios: number | undefined

  let papel = 0
  if (requestedPapelModo === "pliego" && costoPliego > 0 && pliegoW > 0 && pliegoH > 0 && formatoW > 0 && formatoH > 0) {
    const piezas = computePiecesPerSheet(pliegoW, pliegoH, formatoW, formatoH)
    if (piezas >= 1) {
      piezasPorPliego = piezas
      pliegosNecesarios = Math.ceil(qtyConDesperdicio / piezas)
      papel = pliegosNecesarios * costoPliego
    } else {
      papelModo = "unidad"
      papel = (Number(params.costoPapelUnidad) || 0) * qtyConDesperdicio
    }
  } else {
    papelModo = "unidad"
    papel = (Number(params.costoPapelUnidad) || 0) * qtyConDesperdicio
  }

  const corte = Number(params.costoCorte) || 0
  const acabados = Number(params.costoAcabados) || 0
  const transporte = Number(params.costoTransporte) || 0

  const costoProduccion = plancha + tinta + papel + corte + acabados + transporte

  const margen = clampNumber(Number(params.margenPct) || 0, 0, 500)
  const precioVenta = costoProduccion * (1 + margen / 100)

  return {
    qty,
    k,
    waste,
    papelModo,
    papelTipo: paperType,
    qtyConDesperdicio,
    piezasPorPliego,
    pliegosNecesarios,
    papelPliegoWidthCm: papelModo === "pliego" ? pliegoW : undefined,
    papelPliegoHeightCm: papelModo === "pliego" ? pliegoH : undefined,
    papelFormatoWidthCm: papelModo === "pliego" ? formatoW : undefined,
    papelFormatoHeightCm: papelModo === "pliego" ? formatoH : undefined,
    plancha,
    tinta,
    papel,
    corte,
    acabados,
    transporte,
    costoProduccion,
    precioVenta,
    costoUnitario: costoProduccion / qty,
    precioUnitario: precioVenta / qty,
  }
}
