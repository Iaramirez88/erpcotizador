import { computeLitografia } from '@/lib/litografia'
import type { LitografiaAiResult } from '@/lib/litografia-ai'
import type { LitografiaAiKnowledgeDocument } from '@/lib/litografia-ai-knowledge'

type CatalogFinish = {
  nombre: string
  grupo?: string | null
  valor: number
}

type CostLine = {
  label: string
  amount: number
}

export type EditorialKnowledgeEstimate = {
  status: 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE'
  summary: string | null
  lines: CostLine[]
  notes: string[]
  machineName?: string | null
  paperName: string | null
  paperSheet: string | null
  sizeLabel: string | null
  productionCost: number | null
  utility: number | null
  subtotalBeforeIva: number | null
  ivaPct: number
  ivaValue: number | null
  totalSuggested: number | null
  unitPriceWithIva: number | null
}

type ExtractedData = LitografiaAiResult['extracted']

type PaperOption = {
  nombre: string
  valor: number
  widthCm: number
  heightCm: number
  unitLabel: string
}

export type KnowledgeBackedPaperCandidate = {
  nombre: string
  tipo: string | null
  gramaje: number | null
  costoPliego: number
  pliegoWidthCm: number
  pliegoHeightCm: number
  source: 'knowledge-exact' | 'knowledge-nearest'
  assumedFrom: string | null
}

type MachineSizeOption = {
  key: 'octavo' | 'cuarto' | 'medio' | 'pliego'
  widthCm: number
  heightCm: number
}

const DEFAULT_MACHINE_SIZES: MachineSizeOption[] = [
  { key: 'octavo', widthCm: 25, heightCm: 35 },
  { key: 'cuarto', widthCm: 35, heightCm: 50 },
  { key: 'medio', widthCm: 70, heightCm: 50 },
  { key: 'pliego', widthCm: 70, heightCm: 100 },
]

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseNumber(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseDimensionsFromText(value: string | null | undefined) {
  const match = String(value || '').match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*x\s*(\d{2,3}(?:[.,]\d{1,2})?)/i)
  if (!match) return null
  const first = parseNumber(match[1])
  const second = parseNumber(match[2])
  if (!first || !second) return null
  return { widthCm: first, heightCm: second }
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.8
}

function parsePaperOptions(document: LitografiaAiKnowledgeDocument): PaperOption[] {
  return document.costos.papeles
    .map((paper) => {
      if (paper.valor == null || paper.valor <= 0) return null
      const dims = parseDimensionsFromText(paper.unidad)
      if (!dims) return null
      return {
        nombre: paper.nombre,
        valor: paper.valor,
        widthCm: dims.widthCm,
        heightCm: dims.heightCm,
        unitLabel: paper.unidad,
      } satisfies PaperOption
    })
    .filter((paper): paper is PaperOption => Boolean(paper))
}

function parsePaperGramaje(value: string | null | undefined) {
  const match = normalizeText(value).match(/(\d{2,3})\s*(g|gr|gms)?\b/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function parseMaterialRequest(material: string | null | undefined) {
  const normalized = normalizeText(material)
  const gramaje = parsePaperGramaje(material)
  const family = normalized
    .replace(/\b\d{2,3}\s*(g|gr|gms)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { normalized, family, gramaje }
}

export function findKnowledgeBackedPaperCandidate(args: {
  document: LitografiaAiKnowledgeDocument
  material: string | null | undefined
  widthCm: number
  heightCm: number
  quantity: number
  sobranteMinimo?: number
}) {
  const { document, material, widthCm, heightCm, quantity } = args
  const sobranteMinimo = Math.max(0, Math.trunc(Number(args.sobranteMinimo || 0)))
  const request = parseMaterialRequest(material)
  if (!request.family) return null

  const options = parsePaperOptions(document)
    .map((paper) => {
      const normalizedName = normalizeText(paper.nombre)
      if (!normalizedName.includes(request.family) && !request.family.includes(normalizedName.split(' ')[0] || '')) return null

      const paperGramaje = parsePaperGramaje(paper.nombre)
      const exactGram = request.gramaje != null && paperGramaje === request.gramaje
      const diff = request.gramaje != null && paperGramaje != null ? Math.abs(paperGramaje - request.gramaje) : 0
      const compute = computeLitografia({
        cantidad: Math.max(1, Math.trunc(quantity) || 1),
        colores: 1,
        desperdicioPct: 0,
        sobranteMinimo,
        sobranteMinimoUnidad: 'pieza_final',
        costoPlanchaPorColor: 0,
        costoTintaPorColor: 0,
        costoPapelUnidad: 0,
        papelModo: 'pliego',
        papelTipo: normalizedName.includes('bond') ? 'bond' : normalizedName.includes('propal') ? 'propalcote' : 'otro',
        papelPliegoWidthCm: paper.widthCm,
        papelPliegoHeightCm: paper.heightCm,
        papelFormatoWidthCm: widthCm,
        papelFormatoHeightCm: heightCm,
        costoPliego: paper.valor,
        costoCorte: 0,
        costoAcabados: 0,
        costoTransporte: 0,
        margenPct: 0,
      })

      return {
        paper,
        paperGramaje,
        exactGram,
        diff,
        paperCost: compute.papel,
      }
    })
    .filter((entry): entry is { paper: PaperOption; paperGramaje: number | null; exactGram: boolean; diff: number; paperCost: number } => Boolean(entry))
    .sort((left, right) => {
      if (left.exactGram !== right.exactGram) return left.exactGram ? -1 : 1
      if (left.diff !== right.diff) return left.diff - right.diff
      return left.paperCost - right.paperCost
    })

  const best = options[0] ?? null
  if (!best) return null

  return {
    nombre: best.paper.nombre,
    tipo: request.family || null,
    gramaje: best.paperGramaje,
    costoPliego: best.paper.valor,
    pliegoWidthCm: best.paper.widthCm,
    pliegoHeightCm: best.paper.heightCm,
    source: best.exactGram ? 'knowledge-exact' : 'knowledge-nearest',
    assumedFrom: request.gramaje != null && !best.exactGram ? `${request.family} ${request.gramaje} g` : null,
  } satisfies KnowledgeBackedPaperCandidate
}

function findFinalSizeName(document: LitografiaAiKnowledgeDocument, widthCm: number, heightCm: number) {
  const matched = document.costos.corte_por_pliego.find((item) => {
    const dims = parseDimensionsFromText(item.medidas_cm)
    if (!dims) return false
    return (
      (nearlyEqual(dims.widthCm, widthCm) && nearlyEqual(dims.heightCm, heightCm)) ||
      (nearlyEqual(dims.widthCm, heightCm) && nearlyEqual(dims.heightCm, widthCm))
    )
  })
  return matched?.nombre ?? null
}

function inferOpenSize(widthCm: number, heightCm: number) {
  const shortSide = Math.min(widthCm, heightCm)
  const longSide = Math.max(widthCm, heightCm)
  return {
    widthCm: shortSide * 2,
    heightCm: longSide,
  }
}

function pickMachineSize(openWidthCm: number, openHeightCm: number) {
  const shortSide = Math.min(openWidthCm, openHeightCm)
  const longSide = Math.max(openWidthCm, openHeightCm)
  return DEFAULT_MACHINE_SIZES.find((size) => {
    const sizeShort = Math.min(size.widthCm, size.heightCm)
    const sizeLong = Math.max(size.widthCm, size.heightCm)
    return shortSide <= sizeShort + 0.8 && longSide <= sizeLong + 0.8
  }) || null
}

function findCatalogFinishValue(finishes: CatalogFinish[], matcher: RegExp) {
  const exact = finishes.find((finish) => matcher.test(normalizeText(finish.nombre)))
  return exact ? Math.max(0, Number(exact.valor) || 0) : 0
}

function findPartSegment(brief: string, marker: string) {
  const normalized = normalizeText(brief)
  const index = normalized.indexOf(marker)
  if (index < 0) return ''
  const nextDivider = normalized.indexOf(' · ', index)
  if (nextDivider < 0) return normalized.slice(index)
  return normalized.slice(index, nextDivider)
}

function findFirstPartSegment(brief: string, markers: string[]) {
  for (const marker of markers) {
    const segment = findPartSegment(brief, marker)
    if (segment) return segment
  }
  return ''
}

function selectPaperBySegment(args: {
  segment: string
  fallbackSegment: string
  paperOptions: PaperOption[]
  formatWidthCm: number
  formatHeightCm: number
  qty: number
  sobranteMinimo: number
}) {
  const { segment, fallbackSegment, paperOptions, formatWidthCm, formatHeightCm, qty, sobranteMinimo } = args
  const searchSegments = [segment, fallbackSegment].map((value) => normalizeText(value)).filter(Boolean)
  const prefersNarrowSheet = searchSegments.some((value) => value.includes('90x60') || value.includes('60x90'))

  const scored = paperOptions
    .map((paper) => {
      const paperName = normalizeText(paper.nombre)
      const score = searchSegments.reduce((total, value, index) => {
        if (!value.includes(paperName)) return total
        return total + (index === 0 ? 100 : 50)
      }, 0)

      if (!score) return null

      const compute = computeLitografia({
        cantidad: qty,
        colores: 1,
        desperdicioPct: 0,
        sobranteMinimo,
        sobranteMinimoUnidad: 'pieza_final',
        costoPlanchaPorColor: 0,
        costoTintaPorColor: 0,
        costoPapelUnidad: 0,
        papelModo: 'pliego',
        papelTipo: normalizeText(paper.nombre).includes('bond') ? 'bond' : normalizeText(paper.nombre).includes('propal') ? 'propalcote' : 'otro',
        papelPliegoWidthCm: paper.widthCm,
        papelPliegoHeightCm: paper.heightCm,
        papelFormatoWidthCm: formatWidthCm,
        papelFormatoHeightCm: formatHeightCm,
        costoPliego: paper.valor,
        costoCorte: 0,
        costoAcabados: 0,
        costoTransporte: 0,
        margenPct: 0,
      })

      return {
        paper,
        score,
        paperCost: compute.papel,
        paperSheet: `${paper.widthCm} x ${paper.heightCm} cm`,
        sheetPriority: prefersNarrowSheet ? (paper.widthCm === 90 || paper.heightCm === 90 ? 0 : 1) : (paper.widthCm === 70 || paper.heightCm === 70 ? 0 : 1),
      }
    })
    .filter((item): item is { paper: PaperOption; score: number; paperCost: number; paperSheet: string; sheetPriority: number } => Boolean(item))
    .sort((left, right) => left.sheetPriority - right.sheetPriority || left.paperCost - right.paperCost || right.score - left.score)

  return scored[0] ?? null
}

function matchTintasText(text: string | null | undefined, tintas: 1 | 2 | 4) {
  const normalized = normalizeText(text)
  if (!normalized) return false
  if (tintas === 4) return normalized.includes('4') || normalized.includes('cmyk') || normalized.includes('policrom')
  return normalized.includes('1 a 3') || normalized.includes('mono')
}

function findKnowledgeRate<T extends { tamano?: string; tintas?: string; valor: number | null }>(entries: T[], sizeKey: string, tintas: 1 | 2 | 4) {
  return entries.find((entry) => {
    if (entry.valor == null || entry.valor <= 0) return false
    return normalizeText(entry.tamano) === sizeKey && matchTintasText(entry.tintas, tintas)
  }) || null
}

function extractRangeMinimum(value: string | null | undefined) {
  const normalized = normalizeText(value)
  const numbers = normalized.match(/\d+/g)?.map((item) => Number(item)) ?? []
  if (!numbers.length) return 0
  if (normalized.includes('en adelante') || normalized.includes('mas de')) return numbers[0] ?? 0
  return numbers[0] ?? 0
}

function findTerminadoUnitCost(document: LitografiaAiKnowledgeDocument, nameNeedle: string, qty: number) {
  const matches = document.costos.terminados
    .filter((entry) => normalizeText(entry.nombre).includes(nameNeedle) && entry.valor > 0)
    .sort((left, right) => extractRangeMinimum(right.rango) - extractRangeMinimum(left.rango))

  for (const entry of matches) {
    const min = extractRangeMinimum(entry.rango)
    if (qty >= min) return entry.valor
  }

  return matches[0]?.valor ?? 0
}

function findCompaginadoUnitCost(document: LitografiaAiKnowledgeDocument, qty: number) {
  const entries = document.costos.terminados.filter((entry) => normalizeText(entry.nombre).includes('compaginado') && entry.valor > 0)
  const normalizedQty = Math.max(0, Math.trunc(qty))

  if (normalizedQty > 1000) {
    return entries.find((entry) => normalizeText(entry.rango).includes('1000 en adelante'))?.valor ?? 0
  }
  if (normalizedQty > 500) {
    return entries.find((entry) => normalizeText(entry.rango).includes('501 - 1000'))?.valor ?? 0
  }
  return entries.find((entry) => normalizeText(entry.rango).includes('1 - 500'))?.valor ?? 0
}

function findPerThousandPrice(document: LitografiaAiKnowledgeDocument, sizeName: string) {
  const normalized = normalizeText(sizeName)
  return document.costos.plastificado.find((entry) => normalizeText(entry.nombre).includes(normalized) && entry.valor > 0)?.valor ?? 0
}

function findTerminadoPerThousandCost(document: LitografiaAiKnowledgeDocument, nameNeedle: string) {
  return document.costos.terminados.find((entry) => {
    return normalizeText(entry.nombre).includes(nameNeedle) && normalizeText(entry.unidad).includes('millar') && entry.valor > 0
  })?.valor ?? 0
}

function buildMaterialSummary(innerPaper: string | null, coverPaper: string | null) {
  if (innerPaper && coverPaper && innerPaper !== coverPaper) {
    return `Internas ${innerPaper} / Portada ${coverPaper}`
  }
  return innerPaper || coverPaper || null
}

export function estimateEditorialKnowledgeCost(args: {
  brief: string
  extracted: ExtractedData
  document: LitografiaAiKnowledgeDocument
  catalogFinishes?: CatalogFinish[]
}): EditorialKnowledgeEstimate {
  const { brief, extracted, document } = args
  const catalogFinishes = args.catalogFinishes ?? []
  const quantity = Math.max(0, Math.trunc(Number(extracted.cantidad || 0)))
  const widthCm = Number(extracted.anchoCm || 0)
  const heightCm = Number(extracted.altoCm || 0)
  const innerPages = Math.max(0, Math.trunc(Number(extracted.paginas || 0)))
  const normalizedBrief = normalizeText(brief)
  const isEditorial = /cartilla|revista|libro/.test(normalizedBrief)

  const marginPct = Number(document.parametros.margen_utilidad_porcentaje || 40)
  const ivaPct = Number(document.parametros.iva_porcentaje || 19)

  if (!isEditorial || quantity <= 0 || widthCm <= 0 || heightCm <= 0 || innerPages <= 0) {
    return {
      status: 'NOT_AVAILABLE',
      summary: null,
      lines: [],
      notes: [],
      paperName: null,
      paperSheet: null,
      sizeLabel: null,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const finalSizeName = findFinalSizeName(document, widthCm, heightCm)
  const openSize = inferOpenSize(widthCm, heightCm)
  const machineSize = pickMachineSize(openSize.widthCm, openSize.heightCm)
  const paperOptions = parsePaperOptions(document)
  const coverSegment = findFirstPartSegment(brief, ['caratula', 'carátula', 'portada'])
  const innerSegment = normalizedBrief.replace(coverSegment, '')
  const coverPages = /caratula|carátula|portada|contraportada/.test(normalizedBrief) ? 4 : 0
  const innerForms = Math.max(1, Math.ceil(innerPages / 4))
  const coverForms = coverPages > 0 ? 1 : 0
  const innerTintas = parseSectionTintas(innerSegment, extracted.tintas ?? 4)
  const coverTintas = parseSectionTintas(coverSegment || normalizedBrief, extracted.tintas ?? 4)
  const sobranteMinimo = 100

  if (!finalSizeName || !machineSize) {
    return {
      status: 'PARTIAL',
      summary: 'La base editorial quedó parcialmente interpretada, pero falta cerrar tamaño operativo o montaje de impresión.',
      lines: [],
      notes: ['No se pudo inferir un tamaño editorial válido para portada e internas con la base de conocimiento.'],
      paperName: null,
      paperSheet: null,
      sizeLabel: finalSizeName,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const innerPaperSelection = selectPaperBySegment({
    segment: innerSegment,
    fallbackSegment: normalizeText(extracted.material),
    paperOptions,
    formatWidthCm: openSize.widthCm,
    formatHeightCm: openSize.heightCm,
    qty: quantity * innerForms,
    sobranteMinimo,
  })
  const coverPaperSelection = selectPaperBySegment({
    segment: coverSegment || normalizedBrief,
    fallbackSegment: normalizeText(extracted.material),
    paperOptions,
    formatWidthCm: openSize.widthCm,
    formatHeightCm: openSize.heightCm,
    qty: quantity,
    sobranteMinimo,
  })

  if (!innerPaperSelection || !coverPaperSelection) {
    return {
      status: 'PARTIAL',
      summary: 'La base editorial encontró el trabajo, pero no logró empatar bien el papel de internas y portada.',
      lines: [],
      notes: ['Confirma si las internas y la portada usan exactamente los papeles descritos en el brief.'],
      paperName: null,
      paperSheet: null,
      sizeLabel: finalSizeName,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const innerPlanchaRate = findKnowledgeRate(document.costos.planchas, machineSize.key, innerTintas)
  const innerImpresionRate = findKnowledgeRate(document.costos.impresion, machineSize.key, innerTintas)
  const coverPlanchaRate = coverForms > 0 ? findKnowledgeRate(document.costos.planchas, machineSize.key, coverTintas) : null
  const coverImpresionRate = coverForms > 0 ? findKnowledgeRate(document.costos.impresion, machineSize.key, coverTintas) : null
  if (!innerPlanchaRate || !innerImpresionRate || (coverForms > 0 && (!coverPlanchaRate || !coverImpresionRate))) {
    return {
      status: 'PARTIAL',
      summary: 'La base editorial encontró el papel, pero no una tarifa clara de plancha o impresión para el montaje asumido.',
      lines: [],
      notes: [`Montaje tentativo: ${machineSize.key}. Revisa si faltan tarifas activas para ese tamaño.`],
      paperName: buildMaterialSummary(innerPaperSelection.paper.nombre, coverPaperSelection.paper.nombre),
      paperSheet: `${innerPaperSelection.paperSheet} / ${coverPaperSelection.paperSheet}`,
      sizeLabel: `${finalSizeName} cerrado / ${openSize.widthCm} x ${openSize.heightCm} cm abierto`,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const innerTwoSided = isTwoSidedSegment(innerSegment)
  const coverTwoSided = isTwoSidedSegment(coverSegment || normalizedBrief)
  const innerPlancha = (innerPlanchaRate.valor || 0) * innerForms * (innerTwoSided ? 2 : 1)
  const coverPlancha = coverForms > 0 ? (coverPlanchaRate?.valor || 0) * coverForms * (coverTwoSided ? 2 : 1) : 0
  const innerImpresion = Math.max(1, Math.ceil((quantity * (innerTwoSided ? 2 : 1)) / 1000)) * (innerImpresionRate.valor || 0) * innerForms
  const coverImpresion = coverForms > 0 ? Math.max(1, Math.ceil((quantity * (coverTwoSided ? 2 : 1)) / 1000)) * (coverImpresionRate?.valor || 0) * coverForms : 0
  const innerPaper = innerPaperSelection.paperCost
  const coverPaper = coverPaperSelection.paperCost

  const hasPlastificadoMate = /plastificado mate|laminado mate/.test(normalizedBrief)
  const hasUv = /barniz uv|uv parcial|parcial uv|uv/.test(normalizedBrief)
  const hasHolmet = /holmet/.test(normalizedBrief)
  const hasCosida = /cosida|caballete|grapad|grafa/.test(normalizedBrief)

  const plastificadoPerThousand = hasPlastificadoMate ? findPerThousandPrice(document, finalSizeName) : 0
  const plastificadoCost = plastificadoPerThousand > 0 ? Math.max(1, Math.ceil(quantity / 1000)) * plastificadoPerThousand : 0
  const uvCost = hasUv ? findCatalogFinishValue(catalogFinishes, /uv/) : 0
  const holmetUnitCost = hasHolmet ? findTerminadoUnitCost(document, 'holmet', quantity) : 0
  const holmetCost = holmetUnitCost > 0 ? holmetUnitCost * quantity : 0
  const compaginadoUnitCost = findCompaginadoUnitCost(document, quantity)
  const compaginadoQty = Math.ceil(innerPages / 2) * quantity
  const compaginadoCost = compaginadoUnitCost > 0 ? compaginadoUnitCost * compaginadoQty : 0
  const refileCartillaEntry = document.costos.terminados.find((entry) => normalizeText(entry.nombre).includes('refile cartilla') && entry.valor > 0)
  const refileCartillaCost = refileCartillaEntry ? refileCartillaEntry.valor * quantity : 0
  const cosidaEntry = hasCosida
    ? document.costos.terminados.find((entry) => {
        const name = normalizeText(entry.nombre)
        return name.includes('cosida') || name.includes('grafa media carta a cuarto')
      })
    : null
  const cosidaCost = cosidaEntry ? cosidaEntry.valor : 0

  const productionCost = innerPlancha + coverPlancha + innerImpresion + coverImpresion + innerPaper + coverPaper + plastificadoCost + uvCost + holmetCost + compaginadoCost + refileCartillaCost + cosidaCost
  const subtotalBeforeIva = productionCost * (1 + (marginPct / 100))
  const utility = subtotalBeforeIva - productionCost
  const ivaValue = subtotalBeforeIva * (ivaPct / 100)
  const totalSuggested = subtotalBeforeIva + ivaValue
  const unitPriceWithIva = quantity > 0 ? totalSuggested / quantity : null

  const lines: CostLine[] = [
    { label: `Papel internas ${innerPaperSelection.paper.nombre}`, amount: innerPaper },
    { label: `Papel portada ${coverPaperSelection.paper.nombre}`, amount: coverPaper },
    { label: `Planchas internas ${machineSize.key}`, amount: innerPlancha },
    { label: `Planchas portada ${machineSize.key}`, amount: coverPlancha },
    { label: `Impresion internas ${machineSize.key}`, amount: innerImpresion },
    { label: `Impresion portada ${machineSize.key}`, amount: coverImpresion },
  ]

  if (plastificadoCost > 0) lines.push({ label: `Plastificado mate portada ${finalSizeName}`, amount: plastificadoCost })
  if (uvCost > 0) lines.push({ label: 'Barniz UV / parcial UV', amount: uvCost })
  if (holmetCost > 0) lines.push({ label: 'Holmet', amount: holmetCost })
  if (compaginadoCost > 0) lines.push({ label: 'Compaginado internas', amount: compaginadoCost })
  if (refileCartillaCost > 0) lines.push({ label: 'Refile cartilla', amount: refileCartillaCost })
  if (cosidaCost > 0) lines.push({ label: cosidaEntry?.nombre || 'Cosida / caballete', amount: cosidaCost })

  const notes = [
    `Se leyó el trabajo como ${finalSizeName} cerrado con hoja abierta ${openSize.widthCm} x ${openSize.heightCm} cm.`,
    `Internas calculadas en ${innerForms} pliegos por ejemplar; portada en ${coverForms || 1} pliego por ejemplar.`,
    `Montaje tentativo: ${machineSize.key} usando la base de conocimiento editorial.`,
    `Internas interpretadas como ${innerTintas} tintas${innerTwoSided ? ' por ambas caras' : ' por una cara'}; carátula como ${coverTintas} tintas${coverTwoSided ? ' por ambas caras' : ' por una cara'}.`,
  ]

  if (hasUv && uvCost <= 0) {
    notes.push('El barniz UV quedó como referencia técnica, pero no encontró una tarifa específica en la base JSON; el total puede quedar corto frente al cierre final.')
  }

  return {
    status: 'AVAILABLE',
    summary: 'Estimación editorial armada con la base JSON para separar internas, portada y terminados principales.',
    lines,
    notes,
    paperName: buildMaterialSummary(innerPaperSelection.paper.nombre, coverPaperSelection.paper.nombre),
    paperSheet: `${innerPaperSelection.paperSheet} / ${coverPaperSelection.paperSheet}`,
    sizeLabel: `${finalSizeName} cerrado / ${openSize.widthCm} x ${openSize.heightCm} cm abierto`,
    productionCost,
    utility,
    subtotalBeforeIva,
    ivaPct,
    ivaValue,
    totalSuggested,
    unitPriceWithIva,
  }
}

function inferMachineSize(widthCm: number, heightCm: number, tintas: 1 | 2 | 4) {
  const picked = pickMachineSize(widthCm, heightCm)
  if (!picked) return null
  if (picked.key === 'octavo' && tintas === 4) {
    return DEFAULT_MACHINE_SIZES.find((size) => size.key === 'cuarto') || picked
  }
  return picked
}

function inferSidesMultiplier(brief: string, tintas: 1 | 2 | 4) {
  const normalized = normalizeText(brief)
  const explicit = normalized.match(/\b([124])x([014])\b/)
  if (explicit) {
    const front = Math.max(0, Math.trunc(Number(explicit[1]) || 0))
    const back = Math.max(0, Math.trunc(Number(explicit[2]) || 0))
    return {
      totalColors: Math.max(1, front + back),
      twoSided: back > 0,
      platesMultiplier: back > 0 && front > 0 ? 2 : 1,
      printThousands: Math.max(1, Math.ceil((back > 0 ? 2 : 1) / 1)),
    }
  }

  const twoSided = /tiro y retiro|doble cara|ambas caras/.test(normalized)
  return {
    totalColors: twoSided ? tintas * 2 : tintas,
    twoSided,
    platesMultiplier: twoSided ? 2 : 1,
    printThousands: twoSided ? 2 : 1,
  }
}

function findFinishRateBySize(document: LitografiaAiKnowledgeDocument, sizeName: string, matcher: RegExp) {
  const normalizedSize = normalizeText(sizeName)
  return document.costos.plastificado.find((entry) => {
    return normalizeText(entry.nombre).includes(normalizedSize) && matcher.test(normalizeText(entry.nombre))
  }) || null
}

export function estimateKnowledgeOnlyCost(args: {
  brief: string
  extracted: ExtractedData
  document: LitografiaAiKnowledgeDocument
}): EditorialKnowledgeEstimate {
  const { brief, extracted, document } = args
  const quantity = Math.max(0, Math.trunc(Number(extracted.cantidad || 0)))
  const widthCm = Number(extracted.anchoCm || 0)
  const heightCm = Number(extracted.altoCm || 0)
  const tintas = extracted.tintas ?? 4
  const marginPct = Number(document.parametros.margen_utilidad_porcentaje || 40)
  const ivaPct = Number(document.parametros.iva_porcentaje || 19)

  if (quantity <= 0 || widthCm <= 0 || heightCm <= 0 || !extracted.material) {
    return {
      status: 'NOT_AVAILABLE',
      summary: null,
      lines: [],
      notes: [],
      machineName: null,
      paperName: null,
      paperSheet: null,
      sizeLabel: null,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const isEditorial = /cartilla|revista|libro/.test(normalizeText(brief))
  if (isEditorial) return estimateEditorialKnowledgeCost({ brief, extracted, document })

  const sizeLabel = findFinalSizeName(document, widthCm, heightCm) ?? `${widthCm} x ${heightCm} cm`
  const machineSize = inferMachineSize(widthCm, heightCm, tintas)
  const paper = findKnowledgeBackedPaperCandidate({
    document,
    material: extracted.material,
    widthCm,
    heightCm,
    quantity,
    sobranteMinimo: 100,
  })

  if (!machineSize || !paper) {
    return {
      status: 'PARTIAL',
      summary: 'La base JSON identificó el trabajo, pero no alcanzó para cerrar tamaño operativo o papel de referencia.',
      lines: [],
      notes: ['Confirma tamaño final y papel base exactamente como aparecen en la base JSON.'],
      machineName: machineSize ? `Montaje ${machineSize.key}` : null,
      paperName: paper?.nombre ?? null,
      paperSheet: paper ? `${paper.pliegoWidthCm} x ${paper.pliegoHeightCm} cm` : null,
      sizeLabel,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const colorSpec = inferSidesMultiplier(brief, tintas)
  const planchaRate = findKnowledgeRate(document.costos.planchas, machineSize.key, tintas)
  const impresionRate = findKnowledgeRate(document.costos.impresion, machineSize.key, tintas)

  if (!planchaRate || !impresionRate) {
    return {
      status: 'PARTIAL',
      summary: 'La base JSON encontró papel y tamaño, pero no una tarifa clara de plancha o impresión para este montaje.',
      lines: [],
      notes: [`Montaje tentativo: ${machineSize.key}. Revisa si la base JSON necesita una tarifa adicional para esta combinación.`],
      machineName: `Montaje ${machineSize.key}`,
      paperName: paper.nombre,
      paperSheet: `${paper.pliegoWidthCm} x ${paper.pliegoHeightCm} cm`,
      sizeLabel,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const printThousands = Math.max(1, Math.ceil((quantity * (colorSpec.twoSided ? 2 : 1)) / 1000))
  const plancha = (planchaRate.valor || 0) * colorSpec.platesMultiplier
  const impresion = (impresionRate.valor || 0) * printThousands
  const paperCost = computeLitografia({
    cantidad: quantity,
    colores: 1,
    desperdicioPct: 0,
    sobranteMinimo: 100,
    sobranteMinimoUnidad: 'pieza_final',
    costoPlanchaPorColor: 0,
    costoTintaPorColor: 0,
    costoPapelUnidad: 0,
    papelModo: 'pliego',
    papelTipo: normalizeText(paper.nombre).includes('bond') ? 'bond' : normalizeText(paper.nombre).includes('propal') ? 'propalcote' : 'otro',
    papelPliegoWidthCm: paper.pliegoWidthCm,
    papelPliegoHeightCm: paper.pliegoHeightCm,
    papelFormatoWidthCm: widthCm,
    papelFormatoHeightCm: heightCm,
    costoPliego: paper.costoPliego,
    costoCorte: 0,
    costoAcabados: 0,
    costoTransporte: 0,
    margenPct: 0,
  }).papel

  let acabados = 0
  const lines: CostLine[] = [
    { label: `Papel ${paper.nombre}`, amount: paperCost },
    { label: `Planchas ${machineSize.key}`, amount: plancha },
    { label: `Impresión ${machineSize.key}`, amount: impresion },
  ]
  const notes: string[] = [
    `La referencia se armó únicamente con la base JSON en tamaño ${sizeLabel}.`,
    `Montaje tentativo: ${machineSize.key}.`,
    paper.source === 'knowledge-nearest' && paper.assumedFrom
      ? `El papel exacto ${paper.assumedFrom} no existe en la base JSON; se tomó la referencia más cercana: ${paper.nombre}.`
      : `Se tomó ${paper.nombre} sobre pliego ${paper.pliegoWidthCm} x ${paper.pliegoHeightCm} cm.`,
  ]

  const normalizedBrief = normalizeText(brief)
  const plastificadoRate = /(plastificad|laminad)\s+mate/.test(normalizedBrief)
    ? findPerThousandPrice(document, sizeLabel)
    : /(plastificad|laminad)\s+(brillante|brillo)/.test(normalizedBrief)
      ? findPerThousandPrice(document, sizeLabel)
      : 0
  if (plastificadoRate > 0) {
    const plastQty = quantity <= 500 ? 0.5 : Math.max(1, Math.ceil(quantity / 1000))
    const plastCost = plastificadoRate * plastQty
    acabados += plastCost
    lines.push({ label: 'Plastificado / laminado', amount: plastCost })
  } else if (/(plastificad|laminad)/.test(normalizedBrief)) {
    notes.push('El laminado/plastificado pedido no tiene una tarifa específica compatible en la base JSON y quedó fuera del total.')
  }

  if (/holmet/.test(normalizedBrief)) {
    const holmetUnit = findTerminadoUnitCost(document, 'holmet', quantity)
    if (holmetUnit > 0) {
      const holmetCost = holmetUnit * quantity
      acabados += holmetCost
      lines.push({ label: 'Holmet', amount: holmetCost })
    }
  }

  if (/plegable|diptico|triptico|plegad|cuerpos?/.test(normalizedBrief)) {
    const refilePlegadoRate = findTerminadoPerThousandCost(document, 'refile y plegado')
    if (refilePlegadoRate > 0) {
      const refilePlegadoCost = refilePlegadoRate * Math.max(1, Math.ceil(quantity / 1000))
      acabados += refilePlegadoCost
      lines.push({ label: 'Refile y plegado', amount: refilePlegadoCost })
    }
  }

  if (/esquinas redondeadas/.test(normalizedBrief)) {
    notes.push('Esquinas redondeadas no tiene tarifa explícita en la base JSON; quedó reportado pero no sumado al total.')
  }

  const productionCost = paperCost + plancha + impresion + acabados
  const subtotalBeforeIva = productionCost * (1 + (marginPct / 100))
  const utility = subtotalBeforeIva - productionCost
  const ivaValue = subtotalBeforeIva * (ivaPct / 100)
  const totalSuggested = subtotalBeforeIva + ivaValue

  return {
    status: 'AVAILABLE',
    summary: 'Estimación operativa armada únicamente desde la base JSON.',
    lines,
    notes,
    machineName: `Montaje ${machineSize.key}`,
    paperName: paper.nombre,
    paperSheet: `${paper.pliegoWidthCm} x ${paper.pliegoHeightCm} cm`,
    sizeLabel,
    productionCost,
    utility,
    subtotalBeforeIva,
    ivaPct,
    ivaValue,
    totalSuggested,
    unitPriceWithIva: quantity > 0 ? totalSuggested / quantity : null,
  }
}

function parseSectionTintas(segment: string, fallback: 1 | 2 | 4 | null | undefined) {
  const normalized = normalizeText(segment)
  if (/\b4x[04]\b|\bfull color\b|\bpolicromia\b|\bcuatricromia\b|\bcmyk\b/.test(normalized)) return 4 as const
  if (/\b2x[02]\b|\bdos tintas\b/.test(normalized)) return 2 as const
  if (/\b1x[01]\b|\buna tinta\b|\bblanco y negro\b/.test(normalized)) return 1 as const
  return fallback ?? 4
}

function isTwoSidedSegment(segment: string) {
  const normalized = normalizeText(segment)
  const explicit = normalized.match(/\b([124])x([014])\b/)
  if (explicit) {
    return Number(explicit[2]) > 0
  }
  return /tiro y retiro|doble cara|ambas caras/.test(normalized)
}