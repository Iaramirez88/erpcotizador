type PageSpeedMetric = { percentile?: number; category?: string }
type PageSpeedPayload = {
  error?: { message?: string }
  loadingExperience?: { overall_category?: string; metrics?: Record<string, PageSpeedMetric> }
  lighthouseResult?: {
    fetchTime?: string
    categories?: Record<string, { score?: number }>
    audits?: Record<string, { numericValue?: number }>
  }
}

export function getPageSpeedStatus() {
  return { configured: Boolean(process.env.PAGESPEED_API_KEY?.trim()) }
}

export async function getPageSpeedInsights(targetUrl: string) {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim()
  if (!apiKey) return null
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', targetUrl)
  endpoint.searchParams.set('key', apiKey)
  endpoint.searchParams.set('strategy', 'mobile')
  for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) endpoint.searchParams.append('category', category)

  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
  const payload = await response.json().catch(() => ({})) as PageSpeedPayload
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `PageSpeed respondió HTTP ${response.status}.`)
  const lighthouse = payload.lighthouseResult
  const audits = lighthouse?.audits || {}
  const field = payload.loadingExperience?.metrics || {}
  const score = (name: string) => {
    const value = lighthouse?.categories?.[name]?.score
    return typeof value === 'number' ? Math.round(value * 100) : null
  }
  const metric = (name: string) => {
    const value = audits[name]?.numericValue
    return typeof value === 'number' ? value : null
  }

  return {
    fetchedAt: lighthouse?.fetchTime || new Date().toISOString(),
    strategy: 'mobile',
    scores: {
      performance: score('performance'),
      seo: score('seo'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
    },
    lab: {
      firstContentfulPaintMs: metric('first-contentful-paint'),
      largestContentfulPaintMs: metric('largest-contentful-paint'),
      cumulativeLayoutShift: metric('cumulative-layout-shift'),
      totalBlockingTimeMs: metric('total-blocking-time'),
      speedIndexMs: metric('speed-index'),
    },
    field: {
      overallCategory: payload.loadingExperience?.overall_category || null,
      largestContentfulPaintMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      interactionToNextPaintMs: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      cumulativeLayoutShift: typeof field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === 'number'
        ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
        : null,
      lcpCategory: field.LARGEST_CONTENTFUL_PAINT_MS?.category || null,
      inpCategory: field.INTERACTION_TO_NEXT_PAINT?.category || null,
      clsCategory: field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category || null,
    },
  }
}