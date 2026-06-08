import Link from 'next/link'
import { ArrowRight, Boxes, BrainCircuit, Building2, Compass, Factory, LineChart, Wallet, Wrench } from 'lucide-react'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type DomainTone = 'sky' | 'teal' | 'amber'

type Domain = {
  id: string
  title: string
  description: string
  href: string
  tone: DomainTone
  items: string[]
}

type Dependency = {
  from: string
  to: string
  description: string
}

const domains: Domain[] = [
  {
    id: 'nucleo',
    title: 'Nucleo',
    description: 'Base administrativa, control de acceso, configuracion y gobierno del producto.',
    href: '/dashboard',
    tone: 'sky',
    items: ['Dashboard', 'Perfil', 'Notificaciones', 'Usuarios', 'Permisos', 'Sedes', 'Plan', 'Servicios web'],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    description: 'Captacion, seguimiento, venta y documentos de salida dentro del mismo flujo.',
    href: '/dashboard/crm',
    tone: 'teal',
    items: ['CRM', 'Inbox omnicanal', 'Leads', 'Oportunidades', 'Agenda CRM', 'Tareas CRM', 'Clientes', 'Cotizador', 'Cotizaciones', 'Remisiones', 'POS'],
  },
  {
    id: 'operaciones',
    title: 'Operaciones',
    description: 'Ejecucion interna, seguimiento operativo, produccion y trabajo coordinado.',
    href: '/dashboard/ordenes',
    tone: 'amber',
    items: ['Ordenes de trabajo', 'Espacios de trabajo', 'Chat global', 'Escaneos', 'Plantillas', 'Litografia'],
  },
  {
    id: 'inventario',
    title: 'Inventario',
    description: 'Catalogo, stock, abastecimiento, movimientos y soporte a la venta.',
    href: '/dashboard/inventario',
    tone: 'sky',
    items: ['Inventario', 'Productos', 'Materiales', 'Bodegas', 'Traslados', 'Compras', 'Proveedores'],
  },
  {
    id: 'financiero',
    title: 'Financiero',
    description: 'Facturacion, registro contable, control financiero y nomina.',
    href: '/dashboard/contabilidad',
    tone: 'amber',
    items: ['POS', 'Contabilidad', 'Plan de cuentas', 'Comprobantes', 'Libros', 'Conciliaciones', 'Impuestos', 'Cierres', 'Nomina'],
  },
  {
    id: 'ia',
    title: 'IA',
    description: 'Capacidades de copiloto, generacion y auditoria especializada por dominio.',
    href: '/dashboard/imagenes-ia/generador',
    tone: 'teal',
    items: ['Generador de imagenes', 'Vectorizador', 'Conocimiento IA', 'Auditoria IA litografia', 'Auditoria IA CRM'],
  },
  {
    id: 'analitica',
    title: 'Analitica',
    description: 'Lectura del negocio, rendimiento y trazabilidad transversal.',
    href: '/dashboard/reportes',
    tone: 'sky',
    items: ['Reportes', 'Auditorias IA por dominio'],
  },
  {
    id: 'verticales',
    title: 'Verticales',
    description: 'Capas especializadas por industria construidas sobre la base comun.',
    href: '/dashboard/restaurante',
    tone: 'amber',
    items: ['Restaurante', 'Odontologia', 'Dotaciones'],
  },
]

const dependencies: Dependency[] = [
  { from: 'Comercial', to: 'Operaciones', description: 'Las oportunidades y ventas terminan en ordenes, tareas y seguimiento operativo.' },
  { from: 'Comercial', to: 'Inventario', description: 'Cotizador, cotizaciones, remisiones y POS dependen del catalogo y del stock.' },
  { from: 'Operaciones', to: 'Inventario', description: 'La ejecucion interna consulta productos, materiales y disponibilidad real.' },
  { from: 'Comercial', to: 'Financiero', description: 'POS y documentos comerciales terminan impactando facturacion y registro contable.' },
  { from: 'Inventario', to: 'Financiero', description: 'Compras, costos y movimientos soportan el control financiero.' },
  { from: 'IA', to: 'Comercial', description: 'El copiloto CRM y sus auditorias ya apoyan seguimiento, respuesta y tareas.' },
  { from: 'IA', to: 'Operaciones', description: 'Litografia IA, OCR y generacion visual apoyan procesos tecnicos y de produccion.' },
  { from: 'Analitica', to: 'Todos los dominios', description: 'Reportes y auditorias entregan lectura transversal del uso y del rendimiento.' },
]

const observations = {
  exists: [
    'Existe un nucleo administrativo claro con empresa, usuarios, permisos, sedes y plan.',
    'Existe un frente comercial fuerte, pero historicamente repartido entre CRM, cotizador, documentos y POS.',
    'Existe una capa operativa real con ordenes, tareas, espacios de trabajo, litografia y escaneos.',
    'Existe una base financiera importante con contabilidad y nomina separadas por submodulos.',
  ],
  missing: [
    'No existe aun un centro unico de BI/KPI independiente de Reportes.',
    'No existe una seccion transversal unica de Automatizaciones IA.',
    'No existe una capa unica de Produccion; hoy se reparte entre ordenes, tareas, litografia e inventario.',
  ],
  overlap: [
    'Comercial estaba fragmentado entre CRM, Productividad y ventas documentales.',
    'IA estaba separada entre imagenes y litografia sin una lectura comun del dominio.',
    'Operaciones compartia piezas con Comercial y con IA, dificultando leer la cadena completa.',
  ],
}

const domainIcon = {
  nucleo: Compass,
  comercial: Building2,
  operaciones: Factory,
  inventario: Boxes,
  financiero: Wallet,
  ia: BrainCircuit,
  analitica: LineChart,
  verticales: Wrench,
} satisfies Record<string, typeof Compass>

const toneClasses: Record<DomainTone, string> = {
  sky: 'border-sky-200 bg-sky-50/80',
  teal: 'border-emerald-200 bg-emerald-50/80',
  amber: 'border-amber-200 bg-amber-50/80',
}

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
        description="Vista viva del producto actual para entender dominios, dependencias, solapes y vacios sin salir del dashboard."
        actions={
          <>
            <Button asChild className="rounded-xl">
              <Link href="/dashboard/crm">Abrir Comercial</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white/90">
              <Link href="/dashboard/reportes">Ir a Reportes</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Dominios', value: domains.length, hint: 'Capas activas del producto', tone: 'sky' },
          { label: 'Dependencias', value: dependencies.length, hint: 'Cruces clave entre dominios', tone: 'teal' },
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

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Flujo visual de dependencias</CardTitle>
            <CardDescription>Lectura rapida de como se encadenan hoy los dominios del producto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dependencies.map((dependency) => (
              <div key={`${dependency.from}-${dependency.to}`} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-950">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{dependency.from}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{dependency.to}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{dependency.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Jerarquia propuesta</CardTitle>
            <CardDescription>La navegacion se entiende mejor cuando el menu sigue la forma real del producto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="font-semibold text-slate-950">Comercial</p>
              <p>CRM, inbox, leads, oportunidades, agenda, tareas, clientes, cotizador, cotizaciones, remisiones y POS se leen como una sola cadena.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="font-semibold text-slate-950">Operaciones</p>
              <p>Ordenes, espacios, chat interno, litografia, escaneos y plantillas viven como ejecucion y coordinacion.</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
              <p className="font-semibold text-slate-950">IA</p>
              <p>Generacion, vectorizacion, conocimiento y auditorias IA se agrupan como capacidad transversal especializada.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Que existe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {observations.exists.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm leading-6 text-slate-700">{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Que falta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {observations.missing.map((item) => (
              <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm leading-6 text-amber-950">{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Que se solapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {observations.overlap.map((item) => (
              <div key={item} className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-sm leading-6 text-rose-950">{item}</div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}