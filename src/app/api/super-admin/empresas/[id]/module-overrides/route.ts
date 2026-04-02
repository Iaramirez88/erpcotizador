import { NextRequest, NextResponse } from 'next/server'
import type { ModuleKey } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ALL_MODULE_KEYS,
  getEnabledModulesForPlan,
  getModuleOverridesForEmpresa,
  saveEmpresaModuleOverride,
} from '@/lib/plan-modules'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && ALL_MODULE_KEYS.includes(value as ModuleKey)
}

function asOverrideValue(value: unknown): boolean | null | 'invalid' {
  if (value === null) return null
  if (value === true || value === false) return value
  return 'invalid'
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      planTier: true,
      nit: true,
      registrationCodeHash: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  if (!empresa) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const effectivePlanTier = resolveEffectivePlanTier(empresa, new Date())
  const [baseModules, overrides] = await Promise.all([
    getEnabledModulesForPlan(effectivePlanTier),
    getModuleOverridesForEmpresa(empresaId),
  ])

  return NextResponse.json({
    ok: true,
    effectivePlanTier,
    rows: ALL_MODULE_KEYS.map((moduleKey) => {
      const overrideEnabled = overrides[moduleKey] ?? null
      const baseEnabled = baseModules.includes(moduleKey)
      return {
        module: moduleKey,
        baseEnabled,
        overrideEnabled,
        effectiveEnabled: typeof overrideEnabled === 'boolean' ? overrideEnabled : baseEnabled,
      }
    }),
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { module?: unknown; enabled?: unknown }
  if (!isModuleKey(body.module)) {
    return NextResponse.json({ ok: false, error: 'Módulo inválido' }, { status: 400 })
  }

  const enabled = asOverrideValue(body.enabled)
  if (enabled === 'invalid') {
    return NextResponse.json({ ok: false, error: 'Override inválido' }, { status: 400 })
  }

  await saveEmpresaModuleOverride({ empresaId, module: body.module, enabled })

  return NextResponse.json({ ok: true })
}