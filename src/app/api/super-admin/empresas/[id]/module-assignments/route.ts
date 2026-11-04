import { NextRequest, NextResponse } from 'next/server'
import type { ModuleKey } from '@prisma/client'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ALL_MODULE_KEYS } from '@/lib/plan-catalog'
import { normalizePlanCapacityResource } from '@/lib/plan-capacity'
import {
  getAssignmentCapacityOwner,
  getEmpresaModuleAssignments,
  saveEmpresaBillingMode,
  saveEmpresaCapacityAssignment,
  saveEmpresaModuleAssignment,
} from '@/lib/plan-module-assignments'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && ALL_MODULE_KEYS.includes(value as ModuleKey)
}

type Body = {
  module?: unknown
  /** Recurso de consumo: 'SEDES', 'USUARIOS', 'COTIZACIONES', … */
  resource?: unknown
  /** Activa/desactiva la facturación “solo módulos” (sin plan base). */
  moduleOnlyBilling?: unknown
  enabled?: unknown
  limitValue?: unknown
  limitPeriod?: unknown
  overagePolicy?: unknown
  pricePerExtraUnitCOP?: unknown
  notes?: unknown
  reset?: unknown
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const payload = await getEmpresaModuleAssignments({ empresaId })
  if (!payload) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, ...payload })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as Body
  const reset = body.reset === true
  const resource = typeof body.resource === 'string' ? body.resource.trim() : ''
  const moduleKey = isModuleKey(body.module) ? body.module : null
  const togglesBillingMode = body.moduleOnlyBilling !== undefined

  if (!moduleKey && !resource && !togglesBillingMode) {
    return NextResponse.json(
      { ok: false, error: 'Indica un módulo, un recurso de consumo o el modo de facturación' },
      { status: 400 }
    )
  }

  const enabled =
    body.enabled === undefined ? undefined : body.enabled === null ? undefined : Boolean(body.enabled)

  const parseOptionalNumber = (value: unknown): number | null | undefined | 'invalid' => {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0) return 'invalid'
    return Math.round(numeric)
  }

  const limitValue = parseOptionalNumber(body.limitValue)
  if (limitValue === 'invalid') {
    return NextResponse.json({ ok: false, error: 'El límite debe ser un número mayor o igual a 0' }, { status: 400 })
  }

  const pricePerExtraUnitCOP = parseOptionalNumber(body.pricePerExtraUnitCOP)
  if (pricePerExtraUnitCOP === 'invalid') {
    return NextResponse.json(
      { ok: false, error: 'El precio por unidad extra debe ser un número mayor o igual a 0' },
      { status: 400 }
    )
  }

  const limitPeriod =
    body.limitPeriod === undefined ? undefined : body.limitPeriod === null ? null : String(body.limitPeriod)
  if (limitPeriod !== undefined && limitPeriod !== null && !['MONTHLY', 'ACCUMULATED'].includes(limitPeriod)) {
    return NextResponse.json({ ok: false, error: 'Periodo inválido' }, { status: 400 })
  }

  const overagePolicy =
    body.overagePolicy === undefined ? undefined : body.overagePolicy === null ? null : String(body.overagePolicy)
  if (overagePolicy !== undefined && overagePolicy !== null && !['BLOCK', 'OVERAGE', 'WARN'].includes(overagePolicy)) {
    return NextResponse.json({ ok: false, error: 'Política de excedente inválida' }, { status: 400 })
  }

  const touchesConsumption =
    limitValue !== undefined || pricePerExtraUnitCOP !== undefined || limitPeriod !== undefined || overagePolicy !== undefined

  if (touchesConsumption && moduleKey) {
    const owner = getAssignmentCapacityOwner(moduleKey)
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: 'Este módulo no tiene consumo medible asociado' },
        { status: 400 }
      )
    }
    if (owner !== moduleKey) {
      return NextResponse.json(
        { ok: false, error: `El consumo de este recurso se configura en el módulo ${owner}` },
        { status: 400 }
      )
    }
  }

  const notes =
    body.notes === undefined
      ? undefined
      : body.notes === null || String(body.notes).trim() === ''
        ? null
        : String(body.notes).trim().slice(0, 500)

  try {
    if (resource) {
      const normalizedResource = normalizePlanCapacityResource(resource)
      if (!normalizedResource) {
        return NextResponse.json({ ok: false, error: 'Recurso de consumo inválido' }, { status: 400 })
      }

      await saveEmpresaCapacityAssignment({
        empresaId,
        resource: normalizedResource,
        limitValue,
        limitPeriod,
        overagePolicy,
        pricePerExtraUnitCOP,
        notes,
        reset,
      })
    } else if (moduleKey) {
      await saveEmpresaModuleAssignment({
        empresaId,
        module: moduleKey,
        enabled,
        limitValue,
        limitPeriod,
        overagePolicy,
        pricePerExtraUnitCOP,
        notes,
        reset,
      })
    } else {
      if (typeof body.moduleOnlyBilling !== 'boolean') {
        return NextResponse.json(
          { ok: false, error: 'El modo de facturación debe ser true o false' },
          { status: 400 }
        )
      }

      await saveEmpresaBillingMode({ empresaId, moduleOnlyBilling: body.moduleOnlyBilling })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message === 'EMPRESA_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
    }
    if (message === 'RESOURCE_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Recurso de consumo inválido' }, { status: 400 })
    }
    return NextResponse.json(
      { ok: false, error: 'No se pudo guardar la asignación del módulo' },
      { status: 500 }
    )
  }

  const payload = await getEmpresaModuleAssignments({ empresaId })
  if (!payload) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, ...payload })
}
