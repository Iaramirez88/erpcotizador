import Link from 'next/link'
import { BrainCircuit, Building2, Compass, Factory, LayoutGrid, LineChart, Package, ReceiptText, Shield, Store, Wallet, Wrench } from 'lucide-react'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DASHBOARD_NAV_CATALOG, DASHBOARD_SECTION_ORDER, type DashboardSectionTitle } from '@/lib/product-architecture'

type DomainTone = 'sky' | 'teal' | 'amber'

type MapSectionKey = Exclude<DashboardSectionTitle, 'Otros'>

type Domain = {
  id: MapSectionKey
  title: string
  description: string
  href: string
  tone: DomainTone
  items: string[]
}

const DOMAIN_META: Record<MapSectionKey, Omit<Domain, 'items'>> = {
  Inicio: {
    id: 'Inicio',
    title: 'Inicio',
    description: 'Acceso base y punto de entrada del dashboard, sin submódulos visibles en el menú lateral.',
    href: '/dashboard',
    tone: 'sky',
  },
  'Captación': {
    id: 'Captación',
    title: 'Captación',
    description: 'CRM, agenda, automatización, drive comercial y superficies para atraer y seguir oportunidades.',
    href: '/dashboard/crm',
    tone: 'teal',
  },
  Ventas: {
    id: 'Ventas',
    title: 'Ventas',
    description: 'Clientes, cotización, remisiones, facturación y captura documental para cerrar y despachar.',
    href: '/dashboard/cotizador',
    tone: 'amber',
  },
  Operaciones: {
    id: 'Operaciones',
    title: 'Operaciones',
    description: 'Ejecución interna, órdenes, proyectos y red operativa para coordinar el trabajo real.',
    href: '/dashboard/ordenes',
    tone: 'amber',
  },
  Inventario: {
    id: 'Inventario',
    title: 'Inventario',
    description: 'Catálogo, existencias, movimientos, traslados y desperdicios del frente logístico.',
    href: '/dashboard/inventario',
    tone: 'sky',
  },
  Compras: {
    id: 'Compras',
    title: 'Compras',
    description: 'Solicitudes internas, órdenes de compra, recepciones y proveedores como dominio separado.',
    href: '/dashboard/compras',
    tone: 'amber',
  },
  Finanzas: {
    id: 'Finanzas',
    title: 'Finanzas',
    description: 'Contabilidad, nómina y autoservicio laboral dentro del bloque financiero vigente.',
    href: '/dashboard/contabilidad',
    tone: 'amber',
  },
  'Analítica': {
    id: 'Analítica',
    title: 'Analítica',
    description: 'Reportes, lectura del negocio, inteligencia y trazabilidad transversal por auditoría.',
    href: '/dashboard/reportes',
    tone: 'sky',
  },
  IA: {
    id: 'IA',
    title: 'IA',
    description: 'Conocimiento operativo, hubs creativos y herramientas de generación especializadas por dominio.',
    href: '/dashboard/imagenes-ia/generador',
    tone: 'teal',
  },
  Verticales: {
    id: 'Verticales',
    title: 'Verticales',
    description: 'Capas especializadas por industria montadas sobre la base transversal del producto.',
    href: '/dashboard/restaurante',
    tone: 'amber',
  },
  Administración: {
    id: 'Administración',
    title: 'Administración',
    description: 'Gobierno del workspace, perfil, empresa, usuarios, respaldo, plan y control super admin.',
    href: '/dashboard/configuracion/empresa',
    tone: 'amber',
  },
  'Configuración': {
    id: 'Configuración',
    title: 'Configuración',
    description: 'Reglas operativas, costos y plantillas que modifican el comportamiento del negocio.',
    href: '/dashboard/litografia',
    tone: 'teal',
  },
}

const SECTION_ITEM_OVERRIDES: Partial<Record<MapSectionKey, string[]>> = {
  Inicio: ['Inicio'],
  'Captación': ['CRM', 'Oportunidades', 'Calendario', 'Chatbot', 'DRIVE', 'Automatización', 'Captación', 'Pipeline', 'Actividades', 'Conversaciones', 'Sitios web'],
  Ventas: ['Clientes', 'Cotizador', 'Cotizaciones', 'Remisiones', 'Facturación', 'Escaneos'],
  Operaciones: ['Órdenes', 'Tareas y proyectos', 'Red operativa'],
  Inventario: ['Catálogo', 'Existencias', 'Movimientos', 'Traslados', 'Desperdicios', 'Bodegas'],
  Compras: ['Solicitudes de compra', 'Órdenes de compra', 'Recepciones', 'Proveedores'],
  Finanzas: ['Contabilidad', 'Nómina', 'Mi portal laboral'],
  'Analítica': ['Reportes', 'Inteligencia', 'Auditoría IA CRM', 'Auditoría IA'],
  IA: ['Conocimiento IA', 'IA Litografía', 'Hub IA imágenes', 'Generador de imágenes', 'Vectorizador de imágenes'],
  Verticales: ['Restaurante', 'Odontología', 'Dotaciones'],
  Administración: ['Mi perfil', 'Mapa de producto', 'Ayuda', 'Empresa', 'Sedes', 'Usuarios', 'Respaldo', 'Dispositivos', 'Plan', 'Super Admin Empresas', 'Super Admin Usuarios', 'Super Admin'],
  'Configuración': ['Costos', 'Plantillas'],
}

const domainIcon = {
  Inicio: Compass,
  'Captación': Building2,
  Ventas: Store,
  Operaciones: Factory,
  Inventario: Package,
  Compras: ReceiptText,
  Finanzas: Wallet,
  'Analítica': LineChart,
  IA: BrainCircuit,
  Verticales: LayoutGrid,
  Administración: Shield,
  'Configuración': Wrench,
} satisfies Record<MapSectionKey, typeof Compass>

const toneClasses: Record<DomainTone, string> = {
  sky: 'border-sky-200 bg-sky-50/80',
  teal: 'border-emerald-200 bg-emerald-50/80',
  amber: 'border-amber-200 bg-amber-50/80',
}

function buildDomainItems(section: MapSectionKey) {
  const overridden = SECTION_ITEM_OVERRIDES[section]
  if (overridden?.length) return overridden

  return Array.from(
    new Set(
      DASHBOARD_NAV_CATALOG
        .filter((item) => item.section === section)
        .map((item) => item.label)
    )
  )
}

const domains: Domain[] = DASHBOARD_SECTION_ORDER
  .filter((section): section is MapSectionKey => section !== 'Otros')
  .map((section) => ({
    ...DOMAIN_META[section],
    items: buildDomainItems(section),
  }))

export default function ProductMapPage() {
  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Mapa de producto' },
        ]}
        eyebrow="Fase 1 · Organizacion"
        title="Product Map interno"
        description="Vista viva del producto actual para ubicar dominios, capas activas y accesos canonicos sin salir del dashboard."
        actions={
          <>
            <Button asChild className="rounded-xl">
              <Link href="/dashboard/crm">Abrir CRM</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white/90">
              <Link href="/dashboard/reportes">Ir a Reportes</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Dominios', value: domains.length, hint: 'Capas activas del producto', tone: 'sky' },
          { label: 'Frentes base', value: domains.filter((domain) => domain.id !== 'Verticales').length, hint: 'Capas transversales y operativas', tone: 'teal' },
          { label: 'Verticales', value: 3, hint: 'Capas especializadas activas', tone: 'amber' },
        ]}
      />

      <section className="space-y-4">
        <ErpSectionHeading
          title="Mapa actual por dominios"
          description="Cada bloque resume lo que existe hoy y lo agrupa por la lectura de producto que conviene conservar."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {domains.map((domain) => {
            const Icon = domainIcon[domain.id]
            return (
              <Card key={domain.id} className="rounded-[24px] border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClasses[domain.tone]}`}>
                    <Icon className="h-5 w-5 text-slate-900" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-950">{domain.title}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-slate-600">{domain.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {domain.items.map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="w-full rounded-xl border-slate-200 bg-white/90">
                    <Link href={domain.href}>Abrir dominio</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}