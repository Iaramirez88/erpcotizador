"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, BarChart3, Bot, ExternalLink, Gauge, Loader2, Plus, RefreshCw, Search, Sparkles, Target, Trash2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type Overview = {
  googleConfiguration: { configured: boolean; redirectUri?: string | null; message?: string }
  connection: {
    id: string
    status: string
    googleEmail?: string | null
    googleAdsCustomerId?: string | null
    googleAdsConnectionMode?: 'DIRECT' | 'MCC' | null
    googleAdsLoginCustomerId?: string | null
    googleAnalyticsPropertyId?: string | null
    searchConsoleSiteUrl?: string | null
    scopes: string[]
    lastSyncAt?: string | null
    lastErrorMessage?: string | null
  } | null
  websites: Array<{ id: string; nombre: string; primaryDomain?: string | null; subdomain?: string | null; status: string }>
  keywords: Array<{
    id: string
    domain: string
    keyword: string
    device: string
    latestPosition?: number | null
    previousPosition?: number | null
    latestUrl?: string | null
    lastCheckedAt?: string | null
    positions: Array<{ id: string; position?: number | null; clicks?: number | null; impressions?: number | null; checkedAt: string }>
  }>
  briefs: Array<{
    id: string
    title: string
    targetKeyword?: string | null
    contentType: string
    status: string
    generatedText?: string | null
    updatedAt: string
  }>
  metrics: {
    impressions?: number | null
    clicks?: number | null
    cost?: number | null
    crmLeads?: number | null
    qualifiedLeads?: number | null
    opportunities?: number | null
    quotes?: number | null
    sales?: number | null
    crmRevenue?: number | null
    crmGrossProfit?: number | null
    attributedLeads: number
  }
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }
type GoogleResources = {
  ads: Array<{ id: string; name: string; manager: boolean; currencyCode?: string | null; warning?: string }>
  analytics: Array<{ id: string; name: string; accountName: string }>
  searchConsole: Array<{ siteUrl: string; permissionLevel?: string | null }>
  selected: { googleAdsCustomerId?: string | null; googleAnalyticsPropertyId?: string | null; searchConsoleSiteUrl?: string | null }
  warnings: string[]
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value || 0)
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

export function CrmMarketingSeoTab() {
  const { toast } = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [working, setWorking] = useState('')
  const [settings, setSettings] = useState({ googleAdsCustomerId: '', googleAnalyticsPropertyId: '', searchConsoleSiteUrl: '' })
  const [googleResources, setGoogleResources] = useState<GoogleResources | null>(null)
  const [discoveredConnectionId, setDiscoveredConnectionId] = useState('')
  const [keywordForm, setKeywordForm] = useState({ websiteProjectId: '', domain: '', keyword: '', device: 'DESKTOP' })
  const [contentForm, setContentForm] = useState({ websiteProjectId: '', seedIdea: '', targetKeyword: '', contentType: 'BLOG_POST', competitorUrls: '' })

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/crm/marketing/overview', { cache: 'no-store' })
      const json = await response.json() as JsonResponse<Overview>
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo cargar Marketing y SEO.')
      setOverview(json.data)
      setSettings({
        googleAdsCustomerId: json.data.connection?.googleAdsCustomerId || '',
        googleAnalyticsPropertyId: json.data.connection?.googleAnalyticsPropertyId || '',
        searchConsoleSiteUrl: json.data.connection?.searchConsoleSiteUrl || '',
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar Marketing y SEO.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOverview() }, [loadOverview])

  const discoverGoogleResources = useCallback(async (showToast: boolean) => {
    setWorking('resources')
    try {
      const response = await fetch('/api/crm/marketing/google/resources', { method: 'POST' })
      const json = await response.json() as JsonResponse<GoogleResources>
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudieron consultar las cuentas disponibles.')
      setGoogleResources(json.data)
      setSettings((current) => ({
        googleAdsCustomerId: json.data?.selected.googleAdsCustomerId || current.googleAdsCustomerId,
        googleAnalyticsPropertyId: json.data?.selected.googleAnalyticsPropertyId || current.googleAnalyticsPropertyId,
        searchConsoleSiteUrl: json.data?.selected.searchConsoleSiteUrl || current.searchConsoleSiteUrl,
      }))
      if (showToast) toast({
        title: 'Cuentas de Google actualizadas',
        description: json.data.warnings[0] || `${json.data.ads.length} Ads · ${json.data.analytics.length} Analytics · ${json.data.searchConsole.length} Search Console`,
      })
    } catch (error) {
      if (showToast) toast({ title: 'No se pudieron buscar las cuentas', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally {
      setWorking('')
    }
  }, [toast])

  useEffect(() => {
    const connectionId = overview?.connection?.status === 'ACTIVE' ? overview.connection.id : ''
    if (!connectionId || connectionId === discoveredConnectionId) return
    setDiscoveredConnectionId(connectionId)
    void discoverGoogleResources(false)
  }, [discoverGoogleResources, discoveredConnectionId, overview?.connection?.id, overview?.connection?.status])

  async function saveSettings() {
    setWorking('settings')
    try {
      const response = await fetch('/api/crm/marketing/google/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo guardar.')
      toast({ title: 'Propiedades guardadas' })
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  async function addKeyword() {
    setWorking('keyword')
    try {
      const response = await fetch('/api/crm/marketing/seo-keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(keywordForm),
      })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo agregar la palabra clave.')
      setKeywordForm((current) => ({ ...current, keyword: '' }))
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo agregar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  async function deleteKeyword(id: string) {
    setWorking(id)
    try {
      const response = await fetch(`/api/crm/marketing/seo-keywords?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo eliminar.')
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo eliminar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  async function syncPositions() {
    setWorking('sync')
    try {
      const response = await fetch('/api/crm/marketing/seo-keywords/sync', { method: 'POST' })
      const json = await response.json() as JsonResponse<{ checked: number; matched: number }>
      if (!response.ok) throw new Error(json.error || 'No se pudieron consultar posiciones.')
      toast({ title: 'Posiciones actualizadas', description: `${json.data?.matched || 0} de ${json.data?.checked || 0} palabras con datos.` })
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  async function syncGoogleMarketing() {
    setWorking('google-sync')
    try {
      const response = await fetch('/api/crm/marketing/google/sync', { method: 'POST' })
      const json = await response.json() as JsonResponse<{ adsRows: number; warnings: string[] }>
      if (!response.ok) throw new Error(json.error || 'No se pudo sincronizar Google Marketing.')
      toast({
        title: 'Datos de Google actualizados',
        description: json.data?.warnings?.[0] || `${json.data?.adsRows || 0} filas publicitarias procesadas.`,
      })
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  async function generateContent() {
    setWorking('content')
    try {
      const competitorUrls = contentForm.competitorUrls.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean)
      const response = await fetch('/api/crm/marketing/content/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...contentForm, competitorUrls }),
      })
      const json = await response.json() as JsonResponse<unknown>
      if (!response.ok) throw new Error(json.error || 'No se pudo generar el contenido.')
      setContentForm((current) => ({ ...current, seedIdea: '', targetKeyword: '', competitorUrls: '' }))
      toast({ title: 'Borrador generado', description: 'Quedó guardado para revisión humana.' })
      await loadOverview()
    } catch (error) {
      toast({ title: 'No se pudo generar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'destructive' })
    } finally { setWorking('') }
  }

  if (loading && !overview) return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando Marketing y SEO...</div>
  if (!overview) return (
    <div className="rounded-[24px] border border-rose-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-rose-50 p-2 text-rose-600"><AlertCircle className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-950">Marketing y SEO no pudo iniciar</h2>
          <p className="mt-1 text-sm text-slate-600">{loadError || 'No se recibió información del servidor.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void loadOverview()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button>
            <Button asChild variant="outline"><a href="/dashboard/crm/integraciones?view=google">Ir a conexiones Google</a></Button>
          </div>
        </div>
      </div>
    </div>
  )

  const connected = overview.connection?.status === 'ACTIVE'
  const costPerLead = overview.metrics.crmLeads ? (overview.metrics.cost || 0) / overview.metrics.crmLeads : 0
  const roas = overview.metrics.cost ? (overview.metrics.crmRevenue || 0) / overview.metrics.cost : 0
  const googleProducts: Array<{ key: string; name: string; description: string; icon: LucideIcon; scope: string }> = [
    { key: 'ADS', name: 'Google Ads', description: 'Campañas, inversión y conversiones', icon: Target, scope: 'https://www.googleapis.com/auth/adwords' },
    { key: 'ANALYTICS', name: 'Google Analytics', description: 'Tráfico y comportamiento web', icon: BarChart3, scope: 'https://www.googleapis.com/auth/analytics.readonly' },
    { key: 'SEARCH_CONSOLE', name: 'Search Console', description: 'Consultas, clics y posición SEO', icon: Search, scope: 'https://www.googleapis.com/auth/webmasters.readonly' },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Google Marketing</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Ads, Analytics y Search Console</h2>
            <p className="mt-1 text-sm text-slate-600">Una autorización, tres fuentes y atribución comercial dentro del CRM.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {connected ? `Conectado · ${overview.connection?.googleEmail || 'Google'}` : 'Sin conectar'}
            </span>
            {connected ? <Button variant="outline" className="rounded-xl" onClick={() => void syncGoogleMarketing()} disabled={working === 'google-sync'}><RefreshCw className={`mr-2 h-4 w-4 ${working === 'google-sync' ? 'animate-spin' : ''}`} />Sincronizar datos</Button> : null}
          </div>
        </div>
        {!overview.googleConfiguration.configured ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{overview.googleConfiguration.message}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {googleProducts.map(({ key, name, description, icon: Icon, scope }) => (
            <div key={name} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5 text-slate-700" /><span className={`text-[11px] font-semibold ${overview.connection?.scopes.includes(scope) ? 'text-emerald-700' : 'text-amber-700'}`}>{overview.connection?.scopes.includes(scope) ? 'Conectado' : 'Pendiente'}</span></div>
              <p className="mt-3 font-semibold text-slate-950">{name}</p><p className="mt-1 text-xs text-slate-600">{description}</p>
              {key === 'ADS' && overview.connection?.googleAdsConnectionMode ? <p className="mt-2 text-[11px] font-medium text-slate-500">Modalidad: {overview.connection.googleAdsConnectionMode === 'MCC' ? `MCC ${overview.connection.googleAdsLoginCustomerId || ''}`.trim() : 'cuenta propia'}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {overview.googleConfiguration.configured && key === 'ADS' ? <>
                  <Button asChild size="sm" variant="outline"><a href="/api/crm/marketing/google/connect?product=ADS&adsMode=DIRECT">Cuenta propia</a></Button>
                  <Button asChild size="sm" variant="outline"><a href="/api/crm/marketing/google/connect?product=ADS&adsMode=MCC">Mediante MCC</a></Button>
                </> : null}
                {overview.googleConfiguration.configured && key !== 'ADS' ? <Button asChild size="sm" variant="outline"><a href={`/api/crm/marketing/google/connect?product=${key}`}>{overview.connection?.scopes.includes(scope) ? 'Reconectar' : 'Conectar'}</a></Button> : null}
                {!overview.googleConfiguration.configured ? <Button size="sm" variant="outline" disabled>Conectar</Button> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div><Label>Cuenta de Google Ads</Label>{googleResources?.ads.length ? <Select value={settings.googleAdsCustomerId} onValueChange={(value) => setSettings((current) => ({ ...current, googleAdsCustomerId: value }))}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger><SelectContent>{googleResources.ads.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.id}{account.manager ? ' · MCC' : ''}{account.warning ? ' · detalle no disponible' : ''}</SelectItem>)}</SelectContent></Select> : <Input value={settings.googleAdsCustomerId} onChange={(event) => setSettings((current) => ({ ...current, googleAdsCustomerId: event.target.value }))} placeholder={working === 'resources' ? 'Buscando cuentas...' : 'Sin cuentas disponibles'} className="mt-1.5" />}</div>
          <div><Label>Propiedad de Google Analytics</Label>{googleResources?.analytics.length ? <Select value={settings.googleAnalyticsPropertyId} onValueChange={(value) => setSettings((current) => ({ ...current, googleAnalyticsPropertyId: value }))}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger><SelectContent>{googleResources.analytics.map((property) => <SelectItem key={property.id} value={property.id}>{property.name} · {property.accountName}</SelectItem>)}</SelectContent></Select> : <Input value={settings.googleAnalyticsPropertyId} onChange={(event) => setSettings((current) => ({ ...current, googleAnalyticsPropertyId: event.target.value }))} placeholder={working === 'resources' ? 'Buscando propiedades...' : 'Sin propiedades disponibles'} className="mt-1.5" />}</div>
          <div><Label>Propiedad de Search Console</Label>{googleResources?.searchConsole.length ? <Select value={settings.searchConsoleSiteUrl} onValueChange={(value) => setSettings((current) => ({ ...current, searchConsoleSiteUrl: value }))}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger><SelectContent>{googleResources.searchConsole.map((site) => <SelectItem key={site.siteUrl} value={site.siteUrl}>{site.siteUrl}</SelectItem>)}</SelectContent></Select> : <Input value={settings.searchConsoleSiteUrl} onChange={(event) => setSettings((current) => ({ ...current, searchConsoleSiteUrl: event.target.value }))} placeholder={working === 'resources' ? 'Buscando propiedades...' : 'Sin propiedades disponibles'} className="mt-1.5" />}</div>
        </div>
        {googleResources?.warnings.length ? <div className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{googleResources.warnings.join(' ')}</div> : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => void discoverGoogleResources(true)} disabled={!connected || working === 'resources'}><RefreshCw className={`mr-2 h-4 w-4 ${working === 'resources' ? 'animate-spin' : ''}`} />Buscar cuentas</Button><Button variant="outline" onClick={() => void saveSettings()} disabled={!connected || working === 'settings'}>{working === 'settings' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Guardar selección</Button></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[['Inversión', formatMoney(overview.metrics.cost)], ['Leads Ads', formatNumber(overview.metrics.attributedLeads || overview.metrics.crmLeads)], ['Calificados', formatNumber(overview.metrics.qualifiedLeads)], ['Ventas', formatNumber(overview.metrics.sales)], ['Costo/lead', formatMoney(costPerLead)], ['ROAS CRM', `${formatNumber(roas)}x`]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" />Rastreador SEO</CardTitle><CardDescription>Posición promedio real de Search Console durante los últimos 28 días.</CardDescription></div><Button size="sm" variant="outline" onClick={() => void syncPositions()} disabled={working === 'sync' || !connected}><RefreshCw className={`mr-2 h-4 w-4 ${working === 'sync' ? 'animate-spin' : ''}`} />Actualizar</Button></div></CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={keywordForm.websiteProjectId} onValueChange={(value) => setKeywordForm((current) => ({ ...current, websiteProjectId: value }))}><SelectTrigger><SelectValue placeholder="Sitio web" /></SelectTrigger><SelectContent>{overview.websites.map((site) => <SelectItem key={site.id} value={site.id}>{site.nombre}</SelectItem>)}</SelectContent></Select>
              <Input value={keywordForm.domain} onChange={(event) => setKeywordForm((current) => ({ ...current, domain: event.target.value }))} placeholder="cliente.com" />
              <Input value={keywordForm.keyword} onChange={(event) => setKeywordForm((current) => ({ ...current, keyword: event.target.value }))} placeholder="Palabra clave" />
              <div className="flex gap-2"><Select value={keywordForm.device} onValueChange={(value) => setKeywordForm((current) => ({ ...current, device: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DESKTOP">Escritorio</SelectItem><SelectItem value="MOBILE">Móvil</SelectItem></SelectContent></Select><Button onClick={() => void addKeyword()} disabled={working === 'keyword'}><Plus className="h-4 w-4" /></Button></div>
            </div>
            <div className="divide-y rounded-xl border border-slate-200">
              {overview.keywords.length === 0 ? <p className="p-4 text-sm text-slate-500">Agrega palabras clave para comenzar el seguimiento.</p> : overview.keywords.map((item) => {
                const delta = item.latestPosition != null && item.previousPosition != null ? item.previousPosition - item.latestPosition : null
                return <div key={item.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.keyword}</p><p className="truncate text-xs text-slate-500">{item.domain} · {item.device === 'MOBILE' ? 'Móvil' : 'Escritorio'}</p></div><div className="text-right"><p className="text-lg font-semibold">{item.latestPosition == null ? '—' : item.latestPosition.toFixed(1)}</p><p className={`text-[11px] ${delta && delta > 0 ? 'text-emerald-600' : delta && delta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{delta == null ? 'Sin comparación' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}</p></div>{item.latestUrl ? <Button asChild variant="ghost" size="icon"><a href={item.latestUrl} target="_blank" rel="noreferrer" aria-label="Abrir resultado"><ExternalLink className="h-4 w-4" /></a></Button> : null}<Button variant="ghost" size="icon" onClick={() => void deleteKeyword(item.id)} disabled={working === item.id} aria-label="Eliminar palabra clave"><Trash2 className="h-4 w-4" /></Button></div>
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Agente de contenido</CardTitle><CardDescription>Investiga competidores, compara el sitio actual y crea un borrador original.</CardDescription></CardHeader>
          <CardContent className="space-y-3 p-4">
            <Select value={contentForm.websiteProjectId} onValueChange={(value) => setContentForm((current) => ({ ...current, websiteProjectId: value }))}><SelectTrigger><SelectValue placeholder="Sitio web actual" /></SelectTrigger><SelectContent>{overview.websites.map((site) => <SelectItem key={site.id} value={site.id}>{site.nombre}</SelectItem>)}</SelectContent></Select>
            <div className="grid gap-3 sm:grid-cols-2"><Input value={contentForm.targetKeyword} onChange={(event) => setContentForm((current) => ({ ...current, targetKeyword: event.target.value }))} placeholder="Keyword objetivo" /><Select value={contentForm.contentType} onValueChange={(value) => setContentForm((current) => ({ ...current, contentType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BLOG_POST">Artículo SEO</SelectItem><SelectItem value="LANDING_PAGE">Landing page</SelectItem><SelectItem value="SERVICE_PAGE">Página de servicio</SelectItem><SelectItem value="SOCIAL_PLAN">Plan de contenidos</SelectItem></SelectContent></Select></div>
            <Textarea value={contentForm.seedIdea} onChange={(event) => setContentForm((current) => ({ ...current, seedIdea: event.target.value }))} placeholder="Idea, producto, audiencia y objetivo comercial..." rows={4} />
            <Textarea value={contentForm.competitorUrls} onChange={(event) => setContentForm((current) => ({ ...current, competitorUrls: event.target.value }))} placeholder={'URLs públicas de competidores, una por línea\nhttps://competidor.com/servicio'} rows={3} />
            <Button className="w-full" onClick={() => void generateContent()} disabled={working === 'content'}>{working === 'content' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Investigar y generar borrador</Button>
            <div className="divide-y rounded-xl border border-slate-200">
              {overview.briefs.length === 0 ? <p className="p-4 text-sm text-slate-500">Los borradores generados aparecerán aquí.</p> : overview.briefs.slice(0, 6).map((brief) => <div key={brief.id} className="p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-900">{brief.title}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{brief.status}</span></div><p className="mt-1 text-xs text-slate-500">{brief.targetKeyword || brief.contentType}</p>{brief.generatedText ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{brief.generatedText}</p> : null}</div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
