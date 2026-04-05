'use client'

import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContabilidadImpuestosPage() {
  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Impuestos y obligaciones"
        description="Espacio para control de IVA, retenciones, autorretención, reteICA y reportes tributarios que el contador revisa cada mes."
        stats={[
          { label: 'IVA', value: 'Generado/Descontable', hint: 'Ventas, compras y saldos', tone: 'sky' },
          { label: 'Retenciones', value: 'Renta/ICA/IVA', hint: 'Cruce por tercero y documento', tone: 'amber' },
          { label: 'Soporte', value: 'Tributario', hint: 'Bases para declaraciones y anexos', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['IVA ventas', 'Base gravable, tarifa, impuesto y documento origen.'],
          ['IVA compras', 'Descontable por proveedor, factura y centro de costo.'],
          ['Retenciones', 'Renta, ICA, IVA y autorretención con cruce por tercero.'],
          ['Anexos', 'Resumen por período para contador, revisor fiscal y exógena.'],
        ].map(([title, detail]) => (
          <Card key={title} className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}