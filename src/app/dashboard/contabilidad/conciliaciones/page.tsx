'use client'

import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContabilidadConciliacionesPage() {
  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Conciliaciones bancarias"
        description="Base para extractos, partidas pendientes, diferencias, arrastres y cierre por banco, que es una necesidad diaria del contador."
        stats={[
          { label: 'Bancos', value: 'Multicuenta', hint: 'Cada cuenta con su historial y extractos', tone: 'sky' },
          { label: 'Diferencias', value: 'Controladas', hint: 'Partidas por conciliar y ajustes', tone: 'amber' },
          { label: 'Cierre', value: 'Mensual', hint: 'Con arrastre de pendientes', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Flujo esperado</CardTitle>
            <CardDescription>Así debería verse una conciliación útil para una empresa colombiana con tesorería real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {[
              'Cargar extracto bancario o registrar movimientos manuales.',
              'Cruzar pagos, consignaciones, comisiones y ajustes contables.',
              'Separar partidas conciliadas, pendientes y diferencias por investigar.',
              'Cerrar el mes dejando arrastre de partidas no conciliadas.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Controles mínimos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {[
              'Saldo en libros vs saldo extracto.',
              'Notas bancarias pendientes.',
              'Cheques no cobrados o transferencias en tránsito.',
              'Ajustes generados desde la conciliación.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}