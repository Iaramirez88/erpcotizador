'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

type JournalLineRow = {
  id: string
  debit: number
  credit: number
  memo: string | null
  accountCode: string
  accountName: string
  costCenterCode: string | null
  costCenterName: string | null
}

type JournalEntryRow = {
  id: string
  date: string
  description: string
  eventType: string
  referenceType: string | null
  referenceId: string | null
  totalDebit: number
  totalCredit: number
  lines: JournalLineRow[]
}

type VoucherLineRow = {
  id: string
  debit: number
  credit: number
  memo: string | null
  thirdPartyName: string | null
  thirdPartyDocument: string | null
  accountCode: string
  accountName: string
  costCenterCode: string | null
  costCenterName: string | null
}

type VoucherBookRow = {
  id: string
  code: string
  date: string
  description: string
  voucherType: string
  status: string
  periodLabel: string
  totalDebit: number
  totalCredit: number
  lines: VoucherLineRow[]
}

type BalanceRow = {
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  balance: number
}

type BooksResponse = {
  journalEntries: JournalEntryRow[]
  vouchers: VoucherBookRow[]
  balances: BalanceRow[]
}

export default function ContabilidadLibrosPage() {
  const [data, setData] = useState<BooksResponse>({ journalEntries: [], vouchers: [], balances: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/contabilidad/libros', { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; data?: BooksResponse } | null
      if (cancelled) return
      if (!response.ok || !json?.ok || !json.data) {
        setError(json?.error ?? 'No fue posible cargar los libros contables.')
        setLoading(false)
        return
      }
      setData(json.data)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const totalJournalDebit = useMemo(() => data.journalEntries.reduce((sum, item) => sum + item.totalDebit, 0), [data.journalEntries])
  const totalVoucherDebit = useMemo(() => data.vouchers.reduce((sum, item) => sum + item.totalDebit, 0), [data.vouchers])

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Libros y auxiliares"
        description="Zona para libro diario, mayor, auxiliares por cuenta, tercero, centro de costo y validación de movimientos por período."
        stats={[
          { label: 'Asientos diarios', value: data.journalEntries.length, hint: 'Movimientos persistidos del motor contable', tone: 'sky' },
          { label: 'Comprobantes aplicados', value: data.vouchers.length, hint: 'Aprobados o posteados para revisión', tone: 'neutral' },
          { label: 'Saldo debitado', value: formatCurrency(totalJournalDebit + totalVoucherDebit), hint: 'Acumulado visible en esta consulta', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Libro diario</CardTitle>
            <CardDescription>Lectura cronológica de asientos generados por reglas o procesos contables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Cargando movimientos del diario...</div>
            ) : data.journalEntries.length ? (
              data.journalEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{entry.description}</div>
                      <div className="text-sm text-slate-500">{new Date(entry.date).toLocaleDateString('es-CO')} · {entry.eventType}</div>
                      <div className="text-xs text-slate-500">Ref: {entry.referenceType || 'Manual'} {entry.referenceId ? `· ${entry.referenceId}` : ''}</div>
                    </div>
                    <div className="text-right text-sm text-slate-700">
                      <div>Débito {formatCurrency(entry.totalDebit)}</div>
                      <div>Crédito {formatCurrency(entry.totalCredit)}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {entry.lines.map((line) => (
                      <div key={line.id} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm md:grid-cols-[1.2fr_0.8fr_0.5fr_0.5fr]">
                        <div>
                          <div className="font-medium text-slate-900">{line.accountCode} · {line.accountName}</div>
                          <div className="text-xs text-slate-500">{line.memo || 'Sin memo'}</div>
                        </div>
                        <div className="text-xs text-slate-500">{line.costCenterCode ? `${line.costCenterCode} · ${line.costCenterName}` : 'Sin centro de costo'}</div>
                        <div className="text-slate-700">{formatCurrency(line.debit)}</div>
                        <div className="text-slate-700">{formatCurrency(line.credit)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Todavía no hay asientos generados para este libro diario.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Balance por cuenta</CardTitle>
              <CardDescription>Acumulado básico para validar el mayor antes de entrar a estados financieros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Calculando saldo por cuenta...</div>
              ) : data.balances.length ? (
                data.balances.slice(0, 10).map((balance) => (
                  <div key={balance.accountId} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="font-semibold text-slate-950">{balance.accountCode} · {balance.accountName}</div>
                    <div className="mt-2 grid gap-2 text-slate-600 md:grid-cols-3">
                      <div>Débito {formatCurrency(balance.debit)}</div>
                      <div>Crédito {formatCurrency(balance.credit)}</div>
                      <div>Saldo {formatCurrency(balance.balance)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Aún no hay movimiento suficiente para construir el mayor.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Comprobantes aplicados</CardTitle>
              <CardDescription>Revisión rápida de comprobantes listos para trazabilidad y auditoría operativa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Cargando comprobantes aprobados...</div>
              ) : data.vouchers.length ? (
                data.vouchers.slice(0, 6).map((voucher) => (
                  <div key={voucher.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{voucher.code} · {voucher.voucherType}</div>
                        <div className="text-xs text-slate-500">{voucher.periodLabel} · {new Date(voucher.date).toLocaleDateString('es-CO')}</div>
                      </div>
                      <div className="font-medium text-slate-700">{voucher.status}</div>
                    </div>
                    <div className="mt-2 text-slate-600">{voucher.description}</div>
                    <div className="mt-3 space-y-2">
                      {voucher.lines.slice(0, 3).map((line) => (
                        <div key={line.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                          <div className="font-medium text-slate-900">{line.accountCode} · {line.accountName}</div>
                          <div>{line.thirdPartyName || 'Sin tercero'} {line.thirdPartyDocument ? `· ${line.thirdPartyDocument}` : ''}</div>
                          <div>{formatCurrency(line.debit)} / {formatCurrency(line.credit)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay comprobantes aprobados o posteados para mostrar.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}