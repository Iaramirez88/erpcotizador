/**
 * Smoke test de la pestaña “Módulos, sedes y consumo” (super admin).
 *
 * Ejecutar:
 *   npx tsx scripts/smoke-module-assignments.ts
 *
 * Verifica contra la base de datos real:
 * - que `getEmpresaModuleAssignments` resuelva empresa, módulos, capacidad por recurso y totales
 * - que la capacidad incluya SEDES y USUARIOS (los administra el módulo CONFIG)
 * - que `saveEmpresaCapacityAssignment` (equivalente al PUT con `resource`) haga round-trip del
 *   límite, periodo, política y precio por unidad extra, y se pueda revertir sin dejar basura
 * - que `saveEmpresaBillingMode` (PUT con `moduleOnlyBilling`) elimine el plan base y deje de
 *   heredar módulos del plan, y que se pueda revertir
 *
 * Nota: el consumo se factura una sola vez por recurso, nunca por módulo, y solo si el módulo
 * dueño del recurso está habilitado.
 */

import dotenv from 'dotenv'
import type { ModuleKey } from '@prisma/client'
dotenv.config()

const CAPACITY_PROBE_RESOURCE = 'USUARIOS'

/**
 * Los imports de `@/lib/*` se cargan dinámicamente para que `dotenv.config()`
 * se ejecute antes de instanciar el pool de Postgres.
 */
async function main() {
  const { prisma } = await import('@/lib/prisma')
  const {
    getEmpresaModuleAssignments,
    saveEmpresaBillingMode,
    saveEmpresaCapacityAssignment,
  } = await import('@/lib/plan-module-assignments')

  let empresaId: string | null = null
  let previousBillingMode: boolean | null = null
  let previousOverrideModules: ModuleKey[] | null = null
  let previousCapacity: {
    limitValue: number | null
    limitPeriod: string
    overagePolicy: string | null
    pricePerExtraUnitCOP: number | null
    notes: string | null
  } | null = null

  try {
    const empresa = await prisma.empresa.findFirst({
      select: { id: true, nombre: true, moduleOnlyBilling: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!empresa) {
      console.log('No hay empresas en la base de datos.')
      return
    }

    empresaId = empresa.id
    previousBillingMode = empresa.moduleOnlyBilling
    previousOverrideModules = (
      await prisma.empresaModuleOverride.findMany({
        where: { empresaId: empresa.id },
        select: { module: true },
      })
    ).map((row) => row.module)

    const before = await getEmpresaModuleAssignments({ empresaId: empresa.id })
    if (!before) throw new Error('getEmpresaModuleAssignments devolvió null para una empresa existente')
    if (before.empresa.moduleOnlyBilling !== previousBillingMode) {
      throw new Error('La lectura no reporta el modo de facturación de la empresa')
    }

    console.log(
      'empresa:',
      empresa.nombre,
      '| plan contratado:',
      before.empresa.planTier ?? 'sin plan',
      '| plan efectivo:',
      before.empresa.effectivePlanTier,
      '| solo módulos:',
      before.empresa.moduleOnlyBilling
    )
    console.log('totales:', JSON.stringify(before.totals))

    console.log('módulos:')
    for (const row of before.rows.slice(0, 6)) {
      console.log(
        `  ${row.module.padEnd(16)} enabled=${row.effectiveEnabled} incluido=${row.includedInPlan} cobraCOP=${row.moduleCOP} recursos=${row.capacityResources.join('|') || '-'}`
      )
    }

    console.log('capacidad:')
    for (const row of before.capacity) {
      console.log(
        `  ${row.resource.padEnd(14)} dueno=${row.ownerModule.padEnd(12)} usado=${row.used} limite=${row.effectiveLimit ?? 'ILIMITADO'} extras=${row.extraUnits} consumoCOP=${row.consumptionCOP}`
      )
    }

    for (const resource of ['SEDES', 'USUARIOS'] as const) {
      if (!before.capacity.some((row) => row.resource === resource)) {
        throw new Error(`El recurso ${resource} no aparece en la capacidad por recurso`)
      }
    }


    const existingCapacity = await prisma.empresaCapacityOverride.findUnique({
      where: { empresaId_resource: { empresaId: empresa.id, resource: CAPACITY_PROBE_RESOURCE } },
      select: {
        limitValue: true,
        limitPeriod: true,
        overagePolicy: true,
        pricePerExtraUnitCOP: true,
        notes: true,
      },
    })
    previousCapacity = existingCapacity ?? null

    await saveEmpresaCapacityAssignment({
      empresaId: empresa.id,
      resource: CAPACITY_PROBE_RESOURCE,
      limitValue: 2,
      limitPeriod: 'MONTHLY',
      overagePolicy: 'OVERAGE',
      pricePerExtraUnitCOP: 1200,
      notes: 'smoke test',
    })

    const afterCapacity = await getEmpresaModuleAssignments({ empresaId: empresa.id })
    const capacityRow = afterCapacity?.capacity.find((row) => row.resource === CAPACITY_PROBE_RESOURCE) ?? null
    console.log(
      'round-trip capacidad:',
      CAPACITY_PROBE_RESOURCE,
      'limite=',
      capacityRow?.limitValue,
      'periodo=',
      capacityRow?.effectivePeriod,
      'politica=',
      capacityRow?.effectivePolicy,
      'precio=',
      capacityRow?.pricePerExtraUnitCOP,
      'consumoCOP=',
      capacityRow?.consumptionCOP
    )

    if (capacityRow?.limitValue !== 2) throw new Error('El límite del recurso no se reflejó en la lectura')
    if (capacityRow?.pricePerExtraUnitCOP !== 1200) {
      throw new Error('El precio por unidad extra del recurso no se reflejó en la lectura')
    }
    if (capacityRow?.effectivePolicy !== 'OVERAGE') {
      throw new Error('La política de excedente del recurso no se reflejó en la lectura')
    }
    if (!capacityRow?.configured) {
      throw new Error('El recurso quedó marcado como “hereda del plan” después de guardar')
    }

    const enabledBefore = before.rows.filter((row) => row.effectiveEnabled).map((row) => row.module)

    await saveEmpresaBillingMode({ empresaId: empresa.id, moduleOnlyBilling: true })

    const afterBilling = await getEmpresaModuleAssignments({ empresaId: empresa.id })
    if (!afterBilling) throw new Error('La lectura falló después de activar la facturación solo módulos')

    console.log(
      'solo módulos:',
      afterBilling.empresa.moduleOnlyBilling,
      '| plan base COP=',
      afterBilling.totals.basePlanCOP,
      '| módulos COP=',
      afterBilling.totals.modulesCOP,
      '| total COP=',
      afterBilling.totals.totalCOP
    )

    if (!afterBilling.empresa.moduleOnlyBilling) throw new Error('No se activó la facturación solo módulos')
    if (afterBilling.totals.basePlanCOP !== 0) throw new Error('Con solo módulos no debe cobrarse plan base')
    if (afterBilling.rows.some((row) => row.includedInPlan)) {
      throw new Error('Con solo módulos ningún módulo debe venir incluido por el plan')
    }

    const usersRow = afterBilling.capacity.find((row) => row.resource === CAPACITY_PROBE_RESOURCE) ?? null
    if (usersRow?.effectiveLimit !== 2) {
      throw new Error('Con solo módulos el límite configurado del recurso debe seguir vigente')
    }

    const enabledAfter = new Set(
      afterBilling.rows.filter((row) => row.effectiveEnabled).map((row) => row.module)
    )
    const dropped = enabledBefore.filter((module) => !enabledAfter.has(module))
    if (dropped.length) {
      throw new Error(`Con solo módulos se perdieron módulos habilitados: ${dropped.join(', ')}`)
    }
  } finally {
    if (empresaId) {
      if (previousBillingMode !== null) {
        await saveEmpresaBillingMode({ empresaId, moduleOnlyBilling: previousBillingMode }).catch((error) => {
          console.error('No se pudo restaurar el modo de facturación:', error)
        })
      }

      if (previousCapacity) {
        await saveEmpresaCapacityAssignment({
          empresaId,
          resource: CAPACITY_PROBE_RESOURCE,
          limitValue: previousCapacity.limitValue,
          limitPeriod: previousCapacity.limitPeriod,
          overagePolicy: previousCapacity.overagePolicy,
          pricePerExtraUnitCOP: previousCapacity.pricePerExtraUnitCOP,
          notes: previousCapacity.notes,
        }).catch((error) => {
          console.error('No se pudo restaurar la capacidad del recurso:', error)
        })
      } else {
        await saveEmpresaCapacityAssignment({
          empresaId,
          resource: CAPACITY_PROBE_RESOURCE,
          reset: true,
        }).catch((error) => {
          console.error('No se pudo limpiar la capacidad del recurso:', error)
        })
      }

      if (previousOverrideModules) {
        // Al activar “solo módulos” se crean overrides para conservar los módulos vigentes:
        // los que no existían antes del smoke test se eliminan para no dejar basura.
        const where =
          previousOverrideModules.length > 0
            ? { empresaId, module: { notIn: previousOverrideModules } }
            : { empresaId }
        await prisma.empresaModuleOverride.deleteMany({ where }).catch((error) => {
          console.error('No se pudieron limpiar las asignaciones de módulos del smoke test:', error)
        })
      }

      const restored = await getEmpresaModuleAssignments({ empresaId }).catch(() => null)
      if (restored) {
        console.log(
          'restaurado: solo módulos=',
          restored.empresa.moduleOnlyBilling,
          '| usuarios limite=',
          restored.capacity.find((row) => row.resource === CAPACITY_PROBE_RESOURCE)?.limitValue ?? 'hereda del plan'
        )
      }
    }

    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error)
  process.exitCode = 1
})
