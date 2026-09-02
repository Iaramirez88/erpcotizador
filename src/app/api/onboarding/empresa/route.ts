import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import {
  buildCompanyPreset,
  getBusinessTypeLabel,
  parseCompanyOnboardingData,
  resolveDashboardConfig,
} from '@/lib/company-onboarding'
import { isCompanyIntelligenceEnabled, removeIntelligenceHrefFromDashboardConfig } from '@/lib/company-intelligence'
import { ensureBusinessTypeSeedsForEmpresa } from '@/lib/business-type-seeds'
import { getActiveSedeForUser } from '@/lib/rbac'
import { buildAllowedDashboardHrefsForUser } from '@/lib/dashboard-access'
import { getVisibleOnboardingBusinessTypes } from '@/lib/onboarding-business-type-settings'
import { EXTERNAL_DASHBOARD_SCOPE_COOKIE, intersectDashboardHrefsWithExternalScope } from '@/lib/external-dashboard-scope'
import { syncCompanyPresetAccess } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

async function resolveContext() {
  const session = await auth()
  if (!session?.user) return null

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, empresaId: true, uiPreference: { select: { tutorial: true } } },
  })

  if (!user?.empresaId) return null

  const empresa = await prisma.empresa.findUnique({
    where: { id: user.empresaId },
    select: {
      id: true,
      planOwnerUserId: true,
      onboardingStatus: true,
      onboardingCompletedAt: true,
      businessType: true,
      onboardingData: true,
      dashboardConfig: true,
    },
  })

  if (!empresa) return null

  const isOwner = !empresa.planOwnerUserId || empresa.planOwnerUserId === userId

  return {
    userId,
    tutorial: user.uiPreference?.tutorial,
    empresa,
    isOwner,
  }
}

export async function GET() {
  try {
    const context = await resolveContext()
    if (!context) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const externalDashboardScope = cookieStore.get(EXTERNAL_DASHBOARD_SCOPE_COOKIE)?.value ?? null
    const data = parseCompanyOnboardingData(context.empresa.onboardingData)
    const dashboard = resolveDashboardConfig({
      dashboardConfig: context.empresa.dashboardConfig,
      onboardingData: context.empresa.onboardingData,
      businessType: context.empresa.businessType,
    })
    const scopedDashboard = isCompanyIntelligenceEnabled(context.empresa.dashboardConfig)
      ? dashboard
      : removeIntelligenceHrefFromDashboardConfig(dashboard)
    const sede = await getActiveSedeForUser(context.userId)
    const permissionAllowedHrefs = await buildAllowedDashboardHrefsForUser({
      userId: context.userId,
      empresaId: context.empresa.id,
      sedeId: sede.id,
      baseAllowedHrefs: scopedDashboard?.allowedHrefs ?? null,
    })
    const scopedPermissionAllowedHrefs = intersectDashboardHrefsWithExternalScope({
      hrefs: permissionAllowedHrefs,
      scope: externalDashboardScope,
    }) ?? []
    const locked = Boolean(context.empresa.onboardingCompletedAt)
    const availableBusinessTypes = await getVisibleOnboardingBusinessTypes()
    const tutorial = context.tutorial
    const tutorialSeen = tutorial && typeof tutorial === 'object' && !Array.isArray(tutorial) ? tutorial.seen : null
    const welcomeSeen = Boolean(
      tutorialSeen && typeof tutorialSeen === 'object' && !Array.isArray(tutorialSeen)
        ? (tutorialSeen as Record<string, boolean>).dashboardWelcomeTrial15d
        : false
    )

    return NextResponse.json({
      ok: true,
      required: context.isOwner && !locked && context.empresa.onboardingStatus !== 'COMPLETED',
      welcomeSeen,
      editable: context.isOwner && !locked,
      locked,
      status: context.empresa.onboardingStatus,
      businessType: context.empresa.businessType,
      businessTypeLabel: getBusinessTypeLabel(context.empresa.businessType as Parameters<typeof getBusinessTypeLabel>[0]),
      completedAt: context.empresa.onboardingCompletedAt,
      availableBusinessTypes,
      data,
      dashboard: scopedDashboard
        ? {
            ...scopedDashboard,
            allowedHrefs: scopedDashboard.allowedHrefs.length
              ? scopedDashboard.allowedHrefs.filter((href) => scopedPermissionAllowedHrefs.includes(href))
              : scopedPermissionAllowedHrefs,
          }
        : { allowedHrefs: scopedPermissionAllowedHrefs },
    })
  } catch (error) {
    console.error('GET /api/onboarding/empresa error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el onboarding' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveContext()
    if (!context) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    }

    if (!context.isOwner) {
      return NextResponse.json({ ok: false, error: 'Solo la persona dueña del espacio puede configurar este onboarding' }, { status: 403 })
    }

    if (context.empresa.onboardingCompletedAt) {
      return NextResponse.json({ ok: false, error: 'La configuración inicial ya quedó cerrada. Si necesitas cambiar el nicho, solicítalo por soporte.' }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const onboarding = parseCompanyOnboardingData(body)
    const availableBusinessTypes = await getVisibleOnboardingBusinessTypes()
    if (!availableBusinessTypes.includes(onboarding.businessType)) {
      return NextResponse.json({ ok: false, error: 'Ese nicho no está disponible en la configuración inicial.' }, { status: 400 })
    }
    const preset = buildCompanyPreset(onboarding)

    await ensureBusinessTypeSeedsForEmpresa({ empresaId: context.empresa.id, businessType: onboarding.businessType })

    await prisma.empresa.update({
      where: { id: context.empresa.id },
      data: {
        businessType: onboarding.businessType,
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
        onboardingData: onboarding,
        dashboardConfig: preset.dashboard,
      },
      select: { id: true },
    })

    await syncCompanyPresetAccess({
      empresaId: context.empresa.id,
      businessType: onboarding.businessType,
      modules: preset.modules,
      grantedByUserId: context.userId,
    })

    return NextResponse.json({
      ok: true,
      businessType: onboarding.businessType,
      businessTypeLabel: getBusinessTypeLabel(onboarding.businessType),
      modules: preset.modules,
      dashboard: preset.dashboard,
    })
  } catch (error) {
    console.error('POST /api/onboarding/empresa error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el onboarding' }, { status: 500 })
  }
}