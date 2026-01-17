import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type NavPrefs = Record<string, boolean>

type ReportPrefs = {
  sections?: {
    kpis?: boolean
    ventas?: boolean
    topClientes?: boolean
    documentos?: boolean
    compras?: boolean
  }
  charts?: {
    ventasMensuales?: boolean
    documentosPorTipo?: boolean
    comprasPorProveedor?: boolean
  }
}

function defaultPrefs() {
  const nav: NavPrefs = {}
  const report: ReportPrefs = {
    sections: { kpis: true, ventas: true, topClientes: true, documentos: true, compras: true },
    charts: { ventasMensuales: true, documentosPorTipo: true, comprasPorProveedor: true },
  }
  return { nav, report }
}

async function resolveUserIdFromSession(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const userById = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    if (userById?.id) return userById.id
  }
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const pref = await prisma.uiPreference.findUnique({ where: { userId }, select: { nav: true, report: true } })
  const defaults = defaultPrefs()

  return NextResponse.json({
    success: true,
    data: {
      nav: (pref?.nav as unknown) ?? defaults.nav,
      report: (pref?.report as unknown) ?? defaults.report,
    },
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const defaults = defaultPrefs()

  const nav = isPlainObject(body.nav) ? (body.nav as NavPrefs) : undefined
  const report = isPlainObject(body.report) ? (body.report as ReportPrefs) : undefined

  const updated = await prisma.uiPreference.upsert({
    where: { userId },
    create: {
      userId,
      nav: (nav ?? defaults.nav) as never,
      report: (report ?? defaults.report) as never,
    },
    update: {
      nav: (nav ?? undefined) as never,
      report: (report ?? undefined) as never,
    },
    select: { nav: true, report: true },
  })

  return NextResponse.json({ success: true, data: { nav: updated.nav, report: updated.report } })
}
