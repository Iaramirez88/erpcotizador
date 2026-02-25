import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type UiLanguage = 'es' | 'en'

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

type TutorialPrefs = {
  seen?: Record<string, boolean>
}

function defaultPrefs() {
  const nav: NavPrefs = {}
  const report: ReportPrefs = {
    sections: { kpis: true, ventas: true, topClientes: true, documentos: true, compras: true },
    charts: { ventasMensuales: true, documentosPorTipo: true, comprasPorProveedor: true },
  }
  const tutorial: TutorialPrefs = { seen: {} }
  const language: UiLanguage = 'es'
  return { nav, report, tutorial, language }
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

  const pref = await prisma.uiPreference.findUnique({
    where: { userId },
    select: { nav: true, report: true, tutorial: true, language: true },
  })
  const defaults = defaultPrefs()

  return NextResponse.json({
    success: true,
    data: {
      nav: (pref?.nav as unknown) ?? defaults.nav,
      report: (pref?.report as unknown) ?? defaults.report,
      tutorial: (pref?.tutorial as unknown) ?? defaults.tutorial,
      language: (pref?.language as UiLanguage | null) ?? defaults.language,
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
  const tutorial = isPlainObject(body.tutorial) ? (body.tutorial as TutorialPrefs) : undefined

  const languageRaw = typeof body.language === 'string' ? body.language.trim().toLowerCase() : ''
  const language: UiLanguage | undefined = languageRaw === 'es' || languageRaw === 'en' ? (languageRaw as UiLanguage) : undefined

  const updated = await prisma.uiPreference.upsert({
    where: { userId },
    create: {
      userId,
      nav: (nav ?? defaults.nav) as never,
      report: (report ?? defaults.report) as never,
      tutorial: (tutorial ?? defaults.tutorial) as never,
      language: language ?? defaults.language,
    },
    update: {
      nav: (nav ?? undefined) as never,
      report: (report ?? undefined) as never,
      tutorial: (tutorial ?? undefined) as never,
      language: language ?? undefined,
    },
    select: { nav: true, report: true, tutorial: true, language: true },
  })

  return NextResponse.json({
    success: true,
    data: { nav: updated.nav, report: updated.report, tutorial: updated.tutorial, language: updated.language as UiLanguage },
  })
}
