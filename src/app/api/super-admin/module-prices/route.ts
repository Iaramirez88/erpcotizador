import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ALL_MODULE_KEYS, buildPlanModuleCatalog } from '@/lib/plan-catalog'
import { getPlanModulePriceRows, savePlanModulePrice } from '@/lib/plan-module-prices'
import type { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && ALL_MODULE_KEYS.includes(value as ModuleKey)
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const rows = await getPlanModulePriceRows()
  const catalog = buildPlanModuleCatalog(Object.fromEntries(rows.map((row) => [row.module, row.priceCOP])))

  return NextResponse.json({
    ok: true,
    rows: catalog.map((item) => ({
      module: item.module,
      nombre: item.nombre,
      descripcion: item.descripcion,
      category: item.category,
      priceCOP: item.activationPriceMonthlyCOP,
    })),
  })
}

export async function PUT(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const moduleKey = body.module
  const priceCOP = Number(body.priceCOP)

  if (!isModuleKey(moduleKey)) {
    return NextResponse.json({ ok: false, error: 'ModuleKey inválido' }, { status: 400 })
  }

  if (!Number.isFinite(priceCOP) || priceCOP < 0) {
    return NextResponse.json({ ok: false, error: 'priceCOP inválido' }, { status: 400 })
  }

  const row = await savePlanModulePrice({ module: moduleKey, priceCOP: Math.round(priceCOP) })
  return NextResponse.json({ ok: true, row })
}