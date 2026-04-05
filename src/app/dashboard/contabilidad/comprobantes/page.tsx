'use client'

import { useEffect, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccountingVoucherRow } from '@/lib/accounting-core'
import { formatCurrency } from '@/lib/utils'

const workQueues = [
  { title: 'Borradores', detail: 'Comprobantes pendientes por revisión, numeración y soporte.', tone: 'border-amber-200 bg-amber-50/60' },
  { title: 'Aprobados', detail: 'Listos para afectar libros y auxiliares sin editar el histórico.', tone: 'border-sky-200 bg-sky-50/60' },
  { title: 'Anulados', detail: 'Histórico con razón, usuario y trazabilidad de reversión.', tone: 'border-slate-200 bg-slate-50/80' },
]

export default function ContabilidadComprobantesPage() {
  const [rows, setRows] = useState<AccountingVoucherRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/contabilidad/comprobantes', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { data?: AccountingVoucherRow[] } | null
      if (!cancelled) setRows(json?.data ?? [])
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
        title="Comprobantes contables"
        description="Mesa de trabajo para comprobantes manuales, ajustes, reclasificaciones, provisiones, cierres y reversos con trazabilidad completa."
        stats={[
          { label: 'Comprobantes', value: rows.length, hint: 'Registros creados en el núcleo contable', tone: 'sky' },
          { label: 'Borradores', value: rows.filter((item) => item.status === 'DRAFT').length, hint: 'Pendientes de revisión', tone: 'neutral' },
          { label: 'Aprobados/Posteados', value: rows.filter((item) => item.status === 'APPROVED' || item.status === 'POSTED').length, hint: 'Con flujo de control', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Comprobantes recientes</CardTitle>
            <CardDescription>Bandeja inicial conectada al API base de comprobantes contables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length ? rows.slice(0, 8).map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{row.code} · {row.voucherType}</div>
                    <div className="text-sm text-slate-500">{row.periodLabel} · {row.date}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{row.status}</div>
                </div>
                <div className="mt-2 text-sm text-slate-600">{row.description}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                  <div>Tercero: {row.thirdPartyName || 'Sin tercero'}</div>
                  <div>Débito: {formatCurrency(row.totalDebit)}</div>
                  <div>Crédito: {formatCurrency(row.totalCredit)}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Aún no hay comprobantes creados desde el nuevo núcleo contable.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Bandejas objetivo</CardTitle>
            <CardDescription>Estructura sugerida para que el equipo contable trabaje sin mezclar configuración con operación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workQueues.map((queue) => (
              <div key={queue.title} className={`rounded-2xl border p-4 ${queue.tone}`}>
                <div className="font-semibold text-slate-950">{queue.title}</div>
                <div className="mt-1 text-sm text-slate-600">{queue.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}