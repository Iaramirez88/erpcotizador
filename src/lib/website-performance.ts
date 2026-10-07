type PageSpeedMetric = { percentile?: number; category?: string }
type PageSpeedPayload = {
  error?: { message?: string }
  loadingExperience?: { overall_category?: string; metrics?: Record<string, PageSpeedMetric> }
  lighthouseResult?: {
    fetchTime?: string
    categories?: Record<string, { score?: number }>
    audits?: Record<string, { score?: number | null; numericValue?: number; title?: string; description?: string; displayValue?: string }>
  }
}

export type PageSpeedStrategy = 'mobile' | 'desktop'

const MITIGATION_GUIDES: Record<string, string[]> = {
  'render-blocking-resources': ['Carga el CSS crítico en línea.', 'Difiere estilos secundarios y scripts que no intervienen en el primer render.', 'Elimina imports CSS no utilizados en la página inicial.'],
  'unused-javascript': ['Revisa el reporte de cobertura del navegador.', 'Divide el JavaScript por ruta o componente.', 'Carga widgets, chat y analítica después de la interacción o con lazy loading.'],
  'unused-css-rules': ['Elimina selectores no utilizados en producción.', 'Separa los estilos de esta página del CSS global.', 'Minifica el resultado después de purgar reglas.'],
  'modern-image-formats': ['Convierte imágenes fotográficas a AVIF o WebP.', 'Conserva PNG solo cuando necesites transparencia.', 'Configura el componente de imagen para negociar el formato automáticamente.'],
  'uses-optimized-images': ['Comprime las imágenes sin alterar sus dimensiones visibles.', 'Evita exportarlas con calidad innecesariamente alta.', 'Sirve variantes optimizadas desde CDN o el optimizador del framework.'],
  'uses-responsive-images': ['Genera tamaños adaptados a móvil, tableta y escritorio.', 'Declara srcset y sizes según el ancho real del contenedor.', 'No descargues una imagen de escritorio para mostrar una miniatura.'],
  'offscreen-images': ['Activa carga diferida en imágenes fuera del primer viewport.', 'No apliques lazy loading a la imagen LCP.', 'Reserva width y height para evitar saltos de diseño.'],
  'server-response-time': ['Mide la consulta o render que genera el HTML inicial.', 'Añade caché de página o datos donde el contenido lo permita.', 'Reduce redirecciones, consultas seriales y trabajo del servidor.'],
  'largest-contentful-paint-element': ['Identifica el elemento LCP indicado por Lighthouse.', 'Precarga su imagen o fuente y evita lazy loading sobre ese elemento.', 'Reduce su peso y elimina recursos que bloqueen su render.'],
  'total-blocking-time': ['Divide tareas JavaScript de más de 50 ms.', 'Mueve cálculos pesados a Web Workers o al servidor.', 'Retrasa scripts de terceros hasta después del contenido principal.'],
  'mainthread-work-breakdown': ['Reduce evaluación y ejecución de JavaScript.', 'Evita hidratar componentes que pueden renderizarse en servidor.', 'Virtualiza listas grandes y limita observadores activos.'],
  'third-party-summary': ['Elimina etiquetas de terceros sin uso.', 'Carga cada proveedor después del consentimiento o interacción.', 'Evita incluir dos herramientas que midan lo mismo.'],
  'font-display': ['Usa font-display: swap u optional.', 'Precarga únicamente la fuente crítica.', 'Reduce pesos y subconjuntos tipográficos descargados.'],
  'uses-text-compression': ['Activa Brotli o gzip en el proxy/CDN.', 'Comprueba compresión para HTML, CSS, JS, JSON y SVG.', 'Evita comprimir nuevamente formatos de imagen ya comprimidos.'],
  'uses-long-cache-ttl': ['Asigna caché larga e immutable a archivos con hash.', 'Mantén HTML con una política corta o revalidación.', 'Versiona los recursos cuando cambien.'],
  'efficient-cache-policy': ['Asigna caché larga e immutable a archivos con hash.', 'Mantén HTML con una política corta o revalidación.', 'Versiona los recursos cuando cambien.'],
  redirects: ['Enlaza directamente a la URL final.', 'Elimina cadenas entre HTTP, HTTPS, www y dominio canónico.', 'Actualiza enlaces internos y recursos con la URL definitiva.'],
  'dom-size': ['Reduce contenedores anidados sin función visual.', 'Renderiza listas extensas por páginas o mediante virtualización.', 'Monta modales y paneles solo cuando se utilicen.'],
}

function mitigationFor(id: string, title: string) {
  return MITIGATION_GUIDES[id] || [`Localiza “${title}” en el detalle de Lighthouse.`, 'Corrige primero los recursos con mayor ahorro estimado.', 'Vuelve a ejecutar la consulta y compara el valor antes/después.']
}

export function getPageSpeedStatus() {
  return { configured: Boolean(process.env.PAGESPEED_API_KEY?.trim()) }
}

export async function getPageSpeedInsights(targetUrl: string, strategy: PageSpeedStrategy = 'mobile') {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim()
  if (!apiKey) return null
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', targetUrl)
  endpoint.searchParams.set('key', apiKey)
  endpoint.searchParams.set('strategy', strategy)
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
    strategy,
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
    opportunities: Object.entries(audits)
      .filter(([, audit]) => typeof audit.score === 'number' && audit.score < 0.9 && (audit.title || audit.displayValue))
      .map(([id, audit]) => ({
        id,
        title: audit.title || id,
        description: audit.description?.replace(/\[([^\]]+)]\([^)]*\)/g, '$1').slice(0, 700) || null,
        displayValue: audit.displayValue || null,
        score: audit.score ?? null,
        steps: mitigationFor(id, audit.title || id),
      }))
      .sort((left, right) => (left.score ?? 1) - (right.score ?? 1))
      .slice(0, 12),
  }
}