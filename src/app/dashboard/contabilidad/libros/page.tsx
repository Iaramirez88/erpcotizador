'use client'

import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContabilidadLibrosPage() {
  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Libros y auxiliares"
        description="Zona para libro diario, mayor, auxiliares por cuenta, tercero, centro de costo y validación de movimientos por período."
        stats={[
          { label: 'Libro diario', value: 'Base', hint: 'Consulta por comprobante y fecha', tone: 'sky' },
          { label: 'Libro mayor', value: 'Base', hint: 'Saldo inicial, movimiento y saldo final', tone: 'neutral' },
          { label: 'Auxiliares', value: 'Cuenta/Tercero', hint: 'Análisis operativo y tributario', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['Libro diario', 'Consulta cronológica por período, comprobante, tercero y usuario.'],
          ['Libro mayor', 'Acumulado por cuenta contable con saldos inicial y final.'],
          ['Auxiliar por tercero', 'Movimientos por cliente, proveedor, empleado o entidad fiscal.'],
          ['Auxiliar por centro', 'Seguimiento por sede, unidad o centro de costo.'],
          ['Balance de prueba', 'Puente natural hacia estados financieros y revisión de saldos.'],
          ['Exportaciones', 'Salida a Excel o PDF para contador, auditor y revisor fiscal.'],
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