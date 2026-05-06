import type { CrmOpportunityStage } from '@prisma/client'
import Papa from 'papaparse'
import { normalizeString } from '@/lib/crm'

export type GoogleSheetsImportMode = 'LEADS_ONLY' | 'LEADS_AND_OPPORTUNITIES'

export type GoogleSheetsSettings = {
  spreadsheetId: string
  sheetName: string
  publishedCsvUrl: string
  rowLimit: number
  importMode: GoogleSheetsImportMode
  opportunityStage: CrmOpportunityStage
}

export type GoogleSheetsNormalizedRow = {
  rowNumber: number
  nombre: string
  email: string
  telefono: string
  empresaNombre: string
  ciudad: string
  documento: string
  producto: string
  mensaje: string
  landingPageUrl: string
  sourceCampaign: string
  sourceMedium: string
  sourceContent: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  opportunityTitle: string
  expectedValue: number | null
  probabilityPct: number | null
  expectedCloseAt: Date | null
  raw: Record<string, string>
}

export type GoogleSheetsFetchResult = {
  csvUrl: string
  headers: string[]
  rows: GoogleSheetsNormalizedRow[]
}

const DEFAULT_SETTINGS: GoogleSheetsSettings = {
  spreadsheetId: '',
  sheetName: 'Leads',
  publishedCsvUrl: '',
  rowLimit: 200,
  importMode: 'LEADS_ONLY',
  opportunityStage: 'QUALIFIED',
}

const HEADER_ALIASES = {
  nombre: ['nombre', 'name', 'lead name', 'contacto', 'contact name', 'cliente'],
  email: ['email', 'correo', 'correo electronico', 'mail'],
  telefono: ['telefono', 'teléfono', 'phone', 'celular', 'mobile', 'whatsapp'],
  empresaNombre: ['empresa', 'company', 'negocio', 'business'],
  ciudad: ['ciudad', 'city'],
  documento: ['documento', 'document', 'nit', 'cedula', 'cédula'],
  producto: ['producto', 'product', 'servicio', 'service', 'interes', 'interés'],
  mensaje: ['mensaje', 'message', 'detalle', 'descripcion', 'descripción', 'comentarios', 'notas', 'notes'],
  landingPageUrl: ['landing', 'landing page', 'landing url', 'url', 'landingpageurl'],
  sourceCampaign: ['source campaign', 'campana', 'campaña', 'campaign'],
  sourceMedium: ['source medium', 'medium', 'medio'],
  sourceContent: ['source content', 'content', 'contenido'],
  utmSource: ['utm source', 'utm_source'],
  utmMedium: ['utm medium', 'utm_medium'],
  utmCampaign: ['utm campaign', 'utm_campaign'],
  utmContent: ['utm content', 'utm_content'],
  utmTerm: ['utm term', 'utm_term'],
  opportunityTitle: ['oportunidad', 'opportunity', 'opportunity title', 'titulo oportunidad', 'título oportunidad', 'deal'],
  expectedValue: ['expected value', 'valor esperado', 'monto', 'budget', 'presupuesto'],
  probabilityPct: ['probability', 'probabilidad'],
  expectedCloseAt: ['expected close', 'close date', 'fecha cierre', 'fecha de cierre'],
} satisfies Record<string, string[]>

function normalizeHeader(value: string) {
  return normalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(normalizeString(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parseOpportunityStage(value: unknown): CrmOpportunityStage {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'NEW' || normalized === 'QUALIFIED' || normalized === 'PROPOSAL' || normalized === 'NEGOTIATION' || normalized === 'WON' || normalized === 'LOST') {
    return normalized as CrmOpportunityStage
  }
  return DEFAULT_SETTINGS.opportunityStage
}

function parseImportMode(value: unknown): GoogleSheetsImportMode {
  return normalizeString(value).toUpperCase() === 'LEADS_AND_OPPORTUNITIES' ? 'LEADS_AND_OPPORTUNITIES' : 'LEADS_ONLY'
}

function parseOptionalNumber(value: string) {
  const raw = normalizeString(value)
  if (!raw) return null

  let sanitized = raw.replace(/[^0-9,.-]/g, '')
  const lastComma = sanitized.lastIndexOf(',')
  const lastDot = sanitized.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      sanitized = sanitized.replace(/\./g, '').replace(',', '.')
    } else {
      sanitized = sanitized.replace(/,/g, '')
    }
  } else if (lastComma >= 0) {
    const fractional = sanitized.slice(lastComma + 1)
    sanitized = fractional.length <= 2 ? sanitized.replace(',', '.') : sanitized.replace(/,/g, '')
  }

  const parsed = Number.parseFloat(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalDate(value: string) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getRowValue(row: Record<string, string>, aliases: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeString(value)] as const)
  for (const alias of aliases) {
    const found = normalizedEntries.find(([key]) => key === normalizeHeader(alias))
    if (found?.[1]) return found[1]
  }
  return ''
}

function buildCsvUrl(settings: GoogleSheetsSettings) {
  if (settings.publishedCsvUrl) return settings.publishedCsvUrl
  if (!settings.spreadsheetId) return ''
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(settings.spreadsheetId)}/gviz/tq?tqx=out:csv`
  return settings.sheetName ? `${base}&sheet=${encodeURIComponent(settings.sheetName)}` : base
}

export function getGoogleSheetsSettings(settingsJson: Record<string, unknown> | null | undefined): GoogleSheetsSettings {
  return {
    spreadsheetId: normalizeString(settingsJson?.googleSheetsSpreadsheetId),
    sheetName: normalizeString(settingsJson?.googleSheetsSheetName) || DEFAULT_SETTINGS.sheetName,
    publishedCsvUrl: normalizeString(settingsJson?.googleSheetsPublishedCsvUrl),
    rowLimit: Math.min(parsePositiveInt(settingsJson?.googleSheetsRowLimit, DEFAULT_SETTINGS.rowLimit), 1000),
    importMode: parseImportMode(settingsJson?.googleSheetsImportMode),
    opportunityStage: parseOpportunityStage(settingsJson?.googleSheetsOpportunityStage),
  }
}

export function getGoogleSheetsCsvUrl(settingsJson: Record<string, unknown> | null | undefined) {
  return buildCsvUrl(getGoogleSheetsSettings(settingsJson))
}

export function normalizeGoogleSheetsRow(row: Record<string, string>, rowNumber: number): GoogleSheetsNormalizedRow {
  const producto = getRowValue(row, HEADER_ALIASES.producto)
  const mensaje = getRowValue(row, HEADER_ALIASES.mensaje)
  return {
    rowNumber,
    nombre: getRowValue(row, HEADER_ALIASES.nombre),
    email: getRowValue(row, HEADER_ALIASES.email).toLowerCase(),
    telefono: getRowValue(row, HEADER_ALIASES.telefono),
    empresaNombre: getRowValue(row, HEADER_ALIASES.empresaNombre),
    ciudad: getRowValue(row, HEADER_ALIASES.ciudad),
    documento: getRowValue(row, HEADER_ALIASES.documento),
    producto,
    mensaje: mensaje || (producto ? `Interés detectado desde Google Sheets: ${producto}` : ''),
    landingPageUrl: getRowValue(row, HEADER_ALIASES.landingPageUrl),
    sourceCampaign: getRowValue(row, HEADER_ALIASES.sourceCampaign),
    sourceMedium: getRowValue(row, HEADER_ALIASES.sourceMedium),
    sourceContent: getRowValue(row, HEADER_ALIASES.sourceContent),
    utmSource: getRowValue(row, HEADER_ALIASES.utmSource),
    utmMedium: getRowValue(row, HEADER_ALIASES.utmMedium),
    utmCampaign: getRowValue(row, HEADER_ALIASES.utmCampaign),
    utmContent: getRowValue(row, HEADER_ALIASES.utmContent),
    utmTerm: getRowValue(row, HEADER_ALIASES.utmTerm),
    opportunityTitle: getRowValue(row, HEADER_ALIASES.opportunityTitle) || (producto ? `Oportunidad · ${producto}` : ''),
    expectedValue: parseOptionalNumber(getRowValue(row, HEADER_ALIASES.expectedValue)),
    probabilityPct: parseOptionalNumber(getRowValue(row, HEADER_ALIASES.probabilityPct)),
    expectedCloseAt: parseOptionalDate(getRowValue(row, HEADER_ALIASES.expectedCloseAt)),
    raw: row,
  }
}

export async function fetchGoogleSheetsRows(settingsJson: Record<string, unknown> | null | undefined): Promise<GoogleSheetsFetchResult> {
  const settings = getGoogleSheetsSettings(settingsJson)
  const csvUrl = buildCsvUrl(settings)
  if (!csvUrl) {
    throw new Error('Configura googleSheetsPublishedCsvUrl o googleSheetsSpreadsheetId en el canal.')
  }

  const response = await fetch(csvUrl, {
    headers: { Accept: 'text/csv, text/plain;q=0.9, */*;q=0.1' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`No se pudo leer la hoja (${response.status}). Verifica permisos o URL publicada.`)
  }

  const csvText = await response.text()
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (value) => normalizeString(value),
    transform: (value) => normalizeString(value),
  })

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || 'No se pudo parsear el CSV de Google Sheets.')
  }

  const rows = (parsed.data || [])
    .map((row, index) => normalizeGoogleSheetsRow(row, index + 2))
    .filter((row) => row.nombre || row.email || row.telefono || row.empresaNombre || row.mensaje)

  return {
    csvUrl,
    headers: parsed.meta.fields || [],
    rows,
  }
}

export function buildGoogleSheetsExportCsv(rows: Array<Record<string, unknown>>) {
  return Papa.unparse(rows)
}
