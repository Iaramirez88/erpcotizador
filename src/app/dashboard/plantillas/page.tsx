'use client'

import Link from 'next/link'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const templates = [
  {
    title: 'Cotización',
    description: 'Ajusta portada, bloques comerciales, watermark, versiones y layout del PDF comercial.',
    category: 'Ventas',
    accent: 'from-sky-500 to-cyan-400',
    href: '/dashboard/cotizaciones/plantilla',
    action: 'Editar plantilla',
    demo: {
      doc: 'COT-2026-0001',
      party: 'Cliente de prueba S.A.S.',
      total: '$458.150',
      details: ['2 banners gran formato', 'Garantía 30 días', 'Pago Bold + transferencia'],
    },
  },
  {
    title: 'Remisión',
    description: 'Configura la hoja de despacho con branding, márgenes, tipografía y detalle logístico.',
    category: 'Despacho',
    accent: 'from-emerald-500 to-teal-400',
    href: '/dashboard/remisiones/plantilla',
    action: 'Editar plantilla',
    demo: {
      doc: 'REM-2026-0012',
      party: 'Cliente entregado en bodega principal',
      total: '3 ítems',
      details: ['Papel bond', 'Sobres manila', 'Firma de recibido'],
    },
  },
  {
    title: 'Orden de compra',
    description: 'Nueva plantilla para compras: proveedor, despacho, totales y detalle solicitado antes de facturar.',
    category: 'Abastecimiento',
    accent: 'from-teal-600 to-emerald-400',
    href: '/dashboard/compras/plantilla',
    action: 'Editar plantilla',
    demo: {
      doc: 'OC-2026-0042',
      party: 'Papeles del Norte S.A.S.',
      total: '$2.104.690',
      details: ['Vinilo adhesivo', 'Lona front 13oz', 'Entrega viernes 3:00 p.m.'],
    },
  },
  {
    title: 'Facturación',
    description: 'Nueva plantilla visual para factura POS con branding, cliente, pagos y totales, sin tocar la configuración DIAN.',
    category: 'Facturación',
    accent: 'from-amber-500 to-orange-400',
    href: '/dashboard/pos/plantilla',
    action: 'Editar plantilla',
    demo: {
      doc: 'FV-2026-0108',
      party: 'Cliente POS mostrador',
      total: '$980.000',
      details: ['Composición comercial limpia', 'Pagos y saldo visibles', 'Factura interna con branding'],
    },
  },
]

export default function PlantillasPage() {
  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="Centro documental"
        title="Plantillas globales"
        description="Reúne las plantillas activas del sistema y muestra una demo rápida de cada documento antes de entrar al editor o al módulo origen."
        stats={[
          { label: 'Plantillas activas', value: templates.length, hint: 'Cotización, remisión, compras y POS', tone: 'neutral' },
          { label: 'Editor nuevo', value: 'OC + FV', hint: 'Compras y factura ya incluidas', tone: 'sky' },
          { label: 'Modo demo', value: '4', hint: 'Previews rápidas por acción', tone: 'amber' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.title} className="overflow-hidden border-slate-200">
            <div className={`h-2 bg-gradient-to-r ${template.accent}`} />
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {template.category}
                  </div>
                  <CardTitle>{template.title}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Button asChild>
                  <Link href={template.href}>{template.action}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Demo</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{template.demo.doc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Referencia</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{template.demo.total}</div>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cliente / proveedor</div>
                    <div className="mt-1 font-medium text-slate-900">{template.demo.party}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Lo que muestra la demo</div>
                    <ul className="mt-2 space-y-2">
                      {template.demo.details.map((detail) => (
                        <li key={detail} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}