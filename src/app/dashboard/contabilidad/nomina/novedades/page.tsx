'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollNoveltyRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaNovedadesPage() {
  const [rows, setRows] = useState<PayrollNoveltyRow[]>([])
  const { mode, setMode } = useDataViewMode('nomina.novedades', 'list')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/nomina/novedades', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { data?: PayrollNoveltyRow[] } | null
      if (!cancelled) setRows(json?.data ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const incapacidades = rows.filter((item) => item.type === 'INCAPACIDAD')
  const operativas = rows.filter((item) => item.type !== 'INCAPACIDAD')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title="Novedades e incapacidades"
        description="Registro de horas extra, recargos, ausencias, incapacidades, licencias, embargos, préstamos y descuentos."
        stats={[
          { label: 'Radicadas', value: rows.filter((item) => item.status === 'RADICADA').length, hint: 'Pendientes de validar', tone: 'amber' },
          { label: 'Aplicadas', value: rows.filter((item) => item.status === 'APLICADA').length, hint: 'Ya afectan nómina', tone: 'teal' },
          { label: 'Incapacidades', value: incapacidades.length, hint: 'Con soporte médico', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <DataViewToggle mode={mode} onChange={setMode} />
      </div>

      <Tabs defaultValue="operativas" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl">
          <TabsTrigger value="operativas">Novedades</TabsTrigger>
          <TabsTrigger value="incapacidades">Incapacidades</TabsTrigger>
        </TabsList>
        <TabsContent value="operativas">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Novedades aplicables al período</CardTitle>
              <CardDescription>Horas extra, descuentos, licencias y otros eventos de cálculo.</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {operativas.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-500">{item.periodLabel}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.type}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typeof item.amount === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">Valor: {formatCurrency(item.amount)}</span> : null}
                    {typeof item.days === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">Días: {item.days}</span> : null}
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{item.status}</span>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{item.source}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="incapacidades">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Incapacidades y licencias médicas</CardTitle>
              <CardDescription>Base para soportes, origen, días reconocidos y cálculo del auxilio.</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {incapacidades.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-amber-200 bg-amber-50/60 p-4' : 'rounded-[18px] border border-amber-200 bg-amber-50/60 px-4 py-3'}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-600">{item.detail}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{item.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.periodLabel}</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.days ?? 0} días</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.source}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}