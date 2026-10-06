"use client"

import { useCallback, useEffect, useState } from 'react'
import { Activity, BrainCircuit, ExternalLink, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type Position = {
  checkedAt: string
  position?: number | null
  resultUrl?: string | null
  clicks?: number | null
  impressions?: number | null
  ctr?: number | null
  source: string
}

type SeoKeyword = {
  id: string
  domain: string
  keyword: string
  country: string
  locationName?: string | null
  language: string
  device: string
  searchIntent: string
  serviceType?: string | null
  latestSerpPosition?: number | null
  previousSerpPosition?: number | null
  latestSerpUrl?: string | null
  latestSearchConsolePosition?: number | null
  previousSearchConsolePosition?: number | null
  latestSearchConsoleUrl?: string | null
  positions: Position[]
}

type AuditCheck = { label: string; status: 'PASS' | 'WARN' | 'FAIL' | 'INFO'; value: string; score: number; maxScore: number }
type SeoAudit = {
  id: string
  healthScore: number
  indexable: boolean
  statusCode?: number | null
  createdAt: string
  checksJson: Record<string, AuditCheck>
  recommendationsJson: string[]
  metricsJson: { responseTimeMs?: number; coreWebVitals?: unknown }
}

type SerpLocation = { code: number; name: string; countryCode: string; type: string }
type SeoIntelligence = {
  competitors: Array<{ domain: string; appearances: number; bestPosition: number; keywords: string[] }>
  keywords: Array<{ id: string; keyword: string; position?: number | null; serviceType?: string | null; searchIntent: string; competitors: Array<{ position: number | null; domain: string | null; url: string | null; title: string | null }>; actions: string[] }>
}

type SeoData = {
  project: {
    id: string
    nombre: string
    seoJson: { siteUrl?: string; searchConsoleSiteUrl?: string }
    seoKeywords: SeoKeyword[]
    seoAudits: SeoAudit[]
  }
  connection: { status: string; googleEmail?: string | null; scopes: string[]; lastSyncAt?: string | null } | null
  serp: { provider: string; configured: boolean; pendingTasks: number; budget: { budgetUsd: number; spentUsd: number; remainingUsd: number; tasks: number } }
  intelligence: SeoIntelligence
}

type Props = { projectId: string; defaultSiteUrl: string }
type JsonResponse<T> = { success?: boolean; data?: T; error?: string }
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

function formatPosition(value?: number | null) {
  return value == null ? '—' : value.toFixed(1)
}

function formatDelta(current?: number | null, previous?: number | null) {
  if (current == null || previous == null) return { text: '—', className: 'text-slate-500' }
  const delta = previous - current
  return {
    text: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`,
    className: delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500',
  }
}

export default function WebsiteProjectSeoClient({ projectId, defaultSiteUrl }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<SeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [siteUrl, setSiteUrl] = useState(defaultSiteUrl)
  const [propertyUrl, setPropertyUrl] = useState(defaultSiteUrl)
  const [keyword, setKeyword] = useState('')
  const [device, setDevice] = useState('DESKTOP')
  const [country, setCountry] = useState('COL')
  const [locationCode, setLocationCode] = useState<number | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locations, setLocations] = useState<SerpLocation[]>([])
  const [language, setLanguage] = useState('es')
  const [searchIntent, setSearchIntent] = useState('COMMERCIAL')
  const [serviceType, setServiceType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/seo`, { cache: 'no-store' })
      const json = await response.json() as JsonResponse<SeoData>
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo cargar el SEO del sitio.')
      setData(json.data)
      setSiteUrl(json.data.project.seoJson.siteUrl || defaultSiteUrl)
      setPropertyUrl(json.data.project.seoJson.searchConsoleSiteUrl || json.data.project.seoJson.siteUrl || defaultSiteUrl)
    } catch (error) {
      toast({ title: 'No se pudo cargar SEO', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [defaultSiteUrl, projectId, toast])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!data?.serp.configured) {
      setLocations([])
      return
    }
    const controller = new AbortController()
    fetch(`/api/servicios-web/seo/locations?country=${encodeURIComponent(country)}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json() as JsonResponse<SerpLocation[]>
        if (response.ok && json.data) setLocations(json.data)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [country, data?.serp.configured])

  async function requestAction<T>(key: string, url: string, body?: Record<string, unknown>) {
    setWorking(key)
    try {
      const response = await fetch(url, {
        method: 'POST',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      const json = await response.json() as JsonResponse<T>
      if (!response.ok) throw new Error(json.error || 'No se pudo completar la operación.')
      await load()
      return json.data
    } finally {
      setWorking('')
    }
  }

  async function saveSite() {
    setWorking('save')
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/seo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, searchConsoleSiteUrl: propertyUrl }),
      })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo guardar.')
      toast({ title: 'Configuración SEO guardada' })
      await load()
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally {
      setWorking('')
    }
  }

  async function addKeyword() {
    setWorking('add')
    try {
      const domain = new URL(siteUrl).hostname
      const response = await fetch('/api/crm/marketing/seo-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteProjectId: projectId, domain, keyword, country, locationCode, locationName, language, device, searchIntent, serviceType }),
      })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo agregar la palabra clave.')
      setKeyword('')
      await load()
    } catch (error) {
      toast({ title: 'No se pudo agregar', description: error instanceof Error ? error.message : 'Revisa la URL pública.', variant: 'destructive' })
    } finally {
      setWorking('')
    }
  }

  async function removeKeyword(id: string) {
    setWorking(id)
    try {
      const response = await fetch(`/api/crm/marketing/seo-keywords?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo eliminar.')
      await load()
    } catch (error) {
      toast({ title: 'No se pudo eliminar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally {
      setWorking('')
    }
  }

  async function syncSearchConsole() {
    try {
      const result = await requestAction<{ checked: number; matched: number }>('sync', `/api/servicios-web/projects/${projectId}/seo/sync`)
      toast({ title: 'Search Console actualizado', description: `${result?.matched || 0} de ${result?.checked || 0} keywords tienen datos.` })
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    }
  }

  async function syncSerp() {
    try {
      const result = await requestAction<{ collected: { completed: number }; queued: { queued: number } }>('serp', `/api/servicios-web/projects/${projectId}/seo/serp`)
      toast({ title: 'Rank Tracker actualizado', description: `${result?.collected.completed || 0} resultados guardados y ${result?.queued.queued || 0} consultas en cola.` })
    } catch (error) {
      toast({ title: 'No se pudo consultar DataForSEO', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    }
  }

  async function runAudit() {
    try {
      const audit = await requestAction<SeoAudit>('audit', `/api/servicios-web/projects/${projectId}/seo/audit`)
      toast({ title: `SEO Health Score: ${audit?.healthScore ?? 0}/100`, description: 'Auditoría técnica guardada en el historial.' })
    } catch (error) {
      toast({ title: 'No se pudo auditar el sitio', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    }
  }

  if (loading && !data) return <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando SEO...</div>
  if (!data) return null
  const connected = data.connection?.scopes.includes(SEARCH_CONSOLE_SCOPE) || false
  const latestAudit = data.project.seoAudits[0]

  return <div className="space-y-4">
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Search Console</p><h2 className="mt-1 text-xl font-semibold text-slate-950">SEO de {data.project.nombre}</h2><p className="mt-1 text-sm text-slate-600">Registra la URL, mide la SERP exacta y contrasta rendimiento real en Google.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{connected ? `Conectado · ${data.connection?.googleEmail || 'Google'}` : 'Sin conectar'}</span><Button asChild><a href={`/api/crm/marketing/google/connect?product=SEARCH_CONSOLE&returnTo=${encodeURIComponent(`/dashboard/configuracion/servicios-web/sitios/${projectId}/seo`)}`}>{connected ? 'Reconectar' : 'Conectar Search Console'}</a></Button></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><div><Label>URL pública del sitio</Label><Input className="mt-1.5" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://cliente.com/" /></div><div><Label>Propiedad exacta en Search Console</Label><Input className="mt-1.5" value={propertyUrl} onChange={(event) => setPropertyUrl(event.target.value)} placeholder="sc-domain:cliente.com" /><p className="mt-1 text-xs text-slate-500">Acepta URL-prefix o sc-domain.</p></div></div>
      <div className="mt-3 flex justify-end"><Button variant="outline" onClick={() => void saveSite()} disabled={working === 'save'}>{working === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar sitio SEO</Button></div>
    </section>

    {data.intelligence.keywords.length ? <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />SEO Intelligence</CardTitle><CardDescription>Interpreta posiciones y competidores orgánicos para convertir el ranking en acciones.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 p-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Competidores recurrentes</p><div className="space-y-2">{data.intelligence.competitors.length ? data.intelligence.competitors.slice(0, 6).map((competitor) => <div key={competitor.domain} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-900">{competitor.domain}</p><span className="text-xs text-slate-500">Mejor #{competitor.bestPosition}</span></div><p className="mt-1 text-xs text-slate-500">Aparece en {competitor.appearances} resultados · {competitor.keywords.length} keywords</p></div>) : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Consulta DataForSEO para identificar competidores reales.</p>}</div></div>
        <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Acciones por keyword</p><div className="space-y-3">{data.intelligence.keywords.slice(0, 6).map((insight) => <div key={insight.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{insight.keyword}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{insight.position == null ? 'Fuera del top 100' : `Posición ${insight.position.toFixed(1)}`}</span></div><p className="mt-1 text-xs text-slate-500">{insight.searchIntent}{insight.serviceType ? ` · ${insight.serviceType}` : ''}</p><ol className="mt-2 space-y-1 text-sm text-slate-700">{insight.actions.map((action, index) => <li key={`${insight.id}-${index}`}>{index + 1}. {action}</li>)}</ol>{insight.competitors.length ? <p className="mt-2 truncate text-xs text-slate-500">Top rival: {insight.competitors[0].domain} · posición {insight.competitors[0].position ?? '—'}</p> : null}</div>)}</div></div>
      </CardContent>
    </Card> : null}

    <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Auditoría técnica</CardTitle><CardDescription>Analiza indexabilidad, metadatos, estructura, enlaces, imágenes, schema, robots y sitemap.</CardDescription></div><Button onClick={() => void runAudit()} disabled={working === 'audit'}>{working === 'audit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}Auditar ahora</Button></div></CardHeader>
      <CardContent className="p-4">{latestAudit ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">SEO Health Score</p><p className="mt-1 text-3xl font-semibold text-slate-950">{latestAudit.healthScore}<span className="text-sm text-slate-400">/100</span></p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Indexabilidad</p><p className={`mt-2 font-semibold ${latestAudit.indexable ? 'text-emerald-700' : 'text-rose-700'}`}>{latestAudit.indexable ? 'Indexable' : 'Bloqueada'}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Estado HTTP</p><p className="mt-2 font-semibold">{latestAudit.statusCode || '—'}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Respuesta</p><p className="mt-2 font-semibold">{latestAudit.metricsJson.responseTimeMs ?? '—'} ms</p></div></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{Object.values(latestAudit.checksJson).map((check) => <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"><div className="min-w-0"><p className="text-sm font-medium text-slate-900">{check.label}</p><p className="truncate text-xs text-slate-500">{check.value}</p></div><span className={`text-xs font-semibold ${check.status === 'PASS' ? 'text-emerald-700' : check.status === 'WARN' ? 'text-amber-700' : 'text-rose-700'}`}>{check.score}/{check.maxScore}</span></div>)}</div>{latestAudit.recommendationsJson.length ? <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"><p className="text-sm font-semibold text-amber-950">Acciones recomendadas</p><ol className="mt-2 space-y-1 text-sm text-amber-900">{latestAudit.recommendationsJson.map((item, index) => <li key={`${item}-${index}`}>{index + 1}. {item}</li>)}</ol></div> : null}{data.project.seoAudits.length > 1 ? <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Historial de salud</p><div className="flex h-24 items-end gap-2">{data.project.seoAudits.slice().reverse().map((audit) => <div key={audit.id} className="flex min-w-0 flex-1 flex-col items-center gap-1"><span className="text-[10px] font-semibold text-slate-600">{audit.healthScore}</span><div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(4, audit.healthScore)}%` }} title={`${new Date(audit.createdAt).toLocaleDateString('es-CO')}: ${audit.healthScore}/100`} /></div>)}</div></div> : null}<p className="text-xs text-slate-500">Última auditoría: {new Date(latestAudit.createdAt).toLocaleString('es-CO')} · Core Web Vitals se habilitará al conectar PageSpeed/CrUX.</p></div> : <p className="text-sm text-slate-500">Ejecuta la primera auditoría para generar el SEO Health Score.</p>}</CardContent>
    </Card>

    <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Rank Tracker</CardTitle><CardDescription>DataForSEO mide posición exacta; Search Console mide posición media, clics e impresiones.</CardDescription><p className="mt-2 text-xs text-slate-500">{data.serp.configured ? `${data.serp.provider} listo · ${data.serp.pendingTasks} tareas pendientes · US$${data.serp.budget.spentUsd.toFixed(4)} de US$${data.serp.budget.budgetUsd.toFixed(2)} este mes` : 'DataForSEO pendiente de configuración'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void syncSearchConsole()} disabled={!connected || working === 'sync'}><RefreshCw className={`mr-2 h-4 w-4 ${working === 'sync' ? 'animate-spin' : ''}`} />Search Console</Button><Button size="sm" onClick={() => void syncSerp()} disabled={!data.serp.configured || working === 'serp'}><Search className={`mr-2 h-4 w-4 ${working === 'serp' ? 'animate-pulse' : ''}`} />Consultar DataForSEO</Button></div></div></CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-4"><div className="lg:col-span-2"><Label>Keyword exacta</Label><Input className="mt-1.5" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Ej. alquiler de plantas eléctricas Bogotá" /></div><div><Label>País</Label><Select value={country} onValueChange={(value) => { setCountry(value); setLocationCode(null); setLocationName('') }}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COL">Colombia</SelectItem><SelectItem value="MEX">México</SelectItem><SelectItem value="ESP">España</SelectItem><SelectItem value="USA">Estados Unidos</SelectItem><SelectItem value="ARG">Argentina</SelectItem><SelectItem value="CHL">Chile</SelectItem><SelectItem value="PER">Perú</SelectItem><SelectItem value="ECU">Ecuador</SelectItem><SelectItem value="BRA">Brasil</SelectItem></SelectContent></Select></div><div><Label>Ciudad o ubicación</Label><Input className="mt-1.5" list="seo-serp-locations" value={locationName} onChange={(event) => { const value = event.target.value; setLocationName(value); setLocationCode(locations.find((item) => item.name === value)?.code || null) }} placeholder="Bogota,Colombia" /><datalist id="seo-serp-locations">{locations.map((item) => <option key={item.code} value={item.name}>{item.type}</option>)}</datalist><p className="mt-1 text-[11px] text-slate-500">{locationCode ? `Ubicación oficial · código ${locationCode}` : 'Escribe una ciudad o selecciona una ubicación oficial.'}</p></div><div><Label>Idioma</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">Inglés</SelectItem><SelectItem value="pt">Portugués</SelectItem></SelectContent></Select></div><div><Label>Dispositivo</Label><Select value={device} onValueChange={setDevice}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DESKTOP">Escritorio</SelectItem><SelectItem value="MOBILE">Móvil</SelectItem></SelectContent></Select></div><div><Label>Intención</Label><Select value={searchIntent} onValueChange={setSearchIntent}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMMERCIAL">Comercial</SelectItem><SelectItem value="TRANSACTIONAL">Transaccional</SelectItem><SelectItem value="INFORMATIONAL">Informativa</SelectItem><SelectItem value="NAVIGATIONAL">Navegacional</SelectItem><SelectItem value="LOCAL">Local</SelectItem></SelectContent></Select></div><div><Label>Servicio</Label><Input className="mt-1.5" value={serviceType} onChange={(event) => setServiceType(event.target.value)} placeholder="Alquiler de plantas" /></div></div>
        <div className="flex justify-end"><Button onClick={() => void addKeyword()} disabled={!keyword.trim() || working === 'add'}><Plus className="mr-2 h-4 w-4" />Agregar keyword</Button></div>
        <div className="divide-y rounded-xl border border-slate-200">{data.project.seoKeywords.length === 0 ? <p className="p-4 text-sm text-slate-500">Agrega la primera palabra clave para comenzar.</p> : data.project.seoKeywords.map((item) => {
          const serpDelta = formatDelta(item.latestSerpPosition, item.previousSerpPosition)
          const searchConsoleDelta = formatDelta(item.latestSearchConsolePosition, item.previousSearchConsolePosition)
          const latestSearchConsole = item.positions.find((position) => position.source === 'SEARCH_CONSOLE')
          const serpHistory = item.positions.filter((position) => position.source === 'DATAFORSEO').slice(0, 6).reverse()
          return <div key={item.id} className="grid items-center gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_120px_170px_auto]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.keyword}</p><p className="truncate text-xs text-slate-500">{item.country}{item.locationName ? ` · ${item.locationName}` : ''} · {item.language.toUpperCase()} · {item.device === 'MOBILE' ? 'Móvil' : 'Escritorio'} · {item.searchIntent}</p><p className="truncate text-xs text-slate-400">{item.domain}{item.serviceType ? ` · ${item.serviceType}` : ''}</p>{serpHistory.length > 1 ? <p className="mt-1 truncate text-[11px] text-slate-500">Historial SERP: {serpHistory.map((position) => formatPosition(position.position)).join(' → ')}</p> : null}</div><div><p className="text-xs text-slate-500">SERP exacta</p><div className="flex items-baseline gap-2"><p className="font-semibold">{formatPosition(item.latestSerpPosition)}</p><p className={`text-xs ${serpDelta.className}`}>{serpDelta.text}</p></div></div><div><p className="text-xs text-slate-500">Search Console (promedio)</p><div className="flex items-baseline gap-2"><p className="font-semibold">{formatPosition(item.latestSearchConsolePosition)}</p><p className={`text-xs ${searchConsoleDelta.className}`}>{searchConsoleDelta.text}</p></div><p className="text-[11px] text-slate-400">{latestSearchConsole?.clicks ?? 0} clics · {latestSearchConsole?.impressions ?? 0} impresiones</p></div><div className="flex justify-end"><Button asChild variant="ghost" size="icon" disabled={!item.latestSerpUrl && !item.latestSearchConsoleUrl}><a href={item.latestSerpUrl || item.latestSearchConsoleUrl || '#'} target="_blank" rel="noreferrer" aria-label="Abrir resultado"><ExternalLink className="h-4 w-4" /></a></Button><Button variant="ghost" size="icon" onClick={() => void removeKeyword(item.id)} disabled={working === item.id} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></div></div>
        })}</div>
      </CardContent>
    </Card>
  </div>
}
