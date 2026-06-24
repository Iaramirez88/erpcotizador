import {
  getDefaultChatbotFlowStages,
  getDefaultChatbotQuickActions,
  normalizeChatbotFlowStages,
  normalizeChatbotQuickActions,
  type ChatbotFlowStage,
  type ChatbotQuickAction,
} from '@/lib/crm-chatbot-flow'

export type ChatbotFlowTriggerEvent = 'message' | 'quick_action' | 'response_option' | 'human_request' | 'lead_qualified'
export type ChatbotFlowTriggerMatchMode = 'contains' | 'exact'
export type ChatbotFlowVariableSource = 'contact_name' | 'contact_email' | 'contact_phone' | 'contact_whatsapp' | 'product' | 'quantity' | 'company' | 'document' | 'city' | 'address' | 'channel_name' | 'assistant_name' | 'static'
export type ChatbotAssignmentMode = 'channel-owner' | 'default-user' | 'handoff-user'
export type ChatbotMessageTone = 'consultivo' | 'directo' | 'amable'
export type ChatbotAutomationProvider = 'WEB_CHATBOT' | 'WHATSAPP_CLOUD' | 'INSTAGRAM_DM' | 'FACEBOOK_PAGE' | 'MESSENGER'
export type ChatbotStudioNodeLayout = Record<string, { x: number; y: number }>

export type ChatbotStudioPauseNode = {
  id: string
  title: string
  description: string
  durationMinutes: number
  sourceStageId: string
  targetStageId: string
  enabled: boolean
}

export type ChatbotStudioViewport = {
  x: number
  y: number
  scale: number
}

export type ChatbotFlowTrigger = {
  id: string
  label: string
  event: ChatbotFlowTriggerEvent
  matchMode: ChatbotFlowTriggerMatchMode
  matchValue: string
  targetStageId: string
  assistantReply: string
  enabled: boolean
}

export type ChatbotAutomationFlow = {
  id: string
  name: string
  description: string
  enabled: boolean
  isDefault: boolean
  providers: ChatbotAutomationProvider[]
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  flowTriggers: ChatbotFlowTrigger[]
  pauseNodes: ChatbotStudioPauseNode[]
  studioNodeLayout: ChatbotStudioNodeLayout
  studioViewport: ChatbotStudioViewport
}

export type ChatbotFlowVariable = {
  id: string
  key: string
  label: string
  source: ChatbotFlowVariableSource
  fallback: string
  staticValue: string
  description: string
  enabled: boolean
}

export type ChatbotAssignmentRules = {
  assignmentMode: ChatbotAssignmentMode
  defaultAssignedUserId: string
  handoffAssignedUserId: string
  qualifiedAssignedUserId: string
}

export type ChatbotMessageCoherence = {
  tone: ChatbotMessageTone
  greetingTemplate: string
  closingTemplate: string
  styleNotes: string
  forbiddenTerms: string
  requiredTerms: string
}

export type ChatbotStudioSettings = {
  automationFlows: ChatbotAutomationFlow[]
  defaultFlowId: string
  flowTriggers: ChatbotFlowTrigger[]
  flowVariables: ChatbotFlowVariable[]
  assignmentRules: ChatbotAssignmentRules
  messageCoherence: ChatbotMessageCoherence
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function isTriggerEvent(value: unknown): value is ChatbotFlowTriggerEvent {
  return value === 'message' || value === 'quick_action' || value === 'response_option' || value === 'human_request' || value === 'lead_qualified'
}

function isMatchMode(value: unknown): value is ChatbotFlowTriggerMatchMode {
  return value === 'contains' || value === 'exact'
}

function isVariableSource(value: unknown): value is ChatbotFlowVariableSource {
  return value === 'contact_name'
    || value === 'contact_email'
    || value === 'contact_phone'
    || value === 'contact_whatsapp'
    || value === 'product'
    || value === 'quantity'
    || value === 'company'
    || value === 'document'
    || value === 'city'
    || value === 'address'
    || value === 'channel_name'
    || value === 'assistant_name'
    || value === 'static'
}

function isAssignmentMode(value: unknown): value is ChatbotAssignmentMode {
  return value === 'channel-owner' || value === 'default-user' || value === 'handoff-user'
}

function isMessageTone(value: unknown): value is ChatbotMessageTone {
  return value === 'consultivo' || value === 'directo' || value === 'amable'
}

function isAutomationProvider(value: unknown): value is ChatbotAutomationProvider {
  return value === 'WEB_CHATBOT' || value === 'WHATSAPP_CLOUD' || value === 'INSTAGRAM_DM' || value === 'FACEBOOK_PAGE' || value === 'MESSENGER'
}

function normalizeStudioNodeLayout(value: unknown): ChatbotStudioNodeLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => {
        const record = asRecord(item)
        if (!record) return null
        const x = typeof record.x === 'number' ? record.x : null
        const y = typeof record.y === 'number' ? record.y : null
        if (x === null || y === null) return null
        return [key, { x, y }] as const
      })
      .filter((item): item is readonly [string, { x: number; y: number }] => Boolean(item)),
  )
}

function normalizeStudioViewport(value: unknown): ChatbotStudioViewport {
  const record = asRecord(value)
  return {
    x: typeof record?.x === 'number' ? record.x : 48,
    y: typeof record?.y === 'number' ? record.y : 36,
    scale: typeof record?.scale === 'number' ? Math.min(1.6, Math.max(0.45, record.scale)) : 0.88,
  }
}

export function getDefaultChatbotFlowTriggers(): ChatbotFlowTrigger[] {
  return [
    {
      id: 'human-request',
      label: 'Escalar cuando el visitante pida asesor',
      event: 'human_request',
      matchMode: 'contains',
      matchValue: 'asesor, humano, agente, ejecutivo, vendedor',
      targetStageId: 'handoff',
      assistantReply: 'Claro. Voy a dejar esta conversación lista para que continúe un asesor humano.',
      enabled: true,
    },
    {
      id: 'qualified-lead',
      label: 'Mover a cierre comercial cuando ya haya datos clave',
      event: 'lead_qualified',
      matchMode: 'contains',
      matchValue: 'qualified',
      targetStageId: 'handoff',
      assistantReply: 'Perfecto. Ya tengo el contexto suficiente para que el equipo comercial continúe contigo.',
      enabled: true,
    },
  ]
}

export function getDefaultChatbotAutomationProviders(): ChatbotAutomationProvider[] {
  return ['WEB_CHATBOT']
}

export function getDefaultChatbotAutomationFlow(): ChatbotAutomationFlow {
  return {
    id: 'flow-default',
    name: 'Flujo principal',
    description: 'Journey principal para chatbot y respuestas automáticas.',
    enabled: true,
    isDefault: true,
    providers: getDefaultChatbotAutomationProviders(),
    quickActions: getDefaultChatbotQuickActions(),
    flowStages: getDefaultChatbotFlowStages(),
    flowTriggers: getDefaultChatbotFlowTriggers(),
    pauseNodes: [],
    studioNodeLayout: {},
    studioViewport: { x: 48, y: 36, scale: 0.88 },
  }
}

export function getEmptyChatbotAutomationFlow(): ChatbotAutomationFlow {
  return {
    id: 'flow-empty',
    name: 'Flujo vacío',
    description: 'Comienza desde cero y agrega tus propios bloques.',
    enabled: true,
    isDefault: true,
    providers: getDefaultChatbotAutomationProviders(),
    quickActions: [],
    flowStages: [],
    flowTriggers: [],
    pauseNodes: [],
    studioNodeLayout: {},
    studioViewport: { x: 48, y: 36, scale: 0.88 },
  }
}

export function normalizeChatbotStudioPauseNodes(value: unknown): ChatbotStudioPauseNode[] {
  const items = Array.isArray(value) ? value : []
  return items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      const durationMinutes = typeof record.durationMinutes === 'number' ? Math.max(1, Math.round(record.durationMinutes)) : 60
      return {
        id: normalizeString(record.id),
        title: normalizeString(record.title) || 'Pausa',
        description: asText(record.description),
        durationMinutes,
        sourceStageId: normalizeString(record.sourceStageId),
        targetStageId: normalizeString(record.targetStageId),
        enabled: asBoolean(record.enabled, true),
      } satisfies ChatbotStudioPauseNode
    })
    .filter((item): item is ChatbotStudioPauseNode => Boolean(item?.id))
}

export function getDefaultChatbotFlowVariables(): ChatbotFlowVariable[] {
  return [
    {
      id: 'var-contact-name',
      key: 'contact_name',
      label: 'Nombre del contacto',
      source: 'contact_name',
      fallback: 'cliente',
      staticValue: '',
      description: 'Usa el nombre detectado o capturado en la conversación.',
      enabled: true,
    },
    {
      id: 'var-product',
      key: 'product_name',
      label: 'Producto consultado',
      source: 'product',
      fallback: 'tu producto',
      staticValue: '',
      description: 'Inserta el producto o servicio consultado por el visitante.',
      enabled: true,
    },
    {
      id: 'var-assistant',
      key: 'assistant_name',
      label: 'Nombre del asistente',
      source: 'assistant_name',
      fallback: 'asesor virtual',
      staticValue: '',
      description: 'Usa el nombre configurado para el asistente del canal.',
      enabled: true,
    },
  ]
}

export function getDefaultChatbotAssignmentRules(): ChatbotAssignmentRules {
  return {
    assignmentMode: 'channel-owner',
    defaultAssignedUserId: '',
    handoffAssignedUserId: '',
    qualifiedAssignedUserId: '',
  }
}

export function getDefaultChatbotMessageCoherence(): ChatbotMessageCoherence {
  return {
    tone: 'consultivo',
    greetingTemplate: 'Hola {{contact_name}}.',
    closingTemplate: 'Si quieres, continúo con el siguiente paso.',
    styleNotes: 'Mantén mensajes claros, breves y orientados a la acción comercial.',
    forbiddenTerms: 'no se, imposible, toca ver',
    requiredTerms: 'te ayudo, siguiente paso, equipo comercial',
  }
}

export function getDefaultChatbotStudioSettings(): ChatbotStudioSettings {
  const defaultFlow = getDefaultChatbotAutomationFlow()
  return {
    automationFlows: [defaultFlow],
    defaultFlowId: defaultFlow.id,
    flowTriggers: defaultFlow.flowTriggers,
    flowVariables: getDefaultChatbotFlowVariables(),
    assignmentRules: getDefaultChatbotAssignmentRules(),
    messageCoherence: getDefaultChatbotMessageCoherence(),
  }
}

export function normalizeChatbotFlowTriggers(value: unknown): ChatbotFlowTrigger[] {
  const defaults = getDefaultChatbotFlowTriggers()
  if (!Array.isArray(value)) return defaults
  const items = value
  const normalized = items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      return {
        id: normalizeString(record.id),
        label: normalizeString(record.label),
        event: isTriggerEvent(record.event) ? record.event : 'message',
        matchMode: isMatchMode(record.matchMode) ? record.matchMode : 'contains',
        matchValue: asText(record.matchValue),
        targetStageId: normalizeString(record.targetStageId),
        assistantReply: asText(record.assistantReply),
        enabled: asBoolean(record.enabled, true),
      } satisfies ChatbotFlowTrigger
    })
    .filter((item): item is ChatbotFlowTrigger => Boolean(item?.id && item.label && item.targetStageId))

  return normalized
}

export function normalizeChatbotAutomationFlows(value: unknown, fallback?: { quickActions?: unknown; flowStages?: unknown; flowTriggers?: unknown; pauseNodes?: unknown; studioNodeLayout?: unknown; studioViewport?: unknown }): ChatbotAutomationFlow[] {
  const items = Array.isArray(value) ? value : []
  const normalized = items
    .map((item, index) => {
      const record = asRecord(item)
      if (!record) return null
      const providers = Array.isArray(record.providers)
        ? record.providers.filter((provider): provider is ChatbotAutomationProvider => isAutomationProvider(provider))
        : []

      return {
        id: normalizeString(record.id) || `flow-${index + 1}`,
        name: normalizeString(record.name) || `Flujo ${index + 1}`,
        description: asText(record.description),
        enabled: asBoolean(record.enabled, true),
        isDefault: asBoolean(record.isDefault, index === 0),
        providers: providers.length ? providers : getDefaultChatbotAutomationProviders(),
        quickActions: normalizeChatbotQuickActions(record.quickActions),
        flowStages: normalizeChatbotFlowStages(record.flowStages),
        flowTriggers: normalizeChatbotFlowTriggers(record.flowTriggers),
        pauseNodes: normalizeChatbotStudioPauseNodes(record.pauseNodes),
        studioNodeLayout: normalizeStudioNodeLayout(record.studioNodeLayout),
        studioViewport: normalizeStudioViewport(record.studioViewport),
      } satisfies ChatbotAutomationFlow
    })
    .filter((item): item is ChatbotAutomationFlow => Boolean(item?.id && item.name))

  if (normalized.length) {
    const firstDefault = normalized.find((flow) => flow.isDefault)?.id ?? normalized[0].id
    return normalized.map((flow) => ({ ...flow, isDefault: flow.id === firstDefault }))
  }

  return [{
    ...getDefaultChatbotAutomationFlow(),
    quickActions: normalizeChatbotQuickActions(fallback?.quickActions),
    flowStages: normalizeChatbotFlowStages(fallback?.flowStages),
    flowTriggers: normalizeChatbotFlowTriggers(fallback?.flowTriggers),
    pauseNodes: normalizeChatbotStudioPauseNodes(fallback?.pauseNodes),
    studioNodeLayout: normalizeStudioNodeLayout(fallback?.studioNodeLayout),
    studioViewport: normalizeStudioViewport(fallback?.studioViewport),
  }]
}

export function normalizeChatbotFlowVariables(value: unknown): ChatbotFlowVariable[] {
  const defaults = getDefaultChatbotFlowVariables()
  const items = Array.isArray(value) ? value : []
  const normalized = items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      return {
        id: normalizeString(record.id),
        key: normalizeString(record.key),
        label: normalizeString(record.label),
        source: isVariableSource(record.source) ? record.source : 'static',
        fallback: asText(record.fallback),
        staticValue: asText(record.staticValue),
        description: asText(record.description),
        enabled: asBoolean(record.enabled, true),
      } satisfies ChatbotFlowVariable
    })
    .filter((item): item is ChatbotFlowVariable => Boolean(item?.id && item.key && item.label))

  if (!normalized.length) return defaults
  const mergedDefaults = defaults.map((defaultItem) => normalized.find((item) => item.id === defaultItem.id) ?? defaultItem)
  const extra = normalized.filter((item) => !defaults.some((defaultItem) => defaultItem.id === item.id))
  return [...mergedDefaults, ...extra]
}

export function normalizeChatbotAssignmentRules(value: unknown): ChatbotAssignmentRules {
  const record = asRecord(value)
  const defaults = getDefaultChatbotAssignmentRules()
  if (!record) return defaults
  return {
    assignmentMode: isAssignmentMode(record.assignmentMode) ? record.assignmentMode : defaults.assignmentMode,
    defaultAssignedUserId: normalizeString(record.defaultAssignedUserId),
    handoffAssignedUserId: normalizeString(record.handoffAssignedUserId),
    qualifiedAssignedUserId: normalizeString(record.qualifiedAssignedUserId),
  }
}

export function normalizeChatbotMessageCoherence(value: unknown): ChatbotMessageCoherence {
  const record = asRecord(value)
  const defaults = getDefaultChatbotMessageCoherence()
  if (!record) return defaults
  return {
    tone: isMessageTone(record.tone) ? record.tone : defaults.tone,
    greetingTemplate: asText(record.greetingTemplate, defaults.greetingTemplate),
    closingTemplate: asText(record.closingTemplate, defaults.closingTemplate),
    styleNotes: asText(record.styleNotes, defaults.styleNotes),
    forbiddenTerms: asText(record.forbiddenTerms, defaults.forbiddenTerms),
    requiredTerms: asText(record.requiredTerms, defaults.requiredTerms),
  }
}

export function getChatbotStudioSettings(settingsJson: unknown): ChatbotStudioSettings {
  const record = asRecord(settingsJson) ?? {}
  const automationFlows = normalizeChatbotAutomationFlows(record.automationFlows, {
    quickActions: record.quickActions,
    flowStages: record.flowStages,
    flowTriggers: record.flowTriggers,
    pauseNodes: record.pauseNodes,
    studioNodeLayout: record.studioNodeLayout,
    studioViewport: record.studioViewport,
  })
  const defaultFlowId = normalizeString(record.defaultFlowId) || automationFlows.find((flow) => flow.isDefault)?.id || automationFlows[0]?.id || 'flow-default'
  const resolvedDefaultFlowId = automationFlows.some((flow) => flow.id === defaultFlowId) ? defaultFlowId : (automationFlows[0]?.id || 'flow-default')
  const defaultFlow = automationFlows.find((flow) => flow.id === resolvedDefaultFlowId) ?? automationFlows[0] ?? getDefaultChatbotAutomationFlow()

  return {
    automationFlows: automationFlows.map((flow) => ({ ...flow, isDefault: flow.id === resolvedDefaultFlowId })),
    defaultFlowId: resolvedDefaultFlowId,
    flowTriggers: defaultFlow.flowTriggers,
    flowVariables: normalizeChatbotFlowVariables(record.flowVariables),
    assignmentRules: normalizeChatbotAssignmentRules(record.assignmentRules),
    messageCoherence: normalizeChatbotMessageCoherence(record.messageCoherence),
  }
}

export function getChatbotAutomationFlowById(flows: ChatbotAutomationFlow[], flowId: string | null | undefined) {
  const normalizedFlowId = normalizeString(flowId)
  if (!normalizedFlowId) return null
  return flows.find((flow) => flow.id === normalizedFlowId) ?? null
}

export function getDefaultChatbotAutomationFlowFromSettings(settings: ChatbotStudioSettings) {
  return getChatbotAutomationFlowById(settings.automationFlows, settings.defaultFlowId)
    ?? settings.automationFlows.find((flow) => flow.isDefault)
    ?? settings.automationFlows[0]
    ?? getDefaultChatbotAutomationFlow()
}

export function getEnabledChatbotAutomationFlows(args: { settings: ChatbotStudioSettings; provider?: ChatbotAutomationProvider | null }) {
  return args.settings.automationFlows.filter((flow) => flow.enabled && (!args.provider || flow.providers.includes(args.provider)))
}

export function resolveChatbotAutomationFlowByTrigger(args: {
  settings: ChatbotStudioSettings
  provider?: ChatbotAutomationProvider | null
  event: ChatbotFlowTriggerEvent
  value: string
}) {
  const candidateFlows = getEnabledChatbotAutomationFlows({ settings: args.settings, provider: args.provider })
  for (const flow of candidateFlows) {
    const matchedTrigger = matchChatbotFlowTrigger({ triggers: flow.flowTriggers, event: args.event, value: args.value })
    if (matchedTrigger) {
      return { flow, matchedTrigger }
    }
  }

  return {
    flow: getDefaultChatbotAutomationFlowFromSettings(args.settings),
    matchedTrigger: null,
  }
}

export function matchChatbotFlowTrigger(args: {
  triggers: ChatbotFlowTrigger[]
  event: ChatbotFlowTriggerEvent
  value: string
}) {
  const normalizedValue = normalizeString(args.value).toLowerCase()
  return args.triggers.find((trigger) => {
    if (!trigger.enabled || trigger.event !== args.event) return false
    if (trigger.event === 'human_request' || trigger.event === 'lead_qualified') return true
    const terms = trigger.matchValue
      .split(/[\n,;|]+/)
      .map((item) => normalizeString(item).toLowerCase())
      .filter(Boolean)
    if (!terms.length) return false
    if (trigger.matchMode === 'exact') return terms.some((term) => term === normalizedValue)
    return terms.some((term) => normalizedValue.includes(term))
  }) ?? null
}

export function resolveChatbotVariableValue(args: {
  variable: ChatbotFlowVariable
  context: Record<string, string | number | null | undefined>
}) {
  const { variable, context } = args
  const resolveFromContext = (key: string) => {
    const value = context[key]
    if (value === null || value === undefined) return ''
    return String(value)
  }

  const value = variable.source === 'static'
    ? variable.staticValue
    : variable.source === 'contact_name'
      ? resolveFromContext('contact_name')
      : variable.source === 'contact_email'
        ? resolveFromContext('contact_email')
        : variable.source === 'contact_phone'
          ? resolveFromContext('contact_phone')
            : variable.source === 'contact_whatsapp'
              ? resolveFromContext('contact_whatsapp')
          : variable.source === 'product'
            ? resolveFromContext('product_name')
            : variable.source === 'quantity'
              ? resolveFromContext('quantity')
              : variable.source === 'company'
                ? resolveFromContext('company_name')
                      : variable.source === 'document'
                        ? resolveFromContext('document')
                : variable.source === 'city'
                  ? resolveFromContext('city')
                  : variable.source === 'address'
                    ? resolveFromContext('address')
                  : variable.source === 'channel_name'
                    ? resolveFromContext('channel_name')
                    : resolveFromContext('assistant_name')

  return normalizeString(value) || variable.fallback
}

export function interpolateChatbotVariables(args: {
  template: string
  variables: ChatbotFlowVariable[]
  context: Record<string, string | number | null | undefined>
}) {
  return args.variables.reduce((result, variable) => {
    const value = resolveChatbotVariableValue({ variable, context: args.context })
    return result.replaceAll(`{{${variable.key}}}`, value)
  }, args.template)
}

export function applyChatbotMessageCoherence(args: {
  body: string
  coherence: ChatbotMessageCoherence
  variables: ChatbotFlowVariable[]
  context: Record<string, string | number | null | undefined>
}) {
  const baseBody = normalizeString(args.body)
  if (!baseBody) return baseBody

  const greeting = interpolateChatbotVariables({ template: args.coherence.greetingTemplate, variables: args.variables, context: args.context })
  const closing = interpolateChatbotVariables({ template: args.coherence.closingTemplate, variables: args.variables, context: args.context })

  const requiredTerms = args.coherence.requiredTerms
    .split(/[\n,;|]+/)
    .map((item) => normalizeString(item))
    .filter(Boolean)

  let nextBody = baseBody
  if (greeting && !nextBody.toLowerCase().startsWith(greeting.toLowerCase())) {
    nextBody = `${greeting}\n\n${nextBody}`
  }
  if (closing && !nextBody.toLowerCase().includes(closing.toLowerCase())) {
    nextBody = `${nextBody}\n\n${closing}`
  }
  if (args.coherence.tone === 'directo') {
    nextBody = nextBody.replace(/\bme gustaria\b/gi, 'necesito').replace(/\bsi gustas\b/gi, 'si quieres')
  }
  if (args.coherence.tone === 'amable' && !/gracias/i.test(nextBody)) {
    nextBody = `${nextBody}\n\nGracias por escribirnos.`
  }

  for (const term of requiredTerms) {
    if (!nextBody.toLowerCase().includes(term.toLowerCase())) {
      nextBody = `${nextBody}\n${term}`
    }
  }

  return nextBody.trim()
}

export function resolveChatbotAssignmentUserId(args: {
  rules: ChatbotAssignmentRules
  requestHuman: boolean
  leadQualified: boolean
  channelOwnerUserId: string
}) {
  if (args.requestHuman) {
    if (args.rules.handoffAssignedUserId) return args.rules.handoffAssignedUserId
    if (args.rules.assignmentMode === 'handoff-user' && args.rules.defaultAssignedUserId) return args.rules.defaultAssignedUserId
  }
  if (args.leadQualified && args.rules.qualifiedAssignedUserId) {
    return args.rules.qualifiedAssignedUserId
  }
  if (args.rules.assignmentMode === 'default-user' && args.rules.defaultAssignedUserId) {
    return args.rules.defaultAssignedUserId
  }
  return args.channelOwnerUserId
}