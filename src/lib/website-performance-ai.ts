import { z } from 'zod'

const adviceSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  quickWins: z.array(z.object({ title: z.string().trim().min(1).max(180), action: z.string().trim().min(1).max(1200), expectedImpact: z.string().trim().min(1).max(300) })).max(6),
  phases: z.array(z.object({ name: z.string().trim().min(1).max(120), objective: z.string().trim().min(1).max(500), tasks: z.array(z.string().trim().min(1).max(700)).min(1).max(8), verification: z.string().trim().min(1).max(500) })).min(1).max(4),
})

function stripJsonFences(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

export async function generateWebsitePerformanceAdvice(input: { siteName: string; targetUrl: string; audit: unknown }) {
  const baseUrl = String(process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_MODEL || process.env.LLM_MODEL || '').trim()
  const resolvedBaseUrl = baseUrl || (apiKey ? 'https://api.openai.com/v1' : '')
  if (!resolvedBaseUrl || !model) throw new Error('La IA no está configurada. Las recomendaciones técnicas locales siguen disponibles.')

  const response = await fetch(`${resolvedBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un ingeniero senior de rendimiento web. Convierte datos reales de PageSpeed/Lighthouse en un plan ejecutable en español. No inventes tecnologías ni métricas. Prioriza por impacto y esfuerzo. Explica archivos, configuraciones o patrones a revisar sin asumir acceso al código del sitio. Devuelve solo JSON válido con summary, quickWins [{title,action,expectedImpact}] y phases [{name,objective,tasks,verification}].' },
        { role: 'user', content: JSON.stringify({ siteName: input.siteName, targetUrl: input.targetUrl, audit: input.audit }).slice(0, 50000) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`La IA no pudo analizar el rendimiento (HTTP ${response.status}).`)
  const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string | null } }> } | null
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('La IA devolvió una respuesta vacía.')
  const parsed = adviceSchema.safeParse(JSON.parse(stripJsonFences(content)))
  if (!parsed.success) throw new Error('La IA devolvió un plan con formato inválido.')
  return parsed.data
}

export type WebsitePerformanceAdvice = z.infer<typeof adviceSchema>