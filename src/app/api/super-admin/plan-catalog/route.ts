import { NextRequest, NextResponse } from 'next/server'
import type { PlanTier } from '@prisma/client'
import { auth } from '@/lib/auth'
import { getManagedPlans, saveManagedPlan, type PlanIncludeGroup } from '@/lib/managed-plans'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'CRM' || value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
}

function normalizeIncludeGroups(value: unknown): PlanIncludeGroup[] {
  if (!Array.isArray(value)) return []
  return value
    .map((group) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) return null
      const title = typeof (group as { title?: unknown }).title === 'string' ? String((group as { title: string }).title).trim() : ''
      const items = Array.isArray((group as { items?: unknown }).items)
        ? (group as { items: unknown[] }).items.map((item) => String(item || '').trim()).filter(Boolean)
        : []
      if (!title) return null
      return { title, items }
    })
    .filter((group): group is PlanIncludeGroup => Boolean(group))
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const rows = await getManagedPlans({ includeInactive: true })
  return NextResponse.json({ ok: true, rows })
}

export async function PUT(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const tier = body.tier
  const nombre = String(body.nombre || '').trim()
  const descripcion = String(body.descripcion || '').trim()
  const tagline = String(body.tagline || '').trim()
  const forWho = String(body.forWho || '').trim()
  const precioMensualCOP = Number(body.precioMensualCOP)
  const storageLimitGbRaw = body.storageLimitGb
  const storageLimitGb = storageLimitGbRaw === null || storageLimitGbRaw === '' || storageLimitGbRaw === undefined ? null : Number(storageLimitGbRaw)
  const displayOrder = Number(body.displayOrder)
  const active = Boolean(body.active)
  const incluye = normalizeIncludeGroups(body.incluye)
  const alcance = normalizeStringList(body.alcance)

  if (!isPlanTier(tier)) {
    return NextResponse.json({ ok: false, error: 'PlanTier inválido' }, { status: 400 })
  }

  if (!nombre || !descripcion || !tagline || !forWho) {
    return NextResponse.json({ ok: false, error: 'Completa nombre, descripción, tagline y enfoque comercial.' }, { status: 400 })
  }

  if (!Number.isFinite(precioMensualCOP) || precioMensualCOP < 0) {
    return NextResponse.json({ ok: false, error: 'El precio mensual debe ser mayor o igual a cero.' }, { status: 400 })
  }

  if (storageLimitGb !== null && (!Number.isFinite(storageLimitGb) || storageLimitGb <= 0)) {
    return NextResponse.json({ ok: false, error: 'El límite de espacio debe ser mayor a cero.' }, { status: 400 })
  }

  if (!Number.isFinite(displayOrder) || displayOrder < 0) {
    return NextResponse.json({ ok: false, error: 'El orden debe ser mayor o igual a cero.' }, { status: 400 })
  }

  const row = await saveManagedPlan({
    tier,
    nombre,
    descripcion,
    precioMensualCOP: Math.round(precioMensualCOP),
    tagline,
    forWho,
    incluye,
    alcance,
    storageLimitGb: storageLimitGb === null ? null : Math.round(storageLimitGb),
    active,
    displayOrder: Math.round(displayOrder),
  })

  return NextResponse.json({ ok: true, row })
}