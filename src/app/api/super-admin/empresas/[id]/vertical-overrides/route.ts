import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  RBAC_V2_CAPABILITY_CATALOG,
  type RbacV2CapabilityAction,
} from '@/lib/rbac-v2-catalog'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

const VERTICAL_KEYS = ['ODONTOLOGIA', 'RESTAURANTE', 'DOTACIONES'] as const

type VerticalKey = (typeof VERTICAL_KEYS)[number]

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isVerticalKey(value: unknown): value is VerticalKey {
  return typeof value === 'string' && VERTICAL_KEYS.includes(value as VerticalKey)
}

function getVerticalActions(vertical: VerticalKey): RbacV2CapabilityAction[] {
  return RBAC_V2_CAPABILITY_CATALOG.find((item) => item.domain === 'VERTICALES' && item.subdomain === vertical)?.actions ?? ['READ']
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } })
  if (!empresa?.id) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const rows = await prisma.capabilityEntitlement.findMany({
    where: {
      empresaId,
      domain: 'VERTICALES',
      subdomain: { in: [...VERTICAL_KEYS] },
    },
    select: { subdomain: true, action: true, enabled: true },
  })

  return NextResponse.json({
    ok: true,
    rows: VERTICAL_KEYS.map((vertical) => {
      const actions = getVerticalActions(vertical)
      const entitlementByAction = new Map(
        rows
          .filter((row) => row.subdomain === vertical)
          .map((row) => [row.action, row.enabled])
      )

      return {
        vertical,
        enabled: actions.every((action) => entitlementByAction.get(action) !== false),
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

  const body = (await req.json().catch(() => ({}))) as { vertical?: unknown; enabled?: unknown }
  if (!isVerticalKey(body.vertical)) {
    return NextResponse.json({ ok: false, error: 'Vertical inválido' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Estado inválido' }, { status: 400 })
  }

  const vertical = body.vertical
  const enabled = body.enabled
  const actions = getVerticalActions(vertical)
  await prisma.$transaction(
    actions.map((action) =>
      prisma.capabilityEntitlement.upsert({
        where: {
          empresaId_domain_subdomain_action: {
            empresaId,
            domain: 'VERTICALES',
            subdomain: vertical,
            action,
          },
        },
        create: {
          empresaId,
          domain: 'VERTICALES',
          subdomain: vertical,
          action,
          enabled,
        },
        update: {
          enabled,
        },
      })
    )
  )

  return NextResponse.json({ ok: true })
}