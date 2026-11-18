import { z } from 'zod'

/**
 * Generador de flujos del Chatbot Studio mediante IA.
 *
 * El modelo devuelve un "borrador" con referencias por `key` (identificadores
 * estables legibles) y el cliente se encarga de convertirlo en un
 * `ChatbotAutomationFlow` real con ids únicos y posiciones de layout.
 */

const FLOW_NEXT_FIELDS = ['name', 'email', 'phone', 'whatsapp', 'product', 'quantity', 'company', 'document', 'city', 'address', 'confirmation', 'none'] as const
const QUICK_ACTION_KINDS = ['catalog', 'stock', 'human', 'message', 'url', 'product_lookup', 'service_lookup', 'create_quote', 'create_invoice', 'create_work_order'] as const
const RESPONSE_MATCH_MODES = ['exact', 'contains'] as const
const TRIGGER_EVENTS = ['message', 'quick_action', 'response_option', 'human_request', 'lead_qualified'] as const
const TRIGGER_MATCH_MODES = ['contains', 'exact', 'equals', 'starts_with', 'regex'] as const

const responseOptionSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  userMessage: z.string().trim().min(1).max(240),
  assistantReply: z.string().trim().max(500).optional().default(''),
  matchMode: z.enum(RESPONSE_MATCH_MODES).optional().default('contains'),
  matchValue: z.string().trim().max(400).optional().default(''),
  targetStageKey: z.string().trim().max(40).optional().default(''),
})

const stageSchema = z.object({
  key: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional().default(''),
  prompt: z.string().trim().min(1).max(1400),
  nextField: z.enum(FLOW_NEXT_FIELDS).optional().default('none'),
  endChatbotSession: z.boolean().optional().default(false),
  quickActionKeys: z.array(z.string().trim().max(40)).max(8).optional().default([]),
  responseOptions: z.array(responseOptionSchema).max(10).optional().default([]),
})

const quickActionSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  kind: z.enum(QUICK_ACTION_KINDS).optional().default('message'),
  message: z.string().trim().min(1).max(500),
})

const triggerSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  event: z.enum(TRIGGER_EVENTS).optional().default('message'),
  matchMode: z.enum(TRIGGER_MATCH_MODES).optional().default('contains'),
  matchValue: z.string().trim().max(400).optional().default(''),
  targetStageKey: z.string().trim().max(40).optional().default(''),
  assistantReply: z.string().trim().max(500).optional().default(''),
})

export const chatbotStudioFlowDraftSchema = z.object({
  flowName: z.string().trim().min(1).max(120),
  flowDescription: z.string().trim().max(500).optional().default(''),
  startStageKey: z.string().trim().min(1).max(40),
  stages: z.array(stageSchema).min(1).max(20),
  quickActions: z.array(quickActionSchema).max(20).optional().default([]),
  triggers: z.array(triggerSchema).max(20).optional().default([]),
})

export type ChatbotStudioFlowDraft = z.infer<typeof chatbotStudioFlowDraftSchema>

function stripJsonFences(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

function getAiConfig() {
  const baseUrl = String(process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_MODEL || process.env.LLM_MODEL || '').trim()
  return { baseUrl: baseUrl || (apiKey ? 'https://api.openai.com/v1' : ''), apiKey, model }
}

export function getChatbotStudioAiConnectionStatus() {
  const config = getAiConfig()
  return { enabled: Boolean(config.baseUrl && config.model), model: config.model || null }
}

function buildSystemPrompt() {
  return [
    'Eres un arquitecto conversacional senior que diseña flujos de chatbot para CRM en Colombia.',
    'Convierte la instrucción del usuario en un flujo completo de mensajes, opciones de respuesta, acciones rápidas y disparadores.',
    'Devuelve únicamente JSON válido con: flowName, flowDescription, startStageKey, stages, quickActions y triggers.',
    'Reglas:',
    '- `startStageKey` debe coincidir con el key de la primera etapa (mensaje de bienvenida).',
    '- Todo flujo debe incluir una etapa de bienvenida y una etapa final de escalamiento a humano (endChatbotSession=true).',
    '- Usa `nextField` para indicar qué dato captura cada etapa (name, email, phone, product, quantity, company, document, city, address, confirmation o none).',
    '- Cada `key` debe ser un slug corto y único (ej: welcome, catalog, qualification, quote, handoff).',
    '- Los `responseOptions` enlazan con `targetStageKey` para ramificar; deja `targetStageKey` vacío solo en etapas finales.',
    '- `quickActions` son botones globales reutilizables; las etapas los referencian por `quickActionKeys`.',
    '- `triggers` capturan intenciones por `event` y `matchValue` (listas separadas por coma) y redirigen a `targetStageKey`.',
    '- Escribe los mensajes en español colombiano, claros, breves y orientados a acción comercial.',
    '- No inventes precios, tiempos ni compromisos; mantén los textos genéricos y editables.',
    'No incluyas markdown ni texto fuera del JSON.',
  ].join(' ')
}

export async function generateChatbotStudioFlowDraft(args: {
  instruction: string
  assistantName: string
  currentFlow: {
    name: string
    description: string
    stageCount: number
    actionCount: number
    triggerCount: number
    stageTitles: string[]
  } | null
}) {
  const config = getAiConfig()
  if (!config.baseUrl || !config.model) throw new Error('La conexión de IA no está configurada.')

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify({
            instruction: args.instruction,
            assistantName: args.assistantName,
            currentFlow: args.currentFlow,
            locale: 'es-CO',
            constraints: [
              'Genera entre 3 y 12 etapas según la complejidad pedida.',
              'Si piden capturar datos, crea una etapa por dato relevante.',
              'Incluye opciones de respuesta para las ramas principales.',
              'Agrega la acción rápida de hablar con un asesor y derivación a humano.',
            ],
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Chatbot Studio AI error:', response.status, detail.slice(0, 500))
    throw new Error('La IA no pudo generar el flujo en este momento.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | null } | null }> }
    | null
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('La IA devolvió una respuesta vacía.')

  const parsed = chatbotStudioFlowDraftSchema.safeParse(JSON.parse(stripJsonFences(content)))
  if (!parsed.success) {
    console.error('Chatbot Studio AI schema error:', parsed.error.issues)
    throw new Error('La IA devolvió un flujo con formato inválido.')
  }

  return {
    draft: parsed.data,
    engine: { provider: 'openai-compatible', model: config.model },
  }
}
