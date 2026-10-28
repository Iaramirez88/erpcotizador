'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateShort } from '@/lib/utils'

type ReportRow = {
  accountId: string
  code: string
  name: string
  type: string
  amount: number
}

type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  type: string
  debit: number
  credit: number
  balance: number
}

type StatementsResponse = {
  range: { from: string; to: string }
  sources: { journalLines: number; voucherLines: number }
  trialBalance: TrialBalanceRow[]
  trialBalanceTotals: { debit: number; credit: number; difference: number }
  balanceSheet: {
    assets: ReportRow[]
    totalAssets: number
    liabilities: ReportRow[]
    totalLiabilities: number
    equity: ReportRow[]
    totalEquity: number
    accumulatedResult: number
    totalLiabilitiesAndEquity: number
    difference: number
    balanced: boolean
  }
  incomeStatement: {
    income: ReportRow[]
    totalIncome: number
    expenses: ReportRow[]
    totalExpense: number
    result: number
  }
}

function defaultRange() {
  const now = new Date()
  return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().slice(0, 10) }
}

type RangePreset = 'month' | 'previous-month' | 'year' | 'previous-year'

const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: 'month', label: 'Mes actual' },
  { value: 'previous-month', label: 'Mes anterior' },
  { value: 'year', label: 'Año actual' },
  { value: 'previous-year', label: 'Año anterior' },
]

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)
}

function presetRange(preset: RangePreset) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getUTCMonth()

  if (preset === 'month') {
    return { from: `${year}-${String(month + 1).padStart(2, '0')}-01`, to: now.toISOString().slice(0, 10) }
  }

  if (preset === 'previous-month') {
    const previous = new Date(Date.UTC(year, month - 1, 1))
    const previousYear = previous.getUTCFullYear()
    const previousMonth = previous.getUTCMonth()
    return {
      from: `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-01`,
      to: lastDayOfMonth(previousYear, previousMonth),
    }
  }

  if (preset === 'previous-year') {
    return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
  }

  return { from: `${year}-01-01`, to: now.toISOString().slice(0, 10) }
}

export default function ContabilidadEstadosFinancierosPage() {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState<StatementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/contabilidad/estados-financieros?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: StatementsResponse; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? 'No fue posible calcular los estados financieros')
      setData(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible calcular los estados financieros')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(range.from, range.to)
  }, [load, range.from, range.to])

  const applyPreset = useCallback(
    (preset: RangePreset) => {
      const next = presetRange(preset)
      setRange(next)
      void load(next.from, next.to)
    },
    [load]
  )

  const balanceSheet = data?.balanceSheet
  const incomeStatement = data?.incomeStatement

  const balanceTone = useMemo(() => {
    if (!balanceSheet) return 'text-slate-500'
    return balanceSheet.balanced ? 'text-emerald-600' : 'text-rose-600'
  }, [balanceSheet])

  function renderRows(rows: ReportRow[]) {
    if (rows.length === 0) {
      return <div className="py-2 text-sm text-muted-foreground">Sin saldos para este rango.</div>
    }

    return rows.map((row) => (
      <div key={row.accountId} className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 py-1.5 last:border-b-0">
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-700">{row.name}</div>
          <div className="text-xs text-slate-500">{row.code}</div>
        </div>
        <div className="shrink-0 text-sm font-medium text-slate-900">{formatCurrency(row.amount)}</div>
      </div>
    ))
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Estados financieros"
        description="Estado de situación financiera, estado de resultados y balance de prueba calculados desde los asientos posteados y los comprobantes aprobados."
        stats={[
          {
            label: 'Total activo',
            value: loading ? '…' : formatCurrency(balanceSheet?.totalAssets ?? 0),
            hint: 'Saldo acumulado a la fecha de corte',
            tone: 'sky',
          },
          {
            label: 'Pasivo + patrimonio',
            value: loading ? '…' : formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0),
            hint: balanceSheet?.balanced ? 'La ecuación contable cuadra' : 'Revisar diferencias en libros',
            tone: 'amber',
          },
          {
            label: 'Resultado del período',
            value: loading ? '…' : formatCurrency(incomeStatement?.result ?? 0),
            hint: 'Ingresos menos gastos del rango',
            tone: 'teal',
          },
        ]}
      />

      <ContabilidadSubnav />

      <Card className="rounded-[26px] border-slate-200">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-2">
            <Label>Desde</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Hasta</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            />
          </div>
          <Button variant="outline" onClick={() => void load(range.from, range.to)} disabled={loading}>
            {loading ? 'Calculando…' : 'Recalcular'}
          </Button>
          <div className="flex flex-wrap items-center gap-1">
            {RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant="ghost"
                onClick={() => applyPreset(preset.value)}
                disabled={loading}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            {data
              ? `${data.sources.journalLines} líneas de asiento y ${data.sources.voucherLines} líneas de comprobante en el cálculo.`
              : 'El estado de situación es acumulado a la fecha de corte; el estado de resultados usa el rango seleccionado.'}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <Card className="rounded-[26px] border-slate-200 bg-slate-50/60">
        <CardContent className="space-y-1 p-4 text-xs text-slate-600">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Metodología</div>
          <div>
            · Estado de situación financiera: saldos acumulados con fecha ≤ corte (no usa la fecha “desde”).
          </div>
          <div>· Estado de resultados: ingresos y gastos del rango desde–hasta seleccionado.</div>
          <div>· Balance de prueba: débitos y créditos del mismo rango, por cuenta auxiliar.</div>
          <div>
            · Solo se incluyen asientos POSTED y comprobantes aprobados/posteados sin asiento; los asientos en borrador o
            anulados (VOID) quedan fuera del cálculo.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Estado de situación financiera</CardTitle>
            <CardDescription>
              Saldos acumulados al {data ? formatDateShort(data.range.to) : 'cierre seleccionado'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-semibold text-slate-900">Activo</span>
                <span className="font-semibold text-slate-900">{formatCurrency(balanceSheet?.totalAssets ?? 0)}</span>
              </div>
              <div className="mt-1">{renderRows(balanceSheet?.assets ?? [])}</div>
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-semibold text-slate-900">Pasivo</span>
                <span className="font-semibold text-slate-900">{formatCurrency(balanceSheet?.totalLiabilities ?? 0)}</span>
              </div>
              <div className="mt-1">{renderRows(balanceSheet?.liabilities ?? [])}</div>
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-semibold text-slate-900">Patrimonio</span>
                <span className="font-semibold text-slate-900">{formatCurrency(balanceSheet?.totalEquity ?? 0)}</span>
              </div>
              <div className="mt-1">{renderRows(balanceSheet?.equity ?? [])}</div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-slate-700">Resultado acumulado (ingresos − gastos)</span>
              <span className="font-medium text-slate-900">{formatCurrency(balanceSheet?.accumulatedResult ?? 0)}</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Total pasivo + patrimonio</span>
                <span className="font-semibold text-slate-900">{formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0)}</span>
              </div>
              <div className={`mt-2 text-xs font-medium ${balanceTone}`}>
                {balanceSheet?.balanced
                  ? 'Ecuación contable cuadrada: activo = pasivo + patrimonio + resultado.'
                  : `Diferencia por revisar: ${formatCurrency(balanceSheet?.difference ?? 0)}`}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Estado de resultados</CardTitle>
              <CardDescription>
                Movimientos del {data ? formatDateShort(data.range.from) : 'inicio'} al{' '}
                {data ? formatDateShort(data.range.to) : 'corte'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-semibold text-slate-900">Ingresos</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(incomeStatement?.totalIncome ?? 0)}</span>
                </div>
                <div className="mt-1">{renderRows(incomeStatement?.income ?? [])}</div>
              </div>

              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-semibold text-slate-900">Gastos y costos</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(incomeStatement?.totalExpense ?? 0)}</span>
                </div>
                <div className="mt-1">{renderRows(incomeStatement?.expenses ?? [])}</div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-emerald-50/70 px-3 py-2">
                <span className="font-semibold text-slate-900">Resultado del período</span>
                <span className="font-semibold text-slate-900">{formatCurrency(incomeStatement?.result ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Balance de prueba</CardTitle>
              <CardDescription>Débitos y créditos del rango por cuenta contable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Cuenta</span>
                <span className="text-right">Débito</span>
                <span className="text-right">Crédito</span>
                <span className="text-right">Saldo</span>
              </div>

              {(data?.trialBalance ?? []).length === 0 ? (
                <div className="py-2 text-sm text-muted-foreground">Sin movimientos contables en el rango.</div>
              ) : (
                data?.trialBalance.map((row) => (
                  <div
                    key={row.accountId}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-start gap-2 border-b border-dashed border-slate-200 py-1.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-slate-700">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.code}</div>
                    </div>
                    <span className="text-right tabular-nums text-slate-700">{formatCurrency(row.debit)}</span>
                    <span className="text-right tabular-nums text-slate-700">{formatCurrency(row.credit)}</span>
                    <span className="text-right font-medium tabular-nums text-slate-900">{formatCurrency(row.balance)}</span>
                  </div>
                ))
              )}

              {data ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-2 py-1.5 font-semibold text-slate-900">
                  <span>Totales</span>
                  <span className="text-right tabular-nums">{formatCurrency(data.trialBalanceTotals.debit)}</span>
                  <span className="text-right tabular-nums">{formatCurrency(data.trialBalanceTotals.credit)}</span>
                  <span className="text-right tabular-nums">{formatCurrency(data.trialBalanceTotals.difference)}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
