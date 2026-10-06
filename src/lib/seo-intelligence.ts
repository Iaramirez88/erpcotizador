import type { Prisma } from '@prisma/client'

type PositionInput = { source: string; rawJson: Prisma.JsonValue }
type KeywordInput = {
  id: string
  keyword: string
  domain: string
  searchIntent: string
  serviceType: string | null
  latestSerpPosition: number | null
  latestSerpUrl: string | null
  positions: PositionInput[]
}

type OrganicResult = { position: number | null; domain: string | null; url: string | null; title: string | null }

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
}

function organicResults(value: Prisma.JsonValue): OrganicResult[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const rows = (value as Record<string, Prisma.JsonValue>).organicResults
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return []
    const item = row as Record<string, Prisma.JsonValue>
    return [{
      position: typeof item.position === 'number' ? item.position : null,
      domain: typeof item.domain === 'string' ? item.domain : null,
      url: typeof item.url === 'string' ? item.url : null,
      title: typeof item.title === 'string' ? item.title : null,
    }]
  })
}

function actionsForKeyword(keyword: KeywordInput) {
  const actions: string[] = []
  const position = keyword.latestSerpPosition
  if (position == null) actions.push('Crear o reforzar una página específica para esta keyword; el dominio no aparece en el top 100 consultado.')
  else if (position > 20) actions.push('Replantear cobertura semántica, intención y autoridad de la página antes de optimizaciones menores.')
  else if (position > 10) actions.push('Ampliar contenido, enlazado interno y señales de confianza para entrar al top 10.')
  else if (position > 3) actions.push('Optimizar title, H1, snippet y respuesta principal para competir por el top 3.')
  else actions.push('Defender la posición actual actualizando contenido y vigilando cambios de competidores.')

  if (keyword.searchIntent === 'COMMERCIAL' || keyword.searchIntent === 'TRANSACTIONAL') actions.push('Añadir beneficios, prueba social, precios o proceso de cotización y Schema Service/FAQ.')
  if (keyword.searchIntent === 'INFORMATIONAL') actions.push('Responder preguntas relacionadas, incluir ejemplos y enlazar hacia la página comercial del servicio.')
  if (keyword.searchIntent === 'LOCAL') actions.push('Reforzar ciudad, cobertura, NAP, testimonios locales y Schema LocalBusiness.')
  return actions
}

export function buildSeoIntelligence(keywords: KeywordInput[]) {
  const competitorMap = new Map<string, { domain: string; appearances: number; bestPosition: number; keywords: Set<string> }>()
  const keywordInsights = keywords.map((keyword) => {
    const latest = keyword.positions.find((position) => position.source === 'DATAFORSEO')
    const targetDomain = normalizeDomain(keyword.domain)
    const competitors = organicResults(latest?.rawJson ?? {}).filter((result) => {
      const domain = normalizeDomain(result.domain || result.url || '')
      return Boolean(domain) && domain !== targetDomain && !domain.endsWith(`.${targetDomain}`)
    }).slice(0, 10)
    for (const result of competitors) {
      const domain = normalizeDomain(result.domain || result.url || '')
      const current = competitorMap.get(domain) || { domain, appearances: 0, bestPosition: Number.MAX_SAFE_INTEGER, keywords: new Set<string>() }
      current.appearances += 1
      current.bestPosition = Math.min(current.bestPosition, result.position || Number.MAX_SAFE_INTEGER)
      current.keywords.add(keyword.keyword)
      competitorMap.set(domain, current)
    }
    return {
      id: keyword.id,
      keyword: keyword.keyword,
      position: keyword.latestSerpPosition,
      resultUrl: keyword.latestSerpUrl,
      serviceType: keyword.serviceType,
      searchIntent: keyword.searchIntent,
      competitors: competitors.slice(0, 5),
      actions: actionsForKeyword(keyword),
    }
  })

  return {
    competitors: Array.from(competitorMap.values())
      .sort((left, right) => right.appearances - left.appearances || left.bestPosition - right.bestPosition)
      .slice(0, 10)
      .map((item) => ({ ...item, keywords: Array.from(item.keywords).slice(0, 10) })),
    keywords: keywordInsights,
  }
}