import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { z } from 'zod'
import { requireApiAccess } from '@/lib/api-rbac'
import { appendAiWorkspaceHistory } from '@/lib/ai-workspace-history'
import type { LitografiaAiHandoff } from '@/lib/litografia-ai-handoff'
import { prisma } from '@/lib/prisma'
import { analyzeLitografiaBrief, getLitografiaAiConnectionStatus, type ConfidenceLevel, type LitografiaCatalogContext } from '@/lib/litografia-ai'
import { computeLitografia } from '@/lib/litografia'

export const runtime = 'nodejs'

const requestSchema = z.object({
  brief: z.string().trim().min(20, 'Describe mejor el trabajo para que la IA lo pueda interpretar.'),
})

type ConfiguredPriceSuggestion = {
  status: 'MATCHED' | 'PARTIAL' | 'NO_MATCH'
  confidence: ConfidenceLevel
  title: string
  total: number | null
  unitPrice: number | null
  currency: 'COP'
  reasoning: string[]
  matchedRateId: string | null
  matchedSize: string | null
  matchedPaper: string | null
  matchedFinish: string | null
}

type ExternalBenchmarkResult = {
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'UNAVAILABLE'
  provider: string | null
  summary: string | null
  suggestedTotalMin: number | null
  suggestedTotalMax: number | null
  reasoning: string[]
  references: Array<{ label: string; url: string }>
}

type CostBreakdownLine = {
  label: string
  amount: number
}

type CostBreakdown = {
  status: 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE'
  summary: string | null
  lines: CostBreakdownLine[]
  notes: string[]
  machineName: string | null
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

type AssistantQuoteReply = {
  title: string
  message: string
  assumptions: string[]
  copyText: string
}

type LitografiaAiFinishHints = NonNullable<LitografiaAiHandoff['finishHints']>

type PrintProfile = {
  id: string
  nombre: string
  costoPlanchaPorColor: number
  costoTintaPorColor: number
  anchoUtilCm: number
  altoUtilCm: number
  separacionPiezasCm: number
}

type TransportOption = {
  value: string
  label: string
  total: number
}

type ConfigDropdownDelegateCompat = {
  findFirst: (args: unknown) => Promise<unknown>
}

const prismaCompat = prisma as unknown as {
  configDropdown: ConfigDropdownDelegateCompat
}

const DEFAULT_MARGIN_PCT = 40
const DEFAULT_IVA_PCT = 19
const DEFAULT_SOBRANTE_MINIMO = 120

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseColorSpec(brief: string, tintas: 1 | 2 | 4 | null) {
  const normalized = normalizeText(brief)
  const explicit = normalized.match(/\b([124])x([014])\b/)
  if (explicit) {
    const front = Math.max(0, Math.trunc(Number(explicit[1]) || 0))
    const back = Math.max(0, Math.trunc(Number(explicit[2]) || 0))
    return {
      totalColors: Math.max(1, front + back),
      twoSided: back > 0,
    }
  }

  const twoSided = /tiro y retiro|doble cara|ambas caras/.test(normalized)
  if (!tintas) return { totalColors: null, twoSided }
  return {
    totalColors: twoSided ? tintas * 2 : tintas,
    twoSided,
  }
}

function shouldReusePlate(brief: string) {
  const normalized = normalizeText(brief)
  return /misma plancha|mismas planchas|sin planchas nuevas|no cobrar planchas|plancha usada|planchas existentes/.test(normalized)
}

function findMatchedSize(catalog: LitografiaCatalogContext, widthCm: number | null, heightCm: number | null) {
  if (!widthCm || !heightCm) return null
  return (catalog.sizes ?? []).find((size) => {
    const sameOrientation = Math.abs(size.widthCm - widthCm) < 0.6 && Math.abs(size.heightCm - heightCm) < 0.6
    const swappedOrientation = Math.abs(size.widthCm - heightCm) < 0.6 && Math.abs(size.heightCm - widthCm) < 0.6
    return sameOrientation || swappedOrientation
  }) ?? null
}

function findMatchedPaper(catalog: LitografiaCatalogContext, material: string | null | undefined) {
  const needle = normalizeText(material)
  if (!needle) return null
  return (catalog.papers ?? []).find((paper) => {
    const haystack = normalizeText(`${paper.nombre} ${paper.tipo || ''} ${paper.gramaje ?? ''}`)
    return haystack.includes(needle) || needle.includes(haystack)
  }) ?? null
}

function findFinishCandidates(catalog: LitografiaCatalogContext, args: {
  brief: string
  quoteType: string
  acabado: string | null | undefined
}) {
  const normalizedBrief = normalizeText(args.brief)
  const candidates: Array<{ id: string; nombre: string; grupo?: string | null; valor: number }> = []
  const finishNeedle = normalizeText(args.acabado)

  const aliasMatchers: Array<{ test: (finishName: string) => boolean; matchesBrief: boolean }> = [
    {
      test: (finishName) => /grafa|grafad/.test(finishName),
      matchesBrief: /grafa|grafad/.test(normalizedBrief),
    },
    {
      test: (finishName) => /plastificad|laminad.*mate/.test(finishName),
      matchesBrief: /(plastificad|laminad)\s+mate/.test(normalizedBrief),
    },
    {
      test: (finishName) => /plastificad|laminad.*brill/.test(finishName),
      matchesBrief: /(plastificad|laminad)\s+(brillante|brillo)/.test(normalizedBrief),
    },
    {
      test: (finishName) => /refile|corte/.test(finishName),
      matchesBrief: /refile|corte/.test(normalizedBrief),
    },
    {
      test: (finishName) => /plegad/.test(finishName),
      matchesBrief: /plegad|diptico|triptico/.test(normalizedBrief),
    },
  ]

  const pushCandidate = (finish: { id: string; nombre: string; grupo?: string | null; valor: number } | null | undefined) => {
    if (!finish || candidates.some((item) => item.id === finish.id)) return
    candidates.push(finish)
  }

  const exact = finishNeedle
    ? (catalog.finishes ?? []).find((finish) => {
        const haystack = normalizeText(finish.nombre)
        return haystack.includes(finishNeedle) || finishNeedle.includes(haystack)
      }) ?? null
    : null

  pushCandidate(exact)

  for (const finish of catalog.finishes ?? []) {
    const haystack = normalizeText(finish.nombre)

    if (normalizedBrief.includes(haystack)) {
      pushCandidate(finish)
      continue
    }

    const matchedAlias = aliasMatchers.some((alias) => alias.matchesBrief && alias.test(haystack))
    if (matchedAlias) pushCandidate(finish)
  }

  if (args.quoteType === 'PLEGABLE' && normalizedBrief.includes('plegable')) {
    const plegado = (catalog.finishes ?? []).find((finish) => normalizeText(finish.nombre).includes('plegad'))
    pushCandidate(plegado)
  }

  if (normalizedBrief.includes('refile') || normalizedBrief.includes('corte')) {
    const corte = (catalog.finishes ?? []).find((finish) => {
      const haystack = normalizeText(finish.nombre)
      return haystack.includes('refile') || haystack.includes('corte')
    })
    pushCandidate(corte)
  }

  return candidates
}

function formatCopCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatInt(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)
}

function buildAssistantQuoteReply(args: {
  brief: string
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  configuredSuggestion: ConfiguredPriceSuggestion
  costBreakdown: CostBreakdown
}): AssistantQuoteReply | null {
  const { analysis, configuredSuggestion, costBreakdown } = args
  if (
    configuredSuggestion.status === 'MATCHED'
    && configuredSuggestion.total != null
    && configuredSuggestion.unitPrice != null
    && analysis.extracted.cantidad
  ) {
    const productLabel = analysis.extracted.producto ?? analysis.quoteType.toLowerCase()
    const sizeLabel = configuredSuggestion.matchedSize
      ?? (analysis.extracted.anchoCm && analysis.extracted.altoCm
        ? `${analysis.extracted.anchoCm} x ${analysis.extracted.altoCm} cm`
        : 'tamaño por confirmar')
    const materialLabel = configuredSuggestion.matchedPaper ?? analysis.extracted.material ?? 'material por confirmar'
    const finishLabel = configuredSuggestion.matchedFinish ?? analysis.extracted.acabado ?? 'sin acabado adicional detectado'
    const title = `Cotización exacta según tarifa configurada para ${formatInt(analysis.extracted.cantidad)} ${String(productLabel).toLowerCase()}${analysis.extracted.cantidad === 1 ? '' : 's'}`
    const message = [
      `${title}.`,
      `Se encontró una coincidencia vigente en la configuración del ERP para ${sizeLabel}, ${materialLabel} y ${finishLabel}.`,
      '',
      `Total cotizado: ${formatCopCurrency(configuredSuggestion.total)}`,
      `Valor unitario: ${formatCopCurrency(configuredSuggestion.unitPrice)}`,
      configuredSuggestion.reasoning.length ? `Base de la coincidencia: ${configuredSuggestion.reasoning.join(' ')}` : null,
      analysis.nextStep,
    ].filter((line): line is string => Boolean(line)).join('\n')

    return {
      title,
      message,
      assumptions: configuredSuggestion.reasoning,
      copyText: message,
    }
  }

  if (!costBreakdown.totalSuggested || !analysis.extracted.cantidad) return null

  const sizeLabel = costBreakdown.sizeLabel ?? (analysis.extracted.anchoCm && analysis.extracted.altoCm
    ? `${analysis.extracted.anchoCm} x ${analysis.extracted.altoCm} cm`
    : 'tamaño por confirmar')
  const materialLabel = analysis.extracted.material ?? costBreakdown.paperName ?? 'material por confirmar'
  const productLabel = analysis.extracted.producto ?? analysis.quoteType.toLowerCase()
  const tintasLabel = analysis.extracted.tintas ? `${analysis.extracted.tintas}x${analysis.extracted.tintas}` : null
  const finishedLabels = costBreakdown.lines
    .map((line) => line.label)
    .filter((label) => !/^papel\b/i.test(label) && !/^planchas/i.test(label) && !/^impresi[oó]n\b/i.test(label) && !/^entrega\b/i.test(label))
  const finishSummary = finishedLabels.length ? finishedLabels.join(', ') : 'sin terminados adicionales detectados'

  const assumptionSet = new Set<string>()
  if (tintasLabel) assumptionSet.add(`Se asumió impresión ${tintasLabel}.`)
  for (const note of costBreakdown.notes) assumptionSet.add(note)
  if (!analysis.extracted.acabado && !finishedLabels.length) {
    assumptionSet.add('No se detectó un terminado claro distinto al texto libre del brief.')
  }

  const title = `Cotización preliminar para ${formatInt(analysis.extracted.cantidad)} ${String(productLabel).toLowerCase()}${analysis.extracted.cantidad === 1 ? '' : 's'}`
  const intro = `${title} en ${sizeLabel}, ${materialLabel}, ${finishSummary}.`
  const lines = costBreakdown.lines.map((line) => {
    const amount = formatCopCurrency(line.amount)
    return amount ? `${line.label}: ${amount}` : null
  }).filter((line): line is string => Boolean(line))

  const utilityLine = costBreakdown.utility != null ? `Utilidad ${DEFAULT_MARGIN_PCT}%: ${formatCopCurrency(costBreakdown.utility)}` : null
  const subtotalLine = costBreakdown.subtotalBeforeIva != null ? `Subtotal: ${formatCopCurrency(costBreakdown.subtotalBeforeIva)}` : null
  const ivaLine = costBreakdown.ivaValue != null ? `IVA ${costBreakdown.ivaPct}%: ${formatCopCurrency(costBreakdown.ivaValue)}` : null
  const totalLine = `Total final: ${formatCopCurrency(costBreakdown.totalSuggested)}`
  const unitLine = costBreakdown.unitPriceWithIva != null ? `Valor unitario final aproximado: ${formatCopCurrency(costBreakdown.unitPriceWithIva)}` : null
  const assumptions = Array.from(assumptionSet)
  const assumptionsLine = assumptions.length
    ? `Supuestos usados: ${assumptions.join(' ')}`
    : null

  const message = [
    intro,
    '',
    'Costo base estimado:',
    ...lines,
    utilityLine,
    subtotalLine,
    ivaLine,
    totalLine,
    unitLine,
    assumptionsLine,
  ].filter((line): line is string => Boolean(line)).join('\n')

  return {
    title,
    message,
    assumptions,
    copyText: message,
  }
}

function metaNumber(meta: unknown, key: string) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const raw = (meta as Record<string, unknown>)[key]
  const parsed = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

async function loadPricingContext(empresaId: string): Promise<{ profiles: PrintProfile[]; transportOptions: TransportOption[] }> {
  const [profiles, dropdown] = await Promise.all([
    prisma.litografiaPrintProfile.findMany({
      where: { empresaId, activo: true },
      select: {
        id: true,
        nombre: true,
        costoPlanchaPorColor: true,
        costoTintaPorColor: true,
        anchoUtilCm: true,
        altoUtilCm: true,
        separacionPiezasCm: true,
      },
      orderBy: { nombre: 'asc' },
    }),
    prismaCompat.configDropdown.findFirst({
      where: { empresaId, key: 'litografia_transporte' },
      select: {
        items: {
          where: { activo: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: { value: true, label: true, meta: true },
        },
      },
    }),
  ])

  const items = dropdown && typeof dropdown === 'object' && dropdown !== null && 'items' in dropdown
    ? ((dropdown as { items?: Array<{ value: string; label: string; meta: unknown }> }).items ?? [])
    : []

  return {
    profiles,
    transportOptions: items.map((item) => ({
      value: String(item.value || ''),
      label: String(item.label || ''),
      total: Math.max(0, metaNumber(item.meta, 'total') ?? 0),
    })),
  }
}

function findTransportOption(options: TransportOption[], entrega: string | null | undefined) {
  const needle = normalizeText(entrega)
  if (!needle) return null
  return options.find((option) => {
    const haystack = normalizeText(`${option.value} ${option.label}`)
    return haystack.includes(needle) || needle.includes(haystack)
  }) ?? null
}

function buildFinishHints(finishes: Array<{ nombre: string; grupo?: string | null }>): LitografiaAiFinishHints {
  const genericLabels: string[] = []
  let plastificadoLabel: string | null = null
  let troqueladoLabel: string | null = null
  let troqueladaLabel: string | null = null
  let corteLabel: string | null = null

  for (const finish of finishes) {
    const group = String(finish.grupo || '').trim().toUpperCase()
    if (group === 'PLASTIFICADO') {
      plastificadoLabel ||= finish.nombre
      continue
    }
    if (group === 'CORTE') {
      corteLabel ||= finish.nombre
      continue
    }
    if (group === 'TROQUELADO') {
      if (/troquelad[ao]/i.test(finish.nombre)) troqueladaLabel ||= finish.nombre
      else troqueladoLabel ||= finish.nombre
      continue
    }
    genericLabels.push(finish.nombre)
  }

  return {
    genericLabels,
    plastificadoLabel,
    troqueladoLabel,
    troqueladaLabel,
    corteLabel,
  }
}

function buildLitografiaAiHandoff(args: {
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  costBreakdown: CostBreakdown
  transport: TransportOption | null
  finishes: Array<{ nombre: string; grupo?: string | null }>
  assistantReply: AssistantQuoteReply | null
}): LitografiaAiHandoff {
  const { analysis, costBreakdown, transport, finishes, assistantReply } = args
  return {
    id: `${Date.now()}`,
    brief: analysis.normalizedBrief,
    quoteType: analysis.quoteType,
    producto: analysis.extracted.producto,
    cantidad: analysis.extracted.cantidad,
    anchoCm: analysis.extracted.anchoCm,
    altoCm: analysis.extracted.altoCm,
    paginas: analysis.extracted.paginas,
    tintas: analysis.extracted.tintas,
    material: analysis.extracted.material,
    acabado: analysis.extracted.acabado,
    finishHints: buildFinishHints(finishes),
    pricingHints: {
      sizeLabel: costBreakdown.sizeLabel,
      paperName: costBreakdown.paperName,
      transportLabel: transport?.label ?? null,
      machineName: costBreakdown.machineName,
    },
    assistantReply: assistantReply?.message ?? null,
    entrega: analysis.extracted.entrega,
  }
}

function getFinishCandidatesForHandoff(args: {
  brief: string
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  catalog: LitografiaCatalogContext
}) {
  return findFinishCandidates(args.catalog, {
    brief: args.brief,
    quoteType: args.analysis.quoteType,
    acabado: args.analysis.extracted.acabado,
  }).map((finish) => ({ nombre: finish.nombre, grupo: finish.grupo ?? null }))
}

function buildCostBreakdown(args: {
  brief: string
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  catalog: LitografiaCatalogContext
  profiles: PrintProfile[]
  transportOptions: TransportOption[]
}): CostBreakdown {
  const { analysis, catalog, profiles, transportOptions } = args
  const quantity = analysis.extracted.cantidad ?? 0
  const size = findMatchedSize(catalog, analysis.extracted.anchoCm, analysis.extracted.altoCm)
  const paper = findMatchedPaper(catalog, analysis.extracted.material)
  const finishes = findFinishCandidates(catalog, {
    brief: args.brief,
    quoteType: analysis.quoteType,
    acabado: analysis.extracted.acabado,
  })
  const transport = findTransportOption(transportOptions, analysis.extracted.entrega)
  const { totalColors, twoSided } = parseColorSpec(args.brief, analysis.extracted.tintas)
  const reusePlate = shouldReusePlate(args.brief)

  if (analysis.extracted.paginas) {
    return {
      status: 'PARTIAL',
      summary: 'El desglose automático de costos editoriales todavía requiere completar portada, internas y encuadernación.',
      lines: [],
      notes: ['Para revistas, libros o cartillas el flujo editorial sigue siendo el cierre correcto del costo.'],
      machineName: null,
      paperName: null,
      paperSheet: null,
      sizeLabel: null,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct: DEFAULT_IVA_PCT,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  if (quantity <= 0 || !analysis.extracted.anchoCm || !analysis.extracted.altoCm || !paper || !totalColors) {
    return {
      status: 'NOT_AVAILABLE',
      summary: 'Faltan datos clave para calcular costos base.',
      lines: [],
      notes: ['Confirma cantidad, tamaño, tintas y papel para generar un desglose de costos.'],
      machineName: null,
      paperName: paper?.nombre ?? null,
      paperSheet: paper ? `${paper.pliegoWidthCm ?? 0} x ${paper.pliegoHeightCm ?? 0} cm` : null,
      sizeLabel: size?.nombre ?? null,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct: DEFAULT_IVA_PCT,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const finishCost = finishes
    .filter((finish) => String(finish.grupo || '').toUpperCase() !== 'CORTE')
    .reduce((total, finish) => total + (Number(finish.valor) || 0), 0)
  const cutCost = finishes
    .filter((finish) => String(finish.grupo || '').toUpperCase() === 'CORTE')
    .reduce((total, finish) => total + (Number(finish.valor) || 0), 0)
  const transportCost = transport?.total ?? 0
  const sobranteMinimo = twoSided && analysis.extracted.tintas === 4 ? DEFAULT_SOBRANTE_MINIMO * 2 : DEFAULT_SOBRANTE_MINIMO
  const paperType = normalizeText(paper.tipo)

  const candidates = profiles
    .map((profile) => ({
      profile,
      result: computeLitografia({
        cantidad: quantity,
        colores: totalColors,
        desperdicioPct: 0,
        sobranteMinimo,
        costoPlanchaPorColor: reusePlate ? 0 : Number(profile.costoPlanchaPorColor || 0),
        costoTintaPorColor: Number(profile.costoTintaPorColor || 0),
        costoPapelUnidad: 0,
        papelModo: 'pliego',
        papelTipo: paperType.includes('bond') ? 'bond' : paperType.includes('period') ? 'periodico' : paperType.includes('propal') || paperType.includes('cote') ? 'propalcote' : 'otro',
        papelPliegoWidthCm: Number(paper.pliegoWidthCm || 0),
        papelPliegoHeightCm: Number(paper.pliegoHeightCm || 0),
        papelFormatoWidthCm: Number(analysis.extracted.anchoCm || 0),
        papelFormatoHeightCm: Number(analysis.extracted.altoCm || 0),
        costoPliego: Number(paper.costoPliego || 0),
        maquinaPliegoWidthCm: Number(profile.anchoUtilCm || 0),
        maquinaPliegoHeightCm: Number(profile.altoUtilCm || 0),
        maquinaSeparacionCm: Number(profile.separacionPiezasCm || 0),
        costoCorte: cutCost,
        costoAcabados: finishCost,
        costoTransporte: transportCost,
        margenPct: DEFAULT_MARGIN_PCT,
      }),
    }))
    .filter((entry) => entry.result.papelModo === 'pliego' && (entry.result.piezasPorPliego ?? 0) > 0)
    .sort((a, b) => a.result.costoProduccion - b.result.costoProduccion)

  const best = candidates[0] ?? null
  if (!best) {
    return {
      status: 'PARTIAL',
      summary: 'No se pudo elegir una máquina válida con la configuración actual.',
      lines: [],
      notes: ['Revisa si hay perfiles de impresión activos y papeles configurados con tamaños de pliego correctos.'],
      machineName: null,
      paperName: paper.nombre,
      paperSheet: `${paper.pliegoWidthCm ?? 0} x ${paper.pliegoHeightCm ?? 0} cm`,
      sizeLabel: size?.nombre ?? `${analysis.extracted.anchoCm} x ${analysis.extracted.altoCm} cm`,
      productionCost: null,
      utility: null,
      subtotalBeforeIva: null,
      ivaPct: DEFAULT_IVA_PCT,
      ivaValue: null,
      totalSuggested: null,
      unitPriceWithIva: null,
    }
  }

  const productionCost = best.result.costoProduccion
  const subtotalBeforeIva = best.result.precioVenta
  const utility = subtotalBeforeIva - productionCost
  const ivaValue = subtotalBeforeIva * (DEFAULT_IVA_PCT / 100)
  const totalSuggested = subtotalBeforeIva + ivaValue
  const unitPriceWithIva = quantity > 0 ? totalSuggested / quantity : null

  const lines: CostBreakdownLine[] = [
    { label: `Papel ${paper.nombre}`, amount: best.result.papel },
    { label: reusePlate ? 'Planchas reutilizadas' : 'Planchas', amount: best.result.plancha },
    { label: `Impresión ${best.profile.nombre}`, amount: best.result.tinta },
  ]

  for (const finish of finishes) {
    const amount = Number(finish.valor) || 0
    if (amount <= 0) continue
    lines.push({ label: finish.nombre, amount })
  }

  if (transportCost > 0) {
    lines.push({ label: `Entrega ${transport?.label || 'configurada'}`, amount: transportCost })
  }

  const notes: string[] = [
    `Se tomó ${paper.nombre} en pliego ${paper.pliegoWidthCm ?? 0} x ${paper.pliegoHeightCm ?? 0} cm.`,
    `La mejor opción actual es ${best.profile.nombre} con ${best.result.piezasPorPliego ?? 0} piezas por pliego.`,
  ]

  if (twoSided) notes.push('Se tomó como impresión por ambas caras.')
  if (reusePlate) notes.push('No se cobraron planchas nuevas porque el brief indica reutilizar la plancha.')
  if (!transport) notes.push('No se sumó transporte porque la entrega no coincide con una opción configurada.')

  return {
    status: transport ? 'AVAILABLE' : 'PARTIAL',
    summary: 'Desglose base calculado con la configuración litográfica actual.',
    lines,
    notes,
    machineName: best.profile.nombre,
    paperName: paper.nombre,
    paperSheet: `${paper.pliegoWidthCm ?? 0} x ${paper.pliegoHeightCm ?? 0} cm`,
    sizeLabel: size?.nombre ?? `${analysis.extracted.anchoCm} x ${analysis.extracted.altoCm} cm`,
    productionCost,
    utility,
    subtotalBeforeIva,
    ivaPct: DEFAULT_IVA_PCT,
    ivaValue,
    totalSuggested,
    unitPriceWithIva,
  }
}

function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  return prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } }).then((row) => row?.empresaId ?? null)
}

async function loadCatalogContext(empresaId: string): Promise<LitografiaCatalogContext> {
  const [sizes, papers, finishes, products, rates] = await Promise.all([
    prisma.litografiaPrintSize.findMany({
      where: { empresaId, activo: true },
      select: { key: true, nombre: true, widthCm: true, heightCm: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.litografiaPaperRate.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true, tipo: true, gramaje: true, costoPliego: true, pliegoWidthCm: true, pliegoHeightCm: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.litografiaFinishOption.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true, grupo: true, valor: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.litografiaProducto.findMany({
      where: { empresaId, activo: true },
      select: { id: true, nombre: true, formatoKey: true, tintas: true, paperRateId: true, finishOptionId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.litografiaFlyerRate.findMany({
      where: { empresaId, activo: true },
      select: {
        id: true,
        productoId: true,
        formatoKey: true,
        tintas: true,
        tirajeMin: true,
        tirajeMax: true,
        paperRateId: true,
        finishOptionId: true,
        precioTotal: true,
      },
      orderBy: [{ formatoKey: 'asc' }, { tintas: 'asc' }, { tirajeMin: 'asc' }],
    }),
  ])

  return {
    sizes,
    papers,
    finishes,
    products: products.map((product) => ({
      ...product,
      tintas: product.tintas as 1 | 2 | 4,
    })),
    rates: rates.map((rate) => ({
      ...rate,
      tintas: rate.tintas as 1 | 2 | 4,
    })),
  }
}

function matchConfiguredPrice(args: {
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  catalog: LitografiaCatalogContext
}): ConfiguredPriceSuggestion {
  const { analysis, catalog } = args
  const quantity = analysis.extracted.cantidad ?? 0
  const tintas = analysis.extracted.tintas ?? null
  const targetWidth = analysis.extracted.anchoCm
  const targetHeight = analysis.extracted.altoCm
  const materialNeedle = normalizeText(analysis.extracted.material)
  const finishNeedle = normalizeText(analysis.extracted.acabado)

  const matchedSize = targetWidth && targetHeight
    ? (catalog.sizes ?? []).find((size) => {
        const sameOrientation = Math.abs(size.widthCm - targetWidth) < 0.4 && Math.abs(size.heightCm - targetHeight) < 0.4
        const swappedOrientation = Math.abs(size.widthCm - targetHeight) < 0.4 && Math.abs(size.heightCm - targetWidth) < 0.4
        return sameOrientation || swappedOrientation
      }) ?? null
    : null

  const matchedPaper = (catalog.papers ?? []).find((paper) => {
    const haystack = normalizeText(`${paper.nombre} ${paper.tipo || ''} ${paper.gramaje ?? ''}`)
    return materialNeedle ? haystack.includes(materialNeedle) || materialNeedle.includes(haystack) : false
  }) ?? null

  const matchedFinish = (catalog.finishes ?? []).find((finish) => {
    const haystack = normalizeText(finish.nombre)
    return finishNeedle ? haystack.includes(finishNeedle) || finishNeedle.includes(haystack) : false
  }) ?? null

  const reasoning: string[] = []
  if (matchedSize) reasoning.push(`Tamaño detectado en configuración: ${matchedSize.nombre}`)
  if (matchedPaper) reasoning.push(`Papel detectado en configuración: ${matchedPaper.nombre}`)
  if (matchedFinish) reasoning.push(`Acabado detectado en configuración: ${matchedFinish.nombre}`)
  if (tintas) reasoning.push(`Tintas detectadas: ${tintas}`)

  const matchingRates = (catalog.rates ?? [])
    .filter((rate) => {
      if (!quantity || quantity < rate.tirajeMin || quantity > rate.tirajeMax) return false
      if (matchedSize && rate.formatoKey !== matchedSize.key) return false
      if (tintas && rate.tintas !== tintas) return false
      if (matchedPaper && rate.paperRateId && rate.paperRateId !== matchedPaper.id) return false
      if (matchedFinish && rate.finishOptionId && rate.finishOptionId !== matchedFinish.id) return false
      return true
    })
    .sort((a, b) => a.precioTotal - b.precioTotal)

  const bestRate = matchingRates[0] ?? null
  if (bestRate && quantity > 0) {
    reasoning.push(`Se encontró una tarifa vigente entre ${bestRate.tirajeMin} y ${bestRate.tirajeMax} unidades.`)
    return {
      status: 'MATCHED',
      confidence: matchedPaper && matchedSize && tintas ? 'ALTA' : 'MEDIA',
      title: 'Sugerencia con tu configuración actual',
      total: bestRate.precioTotal,
      unitPrice: bestRate.precioTotal / quantity,
      currency: 'COP',
      reasoning,
      matchedRateId: bestRate.id,
      matchedSize: matchedSize?.nombre ?? null,
      matchedPaper: matchedPaper?.nombre ?? null,
      matchedFinish: matchedFinish?.nombre ?? null,
    }
  }

  if (reasoning.length) {
    reasoning.push('No se encontró una tarifa exacta vigente con todos los filtros del brief.')
    return {
      status: 'PARTIAL',
      confidence: 'MEDIA',
      title: 'Coincidencia parcial con tu configuración actual',
      total: null,
      unitPrice: null,
      currency: 'COP',
      reasoning,
      matchedRateId: null,
      matchedSize: matchedSize?.nombre ?? null,
      matchedPaper: matchedPaper?.nombre ?? null,
      matchedFinish: matchedFinish?.nombre ?? null,
    }
  }

  return {
    status: 'NO_MATCH',
    confidence: 'BAJA',
    title: 'Sin coincidencia tarifaria directa',
    total: null,
    unitPrice: null,
    currency: 'COP',
    reasoning: ['La IA entendió el brief, pero no encontró una coincidencia suficientemente confiable en tamaños, papeles, acabados y tarifas configuradas.'],
    matchedRateId: null,
    matchedSize: null,
    matchedPaper: null,
    matchedFinish: null,
  }
}

async function fetchExternalBenchmark(args: {
  brief: string
  analysis: Awaited<ReturnType<typeof analyzeLitografiaBrief>>
  configuredSuggestion: ConfiguredPriceSuggestion
}): Promise<ExternalBenchmarkResult> {
  const benchmarkUrl = String(process.env.LITOGRAFIA_AI_BENCHMARK_URL || '').trim()
  const benchmarkApiKey = String(process.env.LITOGRAFIA_AI_BENCHMARK_API_KEY || '').trim()
  const benchmarkProvider = String(process.env.LITOGRAFIA_AI_BENCHMARK_PROVIDER || 'benchmark-service').trim() || 'benchmark-service'

  if (!benchmarkUrl) {
    return {
      status: 'NOT_CONFIGURED',
      provider: null,
      summary: 'Sin benchmark externo configurado. Para comparar contra competencia necesitas definir un servicio o fuente externa autorizada.',
      suggestedTotalMin: null,
      suggestedTotalMax: null,
      reasoning: ['No existe un conector de mercado activo en el entorno actual.'],
      references: [],
    }
  }

  try {
    const response = await fetch(benchmarkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(benchmarkApiKey ? { Authorization: `Bearer ${benchmarkApiKey}` } : {}),
      },
      body: JSON.stringify({
        brief: args.brief,
        analysis: args.analysis,
        configuredSuggestion: args.configuredSuggestion,
      }),
    })

    if (!response.ok) {
      return {
        status: 'UNAVAILABLE',
        provider: benchmarkProvider,
        summary: 'El benchmark externo respondió con error.',
        suggestedTotalMin: null,
        suggestedTotalMax: null,
        reasoning: [`HTTP ${response.status} al consultar benchmark externo.`],
        references: [],
      }
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          summary?: string
          suggestedTotalMin?: number | null
          suggestedTotalMax?: number | null
          reasoning?: string[]
          references?: Array<{ label?: string; url?: string }>
        }
      | null

    return {
      status: 'CONFIGURED',
      provider: benchmarkProvider,
      summary: payload?.summary || 'Benchmark externo consultado.',
      suggestedTotalMin: typeof payload?.suggestedTotalMin === 'number' ? payload.suggestedTotalMin : null,
      suggestedTotalMax: typeof payload?.suggestedTotalMax === 'number' ? payload.suggestedTotalMax : null,
      reasoning: Array.isArray(payload?.reasoning) ? payload!.reasoning.filter((item) => typeof item === 'string') : [],
      references: Array.isArray(payload?.references)
        ? payload!.references
            .filter((item) => item && typeof item.url === 'string')
            .map((item) => ({ label: item.label || item.url || 'Referencia externa', url: item.url || '' }))
            .filter((item) => item.url)
        : [],
    }
  } catch {
    return {
      status: 'UNAVAILABLE',
      provider: benchmarkProvider,
      summary: 'No se pudo consultar el benchmark externo.',
      suggestedTotalMin: null,
      suggestedTotalMax: null,
      reasoning: ['La conexión al benchmark externo falló o no estuvo disponible.'],
      references: [],
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const parsedBody = requestSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: parsedBody.error.issues[0]?.message || 'Body inválido' }, { status: 400 })
    }

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

    const [catalog, pricingContext] = await Promise.all([
      loadCatalogContext(empresaId),
      loadPricingContext(empresaId),
    ])
    const data = await analyzeLitografiaBrief(parsedBody.data.brief, catalog)
    const connection = getLitografiaAiConnectionStatus()
    const configuredSuggestion = matchConfiguredPrice({ analysis: data, catalog })
    const finishCandidates = getFinishCandidatesForHandoff({
      brief: parsedBody.data.brief,
      analysis: data,
      catalog,
    })
    const matchedTransport = findTransportOption(pricingContext.transportOptions, data.extracted.entrega)
    const costBreakdown = buildCostBreakdown({
      brief: parsedBody.data.brief,
      analysis: data,
      catalog,
      profiles: pricingContext.profiles,
      transportOptions: pricingContext.transportOptions,
    })
    const externalBenchmark = await fetchExternalBenchmark({
      brief: parsedBody.data.brief,
      analysis: data,
      configuredSuggestion,
    })
    const assistantReply = buildAssistantQuoteReply({
      brief: parsedBody.data.brief,
      analysis: data,
      configuredSuggestion,
      costBreakdown,
    })
    const handoff = buildLitografiaAiHandoff({
      analysis: data,
      costBreakdown,
      transport: matchedTransport,
      finishes: finishCandidates,
      assistantReply,
    })

    await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'LITOGRAFIA_QUOTE',
        prompt: parsedBody.data.brief,
        actorUserId: access.userId,
        actorLabel: access.session.user.name || access.session.user.email || 'Usuario interno',
        summary: data.summary,
        responseText: assistantReply?.message ?? null,
        metadata: {
          quoteType: data.quoteType,
          confidence: data.confidence,
          missingFields: data.missingFields,
          finishHints: handoff.finishHints,
          totalSuggested: costBreakdown.totalSuggested,
        },
        asset: null,
      },
    })

    return NextResponse.json({
      ok: true,
      data,
      connection,
      assistantReply,
      handoff,
      pricing: {
        configuredSuggestion,
        costBreakdown,
        externalBenchmark,
      },
    })
  } catch (error) {
    console.error('[litografia][ia][cotizar][POST] Error analizando brief', error)
    return NextResponse.json({ ok: false, error: 'Error interno analizando el brief litográfico.' }, { status: 500 })
  }
}