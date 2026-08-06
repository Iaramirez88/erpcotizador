import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCommercialPriceMap } from '@/lib/commercial-price-settings'
import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'

export type CrmAddonCode = 'DAILY_CALLS'
export type CrmAddonStatus = 'INACTIVE' | 'CONFIGURING' | 'ACTIVE'
export type CrmAddonConnectionMode = 'SGDIGITAL_MANAGED' | 'CUSTOMER_DAILY'
export type CrmAddonCommercialStatus = 'INTERNAL_TEST' | 'QUOTE_REQUIRED' | 'ACTIVE' | 'SUSPENDED'

export type DailyCallsAddonSettings = {
  connectionMode: CrmAddonConnectionMode
  dailyDomain: string
  roomPrefix: string
  enableRecording: boolean
  defaultCallType: 'video' | 'audio'
  commercialStatus?: CrmAddonCommercialStatus | null
  commercialNotes?: string | null
  commercialActivatedAt?: string | null
  apiKeyEncrypted?: string | null
  validatedDomainName?: string | null
  validationCheckedAt?: string | null
  lastValidationError?: string | null
}

export type CrmAddonChecklistItem = {
  key: string
  label: string
  done: boolean
}

export type CrmAddonState = {
  code: CrmAddonCode
  title: string
  description: string
  enabled: boolean
  status: CrmAddonStatus
  ready: boolean
  commercial: {
    code: string
    status: CrmAddonCommercialStatus
    monthlyPriceCOP: number
    canUseAddon: boolean
    label: string
    notes: string | null
    activatedAt: string | null
  }
  accessPolicy: {
    startCall: string
    joinCall: string
    recordCall: string
  }
  metrics: {
    trailing30Days: {
      startedSessions: number
      completedSessions: number
      failedSessions: number
      totalMinutes: number
    }
  }
  validation: {
    checkedAt: string | null
    ok: boolean
    message: string
    domainName: string | null
  }
  settings: Omit<DailyCallsAddonSettings, 'apiKeyEncrypted'> & { hasApiKey: boolean }
  checklist: CrmAddonChecklistItem[]
}

export type DailyCallsAddonRuntime = {
  addon: CrmAddonState
  settings: DailyCallsAddonSettings
  apiKey: string | null
  domainHost: string | null
}

type DomainEntitlementRow = {
  enabled: boolean
  metadata: Prisma.JsonValue
}

export const CRM_ADDON_CODES: CrmAddonCode[] = ['DAILY_CALLS']

const DAILY_CALLS_DOMAIN = 'CRM_ADDON_DAILY_CALLS'
export const DAILY_CALLS_COMMERCIAL_CODE = 'CRM-CALLS-DAILY'

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

export function getCrmAddonDomain(code: CrmAddonCode) {
  if (code === 'DAILY_CALLS') return DAILY_CALLS_DOMAIN
  return `CRM_ADDON_${code}`
}

export function isCrmAddonCode(value: unknown): value is CrmAddonCode {
  return typeof value === 'string' && CRM_ADDON_CODES.includes(value as CrmAddonCode)
}

export function getDefaultDailyCallsAddonSettings(): DailyCallsAddonSettings {
  return {
    connectionMode: 'SGDIGITAL_MANAGED',
    dailyDomain: '',
    roomPrefix: 'crm-room',
    enableRecording: false,
    defaultCallType: 'video',
    commercialStatus: 'INTERNAL_TEST',
    commercialNotes: null,
    commercialActivatedAt: null,
    apiKeyEncrypted: null,
    validatedDomainName: null,
    validationCheckedAt: null,
    lastValidationError: null,
  }
}

export function parseDailyCallsAddonSettings(value: unknown): DailyCallsAddonSettings {
  const raw = asRecord(value)
  const defaults = getDefaultDailyCallsAddonSettings()
  return {
    connectionMode: raw?.connectionMode === 'CUSTOMER_DAILY' ? 'CUSTOMER_DAILY' : defaults.connectionMode,
    dailyDomain: normalizeString(raw?.dailyDomain),
    roomPrefix: normalizeString(raw?.roomPrefix) || defaults.roomPrefix,
    enableRecording: normalizeBoolean(raw?.enableRecording, defaults.enableRecording),
    defaultCallType: raw?.defaultCallType === 'audio' ? 'audio' : defaults.defaultCallType,
    commercialStatus: raw?.commercialStatus === 'QUOTE_REQUIRED' || raw?.commercialStatus === 'ACTIVE' || raw?.commercialStatus === 'SUSPENDED'
      ? raw.commercialStatus
      : defaults.commercialStatus,
    commercialNotes: normalizeString(raw?.commercialNotes) || null,
    commercialActivatedAt: normalizeString(raw?.commercialActivatedAt) || null,
    apiKeyEncrypted: normalizeString(raw?.apiKeyEncrypted) || null,
    validatedDomainName: normalizeString(raw?.validatedDomainName) || null,
    validationCheckedAt: normalizeString(raw?.validationCheckedAt) || null,
    lastValidationError: normalizeString(raw?.lastValidationError) || null,
  }
}

function getDailyCallsChecklist(args: { enabled: boolean; settings: DailyCallsAddonSettings }) {
  const hasApiKey = Boolean(decryptChannelSecret(args.settings.apiKeyEncrypted))
  return [
    { key: 'addon-enabled', label: 'Addon activado para la empresa', done: args.enabled },
    { key: 'billing-mode', label: 'Modo de conexion definido', done: Boolean(args.settings.connectionMode) },
    { key: 'daily-domain', label: 'Dominio de Daily configurado', done: args.settings.connectionMode === 'SGDIGITAL_MANAGED' || Boolean(args.settings.dailyDomain) },
    { key: 'api-key', label: 'API key resguardada en backend', done: args.settings.connectionMode === 'SGDIGITAL_MANAGED' || hasApiKey },
    { key: 'connection-verified', label: 'Conexion Daily validada contra API', done: Boolean(args.settings.validationCheckedAt && !args.settings.lastValidationError) },
    { key: 'inbox-ui', label: 'UI del inbox lista para boton de llamada', done: true },
    { key: 'room-session', label: 'Endpoint de room y token implementado', done: true },
    { key: 'commercial-activation', label: 'Cobro y activacion comercial definidos', done: args.settings.commercialStatus === 'ACTIVE' || args.settings.commercialStatus === 'INTERNAL_TEST' },
  ]
}

function getCommercialStatusMeta(status: CrmAddonCommercialStatus) {
  if (status === 'ACTIVE') return { label: 'Activo comercialmente', canUseAddon: true }
  if (status === 'INTERNAL_TEST') return { label: 'Prueba interna', canUseAddon: true }
  if (status === 'QUOTE_REQUIRED') return { label: 'Pendiente comercial', canUseAddon: false }
  return { label: 'Suspendido', canUseAddon: false }
}

function getDailyCallsAccessPolicySummary() {
  return {
    startCall: 'Pueden iniciar llamadas el asesor asignado y usuarios administradores o managers de la sede.',
    joinCall: 'La unión al modal sigue la misma política del inicio de llamada para mantener control operativo.',
    recordCall: 'La grabación solo se muestra cuando el addon permite grabar y el usuario es admin o manager de sede.',
  }
}

function parseCallSessionPayload(value: Prisma.JsonValue) {
  const raw = asRecord(value)
  if (!raw || normalizeString(raw.eventType) !== 'DAILY_CALL_SESSION') return null

  const durationSecondsRaw = raw.durationSeconds
  const durationSeconds = typeof durationSecondsRaw === 'number' && Number.isFinite(durationSecondsRaw)
    ? durationSecondsRaw
    : 0

  return {
    sessionEvent: normalizeString(raw.sessionEvent),
    durationSeconds,
  }
}

async function getDailyCallsAddonMetrics(empresaId: string) {
  const trailingWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const rows = await prisma.crmMessage.findMany({
    where: {
      empresaId,
      direction: 'SYSTEM',
      messageType: 'EVENT',
      occurredAt: { gte: trailingWindow },
    },
    select: {
      payloadJson: true,
    },
  })

  let startedSessions = 0
  let completedSessions = 0
  let failedSessions = 0
  let totalSeconds = 0

  for (const row of rows) {
    const payload = parseCallSessionPayload(row.payloadJson)
    if (!payload) continue
    if (payload.sessionEvent === 'JOINED') startedSessions += 1
    if (payload.sessionEvent === 'LEFT') {
      completedSessions += 1
      totalSeconds += payload.durationSeconds
    }
    if (payload.sessionEvent === 'FAILED') failedSessions += 1
  }

  return {
    trailing30Days: {
      startedSessions,
      completedSessions,
      failedSessions,
      totalMinutes: Math.round((totalSeconds / 60) * 10) / 10,
    },
  }
}

function getManagedDailyCredentials() {
  const apiKey = normalizeString(process.env.SGDIGITAL_DAILY_API_KEY)
  const dailyDomain = normalizeString(process.env.SGDIGITAL_DAILY_DOMAIN)
  return {
    apiKey,
    dailyDomain,
  }
}

function getDailyCredentials(settings: DailyCallsAddonSettings) {
  if (settings.connectionMode === 'SGDIGITAL_MANAGED') {
    const managed = getManagedDailyCredentials()
    return {
      apiKey: managed.apiKey,
      dailyDomain: managed.dailyDomain,
    }
  }

  return {
    apiKey: decryptChannelSecret(settings.apiKeyEncrypted),
    dailyDomain: settings.dailyDomain,
  }
}

export function resolveDailyDomainHost(domainName: string) {
  const clean = normalizeString(domainName).replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!clean) return null
  return clean.includes('.') ? clean : `${clean}.daily.co`
}

export async function validateDailyCallsAddonSettings(settings: DailyCallsAddonSettings) {
  const credentials = getDailyCredentials(settings)

  if (!credentials.apiKey) {
    return {
      ok: false,
      message: settings.connectionMode === 'SGDIGITAL_MANAGED'
        ? 'Falta configurar SGDIGITAL_DAILY_API_KEY en el servidor.'
        : 'Falta guardar la API key de Daily para esta empresa.',
      domainName: null,
    }
  }

  const response = await fetch('https://api.daily.co/v1/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null) as { domain_name?: string; error?: string; info?: string } | null
  if (!response.ok) {
    return {
      ok: false,
      message: json?.info || json?.error || `Daily respondio con ${response.status}.`,
      domainName: null,
    }
  }

  const resolvedDomainName = normalizeString(json?.domain_name)
  if (credentials.dailyDomain && resolvedDomainName && credentials.dailyDomain !== resolvedDomainName && credentials.dailyDomain !== `${resolvedDomainName}.daily.co`) {
    return {
      ok: false,
      message: `La API key pertenece al dominio ${resolvedDomainName}, pero en la configuracion quedo ${credentials.dailyDomain}.`,
      domainName: resolvedDomainName,
    }
  }

  return {
    ok: true,
    message: `Conexion valida con el dominio ${resolvedDomainName || credentials.dailyDomain || 'Daily'}.`,
    domainName: resolvedDomainName || credentials.dailyDomain || null,
  }
}

function buildDailyCallsAddonState(row: DomainEntitlementRow | null, args?: { metrics?: CrmAddonState['metrics']; monthlyPriceCOP?: number }): CrmAddonState {
  const enabled = row?.enabled === true
  const settings = parseDailyCallsAddonSettings(row?.metadata)
  const hasApiKey = Boolean(decryptChannelSecret(settings.apiKeyEncrypted))
  const connectionConfigured = settings.connectionMode === 'SGDIGITAL_MANAGED' || (Boolean(settings.dailyDomain) && hasApiKey)
  const validationOk = Boolean(settings.validationCheckedAt && !settings.lastValidationError)
  const ready = enabled && connectionConfigured && validationOk
  const status: CrmAddonStatus = !enabled ? 'INACTIVE' : ready ? 'ACTIVE' : 'CONFIGURING'
  const commercialMeta = getCommercialStatusMeta(settings.commercialStatus || 'INTERNAL_TEST')

  return {
    code: 'DAILY_CALLS',
    title: 'Videollamadas Daily',
    description: 'Activa llamadas y videollamadas dentro del CRM como un addon independiente del inbox base.',
    enabled,
    status,
    ready,
    commercial: {
      code: DAILY_CALLS_COMMERCIAL_CODE,
      status: settings.commercialStatus || 'INTERNAL_TEST',
      monthlyPriceCOP: args?.monthlyPriceCOP ?? 189000,
      canUseAddon: commercialMeta.canUseAddon,
      label: commercialMeta.label,
      notes: settings.commercialNotes || null,
      activatedAt: settings.commercialActivatedAt || null,
    },
    accessPolicy: getDailyCallsAccessPolicySummary(),
    metrics: args?.metrics || {
      trailing30Days: {
        startedSessions: 0,
        completedSessions: 0,
        failedSessions: 0,
        totalMinutes: 0,
      },
    },
    validation: {
      checkedAt: settings.validationCheckedAt || null,
      ok: validationOk,
      message: settings.lastValidationError || (settings.validationCheckedAt ? 'Conexion Daily validada correctamente.' : 'Aun no se ha validado la conexion contra Daily.'),
      domainName: settings.validatedDomainName || null,
    },
    settings: {
      connectionMode: settings.connectionMode,
      dailyDomain: settings.dailyDomain,
      roomPrefix: settings.roomPrefix,
      enableRecording: settings.enableRecording,
      defaultCallType: settings.defaultCallType,
      hasApiKey,
      validatedDomainName: settings.validatedDomainName || null,
      validationCheckedAt: settings.validationCheckedAt || null,
      lastValidationError: settings.lastValidationError || null,
    },
    checklist: getDailyCallsChecklist({ enabled, settings }),
  }
}

export async function listCrmAddonsForEmpresa(empresaId: string): Promise<CrmAddonState[]> {
  const [rows, metrics, commercialPriceMap] = await Promise.all([
    prisma.domainEntitlement.findMany({
      where: {
        empresaId,
        domain: { in: [getCrmAddonDomain('DAILY_CALLS')] },
      },
      select: {
        domain: true,
        enabled: true,
        metadata: true,
      },
    }),
    getDailyCallsAddonMetrics(empresaId),
    getCommercialPriceMap(),
  ])

  const byDomain = new Map(rows.map((row) => [row.domain, { enabled: row.enabled, metadata: row.metadata }]))

  return [
    buildDailyCallsAddonState(byDomain.get(getCrmAddonDomain('DAILY_CALLS')) ?? null, {
      metrics,
      monthlyPriceCOP: commercialPriceMap[DAILY_CALLS_COMMERCIAL_CODE] ?? 189000,
    }),
  ]
}

export async function getCrmAddonForEmpresa(args: { empresaId: string; code: CrmAddonCode }): Promise<CrmAddonState> {
  const [row, metrics, commercialPriceMap] = await Promise.all([
    prisma.domainEntitlement.findUnique({
      where: {
        empresaId_domain: {
          empresaId: args.empresaId,
          domain: getCrmAddonDomain(args.code),
        },
      },
      select: {
        enabled: true,
        metadata: true,
      },
    }),
    getDailyCallsAddonMetrics(args.empresaId),
    getCommercialPriceMap(),
  ])

  return buildDailyCallsAddonState(row, {
    metrics,
    monthlyPriceCOP: commercialPriceMap[DAILY_CALLS_COMMERCIAL_CODE] ?? 189000,
  })
}

export async function getDailyCallsAddonRuntimeForEmpresa(empresaId: string): Promise<DailyCallsAddonRuntime> {
  const row = await prisma.domainEntitlement.findUnique({
    where: {
      empresaId_domain: {
        empresaId,
        domain: getCrmAddonDomain('DAILY_CALLS'),
      },
    },
    select: {
      enabled: true,
      metadata: true,
    },
  })

  const settings = parseDailyCallsAddonSettings(row?.metadata)
  const credentials = getDailyCredentials(settings)
  const addon = buildDailyCallsAddonState(row)

  return {
    addon,
    settings,
    apiKey: credentials.apiKey || null,
    domainHost: resolveDailyDomainHost(settings.validatedDomainName || credentials.dailyDomain || settings.dailyDomain),
  }
}

export async function saveDailyCallsAddonForEmpresa(args: {
  empresaId: string
  enabled: boolean
  connectionMode: CrmAddonConnectionMode
  dailyDomain?: string
  roomPrefix?: string
  enableRecording?: boolean
  defaultCallType?: 'video' | 'audio'
  commercialStatus?: CrmAddonCommercialStatus
  commercialNotes?: string
  apiKey?: string
}): Promise<CrmAddonState> {
  const current = await prisma.domainEntitlement.findUnique({
    where: {
      empresaId_domain: {
        empresaId: args.empresaId,
        domain: getCrmAddonDomain('DAILY_CALLS'),
      },
    },
    select: {
      metadata: true,
    },
  })

  const merged = parseDailyCallsAddonSettings(current?.metadata)
  merged.connectionMode = args.connectionMode
  merged.dailyDomain = typeof args.dailyDomain === 'string' ? args.dailyDomain.trim() : merged.dailyDomain
  merged.roomPrefix = typeof args.roomPrefix === 'string' && args.roomPrefix.trim() ? args.roomPrefix.trim() : merged.roomPrefix
  if (typeof args.enableRecording === 'boolean') merged.enableRecording = args.enableRecording
  if (args.defaultCallType === 'audio' || args.defaultCallType === 'video') merged.defaultCallType = args.defaultCallType
  if (args.commercialStatus === 'INTERNAL_TEST' || args.commercialStatus === 'QUOTE_REQUIRED' || args.commercialStatus === 'ACTIVE' || args.commercialStatus === 'SUSPENDED') {
    merged.commercialStatus = args.commercialStatus
    merged.commercialActivatedAt = args.commercialStatus === 'ACTIVE' && !merged.commercialActivatedAt ? new Date().toISOString() : args.commercialStatus === 'ACTIVE' ? merged.commercialActivatedAt : null
  }
  if (typeof args.commercialNotes === 'string') merged.commercialNotes = args.commercialNotes.trim() || null
  if (typeof args.apiKey === 'string') {
    merged.apiKeyEncrypted = args.apiKey.trim() ? encryptChannelSecret(args.apiKey.trim()) : null
    merged.validationCheckedAt = null
    merged.lastValidationError = null
    merged.validatedDomainName = null
  }
  if (typeof args.dailyDomain === 'string') {
    merged.validationCheckedAt = null
    merged.lastValidationError = null
    merged.validatedDomainName = null
  }

  await prisma.domainEntitlement.upsert({
    where: {
      empresaId_domain: {
        empresaId: args.empresaId,
        domain: getCrmAddonDomain('DAILY_CALLS'),
      },
    },
    create: {
      empresaId: args.empresaId,
      domain: getCrmAddonDomain('DAILY_CALLS'),
      enabled: args.enabled,
      metadata: merged as Prisma.InputJsonValue,
    },
    update: {
      enabled: args.enabled,
      metadata: merged as Prisma.InputJsonValue,
    },
  })

  return getCrmAddonForEmpresa({ empresaId: args.empresaId, code: 'DAILY_CALLS' })
}

export async function validateAndPersistDailyCallsAddonForEmpresa(empresaId: string): Promise<CrmAddonState> {
  const row = await prisma.domainEntitlement.findUnique({
    where: {
      empresaId_domain: {
        empresaId,
        domain: getCrmAddonDomain('DAILY_CALLS'),
      },
    },
    select: {
      enabled: true,
      metadata: true,
    },
  })

  const settings = parseDailyCallsAddonSettings(row?.metadata)
  const validation = await validateDailyCallsAddonSettings(settings)
  const nextSettings = {
    ...settings,
    validatedDomainName: validation.domainName,
    validationCheckedAt: new Date().toISOString(),
    lastValidationError: validation.ok ? null : validation.message,
  }

  await prisma.domainEntitlement.upsert({
    where: {
      empresaId_domain: {
        empresaId,
        domain: getCrmAddonDomain('DAILY_CALLS'),
      },
    },
    create: {
      empresaId,
      domain: getCrmAddonDomain('DAILY_CALLS'),
      enabled: row?.enabled === true,
      metadata: nextSettings as Prisma.InputJsonValue,
    },
    update: {
      metadata: nextSettings as Prisma.InputJsonValue,
    },
  })

  return getCrmAddonForEmpresa({ empresaId, code: 'DAILY_CALLS' })
}