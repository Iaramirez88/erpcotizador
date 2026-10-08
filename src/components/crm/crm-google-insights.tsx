"use client"

import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Search, Target } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Campaign = {
  id: string
  name: string
  status?: string | null
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

type AnalyticsRow = { dimensions: Record<string, string>; metrics: Record<string, number> }
type SearchConsoleRow = { value: string; clicks: number; impressions: number; ctr: number; position: number }
type Insights = {
  lastSyncAt?: string | null
  ads: { connected: boolean; customerId?: string | null; campaigns: Campaign[]; dailyRows: number }
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
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void fetch('/api/crm/marketing/google/insights', { cache: 'no-store' }).then(async (response) => {
      const json = await response.json() as { data?: Insights; error?: string }
      if (!response.ok || !json.data) throw new Error(json.error || 'No se pudo cargar el detalle de Google.')
      if (active) setData(json.data)
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el detalle.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  if (loading) return <div className="flex min-h-40 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando vistas de Google...</div>
  if (!data) return <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>

  const analytics = data.analytics.snapshot
  const searchConsole = data.searchConsole.snapshot
  const campaigns = data.ads.campaigns
  const adsTotals = campaigns.reduce((total, item) => ({ impressions: total.impressions + item.impressions, clicks: total.clicks + item.clicks, cost: total.cost + item.cost, conversions: total.conversions + item.conversions, revenue: total.revenue + item.crmRevenue }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 })

  return <section className="border border-slate-200 bg-white p-4 md:p-5">
    <div className="mb-5"><p className="text-xs font-semibold uppercase text-slate-500">Detalle por integración</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Rendimiento de Google</h3><p className="mt-1 text-sm text-slate-600">Explora cada fuente de datos de forma independiente.</p></div>
    <Tabs defaultValue="ads">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="ads"><Target className="mr-2 h-4 w-4" />Google Ads</TabsTrigger>
        <TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
        <TabsTrigger value="search-console"><Search className="mr-2 h-4 w-4" />Search Console</TabsTrigger>
      </TabsList>

      <TabsContent value="ads" className="mt-6 space-y-6">
        <div className="flex flex-wrap gap-6"><Metric label="Impresiones" value={number.format(adsTotals.impressions)} /><Metric label="Clics" value={number.format(adsTotals.clicks)} /><Metric label="Inversión" value={money.format(adsTotals.cost)} /><Metric label="Conversiones" value={number.format(adsTotals.conversions)} /><Metric label="Ingresos CRM" value={money.format(adsTotals.revenue)} /></div>
        <TableShell title="Campañas" description={`Cuenta ${data.ads.customerId || 'sin seleccionar'} · últimos 30 días`} headers={['Campaña', 'Estado', 'Impresiones', 'Clics', 'CTR', 'Costo', 'Conversiones', 'CPA', 'ROAS Ads', 'Leads CRM', 'Ventas', 'ROAS CRM']} rows={campaigns.map((item) => [item.name, item.status || '—', number.format(item.impressions), number.format(item.clicks), `${number.format(item.ctr * 100)}%`, money.format(item.cost), number.format(item.conversions), money.format(item.cpa), `${number.format(item.roas)}x`, number.format(item.crmLeads), number.format(item.sales), `${number.format(item.crmRoas)}x`])} />
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