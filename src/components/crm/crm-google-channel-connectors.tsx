"use client"

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, CheckCircle2, ExternalLink, Loader2, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ConnectorOverview = {
  googleConfiguration: { configured: boolean; message?: string }
  connection: { googleEmail?: string | null; scopes: string[] } | null
}

type Product = {
  key: 'ADS' | 'ANALYTICS' | 'SEARCH_CONSOLE'
  name: string
  description: string
  scope: string
  icon: ReactNode
  steps: string[]
}

const PRODUCTS: Product[] = [
  {
    key: 'ADS',
    name: 'Google Ads',
    description: 'Campañas, inversión, clics, conversiones y ROAS comercial.',
    scope: 'https://www.googleapis.com/auth/adwords',
    icon: <Target className="h-5 w-5" />,
    steps: ['Selecciona Conectar Google Ads.', 'Autoriza únicamente el acceso publicitario.', 'Registra el Customer ID de la cuenta.', 'Sincroniza campañas y revisa el cruce con leads y ventas.'],
  },
  {
    key: 'ANALYTICS',
    name: 'Google Analytics',
    description: 'Sesiones, usuarios, eventos clave e ingresos de GA4.',
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    icon: <BarChart3 className="h-5 w-5" />,
    steps: ['Selecciona Conectar Analytics.', 'Autoriza acceso de solo lectura a GA4.', 'Registra el Property ID numérico.', 'Sincroniza para consultar los últimos 30 días.'],
  },
  {
    key: 'SEARCH_CONSOLE',
    name: 'Google Search Console',
    description: 'Consultas, páginas, clics, impresiones y posición SEO.',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    icon: <Search className="h-5 w-5" />,
    steps: ['Selecciona Conectar Search Console.', 'Autoriza acceso de solo lectura.', 'Indica la URL o propiedad sc-domain del sitio.', 'Agrega keywords y actualiza sus posiciones.'],
  },
]

const GOOGLE_TAB_RETURN_TO = '/dashboard/crm/integraciones?view=google'

export function CrmGoogleChannelConnectors() {
  const [overview, setOverview] = useState<ConnectorOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [guideProduct, setGuideProduct] = useState<Product | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/crm/marketing/overview', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json() as { data?: ConnectorOverview }
        if (active && response.ok && json.data) setOverview(json.data)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Conectar canales</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Canales de medición de Google</h2>
          <p className="mt-1 text-sm text-slate-600">Conecta solo el producto que necesitas. Los permisos se solicitan de forma independiente.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/crm/integraciones?view=marketing">Abrir Marketing y SEO <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
      </div>

      {loading ? <div className="mt-4 flex items-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Consultando conexiones...</div> : null}
      {!loading ? <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {PRODUCTS.map((product) => {
          const connected = overview?.connection?.scopes?.includes(product.scope) || false
          const configured = overview?.googleConfiguration.configured || false
          return <div key={product.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-white p-2 text-slate-700 shadow-sm">{product.icon}</span>{connected ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Conectado</span> : <span className="text-[11px] font-semibold text-amber-700">Pendiente</span>}</div>
            <h3 className="mt-3 font-semibold text-slate-950">{product.name}</h3>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-600">{product.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {configured ? <Button asChild size="sm"><a href={`/api/crm/marketing/google/connect?product=${product.key}&returnTo=${encodeURIComponent(GOOGLE_TAB_RETURN_TO)}`}>{connected ? 'Reconectar' : 'Conectar'}</a></Button> : <Button size="sm" disabled>Conectar</Button>}
              <Button size="sm" variant="ghost" onClick={() => setGuideProduct(product)}>Paso a paso</Button>
            </div>
          </div>
        })}
      </div> : null}
      {!loading && !overview?.googleConfiguration.configured ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{overview?.googleConfiguration.message || 'Configura las credenciales OAuth de Google Marketing en el servidor.'}</p> : null}

      <Dialog open={Boolean(guideProduct)} onOpenChange={(open) => { if (!open) setGuideProduct(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Conectar {guideProduct?.name}</DialogTitle><DialogDescription>La autorización no habilita los demás productos de Google.</DialogDescription></DialogHeader>
          <ol className="space-y-3 py-2">
            {guideProduct?.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span><p className="pt-1 text-sm text-slate-700">{step}</p></li>)}
          </ol>
          <div className="flex justify-end">{guideProduct && overview?.googleConfiguration.configured ? <Button asChild><a href={`/api/crm/marketing/google/connect?product=${guideProduct.key}&returnTo=${encodeURIComponent(GOOGLE_TAB_RETURN_TO)}`}>Continuar con Google</a></Button> : null}</div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
