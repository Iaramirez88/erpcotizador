"use client"

import { useEffect, useState } from 'react'
import { BarChart3, CalendarRange, Loader2, RefreshCw, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Campaign = {
  id: string
  name: string
  status?: string | null
  dailyBudget: number
  impressions: number
  clicks: number
  ctr: number
  cost: number
  conversions: number
  cpa: number
  roas: number
  crmLeads: number
  qualifiedLeads: number
  sales: number
  crmRevenue: number
  crmRoas: number
}

type AdsEntity = Omit<Campaign, 'dailyBudget' | 'roas'> & { campaignName: string; adGroupName?: string | null; keywordText?: string | null; matchType?: string | null; opportunities: number }
type FunnelRow = { id: string; capturedAt: string; channel: string; campaign?: string | null; ad?: string | null; keyword?: string | null; gclid?: string | null; lead?: { name: string; status: string } | null; client?: { name: string } | null; sales: number; revenue: number }

type AnalyticsRow = { dimensions: Record<string, string>; metrics: Record<string, number> }
type SearchConsoleRow = { value: string; clicks: number; impressions: number; ctr: number; position: number }
type Insights = {
  lastSyncAt?: string | null
  range: { from: string; to: string }
  ads: { connected: boolean; customerId?: string | null; campaigns: Campaign[]; adGroups: AdsEntity[]; ads: AdsEntity[]; keywords: AdsEntity[]; funnel: FunnelRow[]; dailyRows: number }
  analytics: { connected: boolean; propertyId?: string | null; snapshot: Record<string, unknown> }
  searchConsole: { connected: boolean; propertyUrl?: string | null; snapshot: Record<string, unknown> }
}

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function EmptyState({ children }: { children: string }) {
  return <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{children}</div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-slate-200 px-3"><p className="text-[11px] font-medium uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p></div>
}

function TableShell({ title, description, headers, rows }: { title: string; description: string; headers: string[]; rows: React.ReactNode[][] }) {
  return <section className="min-w-0">
    <div className="mb-3"><h4 className="text-sm font-semibold text-slate-950">{title}</h4><p className="text-xs text-slate-500">{description}</p></div>
    {rows.length ? <div className="overflow-x-auto border border-slate-200"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((cells, index) => <tr key={index} className="text-slate-700">{cells.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[320px] truncate px-3 py-2.5">{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState>Sin datos todavía. Sincroniza la integración para llenar esta vista.</EmptyState>}
  </section>
}

function analyticsRows(snapshot: Record<string, unknown>, key: string) {
  return Array.isArray(snapshot[key]) ? snapshot[key] as AnalyticsRow[] : []
}

function searchRows(snapshot: Record<string, unknown>, key: string) {
  return Array.isArray(snapshot[key]) ? snapshot[key] as SearchConsoleRow[] : []
}

export function CrmGoogleInsights({ refreshKey }: { refreshKey?: string | null }) {
  const today = new Date().toISOString().slice(0, 10)
  const initialFrom = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [draftFrom, setDraftFrom] = useState(initialFrom)
  const [draftTo, setDraftTo] = useState(today)
  const [range, setRange] = useState({ from: initialFrom, to: today })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetch(`/api/crm/marketing/google/insights?from=${range.from}&to=${range.to}`, { cache: 'no-store' }).then(async (response) => {
      const json = await response.json() as { data?: Insights; error?: string }
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo cargar el detalle de Google.')
      if (active) setData(json.data)
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el detalle.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range, refreshKey])

  async function syncRange() {
    setSyncing(true)
    setError('')
    try {
      const response = await fetch(`/api/crm/marketing/google/sync?from=${range.from}&to=${range.to}`, { method: 'POST' })
      const json = await response.json() as { error?: string }
      if (!response.ok) throw new Error(json.error || 'No se pudo sincronizar el rango.')
      setRange((current) => ({ ...current }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo sincronizar el rango.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="flex min-h-40 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando vistas de Google...</div>
  if (!data) return <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>

  const analytics = data.analytics.snapshot
  const searchConsole = data.searchConsole.snapshot
  const campaigns = data.ads.campaigns
  const adsTotals = campaigns.reduce((total, item) => ({ impressions: total.impressions + item.impressions, clicks: total.clicks + item.clicks, cost: total.cost + item.cost, conversions: total.conversions + item.conversions, revenue: total.revenue + item.crmRevenue }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 })

  return <section className="border border-slate-200 bg-white p-4 md:p-5">
    <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-xs font-semibold uppercase text-slate-500">Detalle por integración</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Rendimiento de Google</h3><p className="mt-1 text-sm text-slate-600">Explora inversión, captación y ventas en el periodo seleccionado.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium text-slate-600">Desde<Input type="date" value={draftFrom} max={draftTo} onChange={(event) => setDraftFrom(event.target.value)} className="h-9 w-40" /></label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">Hasta<Input type="date" value={draftTo} min={draftFrom} max={today} onChange={(event) => setDraftTo(event.target.value)} className="h-9 w-40" /></label>
        <Button variant="outline" size="sm" onClick={() => setRange({ from: draftFrom, to: draftTo })}><CalendarRange className="mr-2 h-4 w-4" />Consultar</Button>
        <Button size="sm" disabled={syncing} onClick={() => void syncRange()}>{syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar rango</Button>
      </div>
    </div>
    {error ? <div className="mb-4 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
    <Tabs defaultValue="ads">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="ads"><Target className="mr-2 h-4 w-4" />Google Ads</TabsTrigger>
        <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
        <TabsTrigger value="search-console"><Search className="mr-2 h-4 w-4" />Search Console</TabsTrigger>
      </TabsList>

      <TabsContent value="ads" className="mt-6 space-y-6">
        <div className="flex flex-wrap gap-6"><Metric label="Impresiones" value={number.format(adsTotals.impressions)} /><Metric label="Clics" value={number.format(adsTotals.clicks)} /><Metric label="Inversión" value={money.format(adsTotals.cost)} /><Metric label="Conversiones" value={number.format(adsTotals.conversions)} /><Metric label="Ingresos CRM" value={money.format(adsTotals.revenue)} /></div>
        <TableShell title="Campañas" description={`Cuenta ${data.ads.customerId || 'sin seleccionar'} · ${data.range.from} a ${data.range.to}`} headers={['Campaña', 'Estado', 'Presupuesto diario', 'Impresiones', 'Clics', 'CTR', 'Costo', 'Conversiones', 'CPA', 'ROAS Ads', 'Leads CRM', 'Ventas', 'ROAS CRM']} rows={campaigns.map((item) => [item.name, item.status || '—', money.format(item.dailyBudget), number.format(item.impressions), number.format(item.clicks), `${number.format(item.ctr * 100)}%`, money.format(item.cost), number.format(item.conversions), money.format(item.cpa), `${number.format(item.roas)}x`, number.format(item.crmLeads), number.format(item.sales), `${number.format(item.crmRoas)}x`])} />
        <div className="grid gap-8 xl:grid-cols-2">
          <TableShell title="Grupos de anuncios" description="Rendimiento y valor comercial por grupo" headers={['Grupo', 'Campaña', 'Clics', 'Costo', 'Leads', 'Ventas', 'Valor venta']} rows={data.ads.adGroups.map((item) => [item.name, item.campaignName, number.format(item.clicks), money.format(item.cost), number.format(item.crmLeads), number.format(item.sales), money.format(item.crmRevenue)])} />
          <TableShell title="Anuncios" description="Creativos identificados por utm_content" headers={['Anuncio', 'Grupo', 'Campaña', 'Clics', 'Costo', 'Leads', 'Ventas']} rows={data.ads.ads.map((item) => [item.name, item.adGroupName || '—', item.campaignName, number.format(item.clicks), money.format(item.cost), number.format(item.crmLeads), number.format(item.sales)])} />
        </div>
        <TableShell title="Palabras clave" description="Keyword → clic → lead → cliente → valor de venta" headers={['Palabra clave', 'Coincidencia', 'Grupo', 'Campaña', 'Clics', 'Costo', 'Leads', 'Clientes/ventas', 'Valor venta', 'ROAS CRM']} rows={data.ads.keywords.map((item) => [item.keywordText || item.name, item.matchType || '—', item.adGroupName || '—', item.campaignName, number.format(item.clicks), money.format(item.cost), number.format(item.crmLeads), number.format(item.sales), money.format(item.crmRevenue), `${number.format(item.crmRoas)}x`])} />
        <TableShell title="Embudo de leads atribuidos" description="Trazabilidad individual conservada por UTM y GCLID" headers={['Fecha', 'Campaña', 'Anuncio', 'Keyword', 'Canal', 'Lead', 'Cliente', 'Ventas', 'Valor', 'GCLID']} rows={data.ads.funnel.map((item) => [new Date(item.capturedAt).toLocaleDateString('es-CO'), item.campaign || '—', item.ad || '—', item.keyword || '—', item.channel.replaceAll('_', ' '), item.lead?.name || '—', item.client?.name || '—', number.format(item.sales), money.format(item.revenue), item.gclid || '—'])} />
      </TabsContent>

      <TabsContent value="analytics" className="mt-6 space-y-8">
        <div className="flex flex-wrap gap-6"><Metric label="Usuarios" value={number.format(Number(analytics.totalUsers || 0))} /><Metric label="Sesiones" value={number.format(Number(analytics.sessions || 0))} /><Metric label="Eventos clave" value={number.format(Number(analytics.keyEvents || 0))} /><Metric label="Ingresos" value={money.format(Number(analytics.purchaseRevenue || 0))} /></div>
        <TableShell title="Canales" description="Origen de sesiones, usuarios y conversiones" headers={['Canal', 'Sesiones', 'Usuarios', 'Eventos clave', 'Ingresos']} rows={analyticsRows(analytics, 'channels').map((row) => [row.dimensions.sessionDefaultChannelGroup || 'Sin asignar', number.format(row.metrics.sessions), number.format(row.metrics.totalUsers), number.format(row.metrics.keyEvents), money.format(row.metrics.purchaseRevenue)])} />
        <TableShell title="Páginas" description="Contenido consultado y participación" headers={['Página', 'Vistas', 'Usuarios', 'Duración media', 'Eventos clave']} rows={analyticsRows(analytics, 'pages').map((row) => [row.dimensions.pagePath || '/', number.format(row.metrics.screenPageViews), number.format(row.metrics.totalUsers), `${number.format(row.metrics.averageSessionDuration)} s`, number.format(row.metrics.keyEvents)])} />
        <div className="grid gap-8 xl:grid-cols-3"><TableShell title="Eventos" description="Acciones registradas" headers={['Evento', 'Cantidad', 'Usuarios', 'Clave']} rows={analyticsRows(analytics, 'events').map((row) => [row.dimensions.eventName, number.format(row.metrics.eventCount), number.format(row.metrics.totalUsers), number.format(row.metrics.keyEvents)])} /><TableShell title="Dispositivos" description="Sesiones por dispositivo" headers={['Dispositivo', 'Sesiones', 'Usuarios', 'Clave']} rows={analyticsRows(analytics, 'devices').map((row) => [row.dimensions.deviceCategory, number.format(row.metrics.sessions), number.format(row.metrics.totalUsers), number.format(row.metrics.keyEvents)])} /><TableShell title="Países" description="Distribución geográfica" headers={['País', 'Sesiones', 'Usuarios', 'Clave']} rows={analyticsRows(analytics, 'countries').map((row) => [row.dimensions.country, number.format(row.metrics.sessions), number.format(row.metrics.totalUsers), number.format(row.metrics.keyEvents)])} /></div>
      </TabsContent>

      <TabsContent value="search-console" className="mt-6 space-y-8">
        <TableShell title="Consultas" description="Términos que muestran el sitio en Google" headers={['Consulta', 'Clics', 'Impresiones', 'CTR', 'Posición']} rows={searchRows(searchConsole, 'queries').map((row) => [row.value, number.format(row.clicks), number.format(row.impressions), `${number.format(row.ctr * 100)}%`, number.format(row.position)])} />
        <TableShell title="Páginas" description="Páginas con visibilidad orgánica" headers={['Página', 'Clics', 'Impresiones', 'CTR', 'Posición']} rows={searchRows(searchConsole, 'pages').map((row) => [row.value, number.format(row.clicks), number.format(row.impressions), `${number.format(row.ctr * 100)}%`, number.format(row.position)])} />
        <div className="grid gap-8 xl:grid-cols-2"><TableShell title="Dispositivos" description="Rendimiento por tipo de dispositivo" headers={['Dispositivo', 'Clics', 'Impresiones', 'CTR', 'Posición']} rows={searchRows(searchConsole, 'devices').map((row) => [row.value, number.format(row.clicks), number.format(row.impressions), `${number.format(row.ctr * 100)}%`, number.format(row.position)])} /><TableShell title="Países" description="Rendimiento por mercado" headers={['País', 'Clics', 'Impresiones', 'CTR', 'Posición']} rows={searchRows(searchConsole, 'countries').map((row) => [row.value, number.format(row.clicks), number.format(row.impressions), `${number.format(row.ctr * 100)}%`, number.format(row.position)])} /></div>
      </TabsContent>
    </Tabs>
  </section>
}