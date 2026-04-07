import { escapeHtml, renderEmail } from '@/lib/email-template'

export type WebsiteServiceReminderDueKind = 'DOMAIN' | 'HOSTING'

export type WebsiteServiceReminderDueItem = {
  kind: WebsiteServiceReminderDueKind
  dueAt: Date
  daysUntil: number
}

export type WebsiteServiceReminderSettings = {
  daysBefore: number
  emailSubjectTemplate: string
  emailBodyTemplate: string
  whatsappTemplate: string
  isEmailEnabled: boolean
  isWhatsAppEnabled: boolean
}

export type WebsiteServiceMessageTemplate = WebsiteServiceReminderSettings & {
  id: string
  nombre: string
  descripcion: string | null
  serviceKind: string
  triggerKind: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type WebsiteServiceReminderService = {
  nombre: string
  websiteUrl: string | null
  domainName: string | null
  hostedAt: string | null
  domainExpiresAt: Date | null
  hostingExpiresAt: Date | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
}

export const WEBSITE_SERVICE_REMINDER_VARIABLES = [
  '{{empresa_nombre}}',
  '{{servicio_nombre}}',
  '{{contacto_nombre}}',
  '{{contacto_email}}',
  '{{contacto_telefono}}',
  '{{website_url}}',
  '{{domain_name}}',
  '{{hosted_at}}',
  '{{dias_restantes}}',
  '{{componentes_por_vencer}}',
  '{{componentes_detalle}}',
  '{{fechas_vencimiento}}',
] as const

export const DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS: WebsiteServiceReminderSettings = {
  daysBefore: 30,
  emailSubjectTemplate: 'Tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días',
  emailBodyTemplate: [
    'Hola {{contacto_nombre}},',
    '',
    'Te recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.',
    '',
    'Componentes por vencer:',
    '{{componentes_detalle}}',
    '',
    'Fechas de vencimiento: {{fechas_vencimiento}}.',
    '',
    'Si deseas renovarlo, responde este mensaje y con gusto te ayudamos.',
    '',
    'Equipo {{empresa_nombre}}',
  ].join('\n'),
  whatsappTemplate: [
    'Hola {{contacto_nombre}}, te recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.',
    'Componentes por vencer: {{componentes_por_vencer}}.',
    '{{componentes_detalle}}',
    'Fechas: {{fechas_vencimiento}}.',
    'Si deseas renovarlo, respóndenos por este medio.',
    'Equipo {{empresa_nombre}}',
  ].join('\n'),
  isEmailEnabled: true,
  isWhatsAppEnabled: true,
}

export const DEFAULT_WEBSITE_SERVICE_TEMPLATE_META = {
  nombre: 'Recordatorio 30 días · servicios web',
  descripcion: 'Plantilla predeterminada para avisos automáticos de vencimiento de dominio y hosting.',
  serviceKind: 'WEBSITE_SERVICE',
  triggerKind: 'EXPIRATION_REMINDER',
  isActive: true,
  isDefault: true,
} as const

function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function mergeWebsiteServiceReminderSettings(input: Partial<WebsiteServiceReminderSettings> | null | undefined): WebsiteServiceReminderSettings {
  return {
    daysBefore: asInteger(input?.daysBefore, DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.daysBefore),
    emailSubjectTemplate:
      normalizeString(input?.emailSubjectTemplate) ?? DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.emailSubjectTemplate,
    emailBodyTemplate:
      normalizeString(input?.emailBodyTemplate) ?? DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.emailBodyTemplate,
    whatsappTemplate:
      normalizeString(input?.whatsappTemplate) ?? DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.whatsappTemplate,
    isEmailEnabled: asBoolean(input?.isEmailEnabled, DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.isEmailEnabled),
    isWhatsAppEnabled: asBoolean(input?.isWhatsAppEnabled, DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS.isWhatsAppEnabled),
  }
}

export function serializeWebsiteServiceMessageTemplate(
  template: {
    id: string
    nombre: string
    descripcion: string | null
    serviceKind: string
    triggerKind: string
    daysBefore: number
    emailSubjectTemplate: string
    emailBodyTemplate: string
    whatsappTemplate: string
    isEmailEnabled: boolean
    isWhatsAppEnabled: boolean
    isActive: boolean
    isDefault: boolean
    createdAt: Date
    updatedAt: Date
  }
): WebsiteServiceMessageTemplate {
  return {
    id: template.id,
    nombre: template.nombre,
    descripcion: template.descripcion,
    serviceKind: template.serviceKind,
    triggerKind: template.triggerKind,
    daysBefore: template.daysBefore,
    emailSubjectTemplate: template.emailSubjectTemplate,
    emailBodyTemplate: template.emailBodyTemplate,
    whatsappTemplate: template.whatsappTemplate,
    isEmailEnabled: template.isEmailEnabled,
    isWhatsAppEnabled: template.isWhatsAppEnabled,
    isActive: template.isActive,
    isDefault: template.isDefault,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}

export function mergeWebsiteServiceMessageTemplate(input: {
  nombre?: unknown
  descripcion?: unknown
  serviceKind?: unknown
  triggerKind?: unknown
  daysBefore?: unknown
  emailSubjectTemplate?: unknown
  emailBodyTemplate?: unknown
  whatsappTemplate?: unknown
  isEmailEnabled?: unknown
  isWhatsAppEnabled?: unknown
  isActive?: unknown
  isDefault?: unknown
} | null | undefined) {
  const settings = mergeWebsiteServiceReminderSettings({
    daysBefore: typeof input?.daysBefore === 'number' || typeof input?.daysBefore === 'string' ? Number(input.daysBefore) : undefined,
    emailSubjectTemplate: typeof input?.emailSubjectTemplate === 'string' ? input.emailSubjectTemplate : undefined,
    emailBodyTemplate: typeof input?.emailBodyTemplate === 'string' ? input.emailBodyTemplate : undefined,
    whatsappTemplate: typeof input?.whatsappTemplate === 'string' ? input.whatsappTemplate : undefined,
    isEmailEnabled: typeof input?.isEmailEnabled === 'boolean' ? input.isEmailEnabled : undefined,
    isWhatsAppEnabled: typeof input?.isWhatsAppEnabled === 'boolean' ? input.isWhatsAppEnabled : undefined,
  })

  return {
    nombre: normalizeString(input?.nombre) ?? DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.nombre,
    descripcion: normalizeString(input?.descripcion),
    serviceKind: normalizeString(input?.serviceKind) ?? DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.serviceKind,
    triggerKind: normalizeString(input?.triggerKind) ?? DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.triggerKind,
    daysBefore: settings.daysBefore,
    emailSubjectTemplate: settings.emailSubjectTemplate,
    emailBodyTemplate: settings.emailBodyTemplate,
    whatsappTemplate: settings.whatsappTemplate,
    isEmailEnabled: settings.isEmailEnabled,
    isWhatsAppEnabled: settings.isWhatsAppEnabled,
    isActive: asBoolean(input?.isActive, DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.isActive),
    isDefault: asBoolean(input?.isDefault, DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.isDefault),
  }
}

function dateOnlyUTC(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function getDaysUntilUtc(date: Date, now = new Date()) {
  const diffMs = dateOnlyUTC(date) - dateOnlyUTC(now)
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

export function getWebsiteServiceDueItemsAtThreshold(
  service: Pick<WebsiteServiceReminderService, 'domainExpiresAt' | 'hostingExpiresAt'>,
  now: Date,
  daysBefore: number
) {
  const dueItems: WebsiteServiceReminderDueItem[] = []

  if (service.domainExpiresAt) {
    const daysUntil = getDaysUntilUtc(service.domainExpiresAt, now)
    if (daysUntil === daysBefore) {
      dueItems.push({ kind: 'DOMAIN', dueAt: service.domainExpiresAt, daysUntil })
    }
  }

  if (service.hostingExpiresAt) {
    const daysUntil = getDaysUntilUtc(service.hostingExpiresAt, now)
    if (daysUntil === daysBefore) {
      dueItems.push({ kind: 'HOSTING', dueAt: service.hostingExpiresAt, daysUntil })
    }
  }

  return dueItems
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function kindLabel(kind: WebsiteServiceReminderDueKind) {
  return kind === 'DOMAIN' ? 'dominio' : 'hosting'
}

function buildComponentsLabel(items: WebsiteServiceReminderDueItem[]) {
  const labels = items.map((item) => kindLabel(item.kind))
  if (labels.length <= 1) return labels[0] ?? 'servicio'
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

function buildComponentsDetail(service: WebsiteServiceReminderService, items: WebsiteServiceReminderDueItem[]) {
  return items
    .map((item) => {
      if (item.kind === 'DOMAIN') {
        const reference = service.domainName || service.websiteUrl || service.nombre
        return `- Dominio: ${reference} · vence ${formatDate(item.dueAt)}`
      }
      return `- Hosting: ${service.hostedAt || service.websiteUrl || service.nombre} · vence ${formatDate(item.dueAt)}`
    })
    .join('\n')
}

function buildVariables(args: {
  empresaNombre: string
  service: WebsiteServiceReminderService
  dueItems: WebsiteServiceReminderDueItem[]
  daysBefore: number
}) {
  const { empresaNombre, service, dueItems, daysBefore } = args

  return {
    empresa_nombre: empresaNombre,
    servicio_nombre: service.nombre,
    contacto_nombre: service.contactName || 'cliente',
    contacto_email: service.contactEmail || '',
    contacto_telefono: service.contactPhone || '',
    website_url: service.websiteUrl || '',
    domain_name: service.domainName || '',
    hosted_at: service.hostedAt || '',
    dias_restantes: String(daysBefore),
    componentes_por_vencer: buildComponentsLabel(dueItems),
    componentes_detalle: buildComponentsDetail(service, dueItems),
    fechas_vencimiento: dueItems.map((item) => formatDate(item.dueAt)).join(', '),
  }
}

export function renderReminderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '')
}

function plainTextToHtml(value: string) {
  return escapeHtml(value).replaceAll('\n', '<br />')
}

export function buildWebsiteServiceReminderEmail(args: {
  empresaNombre: string
  service: WebsiteServiceReminderService
  dueItems: WebsiteServiceReminderDueItem[]
  settings: WebsiteServiceReminderSettings
}) {
  const variables = buildVariables({
    empresaNombre: args.empresaNombre,
    service: args.service,
    dueItems: args.dueItems,
    daysBefore: args.settings.daysBefore,
  })

  const subject = renderReminderTemplate(args.settings.emailSubjectTemplate, variables)
  const bodyText = renderReminderTemplate(args.settings.emailBodyTemplate, variables)
  const html = renderEmail({
    title: subject,
    preheader: `${args.service.nombre} vence en ${args.settings.daysBefore} días.`,
    bodyHtml: `<div style="white-space:normal;">${plainTextToHtml(bodyText)}</div>`,
    footerNote: `Servicio: ${args.service.nombre}`,
  })

  return { subject, html }
}

export function buildWebsiteServiceReminderWhatsappMessage(args: {
  empresaNombre: string
  service: WebsiteServiceReminderService
  dueItems: WebsiteServiceReminderDueItem[]
  settings: WebsiteServiceReminderSettings
}) {
  const variables = buildVariables({
    empresaNombre: args.empresaNombre,
    service: args.service,
    dueItems: args.dueItems,
    daysBefore: args.settings.daysBefore,
  })

  return renderReminderTemplate(args.settings.whatsappTemplate, variables)
}

export function normalizeReminderPhone(raw: string) {
  return raw.trim()
}