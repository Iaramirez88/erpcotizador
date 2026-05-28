import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { defaultLitografiaAiKnowledge } from '@/lib/litografia-ai-default-knowledge'

const moneySchema = z.number().nonnegative().nullable()

const planchaOrImpresionSchema = z.object({
  nombre: z.string().trim().min(1),
  tintas: z.string().trim().min(1).optional(),
  tamano: z.string().trim().min(1).optional(),
  tamano_cm: z.string().trim().min(1).optional(),
  valor: moneySchema,
  unidad: z.string().trim().min(1),
  nota: z.string().trim().min(1).optional(),
  regla_cobro: z.string().trim().min(1).optional(),
})

const paperSchema = z.object({
  nombre: z.string().trim().min(1),
  valor: moneySchema,
  unidad: z.string().trim().min(1),
  nota: z.string().trim().min(1).optional(),
})

const cutSchema = z.object({
  nombre: z.string().trim().min(1),
  medidas_cm: z.string().trim().min(1),
  cantidad_por_pliego: z.number().int().positive(),
})

const plastificadoSchema = z.object({
  nombre: z.string().trim().min(1),
  medidas_cm: z.string().trim().min(1),
  valor: z.number().nonnegative(),
  unidad: z.string().trim().min(1),
})

const terminadoSchema = z.object({
  nombre: z.string().trim().min(1),
  rango: z.string().trim().min(1).optional(),
  valor: z.number().nonnegative(),
  unidad: z.string().trim().min(1),
  nota: z.string().trim().min(1).optional(),
  fuente: z.string().trim().min(1).optional(),
})

export const litografiaAiKnowledgeDocumentSchema = z.object({
  moneda: z.string().trim().min(1),
  actualizado: z.string().trim().min(1),
  fuente: z.string().trim().min(1),
  parametros: z.record(z.string(), z.union([z.number(), z.string().trim().min(1)])),
  costos: z.object({
    planchas: z.array(planchaOrImpresionSchema),
    impresion: z.array(planchaOrImpresionSchema),
    papeles: z.array(paperSchema),
    corte_por_pliego: z.array(cutSchema),
    plastificado: z.array(plastificadoSchema),
    terminados: z.array(terminadoSchema),
  }),
  notas: z.array(z.string().trim().min(1)).default([]),
})

const litografiaAiKnowledgeStoreSchema = z.object({
  version: z.literal(1),
  source: z.enum(['default', 'custom']).default('custom'),
  updatedAt: z.string().trim().min(1),
  updatedByUserId: z.string().trim().min(1).nullable(),
  updatedByLabel: z.string().trim().min(1).nullable(),
  document: litografiaAiKnowledgeDocumentSchema,
})

export type LitografiaAiKnowledgeDocument = z.infer<typeof litografiaAiKnowledgeDocumentSchema>
export type LitografiaAiKnowledgeStore = z.infer<typeof litografiaAiKnowledgeStoreSchema>

const defaultDocument = litografiaAiKnowledgeDocumentSchema.parse(defaultLitografiaAiKnowledge)

function getKnowledgeStorePath(empresaId: string) {
  return path.join(process.cwd(), '.runtime-data', 'litografia-ai-knowledge', `${empresaId}.json`)
}

async function ensureKnowledgeStorePath(empresaId: string) {
  const filePath = getKnowledgeStorePath(empresaId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  return filePath
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function rankEntries<T extends Record<string, unknown>>(entries: T[], rawTerms: Array<string | null | undefined>, limit: number) {
  const terms = Array.from(new Set(rawTerms.flatMap((value) => tokenize(value))))
  if (!terms.length) return entries.slice(0, limit)

  const ranked = entries
    .map((entry, index) => {
      const haystack = normalizeText(Object.values(entry).filter((value) => value != null).join(' '))
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
      return { entry, index, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  if (!ranked.length) return entries.slice(0, Math.min(limit, 3))
  return ranked.slice(0, limit).map((item) => item.entry)
}

function filterByTintas<T extends { tintas?: string }>(entries: T[], tintas: number | null | undefined) {
  if (!tintas) return entries
  const filtered = entries.filter((entry) => {
    const text = normalizeText(entry.tintas)
    if (!text) return true
    if (tintas === 4) return text.includes('4') || text.includes('cmyk') || text.includes('policrom')
    return text.includes('1 a 3') || text.includes('mono')
  })
  return filtered.length ? filtered : entries
}

function buildDefaultStore(): LitografiaAiKnowledgeStore {
  return {
    version: 1,
    source: 'default',
    updatedAt: new Date('2026-05-22T00:00:00.000Z').toISOString(),
    updatedByUserId: null,
    updatedByLabel: null,
    document: defaultDocument,
  }
}

export function getDefaultLitografiaAiKnowledge() {
  return defaultDocument
}

export function summarizeLitografiaAiKnowledge(document: LitografiaAiKnowledgeDocument) {
  return {
    reglas: Object.keys(document.parametros).length,
    planchas: document.costos.planchas.length,
    impresion: document.costos.impresion.length,
    papeles: document.costos.papeles.length,
    cortes: document.costos.corte_por_pliego.length,
    plastificados: document.costos.plastificado.length,
    terminados: document.costos.terminados.length,
    notas: document.notas.length,
  }
}

export async function readLitografiaAiKnowledge(empresaId: string) {
  const filePath = await ensureKnowledgeStorePath(empresaId)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = litografiaAiKnowledgeStoreSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return buildDefaultStore()
    return parsed.data
  } catch {
    return buildDefaultStore()
  }
}

export async function writeLitografiaAiKnowledge(args: {
  empresaId: string
  document: LitografiaAiKnowledgeDocument
  source?: 'default' | 'custom'
  updatedByUserId?: string | null
  updatedByLabel?: string | null
}) {
  const store: LitografiaAiKnowledgeStore = {
    version: 1,
    source: args.source || 'custom',
    updatedAt: new Date().toISOString(),
    updatedByUserId: args.updatedByUserId ?? null,
    updatedByLabel: args.updatedByLabel ?? null,
    document: litografiaAiKnowledgeDocumentSchema.parse(args.document),
  }

  const filePath = await ensureKnowledgeStorePath(args.empresaId)
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf8')
  return store
}

export function buildLitografiaKnowledgePromptContext(args: {
  document: LitografiaAiKnowledgeDocument
  brief: string
  extracted?: {
    producto?: string | null
    cantidad?: number | null
    anchoCm?: number | null
    altoCm?: number | null
    paginas?: number | null
    tintas?: 1 | 2 | 4 | null
    material?: string | null
    acabado?: string | null
  }
}) {
  const { document, brief, extracted } = args
  const generalRules = Object.entries(document.parametros).map(([key, value]) => ({ key, value }))

  return {
    metadata: {
      moneda: document.moneda,
      actualizado: document.actualizado,
      fuente: document.fuente,
    },
    parametros: generalRules,
    costosRelevantes: {
      planchas: rankEntries(
        filterByTintas(document.costos.planchas, extracted?.tintas),
        [brief, extracted?.producto, extracted?.material],
        4,
      ),
      impresion: rankEntries(
        filterByTintas(document.costos.impresion, extracted?.tintas),
        [brief, extracted?.producto, extracted?.material],
        4,
      ),
      papeles: rankEntries(document.costos.papeles, [brief, extracted?.material, extracted?.producto], 6),
      plastificado: rankEntries(document.costos.plastificado, [brief, extracted?.acabado, extracted?.producto], 4),
      terminados: rankEntries(document.costos.terminados, [brief, extracted?.acabado, extracted?.producto], 6),
    },
    cortePorPliego: document.costos.corte_por_pliego,
    notas: document.notas.slice(0, 4),
    guardrails: [
      'Usa esta base como apoyo comercial y operativo, no como reemplazo del tarifario exacto configurado en ERP.',
      'Si una tarifa exacta ya viene del ERP, esa tarifa tiene prioridad sobre cualquier costo base o regla general.',
      'Si hay ambiguedad entre varias opciones, devuelve null y formula la pregunta faltante en vez de inventar.',
    ],
  }
}