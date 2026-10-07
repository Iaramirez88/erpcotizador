import { load } from 'cheerio'
import { fetchPublicHtml } from '@/lib/public-http'
import { getPageSpeedInsights, type PageSpeedStrategy } from '@/lib/website-performance'

type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO'
type AuditCheck = { label: string; status: CheckStatus; value: string; score: number; maxScore: number }

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function resolveWebUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null
  try {
    const resolved = new URL(value, baseUrl)
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.toString() : null
  } catch {
    return null
  }
}

function makeCheck(label: string, passed: boolean, value: string, maxScore: number, warning = false): AuditCheck {
  return { label, status: passed ? 'PASS' : warning ? 'WARN' : 'FAIL', value, score: passed ? maxScore : warning ? Math.round(maxScore / 2) : 0, maxScore }
}

async function inspectRobotsAndSitemap(pageUrl: string) {
  const origin = new URL(pageUrl).origin
  let robotsText = ''
  let robotsFound = false
  try {
    const robots = await fetchPublicHtml(`${origin}/robots.txt`, { userAgent: 'SGDigital-SEOAudit/1.0', maxBytes: 200_000 })
    robotsFound = robots.statusCode >= 200 && robots.statusCode < 300
    if (robotsFound) robotsText = robots.html
  } catch {}

  const sitemapMatch = robotsText.match(/^\s*Sitemap:\s*(\S+)/im)
  const sitemapUrl = resolveWebUrl(sitemapMatch?.[1], origin) || `${origin}/sitemap.xml`
  let sitemapFound = false
  try {
    const sitemap = await fetchPublicHtml(sitemapUrl, { userAgent: 'SGDigital-SEOAudit/1.0', maxBytes: 1_000_000 })
    sitemapFound = sitemap.statusCode >= 200 && sitemap.statusCode < 300 && /<(urlset|sitemapindex)(\s|>)/i.test(sitemap.html)
  } catch {}

  const blocksAll = /User-agent:\s*\*[\s\S]{0,500}?Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robotsText)
  return { robotsFound, sitemapFound, sitemapUrl, blocksAll }
}

export async function auditWebsitePage(targetUrl: string, options: { mode?: 'SEO' | 'PERFORMANCE'; strategy?: PageSpeedStrategy } = {}) {
  const mode = options.mode || 'SEO'
  const strategy = options.strategy || 'mobile'
  const page = await fetchPublicHtml(targetUrl, { userAgent: 'SGDigital-SEOAudit/1.0', maxBytes: 1_500_000, timeoutMs: 20_000 })
  const $ = load(page.html)
  const title = cleanText($('title').first().text())
  const metaDescription = cleanText($('meta[name="description" i]').attr('content') || '')
  const h1 = $('h1').map((_, element) => cleanText($(element).text())).get().filter(Boolean)
  const h2 = $('h2').map((_, element) => cleanText($(element).text())).get().filter(Boolean)
  const canonical = resolveWebUrl($('link[rel="canonical" i]').attr('href'), page.url)
  const robotsMeta = cleanText($('meta[name="robots" i]').attr('content') || '').toLowerCase()
  const noindex = robotsMeta.split(',').some((item) => item.trim() === 'noindex')
  const pageOrigin = new URL(page.url).origin
  let internalLinks = 0
  let externalLinks = 0
  $('a[href]').each((_, element) => {
    const href = resolveWebUrl($(element).attr('href'), page.url)
    if (!href) return
    if (new URL(href).origin === pageOrigin) internalLinks += 1
    else externalLinks += 1
  })
  const images = $('img').length
  const imagesWithoutAlt = $('img').filter((_, element) => !cleanText($(element).attr('alt') || '')).length
  const schemaTypes = new Set<string>()
  let invalidSchemaBlocks = 0
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text()) as { '@type'?: unknown; '@graph'?: Array<{ '@type'?: unknown }> }
      const values = [parsed['@type'], ...(parsed['@graph'] || []).map((item) => item['@type'])].flat()
      values.filter((value): value is string => typeof value === 'string').forEach((value) => schemaTypes.add(value))
    } catch { invalidSchemaBlocks += 1 }
  })
  $('script,style,noscript,svg,template').remove()
  const words = cleanText($('body').text()).split(/\s+/).filter(Boolean).length
  let pageSpeedError: string | null = null
  const [{ robotsFound, sitemapFound, sitemapUrl, blocksAll }, pageSpeed] = await Promise.all([
    inspectRobotsAndSitemap(page.url),
    (mode === 'PERFORMANCE' ? getPageSpeedInsights(page.url, strategy) : Promise.resolve(null)).catch((error) => {
      pageSpeedError = error instanceof Error ? error.message.slice(0, 500) : 'PageSpeed no disponible.'
      return null
    }),
  ])
  const successfulStatus = page.statusCode >= 200 && page.statusCode < 300
  const indexable = successfulStatus && !noindex && !blocksAll
  const altCoverage = images === 0 ? 1 : (images - imagesWithoutAlt) / images

  const checks: Record<string, AuditCheck> = {
    statusCode: makeCheck('Código de estado', successfulStatus, String(page.statusCode), 10),
    https: makeCheck('HTTPS', new URL(page.url).protocol === 'https:', new URL(page.url).protocol.replace(':', '').toUpperCase(), 5),
    indexability: makeCheck('Indexabilidad', indexable, indexable ? 'Indexable' : 'Bloqueada', 10),
    title: makeCheck('Title', title.length >= 30 && title.length <= 60, title ? `${title.length} caracteres` : 'Ausente', 10, title.length > 0),
    metaDescription: makeCheck('Meta description', metaDescription.length >= 120 && metaDescription.length <= 160, metaDescription ? `${metaDescription.length} caracteres` : 'Ausente', 10, metaDescription.length > 0),
    h1: makeCheck('H1', h1.length === 1, `${h1.length} encontrado(s)`, 10, h1.length > 0),
    h2: makeCheck('H2', h2.length > 0, `${h2.length} encontrado(s)`, 5),
    canonical: makeCheck('Canonical', Boolean(canonical), canonical || 'Ausente', 8),
    robots: makeCheck('Robots.txt', robotsFound && !blocksAll, blocksAll ? 'Bloquea todo el sitio' : robotsFound ? 'Disponible' : 'No encontrado', 5, robotsFound),
    sitemap: makeCheck('Sitemap', sitemapFound, sitemapFound ? sitemapUrl : 'No encontrado', 5),
    images: makeCheck('ALT de imágenes', altCoverage >= 0.9, `${images - imagesWithoutAlt}/${images} con ALT`, 7, altCoverage >= 0.6),
    internalLinks: makeCheck('Enlaces internos', internalLinks > 0, String(internalLinks), 5),
    schema: makeCheck('Datos estructurados', schemaTypes.size > 0 && invalidSchemaBlocks === 0, schemaTypes.size ? Array.from(schemaTypes).join(', ') : 'Ausentes', 5, schemaTypes.size > 0),
    wordCount: makeCheck('Contenido', words >= 300, `${words} palabras`, 5, words >= 150),
    ...(mode === 'PERFORMANCE' ? { pageSpeed: pageSpeed
      ? { label: `PageSpeed ${strategy === 'mobile' ? 'móvil' : 'escritorio'}`, status: (pageSpeed.scores.performance || 0) >= 90 ? 'PASS' : (pageSpeed.scores.performance || 0) >= 50 ? 'WARN' : 'FAIL', value: `${pageSpeed.scores.performance ?? '—'}/100`, score: 0, maxScore: 0 }
      : { label: `PageSpeed ${strategy === 'mobile' ? 'móvil' : 'escritorio'}`, status: 'INFO' as const, value: pageSpeedError || 'API pendiente de configuración', score: 0, maxScore: 0 } } : {}),
  }
  const healthScore = Object.values(checks).reduce((sum, check) => sum + check.score, 0)
  const recommendations = Object.values(checks)
    .filter((check) => (check.status === 'FAIL' || check.status === 'WARN') && check.maxScore > 0)
    .map((check) => `${check.label}: ${check.value}.`)
  if (pageSpeed?.scores.performance != null && pageSpeed.scores.performance < 90) {
    recommendations.push(`Rendimiento ${strategy === 'mobile' ? 'móvil' : 'de escritorio'}: PageSpeed obtuvo ${pageSpeed.scores.performance}/100; aplica primero las oportunidades con menor puntuación.`)
  }

  return {
    targetUrl,
    finalUrl: page.url,
    statusCode: page.statusCode,
    healthScore,
    indexable,
    checks,
    recommendations,
    metrics: {
      auditType: mode,
      title,
      metaDescription,
      h1,
      h2,
      canonical,
      robotsMeta,
      robotsFound,
      sitemapFound,
      sitemapUrl,
      images,
      imagesWithoutAlt,
      internalLinks,
      externalLinks,
      schemaTypes: Array.from(schemaTypes),
      invalidSchemaBlocks,
      wordCount: words,
      responseTimeMs: page.responseTimeMs,
      pageSpeed,
      pageSpeedError,
      coreWebVitals: pageSpeed?.field || null,
    },
  }
}