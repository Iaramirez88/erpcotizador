import { z } from 'zod'

export type ConfidenceLevel = 'ALTA' | 'MEDIA' | 'BAJA'

export type LitografiaAiResult = {
  normalizedBrief: string
  summary: string
  confidence: ConfidenceLevel
  quoteType: string
  extracted: {
    producto: string | null
    cantidad: number | null
    anchoCm: number | null
    altoCm: number | null
    paginas: number | null
    tintas: 1 | 2 | 4 | null
    material: string | null
    acabado: string | null
    entrega: string | null
    observaciones: string[]
  }
  missingFields: string[]
  questions: string[]
  nextStep: string
  engine: {
    mode: 'RULES' | 'LLM'
    provider: string
    model: string | null
  }
}

export type LitografiaCatalogContext = {
  sizes?: Array<{ key: string; nombre: string; widthCm: number; heightCm: number }>
  papers?: Array<{ id: string; nombre: string; tipo: string | null; gramaje: number | null; costoPliego: number; pliegoWidthCm?: number; pliegoHeightCm?: number }>
  finishes?: Array<{ id: string; nombre: string; grupo?: string | null; valor: number }>
  products?: Array<{ id: string; nombre: string; formatoKey: string; tintas: 1 | 2 | 4; paperRateId: string; finishOptionId: string | null }>
  rates?: Array<{
    id: string
    productoId: string | null
    formatoKey: string
    tintas: 1 | 2 | 4
    tirajeMin: number
    tirajeMax: number
    paperRateId: string | null
    finishOptionId: string | null
    precioTotal: number
  }>
}

type ExtractedData = LitografiaAiResult['extracted']

const PRODUCT_PATTERNS: Array<{ type: string; expressions: RegExp[] }> = [
  { type: 'REVISTA', expressions: [/\brevista\b/i] },
  { type: 'CARTILLA', expressions: [/\bcartilla\b/i] },
  { type: 'LIBRO', expressions: [/\blibro\b/i] },
  { type: 'VOLANTE', expressions: [/\bvolante(s)?\b/i, /\bflyer(s)?\b/i] },
  { type: 'PLEGABLE', expressions: [/\bplegable(s)?\b/i, /\bdiptico(s)?\b/i, /\btriptico(s)?\b/i] },
  { type: 'TARJETA', expressions: [/\btarjeta(s)?\b/i] },
  { type: 'AFICHE', expressions: [/\bafiche(s)?\b/i, /\bposter(es)?\b/i] },
  { type: 'ETIQUETA', expressions: [/\betiqueta(s)?\b/i, /\bsticker(s)?\b/i] },
  { type: 'CAJA', expressions: [/\bcaja(s)?\b/i, /\bempaque(s)?\b/i] },
]

const MATERIAL_PATTERNS = [
  'propalcote 90 g',
  'propalcote 115 g',
  'propalcote 150 g',
  'propalcote 240 g',
  'propalcote 300 g',
  'propalcote 350 g',
  'bond 75 g',
  'bond 90 g',
  'bond 115 g',
  'cartulina',
  'opalina',
  'adhesivo',
  'kimberly',
  'periodico',
]

const FINISH_PATTERNS = [
  'plastificado mate',
  'plastificado brillante',
  'laminado mate',
  'laminado brillante',
  'troquelado',
  'barniz uv',
  'sectorizado',
  'esquinas redondeadas',
  'grafado',
  'plegado',
  'perforado',
]

const DELIVERY_PATTERNS = ['chapinero', 'suba', 'usaquen', 'engativa', 'norte', 'sur', 'bogota', 'medellin', 'cali', 'barranquilla']

const llmResponseSchema = z.object({
  summary: z.string().trim().min(10),
  confidence: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  quoteType: z.string().trim().min(2),
  extracted: z.object({
    producto: z.string().trim().nullable(),
    cantidad: z.number().int().positive().nullable(),
    anchoCm: z.number().positive().nullable(),
    altoCm: z.number().positive().nullable(),
    paginas: z.number().int().positive().nullable(),
    tintas: z.union([z.literal(1), z.literal(2), z.literal(4), z.null()]),
    material: z.string().trim().nullable(),
    acabado: z.string().trim().nullable(),
    entrega: z.string().trim().nullable(),
    observaciones: z.array(z.string().trim()).default([]),
  }),
  missingFields: z.array(z.string().trim()).default([]),
  questions: z.array(z.string().trim()).default([]),
  nextStep: z.string().trim().min(10),
})

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseProductType(brief: string) {
  for (const item of PRODUCT_PATTERNS) {
    if (item.expressions.some((expression) => expression.test(brief))) return item.type
  }
  return 'OTRO'
}

function parseCantidad(brief: string) {
  const match = brief.match(/(?:^|\s)(\d{1,3}(?:[.,]\d{3})+|\d{3,6})(?:\s+unidades|\s+unds?|\s+ejemplares|\s+piezas|\s+volantes|\s+tarjetas|\s+revistas|\s+libros|\s*$)/i)
  if (!match) return null
  const parsed = Number(match[1].replace(/[.,]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseDimensiones(brief: string) {
  const directMatch = brief.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:x|por)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*cm/i)
  if (directMatch) {
    return {
      anchoCm: Number(directMatch[1].replace(',', '.')),
      altoCm: Number(directMatch[2].replace(',', '.')),
    }
  }

  const aliases: Record<string, { anchoCm: number; altoCm: number }> = {
    'media carta': { anchoCm: 14, altoCm: 21.5 },
    carta: { anchoCm: 21.5, altoCm: 28 },
    oficio: { anchoCm: 21.5, altoCm: 33 },
    a4: { anchoCm: 21, altoCm: 29.7 },
    'tarjeta de presentacion': { anchoCm: 9, altoCm: 5 },
  }

  for (const [label, size] of Object.entries(aliases)) {
    if (brief.includes(label)) return size
  }

  return { anchoCm: null, altoCm: null }
}

function parsePaginas(brief: string) {
  const match = brief.match(/(\d{1,4})\s+pag(?:inas|s)?/i)
  if (!match) return null
  const pages = Number(match[1])
  return Number.isFinite(pages) && pages > 0 ? pages : null
}

function parseTintas(brief: string): 1 | 2 | 4 | null {
  if (/\b4x4\b|\bfull color\b|\bpolicromia\b|\bcuatricromia\b/i.test(brief)) return 4
  if (/\b2x0\b|\b2x2\b|\bdos tintas\b/i.test(brief)) return 2
  if (/\b1x0\b|\b1x1\b|\buna tinta\b|\bblanco y negro\b/i.test(brief)) return 1
  return null
}

function parseKeyword(brief: string, candidates: string[]) {
  return candidates.find((candidate) => brief.includes(candidate)) ?? null
}

function parseObservaciones(brief: string) {
  const notes: string[] = []
  if (/urgente|hoy|manana|inmediato/i.test(brief)) notes.push('Entrega urgente')
  if (/tiro y retiro|doble cara|por ambas caras/i.test(brief)) notes.push('Impresión por ambas caras')
  if (/diseno|arte final|diagramacion/i.test(brief)) notes.push('Requiere apoyo de diseño o arte final')
  if (/empaque|embalaje/i.test(brief)) notes.push('Validar requerimiento de empaque')
  return notes
}

function buildQuestions(extracted: ExtractedData, quoteType: string) {
  const questions: string[] = []

  if (!extracted.cantidad) questions.push('¿Cuál es la cantidad exacta de piezas o ejemplares?')
  if (!extracted.anchoCm || !extracted.altoCm) questions.push('¿Cuál es el tamaño final del impreso en centímetros?')
  if (!extracted.material) questions.push('¿Qué papel o sustrato se debe usar y con qué gramaje?')
  if (!extracted.tintas) questions.push('¿La impresión es a 1, 2 o 4 tintas?')
  if (!extracted.acabado && quoteType !== 'VOLANTE') questions.push('¿Lleva algún acabado como laminado, barniz UV, troquel o plegado?')
  if ((quoteType === 'REVISTA' || quoteType === 'LIBRO' || quoteType === 'CARTILLA') && !extracted.paginas) {
    questions.push('¿Cuántas páginas interiores y cuántas páginas de portada/contraportada tiene?')
  }
  if (!extracted.entrega) questions.push('¿Dónde se entrega el trabajo para calcular transporte?')

  return questions
}

function buildSummary(quoteType: string, extracted: ExtractedData) {
  const parts = [
    quoteType === 'OTRO' ? 'Trabajo litográfico por clasificar' : quoteType,
    extracted.cantidad ? `${extracted.cantidad} unidades` : 'cantidad pendiente',
    extracted.material ?? 'material pendiente',
    extracted.tintas ? `${extracted.tintas} tintas` : 'tintas pendientes',
  ]

  if (extracted.anchoCm && extracted.altoCm) parts.push(`${extracted.anchoCm} x ${extracted.altoCm} cm`)
  if (extracted.acabado) parts.push(extracted.acabado)
  if (extracted.paginas) parts.push(`${extracted.paginas} páginas`)

  return parts.join(' · ')
}

function getConfidenceLevel(missingFields: string[]): ConfidenceLevel {
  if (missingFields.length <= 1) return 'ALTA'
  if (missingFields.length <= 3) return 'MEDIA'
  return 'BAJA'
}

function inferProviderFromConfig(args: { baseUrl: string; provider: string; apiKey: string }) {
  const explicitProvider = args.provider.trim().toLowerCase()
  if (explicitProvider && explicitProvider !== 'openai-compatible') return explicitProvider

  const baseUrl = args.baseUrl.toLowerCase()
  if (baseUrl.includes('api.openai.com')) return 'openai'
  if (baseUrl.includes('11434') || baseUrl.includes('ollama')) return 'ollama'
  if (args.apiKey) return 'openai'
  return 'openai-compatible'
}

function getOpenAiCompatibleConfig() {
  const configuredBaseUrl = String(process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_MODEL || process.env.LLM_MODEL || '').trim()
  const configuredProvider = String(process.env.LITOGRAFIA_AI_PROVIDER || 'openai-compatible').trim() || 'openai-compatible'
  const inferredProvider = inferProviderFromConfig({ baseUrl: configuredBaseUrl, provider: configuredProvider, apiKey })

  let baseUrl = configuredBaseUrl
  if (!baseUrl && inferredProvider === 'openai' && apiKey) {
    baseUrl = 'https://api.openai.com/v1'
  }
  if (!baseUrl && inferredProvider === 'ollama') {
    baseUrl = 'http://127.0.0.1:11434/v1'
  }

  return {
    enabled: Boolean(baseUrl && model),
    baseUrl,
    apiKey,
    model: model || null,
    provider: inferredProvider,
  }
}

function stripJsonFences(content: string) {
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

function buildMissingFields(extracted: ExtractedData, quoteType: string) {
  return [
    !extracted.producto ? 'producto' : null,
    !extracted.cantidad ? 'cantidad' : null,
    !extracted.anchoCm || !extracted.altoCm ? 'tamaño final' : null,
    !extracted.material ? 'papel o sustrato' : null,
    !extracted.tintas ? 'tintas' : null,
    (quoteType === 'REVISTA' || quoteType === 'LIBRO' || quoteType === 'CARTILLA') && !extracted.paginas ? 'paginación' : null,
    !extracted.entrega ? 'entrega/transporte' : null,
  ].filter((value): value is string => Boolean(value))
}

export function analyzeLitografiaBriefWithRules(brief: string): LitografiaAiResult {
  const normalizedBrief = normalizeText(brief)
  const lowerBrief = normalizedBrief.toLowerCase()
  const quoteType = parseProductType(lowerBrief)
  const { anchoCm, altoCm } = parseDimensiones(lowerBrief)

  const extracted: ExtractedData = {
    producto: quoteType === 'OTRO' ? null : quoteType,
    cantidad: parseCantidad(lowerBrief),
    anchoCm,
    altoCm,
    paginas: parsePaginas(lowerBrief),
    tintas: parseTintas(lowerBrief),
    material: parseKeyword(lowerBrief, MATERIAL_PATTERNS),
    acabado: parseKeyword(lowerBrief, FINISH_PATTERNS),
    entrega: parseKeyword(lowerBrief, DELIVERY_PATTERNS),
    observaciones: parseObservaciones(lowerBrief),
  }

  const missingFields = buildMissingFields(extracted, quoteType)

  return {
    normalizedBrief,
    summary: buildSummary(quoteType, extracted),
    confidence: getConfidenceLevel(missingFields),
    quoteType,
    extracted,
    missingFields,
    questions: buildQuestions(extracted, quoteType),
    nextStep: missingFields.length
      ? 'Completa los datos faltantes con el cliente y luego pasa al cotizador litográfico tradicional para cerrar precio exacto.'
      : 'El brief ya está suficientemente completo para cargarlo en el cotizador litográfico y cerrar la cotización exacta.',
    engine: {
      mode: 'RULES',
      provider: 'internal-rules',
      model: null,
    },
  }
}

export async function analyzeLitografiaBrief(
  brief: string,
  catalogContext?: LitografiaCatalogContext,
  knowledgeContext?: unknown,
): Promise<LitografiaAiResult> {
  const baseAnalysis = analyzeLitografiaBriefWithRules(brief)
  const config = getOpenAiCompatibleConfig()

  if (!config.enabled || !config.baseUrl || !config.model) return baseAnalysis

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista comercial senior para cotizacion litografica en Colombia. Tu trabajo no es dar precio ni inventar datos; debes estructurar el brief, detectar vacios y devolver solo JSON valido. Usa centimetros, cantidades enteras, tintas solo 1, 2 o 4. Si un dato no esta claro, devuelve null y agregalo a missingFields y questions. Si llega knowledgeContext, usalo solo como apoyo comercial y operativo; no reemplaza las tarifas exactas del ERP.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              brief,
              baseline: baseAnalysis,
              catalogContext: catalogContext ?? null,
              knowledgeContext: knowledgeContext ?? null,
              instructions: {
                output: 'Devuelve exclusivamente un objeto JSON con: summary, confidence, quoteType, extracted, missingFields, questions, nextStep.',
                constraints: [
                  'No respondas con markdown.',
                  'No inventes precios ni tiempos de producción.',
                  'Si el producto es editorial, intenta identificar páginas.',
                  'Si el material o acabado es ambiguo, usa null.',
                ],
              },
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) return baseAnalysis

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string | null } | null }> }
      | null

    const content = payload?.choices?.[0]?.message?.content
    if (!content) return baseAnalysis

    const parsed = llmResponseSchema.safeParse(JSON.parse(stripJsonFences(content)))
    if (!parsed.success) return baseAnalysis

    return {
      normalizedBrief: baseAnalysis.normalizedBrief,
      summary: parsed.data.summary,
      confidence: parsed.data.confidence,
      quoteType: parsed.data.quoteType,
      extracted: parsed.data.extracted,
      missingFields: parsed.data.missingFields,
      questions: parsed.data.questions,
      nextStep: parsed.data.nextStep,
      engine: {
        mode: 'LLM',
        provider: config.provider,
        model: config.model,
      },
    }
  } catch {
    return baseAnalysis
  }
}

export function getLitografiaAiConnectionStatus() {
  const config = getOpenAiCompatibleConfig()
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
  }
}