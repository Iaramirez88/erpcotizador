export type SerpDevice = 'DESKTOP' | 'MOBILE'

export type SerpCheckRequest = {
  trackingId: string
  keyword: string
  targetDomain: string
  country: string
  locationCode?: number | null
  locationName?: string | null
  languageCode: string
  device: SerpDevice
  depth?: number
}

export type SubmittedSerpTask = {
  trackingId: string
  providerTaskId: string
  costUsd: number | null
  request: SerpCheckRequest
}

export type SerpOrganicResult = {
  position: number | null
  resultUrl: string | null
  matchedDomain: string | null
  serpFeatures: string[]
  checkedAt: Date
  costUsd: number | null
  raw: Record<string, unknown>
}

export type SerpLocation = {
  code: number
  name: string
  countryCode: string
  type: string
}

export interface SerpProvider {
  readonly name: string
  isConfigured(): boolean
  submit(requests: SerpCheckRequest[]): Promise<SubmittedSerpTask[]>
  getResult(providerTaskId: string, targetDomain: string): Promise<SerpOrganicResult | null>
  getLocations(country: string): Promise<SerpLocation[]>
}

type DataForSeoTask = {
  id?: string
  status_code?: number
  status_message?: string
  cost?: number
  data?: { tag?: string }
  result?: Array<{
    datetime?: string
    location_code?: number
    location_name?: string
    country_iso_code?: string
    location_type?: string
    item_types?: string[]
    check_url?: string
    se_domain?: string
    items?: Array<{
      type?: string
      rank_absolute?: number
      rank_group?: number
      domain?: string
      url?: string
      title?: string
    }>
  }> | null
}

type DataForSeoResponse = {
  status_code?: number
  status_message?: string
  tasks?: DataForSeoTask[]
}

const COUNTRY_LOCATION_CODES: Record<string, number> = {
  ARG: 2032,
  BRA: 2076,
  CHL: 2152,
  COL: 2170,
  ECU: 2218,
  ESP: 2724,
  MEX: 2484,
  PER: 2604,
  USA: 2840,
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
}

function domainsMatch(resultDomain: string, targetDomain: string) {
  const result = normalizeDomain(resultDomain)
  const target = normalizeDomain(targetDomain)
  return result === target || result.endsWith(`.${target}`)
}

export class DataForSeoSerpProvider implements SerpProvider {
  readonly name = 'DATAFORSEO'
  private readonly login = process.env.DATAFORSEO_LOGIN?.trim() || ''
  private readonly password = process.env.DATAFORSEO_PASSWORD?.trim() || ''
  private readonly baseUrl = process.env.DATAFORSEO_MODE?.trim().toLowerCase() === 'sandbox'
    ? 'https://sandbox.dataforseo.com'
    : 'https://api.dataforseo.com'

  isConfigured() {
    return Boolean(this.login && this.password)
  }

  private async request(path: string, init?: RequestInit) {
    if (!this.isConfigured()) throw new Error('Configura DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD.')
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.login}:${this.password}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => ({})) as DataForSeoResponse
    if (!response.ok || (payload.status_code && payload.status_code >= 40000)) {
      throw new Error(payload.status_message || `DataForSEO respondió HTTP ${response.status}.`)
    }
    return payload
  }

  async submit(requests: SerpCheckRequest[]) {
    if (!requests.length) return []
    if (requests.length > 100) throw new Error('DataForSEO admite máximo 100 tareas por lote.')

    const payload = await this.request('/v3/serp/google/organic/task_post', {
      method: 'POST',
      body: JSON.stringify(requests.map((request) => {
        const location = request.locationName && !request.locationCode
          ? { location_name: request.locationName }
          : { location_code: request.locationCode || COUNTRY_LOCATION_CODES[request.country] || COUNTRY_LOCATION_CODES.COL }
        return {
          keyword: request.keyword,
          ...location,
          language_code: request.languageCode || 'es',
          device: request.device === 'MOBILE' ? 'mobile' : 'desktop',
          depth: Math.min(100, Math.max(10, request.depth || 100)),
          tag: request.trackingId,
        }
      })),
    })

    const byTrackingId = new Map(requests.map((request) => [request.trackingId, request]))
    return (payload.tasks || []).map((task, index) => {
      if (!task.id || (task.status_code && task.status_code >= 40000)) {
        throw new Error(task.status_message || 'DataForSEO no creó una tarea SERP.')
      }
      const trackingId = String(task.data?.tag || requests[index]?.trackingId || '')
      const request = byTrackingId.get(trackingId)
      if (!request) throw new Error('DataForSEO devolvió una tarea sin identificador interno.')
      return { trackingId, providerTaskId: task.id, costUsd: task.cost ?? null, request }
    })
  }

  async getResult(providerTaskId: string, targetDomain: string) {
    const payload = await this.request(`/v3/serp/google/organic/task_get/advanced/${encodeURIComponent(providerTaskId)}`)
    const task = payload.tasks?.[0]
    if (!task) throw new Error('DataForSEO no devolvió la tarea solicitada.')
    if (!task.result?.length) return null

    const result = task.result[0]
    const items = result.items || []
    const organicItems = items.filter((item) => item.type === 'organic')
    const match = organicItems.find((item) => domainsMatch(item.domain || item.url || '', targetDomain))
    const checkedAt = result.datetime && !Number.isNaN(Date.parse(result.datetime)) ? new Date(result.datetime) : new Date()
    const serpFeatures = Array.from(new Set([...(result.item_types || []), ...items.map((item) => item.type || '').filter(Boolean)]))

    return {
      position: match?.rank_absolute ?? null,
      resultUrl: match?.url || null,
      matchedDomain: match?.domain || null,
      serpFeatures,
      checkedAt,
      costUsd: task.cost ?? null,
      raw: {
        providerTaskId,
        checkUrl: result.check_url || null,
        searchEngineDomain: result.se_domain || null,
        serpFeatures,
        targetDomain,
        matchedResult: match || null,
        organicResults: organicItems.map((item) => ({
          position: item.rank_absolute ?? null,
          groupPosition: item.rank_group ?? null,
          domain: item.domain || null,
          url: item.url || null,
          title: item.title || null,
        })),
      },
    }
  }

  async getLocations(country: string) {
    const countryCodes: Record<string, string> = { ARG: 'ar', BRA: 'br', CHL: 'cl', COL: 'co', ECU: 'ec', ESP: 'es', MEX: 'mx', PER: 'pe', USA: 'us' }
    const countryCode = countryCodes[country.toUpperCase()] || country.toLowerCase().slice(0, 2)
    const payload = await this.request(`/v3/serp/google/locations/${encodeURIComponent(countryCode)}`)
    const locations = payload.tasks?.[0]?.result || []
    return locations
      .filter((item) => typeof item.location_code === 'number' && Boolean(item.location_name))
      .map((item) => ({
        code: item.location_code!,
        name: item.location_name!,
        countryCode: item.country_iso_code || countryCode.toUpperCase(),
        type: item.location_type || 'Location',
      }))
  }
}

export function getSerpProvider(): SerpProvider {
  return new DataForSeoSerpProvider()
}
