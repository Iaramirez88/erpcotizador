import { z } from 'zod'

export type CrmConversationAiMessage = {
  direction: 'INBOUND' | 'OUTBOUND' | 'SYSTEM'
  bodyText: string | null
  occurredAt: string | Date
  sentByName?: string | null
}

export type CrmConversationAiContext = {
  conversationStatus?: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM' | null
  assignedToName?: string | null
  assignedToUserId?: string | null
  unreadCount?: number
  isUnassigned?: boolean
  slaState?: 'healthy' | 'warning' | 'breached' | 'paused' | null
  priorityLabel?: 'Prioridad alta' | 'Prioridad media' | 'Prioridad baja' | null
  lead?: { id: string; nombre: string; status: string } | null
  opportunity?: { id: string; title: string; stage: string } | null
  cliente?: { id: string; nombre: string } | null
}

export type CrmConversationAiTaskSuggestion = {
  title: string
  description: string
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  dueAt: string | null
  assignedToUserId: string | null
  assignedToLabel: string | null
  reason: string
}

export type CrmConversationAiSuggestion = {
  summary: string
  suggestedReply: string
  nextActions: string[]
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  confidence: 'ALTA' | 'MEDIA' | 'BAJA'
  taskSuggestion: CrmConversationAiTaskSuggestion
  engine: {
    mode: 'RULES' | 'LLM'
    provider: string
    model: string | null
  }
}

const conversationAiSchema = z.object({
  summary: z.string().trim().min(20),
  suggestedReply: z.string().trim().min(20),
  nextActions: z.array(z.string().trim().min(3)).max(4).default([]),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  confidence: z.enum(['ALTA', 'MEDIA', 'BAJA']),
})

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000)
}

function buildTaskSuggestion(args: {
  contactName: string | null
  summary: string
  suggestedReply: string
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  context?: CrmConversationAiContext
}) {
  const now = new Date()
  const contactLabel = args.contactName || args.context?.lead?.nombre || args.context?.cliente?.nombre || args.context?.opportunity?.title || 'contacto CRM'

  let priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'
  if (args.context?.slaState === 'breached' || args.context?.priorityLabel === 'Prioridad alta' || args.sentiment === 'NEGATIVE') {
    priority = 'HIGH'
  } else if (args.context?.slaState === 'healthy' && args.context?.priorityLabel === 'Prioridad baja' && args.sentiment === 'POSITIVE') {
    priority = 'LOW'
  }

  let dueAt: string | null = null
  if (priority === 'HIGH') {
    dueAt = addMinutes(now, 30).toISOString()
  } else if (args.context?.priorityLabel === 'Prioridad media' || args.context?.slaState === 'warning' || args.context?.conversationStatus === 'PENDING') {
    dueAt = addMinutes(now, 4 * 60).toISOString()
  } else {
    dueAt = addMinutes(now, 24 * 60).toISOString()
  }

  const reason = args.context?.isUnassigned
    ? 'La conversación está sin responsable y conviene asegurar seguimiento.'
    : args.context?.slaState === 'breached'
      ? 'El SLA está vencido y requiere reacción rápida.'
      : args.context?.opportunity
        ? `El hilo ya está vinculado a la oportunidad ${args.context.opportunity.title}.`
        : args.context?.lead
          ? `El lead asociado está en estado ${args.context.lead.status}.`
          : 'Se recomienda seguimiento comercial sobre el hilo actual.'

  return {
    title: `Seguimiento IA · ${contactLabel}`,
    description: [
      `Resumen IA: ${args.summary}`,
      '',
      `Motivo: ${reason}`,
      '',
      'Respuesta sugerida:',
      args.suggestedReply,
    ].join('\n'),
    priority,
    dueAt,
    assignedToUserId: args.context?.assignedToUserId || null,
    assignedToLabel: args.context?.assignedToName || null,
    reason,
  } satisfies CrmConversationAiTaskSuggestion
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripJsonFences(content: string) {
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
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

function toDisplayTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function getLastInbound(messages: CrmConversationAiMessage[]) {
  return [...messages].reverse().find((message) => message.direction === 'INBOUND' && message.bodyText?.trim()) ?? null
}

function getRecentTranscript(messages: CrmConversationAiMessage[]) {
  return messages
    .filter((message) => message.bodyText?.trim())
    .slice(-8)
    .map((message) => {
      const role = message.direction === 'INBOUND' ? 'Cliente' : message.direction === 'OUTBOUND' ? (message.sentByName || 'Asesor') : 'Sistema'
      const at = toDisplayTime(message.occurredAt)
      return `${role}${at ? ` (${at})` : ''}: ${message.bodyText?.trim()}`
    })
    .join('\n')
}

function detectSentiment(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (/(gracias|perfecto|listo|excelente|me interesa|hagamos|de acuerdo|ok)/i.test(normalized)) return 'POSITIVE' as const
  if (/(molesto|queja|demora|demorado|malo|inconforme|cancelar|no sirve|urgente|incumpl)/i.test(normalized)) return 'NEGATIVE' as const
  return 'NEUTRAL' as const
}

function buildNextActions(args: {
  messages: CrmConversationAiMessage[]
  latestInboundText: string | null
  context?: CrmConversationAiContext
}) {
  const { messages, latestInboundText, context } = args
  const normalized = normalizeText(latestInboundText || '').toLowerCase()
  const actions: string[] = []

  if (/(precio|cotiz|valor|presupuesto)/i.test(normalized)) {
    actions.push('Confirmar datos faltantes antes de cotizar o pasar al cotizador si ya están completos.')
  }
  if (/(llam|whatsapp|asesor|humano|contact)/i.test(normalized)) {
    actions.push('Definir responsable y tiempo de contacto humano.')
  }
  if (/(hoy|urgente|rapido|rápido|ya)/i.test(normalized)) {
    actions.push('Priorizar la conversación por urgencia y responder con tiempo estimado de atención.')
  }
  if (!actions.length) {
    actions.push('Responder confirmando necesidad principal y siguiente paso comercial.')
  }

  const outboundCount = messages.filter((message) => message.direction === 'OUTBOUND').length
  if (!outboundCount) {
    actions.push('Hacer primera respuesta y dejar claro el canal de seguimiento.')
  }

  if (!context?.assignedToName && context?.conversationStatus !== 'RESOLVED' && context?.conversationStatus !== 'SPAM') {
    actions.push('Asignar responsable del hilo para evitar que la conversación quede sin dueño.')
  }

  if (context?.opportunity) {
    if (context.opportunity.stage === 'PROPOSAL' || context.opportunity.stage === 'NEGOTIATION') {
      actions.push('Responder alineado al estado de la oportunidad y buscar el siguiente avance comercial del cierre.')
    }
  } else if (context?.lead) {
    actions.push('Definir si el lead ya está listo para pasar a oportunidad o si aún falta calificación.')
  }

  return actions.slice(0, 3)
}

function buildHeuristicSummary(args: {
  contactName: string | null
  channelName: string
  messages: CrmConversationAiMessage[]
  context?: CrmConversationAiContext
}) {
  const latestInbound = getLastInbound(args.messages)
  const latestText = latestInbound?.bodyText?.trim() || 'Sin texto reciente del cliente.'
  const clipped = latestText.length > 200 ? `${latestText.slice(0, 197)}...` : latestText
  const messageCount = args.messages.filter((message) => message.bodyText?.trim()).length
  const relationLabel = args.context?.opportunity
    ? `La conversación ya está vinculada a la oportunidad ${args.context.opportunity.title} en etapa ${args.context.opportunity.stage}.`
    : args.context?.lead
      ? `El lead asociado está en estado ${args.context.lead.status}.`
      : args.context?.cliente
        ? `El hilo ya está relacionado con el cliente ${args.context.cliente.nombre}.`
        : 'Aún no hay relación comercial cerrada asociada al hilo.'

  return `${args.contactName || 'El contacto'} escribe por ${args.channelName}. Hay ${messageCount} mensajes con contenido en el hilo. ${relationLabel} Última intención detectada: ${clipped}`
}

function buildHeuristicReply(args: {
  contactName: string | null
  latestInboundText: string | null
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  context?: CrmConversationAiContext
}) {
  const greetingName = args.contactName ? ` ${args.contactName}` : ''
  const normalized = normalizeText(args.latestInboundText || '').toLowerCase()

  if (args.context?.isUnassigned && args.context?.slaState === 'breached') {
    return `Hola${greetingName}, gracias por escribirnos. Ya tomamos tu mensaje con prioridad para darte continuidad lo antes posible y responder de forma concreta sobre tu solicitud.`
  }

  if (args.context?.slaState === 'breached') {
    return `Hola${greetingName}, gracias por tu paciencia. Ya revisé tu mensaje y voy a responderte de forma prioritaria para retomar el hilo y avanzar con el siguiente paso.`
  }

  if (args.context?.priorityLabel === 'Prioridad media' && args.context?.conversationStatus === 'PENDING') {
    return `Hola${greetingName}, gracias por volver a escribirnos. Ya retomé el hilo y te ayudo a confirmar este punto para que podamos avanzar sin fricción.`
  }

  if (args.context?.opportunity?.stage === 'NEGOTIATION') {
    return `Hola${greetingName}, gracias por tu mensaje. Ya revisé el avance de tu proceso y te respondo sobre este punto para mantener la negociación en curso. Si hace falta validar un dato puntual para cerrar, te lo confirmo enseguida.`
  }

  if (args.context?.opportunity?.stage === 'PROPOSAL') {
    return `Hola${greetingName}, gracias por escribirnos. Ya revisé tu solicitud dentro de la propuesta que llevamos en curso y te respondo de forma puntual para avanzar al siguiente paso comercial.`
  }

  if (args.context?.lead?.status === 'NEW') {
    return `Hola${greetingName}, gracias por escribirnos. Ya revisé tu mensaje y voy a ayudarte a precisar lo necesario para orientarte mejor y dejar tu solicitud bien encaminada.`
  }

  if (args.context?.lead?.status === 'QUALIFIED') {
    return `Hola${greetingName}, gracias por escribirnos. Ya tengo contexto de tu proceso y te ayudo a avanzar con el siguiente paso para darte una respuesta más concreta.`
  }

  if (/(precio|cotiz|valor|presupuesto)/i.test(normalized)) {
    return `Hola${greetingName}, gracias por escribirnos. Ya revisé tu solicitud y con gusto te ayudo con la cotización. Para darte una respuesta precisa, te confirmaré los datos clave que falten y te compartiré el siguiente paso de inmediato.`
  }

  if (/(llam|whatsapp|asesor|humano|contact)/i.test(normalized)) {
    return `Hola${greetingName}, gracias por escribirnos. Ya dejo tu caso listo para seguimiento y te confirmo a la mayor brevedad el asesor o medio por el que continuaremos contigo.`
  }

  if (args.sentiment === 'NEGATIVE') {
    return `Hola${greetingName}, gracias por contarnos lo ocurrido. Ya revisamos el caso y vamos a darte continuidad con prioridad para aclararlo y proponerte la mejor solución posible.`
  }

  return `Hola${greetingName}, gracias por escribirnos. Ya revisé tu mensaje y te ayudo a continuar con el siguiente paso. Si hace falta algún dato para avanzar, te lo confirmaré de forma puntual.`
}

export function generateCrmConversationSuggestionWithRules(args: {
  contactName: string | null
  channelName: string
  messages: CrmConversationAiMessage[]
  context?: CrmConversationAiContext
}): CrmConversationAiSuggestion {
  const latestInbound = getLastInbound(args.messages)
  const latestInboundText = latestInbound?.bodyText?.trim() || null
  const sentiment = detectSentiment(latestInboundText || '')
  const nextActions = buildNextActions({ messages: args.messages, latestInboundText, context: args.context })

  return {
    summary: buildHeuristicSummary(args),
    suggestedReply: buildHeuristicReply({
      contactName: args.contactName,
      latestInboundText,
      sentiment,
      context: args.context,
    }),
    nextActions,
    sentiment,
    confidence: latestInboundText ? 'MEDIA' : 'BAJA',
    taskSuggestion: buildTaskSuggestion({
      contactName: args.contactName,
      summary: buildHeuristicSummary(args),
      suggestedReply: buildHeuristicReply({
        contactName: args.contactName,
        latestInboundText,
        sentiment,
        context: args.context,
      }),
      sentiment,
      context: args.context,
    }),
    engine: {
      mode: 'RULES',
      provider: 'internal-rules',
      model: null,
    },
  }
}

export async function generateCrmConversationSuggestion(args: {
  contactName: string | null
  channelName: string
  messages: CrmConversationAiMessage[]
  context?: CrmConversationAiContext
}): Promise<CrmConversationAiSuggestion> {
  const baseSuggestion = generateCrmConversationSuggestionWithRules(args)
  const config = getOpenAiCompatibleConfig()

  if (!config.enabled || !config.baseUrl || !config.model) return baseSuggestion

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.25,
        messages: [
          {
            role: 'system',
            content:
              'Eres un coordinador comercial senior para CRM en Colombia. Debes resumir una conversación y proponer una respuesta útil para que un asesor humano la revise. No inventes descuentos, precios, tiempos ni compromisos que no estén en el hilo. Responde en español claro, breve y accionable. Devuelve solo JSON válido con summary, suggestedReply, nextActions, sentiment y confidence.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              contactName: args.contactName,
              channelName: args.channelName,
              transcript: getRecentTranscript(args.messages),
              crmContext: args.context ?? null,
              baseline: baseSuggestion,
              instructions: {
                constraints: [
                  'No uses markdown.',
                  'La respuesta sugerida debe quedar lista para copiar y editar.',
                  'No prometas algo que no aparezca respaldado por el hilo.',
                  'Mantén el resumen en 2 o 3 frases máximo.',
                  'Si existe lead u oportunidad, adapta el tono y el siguiente paso a ese estado comercial.',
                ],
              },
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) return baseSuggestion

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string | null } | null }> }
      | null

    const content = payload?.choices?.[0]?.message?.content
    if (!content) return baseSuggestion

    const parsed = conversationAiSchema.safeParse(JSON.parse(stripJsonFences(content)))
    if (!parsed.success) return baseSuggestion

    return {
      summary: parsed.data.summary,
      suggestedReply: parsed.data.suggestedReply,
      nextActions: parsed.data.nextActions.length ? parsed.data.nextActions : baseSuggestion.nextActions,
      sentiment: parsed.data.sentiment,
      confidence: parsed.data.confidence,
      taskSuggestion: buildTaskSuggestion({
        contactName: args.contactName,
        summary: parsed.data.summary,
        suggestedReply: parsed.data.suggestedReply,
        sentiment: parsed.data.sentiment,
        context: args.context,
      }),
      engine: {
        mode: 'LLM',
        provider: config.provider,
        model: config.model,
      },
    }
  } catch {
    return baseSuggestion
  }
}

export function getCrmConversationAiConnectionStatus() {
  const config = getOpenAiCompatibleConfig()
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
  }
}