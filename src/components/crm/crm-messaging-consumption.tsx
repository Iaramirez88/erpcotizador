'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { UsageMeter, type UsageMeterTone } from '@/components/ui/usage-meter'

type Meter = { key: string; label: string; limit: number; used: number; remaining: number; percentage: number }
type Alert = { key: string; label: string; level: 'WARNING' | 'CRITICAL' | 'BLOCKED'; limit: number; used: number; percentage: number }
type Quota = {
  perChannelDaily: number | null
  perChannelMonthly: number | null
  perEmpresaDaily: number | null
  perEmpresaMonthly: number | null
  timezone: string
  warningPct: number
  criticalPct: number
  blockPct: number
  overagePolicy: string
}
type Usage = { perChannelDaily: number; perChannelMonthly: number; perEmpresaDaily: number; perEmpresaMonthly: number }
type ChannelRow = { id: string; name: string; provider: string; status: string; quota: Quota; usage: Usage; meters: Meter[]; alerts: Alert[] }
type Overview = {
  empresa: { quota: Quota; usage: Usage; meters: Meter[]; alerts: Alert[] }
  channels: ChannelRow[]
  summary: { totalOutbound: number; today: number; thisMonth: number; activeChannels: number }
}
type HistoryRow = {
  id: string
  occurredAt: string
  status: string
  messageType: string
  bodyText: string | null
  channelName: string | null
  provider: string | null
  contactDisplayName: string | null
  contactPhone: string | null
}

function toneFor(meter: Meter, quota: Quota): UsageMeterTone {
  if (meter.percentage >= quota.criticalPct) return 'critical'
  if (meter.percentage >= quota.warningPct) return 'warning'
  return 'normal'
}

function alertBadgeClass(level: Alert['level']): string {
  if (level === 'BLOCKED') return 'bg-rose-100 text-rose-700 border-rose-200'
  if (level === 'CRITICAL') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

function statusBadgeClass(status: string): string {
  if (status === 'DELIVERED' || status === 'READ') return 'bg-emerald-100 text-emerald-700'
  if (status === 'SENT') return 'bg-sky-100 text-sky-700'
  if (status === 'FAILED') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}
export function CrmMessagingConsumption() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ channelId: '', provider: '', status: '', from: '', to: '' })

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/crm/messaging-quota/overview', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo cargar el consumo.')
      setOverview(json.data as Overview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async (nextFilters: typeof filters, nextPage = 0) => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (nextFilters.channelId) params.set('channelId', nextFilters.channelId)
      if (nextFilters.provider) params.set('provider', nextFilters.provider)
      if (nextFilters.status) params.set('status', nextFilters.status)
      if (nextFilters.from) params.set('from', nextFilters.from)
      if (nextFilters.to) params.set('to', nextFilters.to)
      params.set('page', String(nextPage))
      params.set('limit', '25')

      const res = await fetch(`/api/crm/messaging-quota/history?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo cargar el historial.')
      setHistory(json.data.rows as HistoryRow[])
      setHistoryTotal(json.data.total as number)
      setPage(nextPage)
    } catch {
      setHistory([])
      setHistoryTotal(0)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadHistory(filters, 0)
  }, [loadHistory, filters])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Consumo de mensajería</h2>
          <p className="text-sm text-slate-500">Cuotas comerciales internas de Joinclap por canal y empresa.</p>
        </div>
        <Button variant="outline" onClick={() => void loadOverview()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {error ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      ) : null}

      {loading || !overview ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Enviados hoy', value: overview.summary.today },
              { label: 'Enviados este mes', value: overview.summary.thisMonth },
              { label: 'Total salientes', value: overview.summary.totalOutbound },
              { label: 'Canales activos', value: overview.summary.activeChannels },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{stat.value.toLocaleString('es-CO')}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cuota de la empresa</CardTitle>
              <CardDescription>Zona horaria: {overview.empresa.quota.timezone}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.empresa.alerts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {overview.empresa.alerts.map((alert) => (
                    <span key={alert.key} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${alertBadgeClass(alert.level)}`}>
                      {alert.level === 'BLOCKED' ? 'Límite alcanzado' : alert.level === 'CRITICAL' ? 'Crítico' : 'Advertencia'} · {alert.label} ({alert.percentage}%)
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                {overview.empresa.meters.map((meter) => (
                  <UsageMeter
                    key={meter.key}
                    label={meter.label}
                    used={meter.used}
                    limit={meter.limit}
                    unit="msg"
                    tone={toneFor(meter, overview.empresa.quota)}
                    showRemaining
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          {/* Canales */}
          {overview.channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{channel.name}</CardTitle>
                    <CardDescription>{channel.provider} · {channel.status}</CardDescription>
                  </div>
                  {channel.alerts.length > 0 ? (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${alertBadgeClass(channel.alerts[0].level)}`}>
                      {channel.alerts[0].percentage}%
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {channel.meters.map((meter) => (
                    <UsageMeter
                      key={meter.key}
                      label={meter.label}
                      used={meter.used}
                      limit={meter.limit}
                      unit="msg"
                      tone={toneFor(meter, channel.quota)}
                      showRemaining
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de mensajes salientes</CardTitle>
              <CardDescription>{historyTotal.toLocaleString('es-CO')} registros</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <select value={filters.channelId} onChange={(e) => setFilters((prev) => ({ ...prev, channelId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Todos los canales</option>
                  {overview.channels.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select value={filters.provider} onChange={(e) => setFilters((prev) => ({ ...prev, provider: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Todos los proveedores</option>
                  <option value="WHATSAPP_CLOUD">WhatsApp Cloud</option>
                  <option value="WHATSAPP_SANDBOX">WhatsApp Sandbox</option>
                  <option value="MESSENGER">Messenger</option>
                  <option value="FACEBOOK_PAGE">Facebook Page</option>
                  <option value="INSTAGRAM_DM">Instagram DM</option>
                </select>
                <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Todos los estados</option>
                  <option value="SENT">Enviado</option>
                  <option value="DELIVERED">Entregado</option>
                  <option value="READ">Leído</option>
                  <option value="FAILED">Fallido</option>
                </select>
                <input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                <input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </div>
              {historyLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : history.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No hay mensajes salientes que coincidan con los filtros.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 font-medium">Canal</th>
                        <th className="px-3 py-2 font-medium">Contacto</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {new Date(row.occurredAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.channelName || row.provider || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.contactDisplayName || row.contactPhone || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td className="max-w-xs truncate px-3 py-2 text-slate-500">{row.bodyText || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {historyTotal > 25 ? (
                <div className="flex items-center justify-between">
                  <Button variant="outline" disabled={page === 0} onClick={() => void loadHistory(filters, page - 1)}>
                    Anterior
                  </Button>
                  <span className="text-xs text-slate-500">Página {page + 1}</span>
                  <Button variant="outline" disabled={(page + 1) * 25 >= historyTotal} onClick={() => void loadHistory(filters, page + 1)}>
                    Siguiente
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

