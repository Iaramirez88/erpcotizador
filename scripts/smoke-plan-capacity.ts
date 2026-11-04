/**
 * Smoke test del servicio central de capacidad.
 *
 * Ejecutar:
 *   npx tsx scripts/smoke-plan-capacity.ts
 *
 * Verifica contra la base de datos real:
 * - que la tabla `plan_limit_settings` exista (getPlanCapacityConfig)
 * - que el snapshot de consumo se calcule para una empresa
 * - que `checkPlanCapacity` responda con nivel, política y porcentaje
 * - que un límite personalizado (equivalente al PUT de /api/super-admin/plan-limits)
 *   se resuelva con `source: 'CUSTOM'` y se revierta sin dejar basura en la BD
 *
 * Nota: los límites se resuelven con el plan EFECTIVO (paywall), no con el plan
 * contratado. Una empresa con trial vencido y sin pago aparece como BASIC.
 */

import dotenv from 'dotenv'
dotenv.config()

/**
 * Los imports de `@/lib/*` se cargan dinámicamente para que `dotenv.config()`
 * se ejecute antes de instanciar el pool de Postgres.
 */
async function main() {
  const { prisma } = await import('@/lib/prisma')
  const { PLAN_CAPACITY_RESOURCES, checkPlanCapacity, getPlanCapacityConfig, getPlanCapacitySnapshot } = await import(
    '@/lib/plan-capacity'
  )
  const { resolvePaywallState } = await import('@/lib/plan-access')

  try {
    const empresa = await prisma.empresa.findFirst({
      select: {
        id: true,
        nombre: true,
        nit: true,
        registrationCodeHash: true,
        planTier: true,
        planValidUntil: true,
        trialTier: true,
        trialStartedAt: true,
        trialValidUntil: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!empresa) {
      console.log('No hay empresas en la base de datos.')
      return
    }

    const paywall = resolvePaywallState(empresa, new Date())
    const snapshot = await getPlanCapacitySnapshot({ companyId: empresa.id, fresh: true })
    console.log(
      'empresa:',
      empresa.nombre,
      '| plan contratado:',
      empresa.planTier,
      '| plan efectivo:',
      paywall.effectiveTier,
      '| paywall:',
      paywall.reason
    )
    console.log('meters:', snapshot?.meters.length ?? 0, '| summary:', JSON.stringify(snapshot?.summary ?? null))

    for (const meta of PLAN_CAPACITY_RESOURCES) {
      const check = await checkPlanCapacity({ companyId: empresa.id, resource: meta.resource, notify: false })
      console.log(
        `${meta.resource.padEnd(14)} used=${check.used} limit=${check.limit ?? 'ILIMITADO'} pct=${check.percentage}% level=${check.level} policy=${check.policy} allowed=${check.allowed}`
      )
    }

    const config = await getPlanCapacityConfig({ fresh: true })
    console.log('config FULL/COTIZACIONES:', JSON.stringify(config.FULL.COTIZACIONES))

    const settingsCount = await prisma.planLimitSetting.count()
    console.log('plan_limit_settings rows:', settingsCount)

    // Round-trip de personalización: simula lo que guarda PUT /api/super-admin/plan-limits
    // y confirma que el servicio resuelve la fila como CUSTOM. Se limpia al final.
    const probeTier = 'CRM' as const
    const probeResource = 'COTIZACIONES'
    const previous = await prisma.planLimitSetting.findUnique({
      where: { planTier_resource: { planTier: probeTier, resource: probeResource } },
    })

    try {
      await prisma.planLimitSetting.upsert({
        where: { planTier_resource: { planTier: probeTier, resource: probeResource } },
        create: {
          planTier: probeTier,
          resource: probeResource,
          limitValue: 123,
          period: 'MONTHLY',
          overagePolicy: 'WARN',
          warningPct: 70,
          criticalPct: 95,
        },
        update: {
          limitValue: 123,
          period: 'MONTHLY',
          overagePolicy: 'WARN',
          warningPct: 70,
          criticalPct: 95,
        },
      })

      const probed = await getPlanCapacityConfig({ fresh: true })
      console.log('round-trip CRM/COTIZACIONES:', JSON.stringify(probed.CRM.COTIZACIONES))
    } finally {
      if (previous) {
        await prisma.planLimitSetting.update({
          where: { id: previous.id },
          data: {
            limitValue: previous.limitValue,
            period: previous.period,
            overagePolicy: previous.overagePolicy,
            warningPct: previous.warningPct,
            criticalPct: previous.criticalPct,
            notes: previous.notes,
          },
        })
      } else {
        await prisma.planLimitSetting.deleteMany({
          where: { planTier: probeTier, resource: probeResource },
        })
      }
      const { invalidatePlanCapacityCache } = await import('@/lib/plan-capacity')
      invalidatePlanCapacityCache()
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error)
  process.exitCode = 1
})
