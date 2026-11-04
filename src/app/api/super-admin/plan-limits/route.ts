import { NextRequest, NextResponse } from 'next/server'
import type { PlanTier } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import {
  PLAN_CAPACITY_DEFAULT_CRITICAL_PCT,
  PLAN_CAPACITY_DEFAULT_WARNING_PCT,
  PLAN_CAPACITY_RESOURCES,
  getPlanCapacityConfig,
  invalidatePlanCapacityCache,
  normalizePlanCapacityPeriod,
  normalizePlanCapacityPolicy,
  normalizePlanCapacityResource,
} from '@/lib/plan-capacity'
import { COMMERCIAL_PLAN_TIERS } from '@/lib/plan-catalog'

export const runtime = 'nodejs'

const FALLBACK_PLAN_NAMES: Record<PlanTier, string> = {
  CRM: 'CRM',
  BASIC: 'Básico',
  MEDIO: 'Medio',
  INTERMEDIO: 'Intermedio',
  FULL: 'Full',
}

function requireSuperAdmin(session: { user?: { email?: string | null } } | null) {
  if (!session?.user) return null
  if (!isSuperAdminEmail(session.user.email ?? null)) return null
  return session
}

async function loadPlanLabels() {
  const labels = new Map<PlanTier, { nombre: string; storageLimitGb: number | null }>()
  try {
    const rows = await prisma.planCatalogSetting.findMany({
      select: { planTier: true, nombre: true, storageLimitGb: true },
    })
    for (const row of rows) {
      labels.set(row.planTier, { nombre: row.nombre, storageLimitGb: row.storageLimitGb })
    }
  } catch {
    // Tabla de catálogo aún no migrada: se usan nombres por defecto.
  }
  return labels
}

function clampPct(value: unknown, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(100, Math.max(1, Math.round(numeric)))
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const [config, labels] = await Promise.all([getPlanCapacityConfig({ fresh: true }), loadPlanLabels()])

  // Solo planes comerciales vigentes (Básico, Medio, Intermedio y Full): el tier `CRM` es legado.
  const plans = COMMERCIAL_PLAN_TIERS.map((tier) => ({
    planTier: tier,
    nombre: labels.get(tier)?.nombre ?? FALLBACK_PLAN_NAMES[tier],
    storageLimitGb: labels.get(tier)?.storageLimitGb ?? null,
  }))

  const rows = COMMERCIAL_PLAN_TIERS.flatMap((tier) =>
    PLAN_CAPACITY_RESOURCES.map((meta) => {
      const resolved = config[tier][meta.resource]
      return {
        planTier: tier,
        resource: meta.resource,
        limit: resolved.limit,
        period: resolved.period,
        policy: resolved.policy,
        warningPct: resolved.warningPct,
        criticalPct: resolved.criticalPct,
        source: resolved.source,
        isCustom: resolved.source === 'CUSTOM',
      }
    })
  )

  return NextResponse.json({
    ok: true,
    plans,
    resources: PLAN_CAPACITY_RESOURCES,
    rows,
    thresholds: {
      warningPct: PLAN_CAPACITY_DEFAULT_WARNING_PCT,
      criticalPct: PLAN_CAPACITY_DEFAULT_CRITICAL_PCT,
    },
  })
}

export async function PUT(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const planTier = COMMERCIAL_PLAN_TIERS.find((tier) => tier === body.planTier)
  const resource = normalizePlanCapacityResource(typeof body.resource === 'string' ? body.resource : null)

  if (!planTier) return NextResponse.json({ ok: false, error: 'Plan inválido' }, { status: 400 })
  if (!resource) return NextResponse.json({ ok: false, error: 'Recurso inválido' }, { status: 400 })

  // `reset` devuelve el recurso a los defaults del código.
  if (body.reset === true) {
    await prisma.planLimitSetting.deleteMany({ where: { planTier, resource } })
    invalidatePlanCapacityCache()
    return NextResponse.json({ ok: true, reset: true })
  }

  const rawLimit = body.limit
  const limit =
    rawLimit === null || rawLimit === undefined || rawLimit === '' ? null : Number(rawLimit)

  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
    return NextResponse.json({ ok: false, error: 'El límite debe ser un número mayor o igual a 0' }, { status: 400 })
  }

  const period = normalizePlanCapacityPeriod(body.period) ?? 'MONTHLY'
  const policy = normalizePlanCapacityPolicy(body.policy) ?? 'BLOCK'
  const warningPct = clampPct(body.warningPct, PLAN_CAPACITY_DEFAULT_WARNING_PCT)
  const criticalPct = clampPct(body.criticalPct, PLAN_CAPACITY_DEFAULT_CRITICAL_PCT)

  if (criticalPct <= warningPct) {
    return NextResponse.json(
      { ok: false, error: 'El umbral crítico debe ser mayor que el umbral de aviso' },
      { status: 400 }
    )
  }

  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null

  try {
    const row = await prisma.planLimitSetting.upsert({
      where: { planTier_resource: { planTier, resource } },
      create: {
        planTier,
        resource,
        limitValue: limit === null ? null : Math.round(limit),
        period,
        overagePolicy: policy,
        warningPct,
        criticalPct,
        notes,
      },
      update: {
        limitValue: limit === null ? null : Math.round(limit),
        period,
        overagePolicy: policy,
        warningPct,
        criticalPct,
        notes,
      },
    })

    // El almacenamiento comparte fuente con el catálogo de planes (cuota usada por CRM y backups).
    if (resource === 'ALMACENAMIENTO') {
      await prisma.planCatalogSetting
        .updateMany({ where: { planTier }, data: { storageLimitGb: limit === null ? null : Math.round(limit) } })
        .catch(() => null)
    }

    invalidatePlanCapacityCache()

    return NextResponse.json({ ok: true, row })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'No se pudo guardar el límite. Verifica que la migración plan_limit_settings esté aplicada.' },
      { status: 500 }
    )
  }
}
