import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type UiLanguage = 'es' | 'en'
type UiTheme = 'system' | 'light' | 'dark'

type NavPrefs = Record<string, boolean>
type NavOrderPrefs = string[]

type StoredNavPrefs =
  | NavPrefs
  | {
      visibility?: NavPrefs
      order?: NavOrderPrefs
    }

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
  chat?: {
    mutedCrmConversationIds?: string[]
    mutedTeamThreadIds?: string[]
  }
  tasks?: {
    pinnedTaskIds?: string[]
  }
  intelligence?: {
    recommendations?: {
      openedCount?: number
      uniqueActionIds?: string[]
      lastOpenedAt?: string | null
    }
  }
}

type TutorialPrefs = {
  seen?: Record<string, boolean>
}

type DataViewPrefs = Record<string, 'list' | 'grid'>

type SidebarTooltipPrefs = {
  desktop?: boolean
  mobile?: boolean
}

type StoredReportPrefs = ReportPrefs & {
  dataView?: DataViewPrefs
  theme?: UiTheme
  sidebarTooltips?: SidebarTooltipPrefs
}

function normalizeIntelligencePrefs(value: unknown): Required<NonNullable<ReportPrefs['intelligence']>> {
  if (!isPlainObject(value)) {
    return {
      recommendations: {
        openedCount: 0,
        uniqueActionIds: [],
        lastOpenedAt: null,
      },
    }
  }

  const recommendations = isPlainObject(value.recommendations) ? value.recommendations : {}
  const openedCount = typeof recommendations.openedCount === 'number' && Number.isFinite(recommendations.openedCount)
    ? Math.max(0, Math.floor(recommendations.openedCount))
    : 0
  const lastOpenedAt = typeof recommendations.lastOpenedAt === 'string' && recommendations.lastOpenedAt.trim()
    ? recommendations.lastOpenedAt.trim()
    : null

  return {
    recommendations: {
      openedCount,
      uniqueActionIds: normalizeStringList(recommendations.uniqueActionIds),
      lastOpenedAt,
    },
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
}

function normalizeChatPrefs(value: unknown): Required<NonNullable<ReportPrefs['chat']>> {
  if (!isPlainObject(value)) {
    return {
      mutedCrmConversationIds: [],
      mutedTeamThreadIds: [],
    }
  }

  return {
    mutedCrmConversationIds: normalizeStringList(value.mutedCrmConversationIds),
    mutedTeamThreadIds: normalizeStringList(value.mutedTeamThreadIds),
  }
}

function normalizeTaskPrefs(value: unknown): Required<NonNullable<ReportPrefs['tasks']>> {
  if (!isPlainObject(value)) {
    return {
      pinnedTaskIds: [],
    }
  }

  return {
    pinnedTaskIds: normalizeStringList(value.pinnedTaskIds),
  }
}

function normalizeSidebarTooltipPrefs(value: unknown): Required<SidebarTooltipPrefs> {
  if (!isPlainObject(value)) {
    return { desktop: true, mobile: true }
  }

  return {
    desktop: value.desktop !== false,
    mobile: value.mobile !== false,
  }
}

function normalizeNavPrefs(value: unknown): { visibility: NavPrefs; order: NavOrderPrefs } {
  if (!isPlainObject(value)) {
    return { visibility: {}, order: [] }
  }

  const visibilitySource = isPlainObject(value.visibility) ? value.visibility : value
  const visibility = Object.fromEntries(
    Object.entries(visibilitySource).filter(([, entry]) => typeof entry === 'boolean')
  ) as NavPrefs

  const order = Array.isArray(value.order)
    ? value.order.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []

  return { visibility, order }
}

function defaultPrefs() {
  const nav: NavPrefs = {}
  const navOrder: NavOrderPrefs = []
  const report: ReportPrefs = {
    sections: { kpis: true, ventas: true, topClientes: true, documentos: true, compras: true },
    charts: { ventasMensuales: true, documentosPorTipo: true, comprasPorProveedor: true },
    chat: { mutedCrmConversationIds: [], mutedTeamThreadIds: [] },
    tasks: { pinnedTaskIds: [] },
    intelligence: { recommendations: { openedCount: 0, uniqueActionIds: [], lastOpenedAt: null } },
  }
  const tutorial: TutorialPrefs = { seen: {} }
  const dataView: DataViewPrefs = {}
  const language: UiLanguage = 'es'
  const theme: UiTheme = 'system'
  const sidebarTooltips = { desktop: true, mobile: true }
  return { nav, navOrder, report, tutorial, dataView, language, theme, sidebarTooltips }
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
  const defaults = defaultPrefs()
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({
      success: true,
      data: {
        nav: defaults.nav,
        navOrder: defaults.navOrder,
        report: defaults.report,
        tutorial: defaults.tutorial,
        dataView: defaults.dataView,
        language: defaults.language,
        theme: defaults.theme,
        sidebarTooltips: defaults.sidebarTooltips,
      },
    })
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return NextResponse.json({
      success: true,
      data: {
        nav: defaults.nav,
        navOrder: defaults.navOrder,
        report: defaults.report,
        tutorial: defaults.tutorial,
        dataView: defaults.dataView,
        language: defaults.language,
        theme: defaults.theme,
        sidebarTooltips: defaults.sidebarTooltips,
      },
    })
  }

  const pref = await prisma.uiPreference.findUnique({
    where: { userId },
    select: { nav: true, report: true, tutorial: true, language: true },
  })
  const storedNav = normalizeNavPrefs(pref?.nav)
  const storedReport = isPlainObject(pref?.report) ? (pref?.report as StoredReportPrefs) : null

  return NextResponse.json({
    success: true,
    data: {
      nav: storedNav.visibility,
      navOrder: storedNav.order,
      report: {
        ...(storedReport ?? defaults.report),
        chat: normalizeChatPrefs(storedReport?.chat),
        tasks: normalizeTaskPrefs(storedReport?.tasks),
        intelligence: normalizeIntelligencePrefs(storedReport?.intelligence),
      },
      tutorial: (pref?.tutorial as unknown) ?? defaults.tutorial,
      dataView: storedReport?.dataView ?? defaults.dataView,
      language: (pref?.language as UiLanguage | null) ?? defaults.language,
      theme: storedReport?.theme ?? defaults.theme,
      sidebarTooltips: normalizeSidebarTooltipPrefs(storedReport?.sidebarTooltips),
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
  const navOrder = Array.isArray(body.navOrder)
    ? body.navOrder.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : undefined
  const report = isPlainObject(body.report) ? (body.report as ReportPrefs) : undefined
  const tutorial = isPlainObject(body.tutorial) ? (body.tutorial as TutorialPrefs) : undefined
  const dataView = isPlainObject(body.dataView) ? (body.dataView as DataViewPrefs) : undefined
  const sidebarTooltips = isPlainObject(body.sidebarTooltips) ? normalizeSidebarTooltipPrefs(body.sidebarTooltips) : undefined

  const languageRaw = typeof body.language === 'string' ? body.language.trim().toLowerCase() : ''
  const language: UiLanguage | undefined = languageRaw === 'es' || languageRaw === 'en' ? (languageRaw as UiLanguage) : undefined
  const themeRaw = typeof body.theme === 'string' ? body.theme.trim().toLowerCase() : ''
  const theme: UiTheme | undefined = themeRaw === 'system' || themeRaw === 'light' || themeRaw === 'dark'
    ? (themeRaw as UiTheme)
    : undefined

  const current = await prisma.uiPreference.findUnique({
    where: { userId },
    select: { nav: true, report: true },
  })

  const currentReport: StoredReportPrefs = isPlainObject(current?.report) ? (current.report as StoredReportPrefs) : { ...defaults.report, dataView: defaults.dataView }
  const currentNav = normalizeNavPrefs(current?.nav)
  const nextReport = {
    ...currentReport,
    ...(report ?? {}),
    dataView: dataView ?? currentReport.dataView ?? defaults.dataView,
    theme: theme ?? currentReport.theme ?? defaults.theme,
    sidebarTooltips: sidebarTooltips ?? normalizeSidebarTooltipPrefs(currentReport.sidebarTooltips),
    chat: normalizeChatPrefs(report?.chat ?? currentReport.chat),
    tasks: normalizeTaskPrefs(report?.tasks ?? currentReport.tasks),
    intelligence: normalizeIntelligencePrefs(report?.intelligence ?? currentReport.intelligence),
  }
  const nextNav = {
    visibility: nav ?? currentNav.visibility ?? defaults.nav,
    order: navOrder ?? currentNav.order ?? defaults.navOrder,
  }

  const updated = await prisma.uiPreference.upsert({
    where: { userId },
    create: {
      userId,
      nav: nextNav as never,
      report: nextReport as never,
      tutorial: (tutorial ?? defaults.tutorial) as never,
      language: language ?? defaults.language,
    },
    update: {
      nav: nextNav as never,
      report: nextReport as never,
      tutorial: (tutorial ?? undefined) as never,
      language: language ?? undefined,
    },
    select: { nav: true, report: true, tutorial: true, language: true },
  })

  const updatedNav = normalizeNavPrefs(updated.nav)
  const updatedReport = isPlainObject(updated.report) ? (updated.report as StoredReportPrefs) : null

  return NextResponse.json({
    success: true,
    data: {
      nav: updatedNav.visibility,
      navOrder: updatedNav.order,
      report: updatedReport
        ? {
            ...updatedReport,
            chat: normalizeChatPrefs(updatedReport.chat),
            tasks: normalizeTaskPrefs(updatedReport.tasks),
            intelligence: normalizeIntelligencePrefs(updatedReport.intelligence),
          }
        : updatedReport,
      tutorial: updated.tutorial,
      dataView: updatedReport?.dataView ?? defaults.dataView,
      language: updated.language as UiLanguage,
      theme: updatedReport?.theme ?? defaults.theme,
      sidebarTooltips: normalizeSidebarTooltipPrefs(updatedReport?.sidebarTooltips),
    },
  })
}
