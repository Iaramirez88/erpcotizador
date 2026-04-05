'use client'

import { useEffect, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccountingPeriodRow } from '@/lib/accounting-core'

export default function ContabilidadCierresPage() {
  const [periods, setPeriods] = useState<AccountingPeriodRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/contabilidad/periodos', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { data?: AccountingPeriodRow[] } | null
      if (!cancelled) setPeriods(json?.data ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Períodos y cierres"
        description="Bloqueo de meses, cierres anuales, ajustes de fin de período y control de aperturas, que es clave para disciplina contable real."
        stats={[
          { label: 'Períodos', value: periods.length, hint: 'Registrados en el nuevo núcleo', tone: 'sky' },
          { label: 'Abiertos', value: periods.filter((item) => item.status === 'OPEN').length, hint: 'Disponibles para trabajo contable', tone: 'amber' },
          { label: 'Cerrados/Bloqueados', value: periods.filter((item) => item.status !== 'OPEN').length, hint: 'Control del histórico', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Períodos registrados</CardTitle>
            <CardDescription>Conectado al API base de períodos contables para apertura, cierre y bloqueo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {periods.length ? periods.map((period) => (
              <div key={period.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{period.label}</div>
                    <div className="text-sm text-slate-500">{period.code} · {period.range}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{period.status}</div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div>Comprobantes: {period.vouchersCount}</div>
                  <div>Cierre: {period.closedAt || 'Sin cierre'}</div>
                  <div>Bloqueo: {period.lockedAt || 'Sin bloqueo'}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Aún no hay períodos contables creados en el núcleo nuevo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Asientos de cierre esperados</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-slate-600">
            {[
              'Cierre de ingresos y gastos.',
              'Reclasificaciones de saldos.',
              'Provisiones y ajustes NIIF.',
              'Apertura del nuevo período.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}