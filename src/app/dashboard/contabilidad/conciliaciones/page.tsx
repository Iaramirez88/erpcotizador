'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateShort } from '@/lib/utils'

type PendingMovement = {
  id: string
  date: string
  description: string
  amount: number
}

type LedgerItem = {
  id: string
  date: string
  description: string
  amount: number
  source: 'ASIENTO' | 'COMPROBANTE'
  code: string | null
}

type ReconciliationHistoryItem = {
  id: string
  asOf: string
  status: string
  bankBalance: number
  ledgerBalance: number
  difference: number
  movementsCount: number
  pendingMovements: number
  pendingEntries: number
  notes: string | null
  closedByName: string | null
  createdAt: string
}

type ReconciliationAccount = {
  id: string
  name: string
  bankName: string | null
  accountNumber: string | null
  currency: string
  isActive: boolean
  accountingAccountId: string | null
  bankBalance: number
  ledgerBalance: number
  difference: number
  movementsCount: number
  reconciledMovementsCount?: number
  movementsWithoutEntryTotal: number
  pendingMovements: PendingMovement[]
  pendingEntriesTotal: number
  pendingEntries: LedgerItem[]
  status: 'CONCILIADA' | 'CON_DIFERENCIAS' | 'SIN_CUENTA_CONTABLE'
  reconciliations?: ReconciliationHistoryItem[]
}

type ReconciliationResponse = {
  asOf: string
  accounts: ReconciliationAccount[]
  totals: {
    bankBalance: number
    ledgerBalance: number
    difference: number
    pendingMovements: number
    pendingEntries: number
    reconciledAccounts: number
  }
}

const STATUS_LABEL: Record<ReconciliationAccount['status'], string> = {
  CONCILIADA: 'Conciliada',
  CON_DIFERENCIAS: 'Con diferencias',
  SIN_CUENTA_CONTABLE: 'Sin cuenta contable',
}

const STATUS_TONE: Record<ReconciliationAccount['status'], string> = {
  CONCILIADA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CON_DIFERENCIAS: 'border-amber-200 bg-amber-50 text-amber-700',
  SIN_CUENTA_CONTABLE: 'border-slate-200 bg-slate-50 text-slate-600',
}

export default function ContabilidadConciliacionesPage() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<ReconciliationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/contabilidad/conciliaciones?to=${date}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: ReconciliationResponse; error?: string }
        | null
      if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? 'No fue posible calcular la conciliación')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible calcular la conciliación')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(asOf)
  }, [load, asOf])

  const [notesByAccount, setNotesByAccount] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const closeReconciliation = useCallback(
    async (accountId: string) => {
      setActionLoading(`close:${accountId}`)
      setActionError(null)
      setActionMessage(null)
      try {
        const res = await fetch('/api/contabilidad/conciliaciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankAccountId: accountId,
            asOf,
            notes: (notesByAccount[accountId] ?? '').trim() || null,
          }),
        })
        const json = (await res.json().catch(() => null)) as
          | {
              ok?: boolean
              data?: {
                reconciliation: ReconciliationHistoryItem
                markedMovements: number
                report: ReconciliationResponse
              }
              error?: string
            }
          | null
        if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? 'No fue posible cerrar la conciliación')

        setData(json.data.report)
        setNotesByAccount((prev) => ({ ...prev, [accountId]: '' }))
        setActionMessage(
          `Conciliación cerrada al ${formatDateShort(json.data.reconciliation.asOf)} · ${
            json.data.reconciliation.status
          } · ${json.data.markedMovements} movimiento(s) marcados`
        )
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'No fue posible cerrar la conciliación')
      } finally {
        setActionLoading(null)
      }
    },
    [asOf, notesByAccount]
  )

  const reopenReconciliation = useCallback(
    async (reconciliationId: string) => {
      setActionLoading(`reopen:${reconciliationId}`)
      setActionError(null)
      setActionMessage(null)
      try {
        const res = await fetch(`/api/contabilidad/conciliaciones/${reconciliationId}`, { method: 'DELETE' })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'No fue posible reabrir el cierre')
        await load(asOf)
        setActionMessage('Cierre reabierto: los movimientos vuelven a quedar pendientes de conciliar.')
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'No fue posible reabrir el cierre')
      } finally {
        setActionLoading(null)
      }
    },
    [asOf, load]
  )

  const accounts = data?.accounts ?? []
  const totals = data?.totals

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Conciliaciones bancarias"
        description="Cruce del saldo de tesorería contra la cuenta contable vinculada, con partidas pendientes y diferencias por investigar."
        stats={[
          {
            label: 'Cuentas conciliadas',
            value: loading ? '…' : `${totals?.reconciledAccounts ?? 0}/${accounts.length}`,
            hint: 'Sin partidas pendientes al corte',
            tone: 'sky',
          },
          {
            label: 'Diferencia total',
            value: loading ? '…' : formatCurrency(totals?.difference ?? 0),
            hint: 'Saldo banco menos saldo contable',
            tone: 'amber',
          },
          {
            label: 'Partidas pendientes',
            value: loading ? '…' : (totals?.pendingMovements ?? 0) + (totals?.pendingEntries ?? 0),
            hint: 'Movimientos sin asiento y asientos sin movimiento',
            tone: 'teal',
          },
        ]}
      />

      <ContabilidadSubnav />

      <Card className="rounded-[26px] border-slate-200">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-2">
            <Label>Fecha de corte</Label>
            <Input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          </div>
          <Button variant="outline" onClick={() => void load(asOf)} disabled={loading}>
            {loading ? 'Calculando…' : 'Recalcular'}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/contabilidad/tesoreria">Ir a Tesorería</Link>
          </Button>
          <div className="text-xs text-slate-500">
            El cruce usa movimientos bancarios hasta la fecha de corte y asientos posteados (o comprobantes aprobados sin
            asiento) sobre la cuenta contable vinculada.
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionMessage}
        </div>
      ) : null}

      {data ? (
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Resumen al {formatDateShort(data.asOf)}</CardTitle>
            <CardDescription>Consolidado de todas las cuentas bancarias de la empresa.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs text-slate-500">Saldo en tesorería</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(data.totals.bankBalance)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs text-slate-500">Saldo en contabilidad</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(data.totals.ledgerBalance)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs text-slate-500">Diferencia</div>
              <div
                className={`mt-1 text-lg font-semibold ${
                  Math.abs(data.totals.difference) < 0.01 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(data.totals.difference)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="text-xs text-slate-500">Partidas pendientes</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {data.totals.pendingMovements + data.totals.pendingEntries}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && accounts.length === 0 ? (
        <Card className="rounded-[26px] border-dashed border-slate-300">
          <CardContent className="space-y-3 p-6 text-sm text-slate-600">
            <div>Aún no hay cuentas bancarias registradas para conciliar.</div>
            <Button asChild>
              <Link href="/dashboard/contabilidad/tesoreria">Crear cuenta en Tesorería</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id} className="rounded-[26px] border-slate-200">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{account.name}</CardTitle>
                  <CardDescription>
                    {[account.bankName, account.accountNumber].filter(Boolean).join(' · ') || 'Sin datos bancarios'}
                    {account.isActive ? '' : ' · Cuenta inactiva'}
                  </CardDescription>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[account.status]}`}>
                  {STATUS_LABEL[account.status]}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Saldo banco</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatCurrency(account.bankBalance)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Saldo contable</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatCurrency(account.ledgerBalance)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Diferencia</div>
                  <div
                    className={`mt-1 font-semibold ${
                      Math.abs(account.difference) < 0.01 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(account.difference)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                {account.accountingAccountId
                  ? `${account.movementsCount} movimientos bancarios al corte · ${account.reconciledMovementsCount ?? 0} ya conciliados.`
                  : 'Vincula una cuenta contable en Tesorería para poder cruzar los saldos.'}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">Cierre de conciliación</div>
                  <span className="text-[11px] text-slate-500">Corte {formatDateShort(asOf)}</span>
                </div>
                {(() => {
                  const history = account.reconciliations ?? []
                  const last = history[0]
                  const previous = history.slice(1)
                  const closeKey = `close:${account.id}`
                  const reopening = actionLoading?.startsWith('reopen:') ? actionLoading.slice('reopen:'.length) : null

                  return (
                    <div className="mt-2 space-y-2">
                      <div className="text-[11px] text-slate-600">
                        {last
                          ? `Último cierre: ${formatDateShort(last.asOf)} · ${last.status} · ${last.movementsCount} movimiento(s)${
                              last.closedByName ? ` · ${last.closedByName}` : ''
                            }`
                          : 'Esta cuenta aún no tiene cierres de conciliación guardados.'}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={notesByAccount[account.id] ?? ''}
                          onChange={(event) =>
                            setNotesByAccount((prev) => ({ ...prev, [account.id]: event.target.value }))
                          }
                          placeholder="Nota del cierre (opcional)"
                          className="h-8 w-full max-w-[240px] text-xs"
                          disabled={!account.accountingAccountId}
                        />
                        <Button
                          size="sm"
                          onClick={() => void closeReconciliation(account.id)}
                          disabled={!account.accountingAccountId || actionLoading === closeKey}
                        >
                          {actionLoading === closeKey ? 'Cerrando…' : 'Cerrar conciliación al corte'}
                        </Button>
                        {last ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void reopenReconciliation(last.id)}
                            disabled={reopening === last.id}
                          >
                            {reopening === last.id ? 'Reabriendo…' : 'Reabrir último cierre'}
                          </Button>
                        ) : null}
                      </div>

                      {last?.notes ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                          Nota: {last.notes}
                        </div>
                      ) : null}

                      {previous.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Cierres anteriores</div>
                          {previous.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px]"
                            >
                              <span className="text-slate-600">
                                {formatDateShort(item.asOf)} · {item.status} · diferencia {formatCurrency(item.difference)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void reopenReconciliation(item.id)}
                                disabled={reopening === item.id}
                              >
                                {reopening === item.id ? 'Reabriendo…' : 'Reabrir'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between font-semibold text-slate-900">
                  <span>Movimientos sin asiento</span>
                  <span className="text-xs font-medium text-slate-500">{account.movementsWithoutEntryTotal}</span>
                </div>
                {account.pendingMovements.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500">
                    Todos los movimientos bancarios están vinculados a un asiento.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {account.pendingMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-slate-700">{movement.description}</div>
                          <div className="text-xs text-slate-500">{formatDateShort(movement.date)}</div>
                        </div>
                        <div
                          className={`shrink-0 font-medium ${
                            movement.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(movement.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between font-semibold text-slate-900">
                  <span>Asientos sin movimiento bancario</span>
                  <span className="text-xs font-medium text-slate-500">{account.pendingEntriesTotal}</span>
                </div>
                {account.pendingEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500">
                    No hay asientos contables pendientes de cruce en esta cuenta.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {account.pendingEntries.map((item) => (
                      <div
                        key={`${item.source}-${item.id}`}
                        className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-slate-700">{item.description}</div>
                          <div className="text-xs text-slate-500">
                            {formatDateShort(item.date)} ·{' '}
                            {item.source === 'COMPROBANTE' ? `Comprobante ${item.code ?? ''}`.trim() : 'Asiento contable'}
                          </div>
                        </div>
                        <div className="shrink-0 font-medium text-slate-900">{formatCurrency(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
