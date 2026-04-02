import Link from 'next/link'
import { ArrowRight, BarChart3, Boxes, Calculator, ClipboardList, FolderKanban, Package2, ReceiptText, ScanSearch, Users2, Workflow } from 'lucide-react'
import { auth } from '@/lib/auth'
import ContinueLastViewButton from '@/components/dashboard/continue-last-view-button'
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
  const continueHref = cards[0]?.href ?? '/dashboard/reportes'

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard' }]}
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
            <ContinueLastViewButton userId={userId} fallbackHref={continueHref} />
          </>
        }
      />

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">¿Qué quieres hacer hoy?</CardTitle>
          <CardDescription>Escoge un frente de trabajo y entra directo a la gestión que necesitas.</CardDescription>
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
    </div>
  )
}
