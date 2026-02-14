import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS, ALL_PLAN_TIERS, ensurePlanModuleDefaults } from '@/lib/plan-modules'
import { isSuperAdminEmail } from '@/lib/super-admin'
import type { ModuleKey, PlanTier } from '@prisma/client'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || session.user.role !== 'ADMIN' || !isSuperAdminEmail(email)) return null
  return session
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  // Asegura matriz completa para la UI (una fila por plan x módulo)
  await ensurePlanModuleDefaults()

  const rows = await prisma.planModuleSetting.findMany({
    select: { planTier: true, module: true, enabled: true, updatedAt: true },
    orderBy: [{ planTier: 'asc' }, { module: 'asc' }],
  })

  return NextResponse.json({
    ok: true,
    planTiers: ALL_PLAN_TIERS,
    modules: ALL_MODULE_KEYS,
    rows,
  })
}

export async function PUT(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const planTier = String(body.planTier ?? '') as PlanTier
  const moduleKey = String(body.module ?? '') as ModuleKey
  const enabled = Boolean(body.enabled)

  if (!ALL_PLAN_TIERS.includes(planTier)) {
    return NextResponse.json({ ok: false, error: 'PlanTier inválido' }, { status: 400 })
  }

  if (!ALL_MODULE_KEYS.includes(moduleKey)) {
    return NextResponse.json({ ok: false, error: 'ModuleKey inválido' }, { status: 400 })
  }

  const updated = await prisma.planModuleSetting.upsert({
    where: { planTier_module: { planTier, module: moduleKey } },
    create: { planTier, module: moduleKey, enabled },
    update: { enabled },
    select: { planTier: true, module: true, enabled: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, row: updated })
}
