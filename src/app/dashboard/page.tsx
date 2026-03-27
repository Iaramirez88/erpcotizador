import Link from 'next/link'
import { ArrowRight, BarChart3, Boxes, Calculator, ClipboardList, FolderKanban, MessageSquareMore, Package2, ReceiptText, ScanSearch, Settings2, Sparkles, Users2, Workflow } from 'lucide-react'
import { auth } from '@/lib/auth'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { redirect } from 'next/navigation'

type StartCard = {
  title: string
  description: string
  href: string
  cta: string
  moduleKeys: string[]
  icon: React.ComponentType<{ className?: string }>
  tone: string
  surface: string
}

function buildStartCards(): StartCard[] {
  return [
    {
      title: 'Cotizar y vender',
      description: 'Crea una cotización, ajusta plantillas y lleva el negocio a propuesta comercial sin entrar a reportes.',
      href: '/dashboard/cotizador',
      cta: 'Empezar cotización',
      moduleKeys: ['COTIZADOR', 'COTIZACIONES'],
      icon: Calculator,
      tone: 'text-amber-950',
      surface: 'border-amber-200 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.35),transparent_34%),linear-gradient(180deg,#fffdf7,#fff7e8)]',
    },
    {
      title: 'Gestionar CRM',
      description: 'Atiende leads, mueve oportunidades y abre conversaciones desde un frente comercial mucho más operativo.',
      href: '/dashboard/crm',
      cta: 'Abrir CRM',
      moduleKeys: ['CRM'],
      icon: Users2,
      tone: 'text-sky-950',
      surface: 'border-sky-200 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_34%),linear-gradient(180deg,#f8fdff,#eef8ff)]',
    },
    {
      title: 'Repositorio comercial',
      description: 'Sube propuestas, artes, audios y soportes del cliente en una biblioteca compartible para el equipo.',
      href: '/dashboard/crm/archivos',
      cta: 'Ir al repositorio',
      moduleKeys: ['CRM'],
      icon: FolderKanban,
      tone: 'text-emerald-950',
      surface: 'border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.28),transparent_34%),linear-gradient(180deg,#f7fffb,#ebfff6)]',
    },
    {
      title: 'Coordinar tareas internas',
      description: 'Abre espacios de trabajo, asigna responsables y conecta documentos reales desde la biblioteca CRM.',
      href: '/dashboard/espacios-trabajo',
      cta: 'Organizar equipo',
      moduleKeys: ['CRM'],
      icon: Workflow,
      tone: 'text-violet-950',
      surface: 'border-violet-200 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.3),transparent_34%),linear-gradient(180deg,#fcfaff,#f4efff)]',
    },
    {
      title: 'Controlar inventario',
      description: 'Revisa existencias, movimientos y bodegas para saber si puedes cumplir antes de comprometer una venta.',
      href: '/dashboard/inventario',
      cta: 'Ver inventario',
      moduleKeys: ['INVENTARIO', 'MATERIALES'],
      icon: Boxes,
      tone: 'text-indigo-950',
      surface: 'border-indigo-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_34%),linear-gradient(180deg,#f8f9ff,#eef2ff)]',
    },
    {
      title: 'Registrar compras',
      description: 'Gestiona abastecimiento, proveedores y entradas operativas para que la producción no se frene.',
      href: '/dashboard/compras',
      cta: 'Abrir compras',
      moduleKeys: ['COMPRAS', 'PROVEEDORES'],
      icon: ClipboardList,
      tone: 'text-orange-950',
      surface: 'border-orange-200 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.25),transparent_34%),linear-gradient(180deg,#fff9f5,#fff1e8)]',
    },
    {
      title: 'Digitalizar con OCR',
      description: 'Procesa documentos, extrae datos y acelera validaciones con el flujo de escaneos asistidos.',
      href: '/dashboard/escaneos',
      cta: 'Procesar documentos',
      moduleKeys: ['ESCANEOS'],
      icon: ScanSearch,
      tone: 'text-cyan-950',
      surface: 'border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_34%),linear-gradient(180deg,#f4feff,#eafcff)]',
    },
    {
      title: 'Facturar o cobrar',
      description: 'Salta al POS o a la operación administrativa cuando la necesidad del cliente ya es transaccional.',
      href: '/dashboard/pos',
      cta: 'Entrar a POS',
      moduleKeys: ['POS'],
      icon: ReceiptText,
      tone: 'text-rose-950',
      surface: 'border-rose-200 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.24),transparent_34%),linear-gradient(180deg,#fff8f9,#fff0f3)]',
    },
    {
      title: 'Ver contabilidad',
      description: 'Abre tesorería, asientos y centros de costo cuando ya necesitas control financiero, no navegación general.',
      href: '/dashboard/contabilidad',
      cta: 'Abrir contabilidad',
      moduleKeys: ['CONTABILIDAD'],
      icon: Package2,
      tone: 'text-slate-950',
      surface: 'border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.24),transparent_34%),linear-gradient(180deg,#ffffff,#f8fafc)]',
    },
  ]
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    redirect('/auth/login')
  }

  let allowedModules: string[] | null = null
  let activeSedeName: string | null = null

  try {
    const sede = await getActiveSedeForUser(userId)
    activeSedeName = sede.nombre
    const access = await getEffectiveAccessMap({ userId, sedeId: sede.id, modules: NAV_MODULES })
    allowedModules = NAV_MODULES.filter((moduleKey) => (access[moduleKey] ?? 'NONE') !== 'NONE')
  } catch {
    allowedModules = null
  }

  const enabledModules = allowedModules ? new Set(allowedModules) : null
  const cards = buildStartCards().filter((card) => !enabledModules || card.moduleKeys.some((moduleKey) => enabledModules.has(moduleKey)))
  const displayName = session.user.name || session.user.email || 'equipo'

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard' }]}
        eyebrow="Centro de arranque"
        title={`Hola, ${displayName}`}
        description={activeSedeName
          ? `El dashboard ahora es una pantalla de inicio. Elige qué quieres gestionar primero en ${activeSedeName} y entra directo al flujo correcto.`
          : 'El dashboard ahora funciona como pantalla de inicio. Elige qué quieres gestionar primero y entra directo al flujo correcto.'}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/reportes">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ir a reportes
              </Link>
            </Button>
            <Button asChild className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
              <Link href="/dashboard/crm">
                <Sparkles className="mr-2 h-4 w-4" />
                Continuar operación
              </Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Modo actual', value: 'Inicio guiado', hint: 'Sin KPIs ni resumen general aquí', tone: 'neutral' },
          { label: 'Analítica', value: 'Reportes', hint: 'Ventas, conversiones y desempeño quedaron separados', tone: 'teal' },
          { label: 'Flujos visibles', value: cards.length, hint: 'Accesos disponibles según permisos actuales', tone: 'amber' },
        ]}
      />

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">¿Qué quieres hacer hoy?</CardTitle>
          <CardDescription>
            Escoge un frente de trabajo. Reportes queda reservado para análisis y este espacio se usa para arrancar acciones concretas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.href} href={card.href} className={`group rounded-[28px] border p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${card.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-sm ${card.tone}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Empezar
                  </span>
                </div>
                <div className="mt-6 space-y-2">
                  <h2 className="text-xl font-semibold text-slate-950">{card.title}</h2>
                  <p className="text-sm leading-6 text-slate-700">{card.description}</p>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.26)]">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Cómo queda la separación</CardTitle>
            <CardDescription>El sistema deja de duplicar propósito entre dashboard y reportes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard</p>
              <p className="mt-2 font-semibold text-slate-950">Centro de inicio y decisión</p>
              <p className="mt-2 leading-6">Aquí el usuario decide si quiere vender, organizar, comprar, escanear, facturar o configurar. Todo orientado a comenzar gestión.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reportes</p>
              <p className="mt-2 font-semibold text-slate-950">Analítica y lectura del negocio</p>
              <p className="mt-2 leading-6">Allí quedan ventas, conversiones, clientes, compras y tendencias para lectura ejecutiva, sin mezclarlo con accesos operativos.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.26)]">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Atajos complementarios</CardTitle>
            <CardDescription>Acciones frecuentes fuera del flujo principal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-between rounded-2xl border-slate-200 bg-white/90 px-4 py-6 text-left">
              <Link href="/dashboard/reportes">
                <span className="flex items-center gap-3"><BarChart3 className="h-5 w-5" />Ver reportes y métricas</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between rounded-2xl border-slate-200 bg-white/90 px-4 py-6 text-left">
              <Link href="/dashboard/chat">
                <span className="flex items-center gap-3"><MessageSquareMore className="h-5 w-5" />Entrar al chat interno</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between rounded-2xl border-slate-200 bg-white/90 px-4 py-6 text-left">
              <Link href="/dashboard/configuracion/empresa">
                <span className="flex items-center gap-3"><Settings2 className="h-5 w-5" />Ajustar empresa y módulos</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
