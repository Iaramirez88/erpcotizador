import { load } from 'cheerio'
import { z } from 'zod'
import { fetchPublicHtml } from '@/lib/public-http'

const contentDraftSchema = z.object({
  title: z.string().trim().min(1).max(180),
  metaDescription: z.string().trim().min(1).max(320),
  targetKeyword: z.string().trim().max(200).optional().default(''),
  searchIntent: z.string().trim().max(120).optional().default(''),
  outline: z.array(z.string().trim().min(1).max(240)).min(3).max(20),
  differentiators: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  content: z.string().trim().min(100).max(30000),
})

function getAiConfig() {
  const baseUrl = String(process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_MODEL || process.env.LLM_MODEL || '').trim()
  return { baseUrl: baseUrl || (apiKey ? 'https://api.openai.com/v1' : ''), apiKey, model }
}

export function getContentAgentStatus() {
  const config = getAiConfig()
  return { enabled: Boolean(config.baseUrl && config.model), model: config.model || null }
}

async function fetchPublicPageText(initialUrl: string) {
  const page = await fetchPublicHtml(initialUrl, { userAgent: 'SGDigital-ContentResearch/1.0', maxBytes: 500_000, timeoutMs: 10_000 })
  if (page.statusCode < 200 || page.statusCode >= 300) throw new Error(`No se pudo leer ${new URL(page.url).hostname} (${page.statusCode}).`)
  const $ = load(page.html)
  $('script,style,noscript,svg,iframe').remove()
  const title = $('title').first().text().replace(/\s+/g, ' ').trim()
  const description = $('meta[name="description"]').attr('content')?.trim() || ''
  const headings = $('h1,h2,h3').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean).slice(0, 40)
  const text = $('main,article,body').first().text().replace(/\s+/g, ' ').trim().slice(0, 16000)
  return { url: page.url, title, description, headings, text }
}

function stripJsonFences(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

export async function generateContentDraft(args: {
  seedIdea: string
  targetKeyword?: string | null
  contentType: string
  competitorUrls: string[]
  currentWebsiteContent: unknown
}) {
  const config = getAiConfig()
  if (!config.baseUrl || !config.model) throw new Error('La conexión de IA no está configurada.')

  const competitorResearch = await Promise.all(
    args.competitorUrls.slice(0, 3).map((url) => fetchPublicPageText(url)),
  )
  const currentWebsiteContent = JSON.stringify(args.currentWebsiteContent).slice(0, 24000)
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un estratega SEO y editor senior. Analiza patrones y vacíos de competidores sin copiar frases. Contrasta contra el contenido actual del sitio. Devuelve solo JSON válido con title, metaDescription, targetKeyword, searchIntent, outline, differentiators y content. El contenido debe ser original, útil, en español colombiano y listo para revisión humana.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            idea: args.seedIdea,
            targetKeyword: args.targetKeyword || '',
            contentType: args.contentType,
            competitorResearch,
            currentWebsiteContent,
          }),
        },
      ],
    }),
  })
  if (!response.ok) throw new Error('La IA no pudo generar el contenido en este momento.')
  const payload = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('La IA devolvió una respuesta vacía.')
  const parsed = contentDraftSchema.safeParse(JSON.parse(stripJsonFences(content)))
  if (!parsed.success) throw new Error('La IA devolvió un contenido con formato inválido.')
  return { draft: parsed.data, competitorResearch }
}
