'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDateShort } from '@/lib/utils'

type AccountingBaseStatus = {
  installed: boolean
  accounts: number
  postingAccounts: number
  costCenters: number
  rules: number
  activeRules: number
  journalEntries: number
  vouchers: number
  eventsWithRules: string[]
  missingEvents: string[]
}

type PendingAccountingItem = {
  referenceType: string
  referenceId: string
  label: string
  detail: string | null
  date: string
  amount: number
}

type PendingAccountingGroup = {
  referenceType: string
  label: string
  count: number
  amount: number
  items: PendingAccountingItem[]
}

type PendingAccountingData = {
  windowDays: number
  total: number
  groups: PendingAccountingGroup[]
}

const EVENT_LABEL: Record<string, string> = {
  POS_INVOICE: 'Ventas POS',
  POS_RETURN: 'Devoluciones POS',
  COMPRA: 'Compras',
  COMPRA_PAGO: 'Pagos a proveedor',
  DIAN_DOCUMENT: 'Documentos DIAN',
  PAYROLL_PERIOD: 'Nómina',
  PAYROLL_PAYMENT: 'Pagos nómina',
  PAYROLL_SETTLEMENT: 'Liquidaciones',
  MANUAL: 'Manual',
}

export function AccountingBasePanel() {
  const [status, setStatus] = useState<AccountingBaseStatus | null>(null)
  const [pending, setPending] = useState<PendingAccountingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [baseRes, pendingRes] = await Promise.all([
        fetch('/api/contabilidad/base', { cache: 'no-store' }),
        fetch('/api/contabilidad/pendientes', { cache: 'no-store' }),
      ])

      const baseJson = (await baseRes.json().catch(() => null)) as
        | { ok?: boolean; data?: AccountingBaseStatus; error?: string }
        | null
      const pendingJson = (await pendingRes.json().catch(() => null)) as
        | { ok?: boolean; data?: PendingAccountingData; error?: string }
        | null

      if (baseRes.ok && baseJson?.ok && baseJson.data) setStatus(baseJson.data)
      if (pendingRes.ok && pendingJson?.ok && pendingJson.data) setPending(pendingJson.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cargar el estado contable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const installBase = useCallback(async () => {
    setInstalling(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/contabilidad/base', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            data?: {
              accountsCreated: number
              rulesCreated: number
              rulesSkipped: number
              status: AccountingBaseStatus
            }
            error?: string
          }
        | null
      if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? 'No fue posible instalar la base contable')

      setStatus(json.data.status)
      setMessage(
        `Base contable lista: ${json.data.accountsCreated} cuenta(s) creadas, ${json.data.rulesCreated} regla(s) nuevas, ${json.data.rulesSkipped} regla(s) existentes conservadas.`
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible instalar la base contable')
    } finally {
      setInstalling(false)
    }
  }, [load])

  const postAll = useCallback(async () => {
    setPosting('all')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/contabilidad/pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            data?: {
              processed: number
              posted: number
              skipped: number
              failed: number
              pending: PendingAccountingData
            }
            error?: string
          }
        | null
      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error ?? 'No fue posible contabilizar los pendientes')
      }

      setPending(json.data.pending)
      setMessage(
        `Procesados ${json.data.processed}: ${json.data.posted} asiento(s) generados, ${json.data.skipped} omitidos, ${json.data.failed} con error.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible contabilizar los pendientes')
    } finally {
      setPosting(null)
    }
  }, [])

  const postGroup = useCallback(
    async (group: PendingAccountingGroup) => {
      setPosting(group.referenceType)
      setError(null)
      setMessage(null)
      try {
        let posted = 0
        let failed = 0

        for (const item of group.items) {
          const res = await fetch('/api/contabilidad/pendientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referenceType: item.referenceType, referenceId: item.referenceId }),
          })
          const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { entryId?: string | null } } | null
          if (res.ok && json?.ok) {
            if (json.data?.entryId) posted += 1
          } else {
            failed += 1
          }
        }

        await load()
        setMessage(`${group.label}: ${posted} asiento(s) generados${failed ? `, ${failed} con error` : ''}.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No fue posible contabilizar el grupo')
      } finally {
        setPosting(null)
      }
    },
    [load]
  )


  const pendingTotal = pending?.total ?? 0
  const groups = pending?.groups ?? []

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader className="gap-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Motor contable automático</CardTitle>
                <CardDescription>
                  POS, devoluciones, compras, pagos y documentos DIAN generan asiento con las reglas activas.
                </CardDescription>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  status?.installed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {loading ? 'Consultando…' : status?.installed ? 'Activo' : 'Sin configurar'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Cuentas posteables</div>
                <div className="mt-1 font-semibold text-slate-950">{status?.postingAccounts ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Reglas activas</div>
                <div className="mt-1 font-semibold text-slate-950">{status?.activeRules ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Asientos posteados</div>
                <div className="mt-1 font-semibold text-slate-950">{status?.journalEntries ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Comprobantes</div>
                <div className="mt-1 font-semibold text-slate-950">{status?.vouchers ?? 0}</div>
              </div>
            </div>

            {status && status.missingEvents.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Eventos sin regla activa: {status.missingEvents.map((event) => EVENT_LABEL[event] ?? event).join(', ')}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void installBase()} disabled={installing || loading}>
                {installing
                  ? 'Instalando…'
                  : status?.installed
                    ? 'Completar base contable'
                    : 'Instalar plan base + reglas'}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/contabilidad/reglas">Revisar reglas</Link>
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              La instalación crea un PUC mínimo (caja, bancos, clientes, IVA, ingresos y costos) y una regla por evento,
              sin sobrescribir reglas existentes.
            </p>
          </CardContent>
        </Card>


        <Card className="rounded-[26px] border-slate-200">
          <CardHeader className="gap-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Pendientes de contabilizar</CardTitle>
                <CardDescription>
                  Documentos de los últimos {pending?.windowDays ?? 120} días sin asiento contable.
                </CardDescription>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {loading ? '…' : pendingTotal}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-4 text-center text-xs text-emerald-700">
                {loading ? 'Buscando documentos sin asiento…' : 'Todo está contabilizado en la ventana revisada.'}
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.referenceType}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{group.label}</div>
                      <div className="text-[11px] text-slate-500">
                        {group.count} documento(s) · {formatCurrency(group.amount)}
                        {group.items[0] ? ` · último ${formatDateShort(group.items[0].date)}` : ''}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void postGroup(group)}
                      disabled={posting !== null}
                    >
                      {posting === group.referenceType ? 'Contabilizando…' : 'Contabilizar'}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void postAll()} disabled={posting !== null || pendingTotal === 0}>
                {posting === 'all' ? 'Contabilizando…' : 'Contabilizar todo'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading || posting !== null}>
                {loading ? 'Actualizando…' : 'Actualizar'}
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              Se contabiliza con las reglas activas de cada evento. Si falta una regla o el período está cerrado, el
              documento queda pendiente y se reintenta sin duplicar asientos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

