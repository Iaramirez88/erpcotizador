export type LitografiaParams = {
  cantidad: number
  colores: number
  desperdicioPct: number

  // Sobrante mínimo (unidades) adicional al % de desperdicio.
  // Se usa como mínimo de unidades extra para cubrir desperdicio.
  sobranteMinimo?: number

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
  maquinaPliegoWidthCm?: number
  maquinaPliegoHeightCm?: number
  maquinaSeparacionCm?: number
  costoCorte: number
  costoAcabados: number
  costoTransporte: number

  margenPct: number
}

export type LitografiaResult = {
  qty: number
  k: number
  waste: number

  sobranteMinimo: number

  papelModo: "unidad" | "pliego"
  papelTipo?: "bond" | "propalcote" | "periodico" | "otro"
  qtyConDesperdicio: number
  piezasPorPliego?: number
  pliegosNecesarios?: number
  papelPliegoWidthCm?: number
  papelPliegoHeightCm?: number
  papelFormatoWidthCm?: number
  papelFormatoHeightCm?: number
  maquinaPliegoWidthCm?: number
  maquinaPliegoHeightCm?: number
  maquinaSeparacionCm?: number
  pliegoUtilWidthCm?: number
  pliegoUtilHeightCm?: number
  piezasHorizontal?: number
  piezasVertical?: number
  orientacionImpresion?: "normal" | "girada"

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

function computeAxisFit(sheet: number, piece: number, gap: number) {
  if (sheet <= 0 || piece <= 0) return 0
  if (gap <= 0) return Math.floor(sheet / piece)
  return Math.floor((sheet + gap) / (piece + gap))
}

function computePiecesPerSheet(pliegoW: number, pliegoH: number, piezaW: number, piezaH: number, gap: number) {
  const directAcross = computeAxisFit(pliegoW, piezaW, gap)
  const directDown = computeAxisFit(pliegoH, piezaH, gap)
  const direct = directAcross * directDown

  const rotatedAcross = computeAxisFit(pliegoW, piezaH, gap)
  const rotatedDown = computeAxisFit(pliegoH, piezaW, gap)
  const rotated = rotatedAcross * rotatedDown

  if (rotated > direct) {
    return {
      total: rotated,
      across: rotatedAcross,
      down: rotatedDown,
      orientation: "girada" as const,
    }
  }

  return {
    total: direct,
    across: directAcross,
    down: directDown,
    orientation: "normal" as const,
  }
}

export function computeLitografia(params: LitografiaParams): LitografiaResult {
  const qty = clampNumber(Number(params.cantidad) || 0, 1, 1_000_000_000)
  const k = clampNumber(Number(params.colores) || 1, 1, 12)
  const waste = clampNumber(Number(params.desperdicioPct) || 0, 0, 100)
  const sobranteMinimo = clampNumber(Number(params.sobranteMinimo) || 0, 0, 1_000_000_000)
  const extraFromPct = qty * (waste / 100)
  const extra = Math.max(extraFromPct, sobranteMinimo)
  const qtyConDesperdicio = qty + extra

  const plancha = (Number(params.costoPlanchaPorColor) || 0) * k
  const tinta = (Number(params.costoTintaPorColor) || 0) * k

  const requestedPapelModo = params.papelModo === "pliego" ? "pliego" : "unidad"
  const paperType = params.papelTipo
  const pliegoW = Number(params.papelPliegoWidthCm) || 0
  const pliegoH = Number(params.papelPliegoHeightCm) || 0
  const formatoW = Number(params.papelFormatoWidthCm) || 0
  const formatoH = Number(params.papelFormatoHeightCm) || 0
  const costoPliego = Number(params.costoPliego) || 0
  const maquinaW = Number(params.maquinaPliegoWidthCm) || 0
  const maquinaH = Number(params.maquinaPliegoHeightCm) || 0
  const maquinaSeparacion = Math.max(0, Number(params.maquinaSeparacionCm) || 0)

  let papelModo: "unidad" | "pliego" = requestedPapelModo
  let piezasPorPliego: number | undefined
  let pliegosNecesarios: number | undefined
  let pliegoUtilWidthCm: number | undefined
  let pliegoUtilHeightCm: number | undefined
  let piezasHorizontal: number | undefined
  let piezasVertical: number | undefined
  let orientacionImpresion: "normal" | "girada" | undefined

  let papel = 0
  if (requestedPapelModo === "pliego" && costoPliego > 0 && pliegoW > 0 && pliegoH > 0 && formatoW > 0 && formatoH > 0) {
    const utilW = maquinaW > 0 ? Math.min(pliegoW, maquinaW) : pliegoW
    const utilH = maquinaH > 0 ? Math.min(pliegoH, maquinaH) : pliegoH
    const layout = computePiecesPerSheet(utilW, utilH, formatoW, formatoH, maquinaSeparacion)
    if (layout.total >= 1) {
      pliegoUtilWidthCm = utilW
      pliegoUtilHeightCm = utilH
      piezasHorizontal = layout.across
      piezasVertical = layout.down
      orientacionImpresion = layout.orientation
      piezasPorPliego = layout.total
      pliegosNecesarios = Math.ceil(qtyConDesperdicio / layout.total)
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
    sobranteMinimo,
    papelModo,
    papelTipo: paperType,
    qtyConDesperdicio,
    piezasPorPliego,
    pliegosNecesarios,
    papelPliegoWidthCm: papelModo === "pliego" ? pliegoW : undefined,
    papelPliegoHeightCm: papelModo === "pliego" ? pliegoH : undefined,
    papelFormatoWidthCm: papelModo === "pliego" ? formatoW : undefined,
    papelFormatoHeightCm: papelModo === "pliego" ? formatoH : undefined,
    maquinaPliegoWidthCm: papelModo === "pliego" && maquinaW > 0 ? maquinaW : undefined,
    maquinaPliegoHeightCm: papelModo === "pliego" && maquinaH > 0 ? maquinaH : undefined,
    maquinaSeparacionCm: papelModo === "pliego" ? maquinaSeparacion : undefined,
    pliegoUtilWidthCm: papelModo === "pliego" ? pliegoUtilWidthCm : undefined,
    pliegoUtilHeightCm: papelModo === "pliego" ? pliegoUtilHeightCm : undefined,
    piezasHorizontal: papelModo === "pliego" ? piezasHorizontal : undefined,
    piezasVertical: papelModo === "pliego" ? piezasVertical : undefined,
    orientacionImpresion: papelModo === "pliego" ? orientacionImpresion : undefined,
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
