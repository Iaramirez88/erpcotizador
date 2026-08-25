import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS } from '@/lib/plan-modules'
import { getEnabledModulesForEmpresa } from '@/lib/plan-modules'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { EXTERNAL_DASHBOARD_SCOPE_COOKIE, isModuleAllowedForExternalDashboardScope } from '@/lib/external-dashboard-scope'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
    const cookieStore = await cookies()
    const externalDashboardScope = cookieStore.get(EXTERNAL_DASHBOARD_SCOPE_COOKIE)?.value ?? null

    // Super admin: ve todo.
    if (session.user.role === 'ADMIN') {
      const enabled = externalDashboardScope
        ? ALL_MODULE_KEYS.filter((moduleKey) => isModuleAllowedForExternalDashboardScope({ moduleKey, scope: externalDashboardScope }))
        : ALL_MODULE_KEYS
      return NextResponse.json({ ok: true, enabled, planTier: 'FULL' })
    }

    const userId = session.user.id
    const empresaId = await requireEmpresaIdForUser(userId)

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        nit: true,
        registrationCodeHash: true,
        planTier: true,
        planValidUntil: true,
        trialTier: true,
        trialStartedAt: true,
        trialValidUntil: true,
      },
    })

    const planTier = empresa ? resolveEffectivePlanTier(empresa, new Date()) : 'FULL'

    const enabled = await getEnabledModulesForEmpresa({ empresaId, planTier })
    const scopedEnabled = externalDashboardScope
      ? enabled.filter((moduleKey) => isModuleAllowedForExternalDashboardScope({ moduleKey, scope: externalDashboardScope }))
      : enabled
    return NextResponse.json({ ok: true, enabled: scopedEnabled, planTier })
  } catch (error: unknown) {
    console.error('GET /api/modules/enabled error:', error)
    return NextResponse.json({ ok: true, enabled: ALL_MODULE_KEYS, planTier: 'FULL', degraded: true })
  }
}
