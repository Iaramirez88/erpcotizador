import {
  type ChatbotFlowStage,
  type ChatbotQuickAction,
  normalizeChatbotFlowStages,
  normalizeChatbotQuickActions,
} from '@/lib/crm-chatbot-flow'
import {
  getChatbotStudioSettings,
  getDefaultChatbotAutomationFlowFromSettings,
} from '@/lib/crm-chatbot-studio'
import {
  normalizeChatbotInactivityAction,
  normalizeChatbotInactivityRule,
  normalizeChatbotInactivityUnit,
  toChatbotInactivityMinutes,
  type ChatbotInactivityAction,
  type ChatbotInactivityRule,
  type ChatbotInactivityUnit,
} from '@/lib/crm-chatbot-inactivity'

export type PublicChatbotPreChatFormTemplate = 'sales-support' | 'support-triage' | 'quote-request'
export type PublicChatbotResetConversationUnit = ChatbotInactivityUnit

export type PublicChatbotPreChatDepartmentOption = {
  id: string
  label: string
  value: string
}

export type PublicChatbotPreChatFormPreset = {
  value: PublicChatbotPreChatFormTemplate
  label: string
  title: string
  description: string
  submitLabel: string
  showNameField: boolean
  showEmailField: boolean
  showPhoneField: boolean
  requireName: boolean
  requireEmail: boolean
  requirePhone: boolean
  requireContactMethod: boolean
  showDepartmentField: boolean
  departmentLabel: string
  departmentPlaceholder: string
  departmentOptions: PublicChatbotPreChatDepartmentOption[]
}

const PUBLIC_CHATBOT_PRE_CHAT_FORM_PRESETS: PublicChatbotPreChatFormPreset[] = [
  {
    value: 'sales-support',
    label: 'Ventas y soporte',
    title: 'Bienvenido a nuestro chat',
    description: 'Antes de iniciar la conversación, completa tus datos y elige el área que debe atenderte.',
    submitLabel: 'Iniciar chat',
    showNameField: true,
    showEmailField: true,
    showPhoneField: true,
    requireName: true,
    requireEmail: false,
    requirePhone: false,
    requireContactMethod: true,
    showDepartmentField: true,
    departmentLabel: 'Seleccione un departamento',
    departmentPlaceholder: 'Elige una opción',
    departmentOptions: [
      { id: 'department-sales', label: 'Ventas', value: 'ventas' },
      { id: 'department-support', label: 'Soporte técnico', value: 'soporte-tecnico' },
    ],
  },
  {
    value: 'support-triage',
    label: 'Mesa de soporte',
    title: 'Ayúdanos a enrutar tu caso',
    description: 'Déjanos un medio de contacto y el tipo de ayuda que necesitas para abrir el caso correctamente.',
    submitLabel: 'Abrir chat de soporte',
    showNameField: true,
    showEmailField: true,
    showPhoneField: true,
    requireName: true,
    requireEmail: false,
    requirePhone: false,
    requireContactMethod: true,
    showDepartmentField: true,
    departmentLabel: 'Tipo de soporte',
    departmentPlaceholder: 'Selecciona una categoría',
    departmentOptions: [
      { id: 'support-billing', label: 'Facturación', value: 'facturacion' },
      { id: 'support-technical', label: 'Incidente técnico', value: 'incidente-tecnico' },
      { id: 'support-follow-up', label: 'Seguimiento de caso', value: 'seguimiento' },
    ],
  },
  {
    value: 'quote-request',
    label: 'Solicitud de cotización',
    title: 'Cuéntanos qué necesitas cotizar',
    description: 'Capturamos primero tus datos comerciales y luego te guiamos para tomar los detalles del requerimiento.',
    submitLabel: 'Continuar a la cotización',
    showNameField: true,
    showEmailField: true,
    showPhoneField: true,
    requireName: true,
    requireEmail: false,
    requirePhone: false,
    requireContactMethod: true,
    showDepartmentField: true,
    departmentLabel: 'Tipo de solicitud',
    departmentPlaceholder: 'Selecciona una opción',
    departmentOptions: [
      { id: 'quote-commercial', label: 'Ventas', value: 'ventas' },
      { id: 'quote-design', label: 'Diseño / preprensa', value: 'diseno-preprensa' },
      { id: 'quote-production', label: 'Producción', value: 'produccion' },
    ],
  },
]

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getBooleanSetting(settings: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback
}

function getPositiveIntegerSetting(settings: Record<string, unknown>, key: string, fallback: number) {
  const rawValue = settings[key]
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return Math.max(1, Math.round(rawValue))
  if (typeof rawValue === 'string') {
    const parsed = Number.parseInt(rawValue.trim(), 10)
    if (Number.isFinite(parsed)) return Math.max(1, parsed)
  }
  return fallback
}

function normalizeDepartmentOptions(value: unknown, fallback: PublicChatbotPreChatDepartmentOption[]) {
  const fromArray = Array.isArray(value)
    ? value
      .map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const record = item as Record<string, unknown>
        const label = normalizeString(record.label)
        const optionValue = normalizeString(record.value) || label.toLowerCase().replace(/\s+/g, '-')
        if (!label) return null
        return {
          id: normalizeString(record.id) || `prechat-option-${index + 1}`,
          label,
          value: optionValue,
        } satisfies PublicChatbotPreChatDepartmentOption
      })
      .filter((item): item is PublicChatbotPreChatDepartmentOption => Boolean(item))
    : []

  if (fromArray.length) return fromArray

  if (typeof value === 'string' && value.trim()) {
    const fromText = value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((label, index) => ({
        id: `prechat-option-${index + 1}`,
        label,
        value: label.toLowerCase().replace(/\s+/g, '-'),
      }))

    if (fromText.length) return fromText
  }

  return fallback
}

export function getPublicChatbotPreChatFormPreset(template: unknown): PublicChatbotPreChatFormPreset {
  const selectedTemplate = normalizeString(template) as PublicChatbotPreChatFormTemplate
  return PUBLIC_CHATBOT_PRE_CHAT_FORM_PRESETS.find((item) => item.value === selectedTemplate) ?? PUBLIC_CHATBOT_PRE_CHAT_FORM_PRESETS[0]
}

export function getPublicChatbotPreChatFormPresets() {
  return PUBLIC_CHATBOT_PRE_CHAT_FORM_PRESETS
}

export type PublicChatbotSettings = {
  chatbotTitle: string
  chatbotPrompt: string
  assistantName: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  fontFamily: string
  headerBadgeLabel: string
  statusBadgeLabel: string
  launcherLabel: string
  launcherIcon: string
  launcherPosition: 'right' | 'center' | 'left'
  launcherPlacement: 'fixed' | 'absolute'
  launcherSize: 'compact' | 'standard' | 'large'
  launcherStartsCollapsed: boolean
  launcherOffsetX: string
  launcherOffsetY: string
  launcherZIndex: string
  panelZIndex: string
  backdropZIndex: string
  chatbotCustomCss: string
  floatingLauncherEnabled: boolean
  publicEmbedEnabled: boolean
  allowHumanHandoff: boolean
  showProductField: boolean
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  resetConversationAfterValue: number
  resetConversationAfterUnit: PublicChatbotResetConversationUnit
  resetConversationAfterMinutes: number
  resetConversationAfterAction: ChatbotInactivityAction
  preChatFormEnabled: boolean
  preChatFormInactivityRule: ChatbotInactivityRule
  preChatFormTemplate: PublicChatbotPreChatFormTemplate
  preChatFormTitle: string
  preChatFormDescription: string
  preChatFormSubmitLabel: string
  preChatFormShowNameField: boolean
  preChatFormShowEmailField: boolean
  preChatFormShowPhoneField: boolean
  preChatFormRequireName: boolean
  preChatFormRequireEmail: boolean
  preChatFormRequirePhone: boolean
  preChatFormRequireContactMethod: boolean
  preChatFormShowDepartmentField: boolean
  preChatFormDepartmentLabel: string
  preChatFormDepartmentPlaceholder: string
  preChatFormDepartmentOptions: PublicChatbotPreChatDepartmentOption[]
  termsEnabled: boolean
  termsLabel: string
  termsLinkText: string
  termsLinkUrl: string
  startStageId: string
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  allowedDomains: string[]
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function matchesAllowedHost(host: string, allowedHost: string) {
  if (!allowedHost) return false
  if (host === allowedHost) return true
  return host.endsWith(`.${allowedHost}`)
}

export function getPublicChatbotSettings(settingsJson: unknown): PublicChatbotSettings {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}
  const studioSettings = getChatbotStudioSettings(settings)
  const defaultFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)
  const preChatPreset = getPublicChatbotPreChatFormPreset(settings.preChatFormTemplate)

  const rawAllowedDomains = typeof settings.allowedDomains === 'string' ? settings.allowedDomains : ''
  const allowedDomains = rawAllowedDomains
    .split(/[\n,;]+/)
    .map((value) => normalizeHost(value))
    .filter(Boolean)
  const legacyResetConversationAfterHours = getPositiveIntegerSetting(settings, 'chatResetConversationAfterHours', 12)
  const resetConversationAfterValue = getPositiveIntegerSetting(settings, 'chatResetConversationAfterValue', legacyResetConversationAfterHours)
  const resetConversationAfterUnit = normalizeChatbotInactivityUnit(settings.chatResetConversationAfterUnit)
  const resetConversationAfterMinutes = toChatbotInactivityMinutes(resetConversationAfterValue, resetConversationAfterUnit)
  const resetConversationAfterAction = normalizeChatbotInactivityAction(settings.chatResetConversationAfterAction)
  const preChatFormInactivityRule = normalizeChatbotInactivityRule(settings.preChatFormInactivityRule, {
    enabled: false,
    timeoutValue: resetConversationAfterValue,
    timeoutUnit: resetConversationAfterUnit,
    action: resetConversationAfterAction,
  })

  return {
    chatbotTitle: typeof settings.chatbotTitle === 'string' && settings.chatbotTitle.trim() ? settings.chatbotTitle.trim() : 'Asesor virtual SGDigital',
    chatbotPrompt: typeof settings.chatbotPrompt === 'string' && settings.chatbotPrompt.trim() ? settings.chatbotPrompt.trim() : 'Cuéntanos tu proyecto y te contactamos.',
    assistantName: typeof settings.assistantName === 'string' && settings.assistantName.trim() ? settings.assistantName.trim() : 'Asesor virtual SGDigital',
    accentColor: typeof settings.accentColor === 'string' && settings.accentColor.trim() ? settings.accentColor.trim() : '#1d4ed8',
    pageBackgroundColor: typeof settings.pageBackgroundColor === 'string' && settings.pageBackgroundColor.trim() ? settings.pageBackgroundColor.trim() : '#eef5ff',
    backgroundColor: typeof settings.backgroundColor === 'string' && settings.backgroundColor.trim() ? settings.backgroundColor.trim() : '#f8fbff',
    fontFamily: typeof settings.fontFamily === 'string' && settings.fontFamily.trim() ? settings.fontFamily.trim() : 'ui-sans-serif, system-ui, sans-serif',
    headerBadgeLabel: typeof settings.headerBadgeLabel === 'string' && settings.headerBadgeLabel.trim() ? settings.headerBadgeLabel.trim() : 'Chatbot CRM',
    statusBadgeLabel: typeof settings.statusBadgeLabel === 'string' && settings.statusBadgeLabel.trim() ? settings.statusBadgeLabel.trim() : 'En linea',
    launcherLabel: typeof settings.launcherLabel === 'string' && settings.launcherLabel.trim() ? settings.launcherLabel.trim() : 'Abrir asesor virtual',
    launcherIcon: typeof settings.launcherIcon === 'string' && settings.launcherIcon.trim() ? settings.launcherIcon.trim() : 'Bot',
    launcherPosition: settings.launcherPosition === 'left' ? 'left' : settings.launcherPosition === 'center' ? 'center' : 'right',
    launcherPlacement: settings.launcherPlacement === 'absolute' ? 'absolute' : 'fixed',
    launcherSize: settings.launcherSize === 'compact' ? 'compact' : settings.launcherSize === 'large' ? 'large' : 'standard',
    launcherStartsCollapsed: getBooleanSetting(settings, 'launcherStartsCollapsed', true),
    launcherOffsetX: typeof settings.launcherOffsetX === 'string' && settings.launcherOffsetX.trim() ? settings.launcherOffsetX.trim() : '60',
    launcherOffsetY: typeof settings.launcherOffsetY === 'string' && settings.launcherOffsetY.trim() ? settings.launcherOffsetY.trim() : '60',
    launcherZIndex: typeof settings.launcherZIndex === 'string' && settings.launcherZIndex.trim() ? settings.launcherZIndex.trim() : '2147483647',
    panelZIndex: typeof settings.panelZIndex === 'string' && settings.panelZIndex.trim() ? settings.panelZIndex.trim() : '2147483646',
    backdropZIndex: typeof settings.backdropZIndex === 'string' && settings.backdropZIndex.trim() ? settings.backdropZIndex.trim() : '2147483645',
    chatbotCustomCss: typeof settings.chatbotCustomCss === 'string' ? settings.chatbotCustomCss : '',
    floatingLauncherEnabled: settings.floatingLauncherEnabled !== false,
    publicEmbedEnabled: settings.publicEmbedEnabled !== false,
    allowHumanHandoff: settings.allowHumanHandoff !== false,
    showProductField: settings.showProductField !== false,
    nameLabel: typeof settings.nameLabel === 'string' && settings.nameLabel.trim() ? settings.nameLabel.trim() : 'Nombre',
    namePlaceholder: typeof settings.namePlaceholder === 'string' && settings.namePlaceholder.trim() ? settings.namePlaceholder.trim() : 'Tu nombre',
    emailLabel: typeof settings.emailLabel === 'string' && settings.emailLabel.trim() ? settings.emailLabel.trim() : 'Correo',
    emailPlaceholder: typeof settings.emailPlaceholder === 'string' && settings.emailPlaceholder.trim() ? settings.emailPlaceholder.trim() : 'tu@correo.com',
    phoneLabel: typeof settings.phoneLabel === 'string' && settings.phoneLabel.trim() ? settings.phoneLabel.trim() : 'Teléfono',
    phonePlaceholder: typeof settings.phonePlaceholder === 'string' && settings.phonePlaceholder.trim() ? settings.phonePlaceholder.trim() : 'Tu WhatsApp o teléfono',
    productLabel: typeof settings.productLabel === 'string' && settings.productLabel.trim() ? settings.productLabel.trim() : 'Producto a cotizar',
    productPlaceholder: typeof settings.productPlaceholder === 'string' && settings.productPlaceholder.trim() ? settings.productPlaceholder.trim() : 'Ej: mugs, flyers, etiquetas',
    messageLabel: typeof settings.messageLabel === 'string' && settings.messageLabel.trim() ? settings.messageLabel.trim() : 'Mensaje',
    messagePlaceholder: typeof settings.messagePlaceholder === 'string' && settings.messagePlaceholder.trim() ? settings.messagePlaceholder.trim() : 'Cuéntanos qué necesitas y en qué cantidad.',
    resetConversationAfterValue,
    resetConversationAfterUnit,
    resetConversationAfterMinutes,
    resetConversationAfterAction,
    preChatFormEnabled: getBooleanSetting(settings, 'preChatFormEnabled', false),
    preChatFormInactivityRule,
    preChatFormTemplate: preChatPreset.value,
    preChatFormTitle: normalizeString(settings.preChatFormTitle, preChatPreset.title),
    preChatFormDescription: normalizeString(settings.preChatFormDescription, preChatPreset.description),
    preChatFormSubmitLabel: normalizeString(settings.preChatFormSubmitLabel, preChatPreset.submitLabel),
    preChatFormShowNameField: getBooleanSetting(settings, 'preChatFormShowNameField', preChatPreset.showNameField),
    preChatFormShowEmailField: getBooleanSetting(settings, 'preChatFormShowEmailField', preChatPreset.showEmailField),
    preChatFormShowPhoneField: getBooleanSetting(settings, 'preChatFormShowPhoneField', preChatPreset.showPhoneField),
    preChatFormRequireName: getBooleanSetting(settings, 'preChatFormRequireName', preChatPreset.requireName),
    preChatFormRequireEmail: getBooleanSetting(settings, 'preChatFormRequireEmail', preChatPreset.requireEmail),
    preChatFormRequirePhone: getBooleanSetting(settings, 'preChatFormRequirePhone', preChatPreset.requirePhone),
    preChatFormRequireContactMethod: getBooleanSetting(settings, 'preChatFormRequireContactMethod', preChatPreset.requireContactMethod),
    preChatFormShowDepartmentField: getBooleanSetting(settings, 'preChatFormShowDepartmentField', preChatPreset.showDepartmentField),
    preChatFormDepartmentLabel: normalizeString(settings.preChatFormDepartmentLabel, preChatPreset.departmentLabel),
    preChatFormDepartmentPlaceholder: normalizeString(settings.preChatFormDepartmentPlaceholder, preChatPreset.departmentPlaceholder),
    preChatFormDepartmentOptions: normalizeDepartmentOptions(settings.preChatFormDepartmentOptions, preChatPreset.departmentOptions),
    termsEnabled: getBooleanSetting(settings, 'termsEnabled', false),
    termsLabel: normalizeString(settings.termsLabel, 'Acepto el tratamiento de datos personales.'),
    termsLinkText: normalizeString(settings.termsLinkText, 'Leer términos'),
    termsLinkUrl: normalizeString(settings.termsLinkUrl),
    startStageId: defaultFlow.startStageId,
    quickActions: defaultFlow.quickActions.length
      ? defaultFlow.quickActions
      : normalizeChatbotQuickActions(settings.quickActions),
    flowStages: defaultFlow.flowStages.length
      ? defaultFlow.flowStages
      : normalizeChatbotFlowStages(settings.flowStages),
    allowedDomains,
  }
}

export function extractHostFromUrl(rawValue: string | null | undefined) {
  if (!rawValue) return ''
  try {
    return normalizeHost(new URL(rawValue).host)
  } catch {
    return normalizeHost(rawValue)
  }
}

export function isChatbotDomainAllowed(args: {
  allowedDomains: string[]
  candidateHost?: string | null
  appHost?: string | null
}) {
  const candidateHost = normalizeHost(args.candidateHost || '')
  const appHost = normalizeHost(args.appHost || '')

  if (!args.allowedDomains.length) return true
  if (!candidateHost) return false
  if (appHost && candidateHost === appHost) return true

  return args.allowedDomains.some((allowedHost) => matchesAllowedHost(candidateHost, allowedHost))
}
