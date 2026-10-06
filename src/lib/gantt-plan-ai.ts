import { z } from 'zod'

const ganttAiSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(''),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#2563EB'),
  items: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(500).optional().default(''),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#2563EB'),
    offsetDays: z.number().int().min(0).max(730),
    durationDays: z.number().int().min(1).max(365),
    parentIndex: z.number().int().min(0).nullable().optional().default(null),
    isMilestone: z.boolean().optional().default(false),
  })).min(3).max(30),
  dependencies: z.array(z.object({
    predecessorIndex: z.number().int().min(0),
    successorIndex: z.number().int().min(0),
    lagDays: z.number().int().min(0).max(90).optional().default(0),
  })).max(60).optional().default([]),
})

function stripJsonFences(content: string) {
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

function getOpenAiCompatibleConfig() {
  const baseUrl = String(process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_MODEL || process.env.LLM_MODEL || '').trim()
  const resolvedBaseUrl = baseUrl || (apiKey ? 'https://api.openai.com/v1' : '')
  return { enabled: Boolean(resolvedBaseUrl && model), baseUrl: resolvedBaseUrl, apiKey, model }
}

export function getGanttAiConnectionStatus() {
  const config = getOpenAiCompatibleConfig()
  return { enabled: config.enabled, model: config.model || null }
}

export async function generateGanttPlanDraft(args: {
  prompt: string
  startDate: string
}) {
  const config = getOpenAiCompatibleConfig()
  if (!config.enabled) throw new Error('La conexión de IA no está configurada.')

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
          content: [
            'Eres un director senior de proyectos. Convierte la solicitud en un plan Gantt práctico y realista.',
            'Devuelve únicamente JSON válido con name, description, colorHex, items y dependencies.',
            'Cada item requiere title, description, colorHex, offsetDays, durationDays, parentIndex e isMilestone.',
            'parentIndex solo puede apuntar a un item anterior; usa null para actividades principales.',
            'Los hitos duran 1 día. Incluye entre 5 y 20 items, fases principales, subtareas e hitos de aprobación o entrega.',
            'dependencies usa índices de items y representa precedencias finish-to-start. No generes ciclos.',
            'No incluyas markdown ni texto fuera del JSON.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            projectRequest: args.prompt,
            requestedStartDate: args.startDate,
            locale: 'es-CO',
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('OpenAI Gantt error:', response.status, detail.slice(0, 500))
    throw new Error('La IA no pudo generar el plan en este momento.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | null } | null }> }
    | null
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('La IA devolvió una respuesta vacía.')

  const parsedJson = JSON.parse(stripJsonFences(content)) as unknown
  const parsed = ganttAiSchema.safeParse(parsedJson)
  if (!parsed.success) throw new Error('La IA devolvió un plan con formato inválido.')

  const items = parsed.data.items.map((item, index) => ({
    ...item,
    colorHex: item.colorHex.toUpperCase(),
    parentIndex: item.parentIndex != null && item.parentIndex < index ? item.parentIndex : null,
    durationDays: item.isMilestone ? 1 : item.durationDays,
  }))
  const dependencies = parsed.data.dependencies.filter(
    (dependency) =>
      dependency.predecessorIndex < items.length &&
      dependency.successorIndex < items.length &&
      dependency.predecessorIndex !== dependency.successorIndex,
  )

  return {
    ...parsed.data,
    colorHex: parsed.data.colorHex.toUpperCase(),
    items,
    dependencies,
  }
}
