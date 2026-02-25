'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PIE_COLORS } from '@/lib/chart-colors'
import type { AccountingAccountType, AccountingEventType } from '@prisma/client'

type ChartKind = 'bar' | 'line' | 'pie'
type AreaKind = 'accounts' | 'cost-centers' | 'rules'

type AccountRow = {
  id: string
  type: AccountingAccountType
  isPosting: boolean
  createdAt: string
}

type CostCenterRow = {
  id: string
  createdAt: string
}

type RuleLineRow = {
  accountId: string
  costCenterId: string | null
}

type RuleRow = {
  id: string
  eventType: AccountingEventType
  isActive: boolean
  createdAt: string
  lines: RuleLineRow[]
}

type SeriesPoint = { month: string; count: number }
type NamedCount = { name: string; count: number }

const ACCOUNT_TYPE_LABEL: Record<AccountingAccountType, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
}

const EVENT_TYPE_LABEL: Record<AccountingEventType, string> = {
  POS_INVOICE: 'POS - Venta',
  POS_RETURN: 'POS - Devolución',
  COMPRA: 'Compra',
  COMPRA_PAGO: 'Compra - Pago',
  DIAN_DOCUMENT: 'DIAN',
  MANUAL: 'Manual',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : String(value ?? '')
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return Boolean(record[key])
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function toMonthlySeries(items: Array<{ createdAt: string }>): SeriesPoint[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = monthKey(item.createdAt)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, count]) => ({ month, count }))
}

function toNamedCounts<T>(items: T[], keyFn: (item: T) => string): NamedCount[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export default function ContabilidadHomePage() {
  const [chartKind, setChartKind] = useState<ChartKind>('bar')
  const [areaKind, setAreaKind] = useState<AreaKind>('accounts')

  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [aRes, cRes, rRes] = await Promise.all([
          fetch('/api/contabilidad/cuentas', { cache: 'no-store' }),
          fetch('/api/contabilidad/centros-de-costo', { cache: 'no-store' }),
          fetch('/api/contabilidad/reglas', { cache: 'no-store' }),
        ])

        const aRaw = (await aRes.json()) as unknown
        const cRaw = (await cRes.json()) as unknown
        const rRaw = (await rRes.json()) as unknown

        const aOk = isRecord(aRaw) && aRaw.ok === true
        const cOk = isRecord(cRaw) && cRaw.ok === true
        const rOk = isRecord(rRaw) && rRaw.ok === true

        if (!aRes.ok || !aOk) throw new Error((isRecord(aRaw) ? (aRaw.error as string) : '') || 'Error cargando cuentas')
        if (!cRes.ok || !cOk)
          throw new Error((isRecord(cRaw) ? (cRaw.error as string) : '') || 'Error cargando centros de costo')
        if (!rRes.ok || !rOk) throw new Error((isRecord(rRaw) ? (rRaw.error as string) : '') || 'Error cargando reglas')

        if (cancelled) return

        setAccounts(
          readArray((aRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            return [
              {
                id: readString(row, 'id'),
                type: readString(row, 'type') as AccountingAccountType,
                isPosting: readBoolean(row, 'isPosting'),
                createdAt: readString(row, 'createdAt'),
              },
            ]
          }),
        )

        setCostCenters(
          readArray((cRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            return [{ id: readString(row, 'id'), createdAt: readString(row, 'createdAt') }]
          }),
        )

        setRules(
          readArray((rRaw as Record<string, unknown>).data).flatMap((row) => {
            if (!isRecord(row)) return []
            const linesRaw = readArray(row.lines)
            const lines = linesRaw.flatMap((l) => {
              if (!isRecord(l)) return []
              const rawCostCenter = l.costCenterId
              return [
                {
                  accountId: readString(l, 'accountId'),
                  costCenterId: typeof rawCostCenter === 'string' ? rawCostCenter : null,
                },
              ]
            })

            return [
              {
                id: readString(row, 'id'),
                eventType: readString(row, 'eventType') as AccountingEventType,
                isActive: readBoolean(row, 'isActive'),
                createdAt: readString(row, 'createdAt'),
                lines,
              },
            ]
          }),
        )
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error cargando estadísticas')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const chartTitle = useMemo(() => {
    if (areaKind === 'accounts') return 'Plan de cuentas'
    if (areaKind === 'cost-centers') return 'Centros de costo'
    return 'Reglas'
  }, [areaKind])

  const chartData = useMemo(() => {
    if (areaKind === 'accounts') {
      if (chartKind === 'line') return toMonthlySeries(accounts)
      return toNamedCounts(accounts, (a) => ACCOUNT_TYPE_LABEL[a.type] ?? a.type)
    }

    if (areaKind === 'rules') {
      if (chartKind === 'line') return toMonthlySeries(rules)
      return toNamedCounts(rules, (r) => EVENT_TYPE_LABEL[r.eventType] ?? r.eventType)
    }

    if (chartKind === 'line') return toMonthlySeries(costCenters)

    const used = new Set<string>()
    for (const rule of rules) {
      for (const line of rule.lines) {
        if (line.costCenterId) used.add(line.costCenterId)
      }
    }

    const usedCount = costCenters.filter((c) => used.has(c.id)).length
    const notUsedCount = costCenters.length - usedCount

    return [
      { name: 'En reglas', count: usedCount },
      { name: 'Sin reglas', count: notUsedCount },
    ] satisfies NamedCount[]
  }, [accounts, areaKind, chartKind, costCenters, rules])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Contabilidad</h1>
        <p className="text-sm text-muted-foreground">Configura el plan de cuentas, centros de costo y reglas contables.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/contabilidad/plan-de-cuentas" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Plan de cuentas</div>
          <div className="text-sm text-muted-foreground">Cuentas contables por empresa.</div>
        </Link>

        <Link href="/dashboard/contabilidad/centros-de-costo" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Centros de costo</div>
          <div className="text-sm text-muted-foreground">Dimensión opcional para asientos.</div>
        </Link>

        <Link href="/dashboard/contabilidad/reglas" className="rounded-lg border p-4 hover:bg-muted/50">
          <div className="font-medium">Reglas</div>
          <div className="text-sm text-muted-foreground">Evento → Regla → Asiento.</div>
        </Link>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">Estadísticas</div>
          <div className="flex flex-wrap gap-2">
            <Select value={areaKind} onValueChange={(v) => setAreaKind(v as AreaKind)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accounts">Plan de cuentas</SelectItem>
                <SelectItem value="cost-centers">Centros de costo</SelectItem>
                <SelectItem value="rules">Reglas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={chartKind} onValueChange={(v) => setChartKind(v as ChartKind)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo de gráfica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="line">Línea</SelectItem>
                <SelectItem value="pie">Torta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando estadísticas…</div>
          ) : Array.isArray(chartData) && chartData.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay datos suficientes para graficar.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{chartTitle}</div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartKind === 'bar' ? (
                    <BarChart data={chartData as NamedCount[]}>
                      <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Cantidad" fill={PIE_COLORS[0]} />
                    </BarChart>
                  ) : chartKind === 'line' ? (
                    <LineChart data={chartData as SeriesPoint[]}>
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" name="Cantidad" stroke={PIE_COLORS[0]} strokeWidth={2} />
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={chartData as NamedCount[]} dataKey="count" nameKey="name" outerRadius={110}>
                        {(chartData as NamedCount[]).map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
