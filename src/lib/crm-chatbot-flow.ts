export type ChatbotFlowNextField = 'name' | 'email' | 'phone' | 'whatsapp' | 'product' | 'quantity' | 'company' | 'document' | 'city' | 'address' | 'confirmation' | 'none'

export type ChatbotFlowResponseMatchMode = 'exact' | 'contains'

export type ChatbotQuickActionKind = 'catalog' | 'stock' | 'human' | 'message' | 'url' | 'product_lookup' | 'service_lookup' | 'create_quote' | 'create_invoice' | 'create_work_order'

export type ChatbotQuickAction = {
  id: string
  label: string
  kind: ChatbotQuickActionKind
  message: string
  actionUrl: string | null
  enabled: boolean
}

export type ChatbotFlowResponseOption = {
  id: string
  label: string
  userMessage: string
  assistantReply: string
  matchMode: ChatbotFlowResponseMatchMode
  matchValue: string
  targetStageId: string
}

export type ChatbotFlowStage = {
  id: string
  title: string
  description: string
  prompt: string
  nextField: ChatbotFlowNextField
  quickActionIds: string[]
  responseOptions: ChatbotFlowResponseOption[]
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function isFlowNextField(value: unknown): value is ChatbotFlowNextField {
  return value === 'name'
    || value === 'email'
    || value === 'phone'
    || value === 'whatsapp'
    || value === 'product'
    || value === 'quantity'
    || value === 'company'
    || value === 'document'
    || value === 'city'
    || value === 'address'
    || value === 'confirmation'
    || value === 'none'
}

function isResponseMatchMode(value: unknown): value is ChatbotFlowResponseMatchMode {
  return value === 'exact' || value === 'contains'
}

function isQuickActionKind(value: unknown): value is ChatbotQuickActionKind {
  return value === 'catalog'
    || value === 'stock'
    || value === 'human'
    || value === 'message'
    || value === 'url'
    || value === 'product_lookup'
    || value === 'service_lookup'
    || value === 'create_quote'
    || value === 'create_invoice'
    || value === 'create_work_order'
}

export function getDefaultChatbotQuickActions(): ChatbotQuickAction[] {
  return [
    {
      id: 'view-catalog',
      label: 'Ver catálogo',
      kind: 'catalog',
      message: 'Quiero ver el catálogo disponible.',
      actionUrl: null,
      enabled: true,
    },
    {
      id: 'products-in-stock',
      label: 'Productos con stock',
      kind: 'stock',
      message: 'Muéstrame productos con stock disponible.',
      actionUrl: null,
      enabled: true,
    },
    {
      id: 'talk-to-advisor',
      label: 'Hablar con asesor',
      kind: 'human',
      message: 'Quiero hablar con un asesor humano.',
      actionUrl: null,
      enabled: true,
    },
  ]
}

function createResponseOption(option: ChatbotFlowResponseOption): ChatbotFlowResponseOption {
  return option
}

export function getDefaultChatbotFlowStages(): ChatbotFlowStage[] {
  return [
    {
      id: 'welcome',
      title: 'Descubrimiento',
      description: 'Recibe al visitante y lo orienta hacia catálogo o captura.',
      prompt: 'Hola. Soy tu asistente comercial y puedo ayudarte a explorar catálogo, revisar stock o dejar tu solicitud lista para el equipo.',
      nextField: 'name',
      quickActionIds: ['view-catalog', 'products-in-stock', 'talk-to-advisor'],
      responseOptions: [
        createResponseOption({
          id: 'welcome-catalog',
          label: 'Quiero ver opciones',
          userMessage: 'Quiero ver opciones de productos.',
          assistantReply: 'Perfecto. Te llevo a una ruta de exploración para mostrarte catálogo, stock y referencias activas.',
          matchMode: 'contains',
          matchValue: 'catalogo, catálogo, opciones, productos, referencias, inventario, stock',
          targetStageId: 'catalog',
        }),
        createResponseOption({
          id: 'welcome-quote',
          label: 'Quiero cotizar',
          userMessage: 'Quiero cotizar un producto o servicio.',
          assistantReply: 'Perfecto. Voy a guiarte paso a paso para dejar la solicitud lista para el equipo comercial.',
          matchMode: 'contains',
          matchValue: 'cotizar, cotizacion, cotización, precio, presupuesto, necesito comprar',
          targetStageId: 'qualification',
        }),
        createResponseOption({
          id: 'welcome-human',
          label: 'Prefiero un asesor',
          userMessage: 'Prefiero hablar con un asesor humano.',
          assistantReply: 'Entendido. Voy a dejar el contexto listo para que un asesor continúe contigo.',
          matchMode: 'contains',
          matchValue: 'asesor, humano, vendedor, ejecutivo, agente',
          targetStageId: 'handoff',
        }),
      ],
    },
    {
      id: 'catalog',
      title: 'Catálogo y stock',
      description: 'Enfoca la conversación en productos, disponibilidad y referencias.',
      prompt: 'Puedo mostrarte referencias activas, disponibilidad aproximada y alternativas cercanas según el producto que busques.',
      nextField: 'product',
      quickActionIds: ['view-catalog', 'products-in-stock', 'talk-to-advisor'],
      responseOptions: [
        createResponseOption({
          id: 'catalog-search-product',
          label: 'Ya sé qué producto necesito',
          userMessage: 'Ya sé qué producto necesito.',
          assistantReply: 'Perfecto. Escríbeme el nombre del producto, referencia o servicio que quieres revisar y te guío con disponibilidad y precio de referencia.',
          matchMode: 'contains',
          matchValue: 'ya se, ya sé, producto, referencia, servicio',
          targetStageId: 'catalog',
        }),
        createResponseOption({
          id: 'catalog-need-quote',
          label: 'Quiero pasar a cotización',
          userMessage: 'Quiero pasar a cotización.',
          assistantReply: 'Listo. Pasemos a la captura comercial para dejar tu solicitud bien calificada.',
          matchMode: 'contains',
          matchValue: 'cotizar, cotizacion, cotización, precio, continuar, seguir',
          targetStageId: 'qualification',
        }),
      ],
    },
    {
      id: 'qualification',
      title: 'Calificación',
      description: 'Captura datos de contacto, producto y cantidad para el CRM.',
      prompt: 'Perfecto. Ahora voy a completar los datos necesarios para dejar el lead listo y que el equipo comercial continúe el seguimiento.',
      nextField: 'email',
      quickActionIds: ['products-in-stock', 'talk-to-advisor'],
      responseOptions: [
        createResponseOption({
          id: 'qualification-human',
          label: 'Prefiero que me contacten ya',
          userMessage: 'Prefiero que me contacten ya.',
          assistantReply: 'Entendido. Voy a escalar el caso al equipo para que continúe el seguimiento humano.',
          matchMode: 'contains',
          matchValue: 'contacten, asesor, humano, llamar, whatsapp',
          targetStageId: 'handoff',
        }),
      ],
    },
    {
      id: 'handoff',
      title: 'Escalamiento humano',
      description: 'Cierra el flujo automático y deriva el caso a un asesor.',
      prompt: 'Ya dejé el contexto preparado y ahora voy a escalar la conversación al equipo para seguimiento humano.',
      nextField: 'none',
      quickActionIds: ['talk-to-advisor'],
      responseOptions: [],
    },
  ]
}

export function getDefaultChatbotFlowResponseOptions(stageId: string) {
  return getDefaultChatbotFlowStages().find((stage) => stage.id === stageId)?.responseOptions ?? []
}

export function normalizeChatbotFlowResponseOptions(value: unknown, stageId: string): ChatbotFlowResponseOption[] {
  const defaults = getDefaultChatbotFlowResponseOptions(stageId)
  const items = Array.isArray(value) ? value : []
  const normalized = items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      return {
        id: asText(record.id),
        label: asText(record.label),
        userMessage: asText(record.userMessage),
        assistantReply: asText(record.assistantReply),
        matchMode: isResponseMatchMode(record.matchMode) ? record.matchMode : 'contains',
        matchValue: asText(record.matchValue),
        targetStageId: asText(record.targetStageId),
      } satisfies ChatbotFlowResponseOption
    })
    .filter((item): item is ChatbotFlowResponseOption => Boolean(item?.id && item.label && item.userMessage && item.targetStageId))

  if (!normalized.length) return defaults

  const mergedDefaults = defaults.map((defaultOption) => normalized.find((item) => item.id === defaultOption.id) ?? defaultOption)
  const extraOptions = normalized.filter((item) => !defaults.some((defaultOption) => defaultOption.id === item.id))

  return [...mergedDefaults, ...extraOptions]
}

export function normalizeChatbotQuickActions(value: unknown): ChatbotQuickAction[] {
  const defaults = getDefaultChatbotQuickActions()
  const items = Array.isArray(value) ? value : []
  const normalized = items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      const actionUrl = asText(record.actionUrl)
      return {
        id: asText(record.id),
        label: asText(record.label),
        kind: isQuickActionKind(record.kind) ? record.kind : 'message',
        message: asText(record.message),
        actionUrl: actionUrl || null,
        enabled: asBoolean(record.enabled, true),
      } satisfies ChatbotQuickAction
    })
    .filter((item): item is ChatbotQuickAction => Boolean(item?.id && item.label && item.message))

  if (!normalized.length) return defaults

  const mergedDefaults = defaults.map((defaultAction) => normalized.find((item) => item.id === defaultAction.id) ?? defaultAction)
  const extraActions = normalized.filter((item) => !defaults.some((defaultAction) => defaultAction.id === item.id))
  return [...mergedDefaults, ...extraActions]
}

export function normalizeChatbotFlowStages(value: unknown): ChatbotFlowStage[] {
  const defaults = getDefaultChatbotFlowStages()
  const items = Array.isArray(value) ? value : []
  const normalized = items
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null
      return {
        id: asText(record.id),
        title: asText(record.title),
        description: asText(record.description),
        prompt: asText(record.prompt),
        nextField: isFlowNextField(record.nextField) ? record.nextField : 'none',
        quickActionIds: normalizeIds(record.quickActionIds),
        responseOptions: normalizeChatbotFlowResponseOptions(record.responseOptions, asText(record.id)),
      } satisfies ChatbotFlowStage
    })
    .filter((item): item is ChatbotFlowStage => Boolean(item?.id && item.title))

  if (!normalized.length) return defaults

  const mergedDefaults = defaults.map((defaultStage) => {
    const stage = normalized.find((item) => item.id === defaultStage.id)
    return stage
      ? {
          ...defaultStage,
          ...stage,
          quickActionIds: stage.quickActionIds.length ? stage.quickActionIds : defaultStage.quickActionIds,
          responseOptions: stage.responseOptions,
        }
      : defaultStage
  })

  const extraStages = normalized.filter((stage) => !defaults.some((defaultStage) => defaultStage.id === stage.id))

  return [...mergedDefaults, ...extraStages]
}

export function findChatbotQuickAction(actions: ChatbotQuickAction[], actionId: string | null | undefined) {
  if (!actionId) return null
  return actions.find((item) => item.id === actionId && item.enabled) ?? null
}

export function findChatbotFlowStage(stages: ChatbotFlowStage[], stageId: string | null | undefined) {
  if (!stageId) return null
  return stages.find((item) => item.id === stageId) ?? null
}

export function getStageQuickActions(stage: ChatbotFlowStage | null | undefined, actions: ChatbotQuickAction[]) {
  if (!stage) return actions.filter((item) => item.enabled)
  return stage.quickActionIds
    .map((actionId) => findChatbotQuickAction(actions, actionId))
    .filter((item): item is ChatbotQuickAction => Boolean(item))
}

export function findChatbotFlowResponseOption(stage: ChatbotFlowStage | null | undefined, optionId: string | null | undefined) {
  if (!stage || !optionId) return null
  return stage.responseOptions.find((item) => item.id === optionId) ?? null
}

export function getStageResponseOptions(stage: ChatbotFlowStage | null | undefined) {
  return stage?.responseOptions ?? []
}

function normalizeMatchTerms(value: string) {
  return value
    .split(/[\n,;|]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function matchChatbotFlowResponseOption(stage: ChatbotFlowStage | null | undefined, messageText: string) {
  if (!stage) return null
  const normalizedMessage = asText(messageText).toLowerCase()
  if (!normalizedMessage) return null

  return stage.responseOptions.find((option) => {
    const matchTerms = normalizeMatchTerms(option.matchValue || option.label)
    if (!matchTerms.length) return false
    if (option.matchMode === 'exact') {
      return matchTerms.some((term) => normalizedMessage === term)
    }
    return matchTerms.some((term) => normalizedMessage.includes(term))
  }) ?? null
}
