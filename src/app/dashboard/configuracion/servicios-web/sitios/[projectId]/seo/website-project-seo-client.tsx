"use client"

import { useCallback, useEffect, useState } from 'react'
import { Activity, CheckCircle2, Gauge, Loader2, Monitor, Plus, RefreshCw, Search, ShieldCheck, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import SeoDiagnosticsReport, { type SeoDiagnosticAudit } from './seo-diagnostics-report'

type Position = {
  checkedAt: string
  position?: number | null
  resultUrl?: string | null
  clicks?: number | null
  impressions?: number | null
  ctr?: number | null
  source: string
  rawJson?: unknown
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

type SeoAudit = SeoDiagnosticAudit

type SerpLocation = { code: number; name: string; countryCode: string; type: string }
type PerformanceAdvice = { summary: string; quickWins: Array<{ title: string; action: string; expectedImpact: string }>; phases: Array<{ name: string; objective: string; tasks: string[]; verification: string }> }
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

function rankDescription(position?: number | null) {
  if (position == null) return { range: 'Fuera del top 100', description: 'Google no encontró el dominio entre los primeros 100 resultados.' }
  if (position <= 3) return { range: 'Top 3', description: 'Máxima visibilidad orgánica; conviene defender contenido y CTR.' }
  if (position <= 10) return { range: 'Top 10', description: 'Primera página de resultados, con oportunidad de subir al top 3.' }
  if (position <= 20) return { range: 'Top 20', description: 'Segunda página; necesita relevancia, enlaces y autoridad.' }
  if (position <= 50) return { range: 'Top 50', description: 'Visibilidad baja; requiere una optimización sustancial.' }
  return { range: 'Top 100', description: 'Posición inicial con poca exposición y trabajo estructural pendiente.' }
}

function searchVolume(positions: Position[]) {
  for (const position of positions) {
    if (!position.rawJson || typeof position.rawJson !== 'object' || Array.isArray(position.rawJson)) continue
    const value = (position.rawJson as Record<string, unknown>).searchVolume
    if (typeof value === 'number') return value
  }
  return null
}

function averagePosition(positions: Position[], source: string) {
  const values = positions.filter((position) => position.source === source && typeof position.position === 'number').map((position) => position.position as number)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
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
  const [diagnosticTab, setDiagnosticTab] = useState<'SEO' | 'PERFORMANCE'>('SEO')
  const [performanceStrategy, setPerformanceStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [performanceAdvice, setPerformanceAdvice] = useState<PerformanceAdvice | null>(null)

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
      const json = await response.json() as JsonResponse<{ id: string }>
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo agregar la palabra clave.')
      setKeyword('')
      await load()
      setWorking(json.data.id)
      const rankResponse = await fetch(`/api/servicios-web/projects/${projectId}/seo/serp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywordId: json.data.id }) })
      const rankJson = await rankResponse.json() as JsonResponse<{ position: number | null; searchVolume: number | null }>
      if (!rankResponse.ok) {
        toast({ title: 'Keyword guardada, consulta pendiente', description: rankJson.error || 'Puedes volver a consultar DataForSEO desde el encabezado.', variant: 'destructive' })
      } else {
        toast({ title: 'Keyword analizada', description: rankJson.data?.position == null ? 'El dominio no aparece en el top 100.' : `Posición actual: ${rankJson.data.position}.` })
      }
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

  async function refreshKeyword(id: string) {
    setWorking(id)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/seo/serp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywordId: id }) })
      const json = await response.json() as JsonResponse<{ position: number | null }>
      if (!response.ok) throw new Error(json.error || 'No se pudo actualizar la keyword.')
      await load()
    } catch (error) {
      toast({ title: 'No se pudo consultar DataForSEO', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
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

  async function runAudit(mode: 'SEO' | 'PERFORMANCE') {
    try {
      const audit = await requestAction<SeoAudit>('audit', `/api/servicios-web/projects/${projectId}/seo/audit`, { mode, strategy: performanceStrategy })
      toast({ title: mode === 'SEO' ? `SEO Health Score: ${audit?.healthScore ?? 0}/100` : `Rendimiento ${performanceStrategy === 'mobile' ? 'móvil' : 'escritorio'} actualizado`, description: 'Consulta guardada en el historial.' })
    } catch (error) {
      toast({ title: 'No se pudo auditar el sitio', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    }
  }

  async function explainPerformance(auditId: string) {
    setWorking('performance-ai')
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/seo/performance-advice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId }) })
      const json = await response.json() as JsonResponse<PerformanceAdvice>
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo generar el plan de mejora.')
      setPerformanceAdvice(json.data)
    } catch (error) {
      toast({ title: 'No se pudo generar la explicación', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally {
      setWorking('')
    }
  }

  if (loading && !data) return <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando SEO...</div>
  if (!data) return null
  const connected = data.connection?.scopes.includes(SEARCH_CONSOLE_SCOPE) || false
  const seoAudits = data.project.seoAudits.filter((audit) => audit.metricsJson.auditType !== 'PERFORMANCE')
  const performanceAudits = data.project.seoAudits.filter((audit) => audit.metricsJson.pageSpeed && (audit.metricsJson.pageSpeed.strategy || 'mobile') === performanceStrategy)

  return <div className="space-y-4">
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Search Console</p><h2 className="mt-1 text-xl font-semibold text-slate-950">SEO de {data.project.nombre}</h2><p className="mt-1 text-sm text-slate-600">Registra la URL, mide la SERP exacta y contrasta rendimiento real en Google.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{connected ? `Conectado · ${data.connection?.googleEmail || 'Google'}` : 'Sin conectar'}</span><Button asChild><a href={`/api/crm/marketing/google/connect?product=SEARCH_CONSOLE&returnTo=${encodeURIComponent(`/dashboard/configuracion/servicios-web/sitios/${projectId}/seo`)}`}>{connected ? 'Reconectar' : 'Conectar Search Console'}</a></Button></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><div><Label>URL pública del sitio</Label><Input className="mt-1.5" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://cliente.com/" /></div><div><Label>Propiedad exacta en Search Console</Label><Input className="mt-1.5" value={propertyUrl} onChange={(event) => setPropertyUrl(event.target.value)} placeholder="sc-domain:cliente.com" /><p className="mt-1 text-xs text-slate-500">Acepta URL-prefix o sc-domain.</p></div></div>
      <div className="mt-3 flex justify-end"><Button variant="outline" onClick={() => void saveSite()} disabled={working === 'save'}>{working === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar sitio SEO</Button></div>
    </section>

    <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <Tabs value={diagnosticTab} onValueChange={(value) => setDiagnosticTab(value as 'SEO' | 'PERFORMANCE')}>
        <CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" />Centro de diagnóstico</CardTitle><CardDescription>Consulta por separado la calidad SEO y el rendimiento técnico del sitio.</CardDescription></div><TabsList className="grid w-full grid-cols-2 md:w-[360px]"><TabsTrigger value="SEO"><ShieldCheck className="mr-2 h-4 w-4" />SEO técnico</TabsTrigger><TabsTrigger value="PERFORMANCE"><Activity className="mr-2 h-4 w-4" />Rendimiento</TabsTrigger></TabsList></div></CardHeader>
        <CardContent className="p-4">
          <TabsContent value="SEO" className="mt-0 space-y-4"><div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-950">Diagnóstico SEO</h3><p className="text-xs text-slate-500">Revisa indexabilidad, metadatos, encabezados, enlaces, imágenes y datos estructurados.</p></div><Button onClick={() => void runAudit('SEO')} disabled={working === 'audit'}>{working === 'audit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Consultar SEO</Button></div><SeoDiagnosticsReport audits={seoAudits} mode="SEO" /></TabsContent>
          <TabsContent value="PERFORMANCE" className="mt-0 space-y-4"><div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-semibold text-slate-950">Rendimiento PageSpeed</h3><p className="text-xs text-slate-500">Elige el dispositivo, consulta Lighthouse y recibe instrucciones concretas para mejorar.</p></div><div className="flex flex-wrap items-center gap-2"><Select value={performanceStrategy} onValueChange={(value) => { setPerformanceStrategy(value as 'mobile' | 'desktop'); setPerformanceAdvice(null) }}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mobile"><span className="flex items-center"><Smartphone className="mr-2 h-4 w-4" />Móvil</span></SelectItem><SelectItem value="desktop"><span className="flex items-center"><Monitor className="mr-2 h-4 w-4" />Escritorio</span></SelectItem></SelectContent></Select><Button variant="outline" onClick={() => void explainPerformance(performanceAudits[0]?.id || '')} disabled={!performanceAudits.length || working === 'performance-ai'}>{working === 'performance-ai' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Explicar con IA</Button><Button onClick={() => { setPerformanceAdvice(null); void runAudit('PERFORMANCE') }} disabled={working === 'audit'}>{working === 'audit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}Consultar rendimiento</Button></div></div><SeoDiagnosticsReport audits={performanceAudits} mode="PERFORMANCE" />{performanceAdvice ? <section className="border-t border-slate-200 pt-5"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-sky-600" /><h3 className="font-semibold text-slate-950">Plan de mejora asistido por IA</h3></div><p className="mt-2 text-sm leading-6 text-slate-600">{performanceAdvice.summary}</p>{performanceAdvice.quickWins.length ? <div className="mt-4"><h4 className="text-xs font-semibold uppercase text-slate-500">Mejoras rápidas</h4><div className="mt-2 grid gap-3 md:grid-cols-2">{performanceAdvice.quickWins.map((item) => <div key={item.title} className="border border-sky-200 bg-sky-50 p-3"><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-700">{item.action}</p><p className="mt-2 text-xs font-medium text-sky-700">Impacto esperado: {item.expectedImpact}</p></div>)}</div></div> : null}<div className="mt-5 space-y-3">{performanceAdvice.phases.map((phase, index) => <article key={phase.name} className="border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center bg-sky-600 text-xs font-semibold text-white">{index + 1}</span><div><h4 className="font-semibold text-slate-900">{phase.name}</h4><p className="mt-1 text-sm text-slate-600">{phase.objective}</p><ul className="mt-3 space-y-2">{phase.tasks.map((task) => <li key={task} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{task}</li>)}</ul><p className="mt-3 text-xs font-medium text-slate-500">Verificación: {phase.verification}</p></div></div></article>)}</div></section> : null}</TabsContent>
        </CardContent>
      </Tabs>
    </Card>

    <Card className="rounded-[24px] border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" />Rank Tracker</CardTitle><CardDescription>DataForSEO mide posición exacta; Search Console mide posición media, clics e impresiones.</CardDescription><p className="mt-2 text-xs text-slate-500">{data.serp.configured ? `${data.serp.provider} listo · ${data.serp.pendingTasks} tareas pendientes · US$${data.serp.budget.spentUsd.toFixed(4)} de US$${data.serp.budget.budgetUsd.toFixed(2)} este mes` : 'DataForSEO pendiente de configuración'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void syncSearchConsole()} disabled={!connected || working === 'sync'}><RefreshCw className={`mr-2 h-4 w-4 ${working === 'sync' ? 'animate-spin' : ''}`} />Search Console</Button><Button size="sm" onClick={() => void syncSerp()} disabled={!data.serp.configured || working === 'serp'}><Search className={`mr-2 h-4 w-4 ${working === 'serp' ? 'animate-pulse' : ''}`} />Consultar DataForSEO</Button></div></div></CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-4"><div className="lg:col-span-2"><Label>Keyword exacta</Label><Input className="mt-1.5" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Ej. alquiler de plantas eléctricas Bogotá" /></div><div><Label>País</Label><Select value={country} onValueChange={(value) => { setCountry(value); setLocationCode(null); setLocationName('') }}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COL">Colombia</SelectItem><SelectItem value="MEX">México</SelectItem><SelectItem value="ESP">España</SelectItem><SelectItem value="USA">Estados Unidos</SelectItem><SelectItem value="ARG">Argentina</SelectItem><SelectItem value="CHL">Chile</SelectItem><SelectItem value="PER">Perú</SelectItem><SelectItem value="ECU">Ecuador</SelectItem><SelectItem value="BRA">Brasil</SelectItem></SelectContent></Select></div><div><Label>Ciudad o ubicación</Label><Input className="mt-1.5" list="seo-serp-locations" value={locationName} onChange={(event) => { const value = event.target.value; setLocationName(value); setLocationCode(locations.find((item) => item.name === value)?.code || null) }} placeholder="Bogota,Colombia" /><datalist id="seo-serp-locations">{locations.map((item) => <option key={item.code} value={item.name}>{item.type}</option>)}</datalist><p className="mt-1 text-[11px] text-slate-500">{locationCode ? `Ubicación oficial · código ${locationCode}` : 'Escribe una ciudad o selecciona una ubicación oficial.'}</p></div><div><Label>Idioma</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">Inglés</SelectItem><SelectItem value="pt">Portugués</SelectItem></SelectContent></Select></div><div><Label>Dispositivo</Label><Select value={device} onValueChange={setDevice}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DESKTOP">Escritorio</SelectItem><SelectItem value="MOBILE">Móvil</SelectItem></SelectContent></Select></div><div><Label>Intención</Label><Select value={searchIntent} onValueChange={setSearchIntent}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMMERCIAL">Comercial</SelectItem><SelectItem value="TRANSACTIONAL">Transaccional</SelectItem><SelectItem value="INFORMATIONAL">Informativa</SelectItem><SelectItem value="NAVIGATIONAL">Navegacional</SelectItem><SelectItem value="LOCAL">Local</SelectItem></SelectContent></Select></div><div><Label>Servicio</Label><Input className="mt-1.5" value={serviceType} onChange={(event) => setServiceType(event.target.value)} placeholder="Alquiler de plantas" /></div></div>
        <div className="flex justify-end"><Button onClick={() => void addKeyword()} disabled={!keyword.trim() || working === 'add'}><Plus className="mr-2 h-4 w-4" />Agregar keyword</Button></div>
        <div className="overflow-x-auto border border-slate-200"><div className="hidden min-w-[1180px] grid-cols-[1.35fr_0.85fr_0.8fr_0.7fr_1.4fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase text-slate-500 lg:grid"><span>Keyword y URL detectada</span><span>Rango actual</span><span>Posición y promedio</span><span>Búsquedas/mes</span><span>Sugerencias para mejorar</span><span /></div>{data.project.seoKeywords.length === 0 ? <p className="p-4 text-sm text-slate-500">Agrega la primera palabra clave para comenzar.</p> : data.project.seoKeywords.map((item) => {
          const serpDelta = formatDelta(item.latestSerpPosition, item.previousSerpPosition)
          const latestSearchConsole = item.positions.find((position) => position.source === 'SEARCH_CONSOLE')
          const serpAverage = averagePosition(item.positions, 'DATAFORSEO')
          const monthlyVolume = searchVolume(item.positions)
          const rank = rankDescription(item.latestSerpPosition)
          const insight = data.intelligence.keywords.find((candidate) => candidate.id === item.id)
          const processing = working === item.id
          return <div key={item.id} className="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 lg:min-w-[1180px] lg:grid-cols-[1.35fr_0.85fr_0.8fr_0.7fr_1.4fr_auto]">
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{item.keyword}</p><p className="mt-1 truncate text-xs font-medium text-sky-700">{item.latestSerpUrl || item.latestSearchConsoleUrl || `Sin URL posicionada · ${item.domain}`}</p><p className="mt-1 text-[11px] text-slate-500">{item.country}{item.locationName ? ` · ${item.locationName}` : ''} · {item.device === 'MOBILE' ? 'Móvil' : 'Escritorio'} · {item.searchIntent}</p></div>
            <div><p className="text-sm font-semibold text-slate-900">{processing ? 'Consultando…' : rank.range}</p><p className="mt-1 text-xs leading-5 text-slate-500">{processing ? 'DataForSEO está procesando ranking y volumen.' : rank.description}</p></div>
            <div><div className="flex items-baseline gap-2"><span className="text-xl font-semibold text-slate-950">{processing ? '—' : formatPosition(item.latestSerpPosition)}</span><span className={`text-xs ${serpDelta.className}`}>{serpDelta.text}</span></div><p className="text-[11px] text-slate-500">Promedio {item.positions.filter((position) => position.source === 'DATAFORSEO').length} consultas: {formatPosition(serpAverage)}</p><p className="mt-1 text-[11px] text-slate-400">Search Console: {formatPosition(item.latestSearchConsolePosition)} · {latestSearchConsole?.clicks ?? 0} clics</p></div>
            <div><p className="text-xl font-semibold text-slate-950">{processing ? '—' : monthlyVolume == null ? 'Sin dato' : monthlyVolume.toLocaleString('es-CO')}</p><p className="text-[11px] text-slate-500">Promedio mensual estimado por Google Ads</p></div>
            <div>{processing ? <div className="flex items-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analizando resultados…</div> : <ol className="space-y-1 text-xs leading-5 text-slate-700">{(insight?.actions || ['Ejecuta DataForSEO para generar recomendaciones.']).slice(0, 3).map((action, index) => <li key={`${item.id}-action-${index}`}><span className="font-semibold text-slate-900">{index + 1}.</span> {action}</li>)}</ol>}</div>
            <div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => void refreshKeyword(item.id)} disabled={processing} aria-label="Actualizar ranking" title="Actualizar ranking y volumen"><RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} /></Button><Button variant="ghost" size="icon" onClick={() => void removeKeyword(item.id)} disabled={processing} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></div>
          </div>
        })}</div>
      </CardContent>
    </Card>
  </div>
}
