import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { COMMERCIAL_PRICE_CATALOG } from '@/lib/commercial-price-catalog'
import { getCommercialPriceRows, saveCommercialPrice } from '@/lib/commercial-price-settings'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function isCommercialCode(value: unknown): value is string {
  return typeof value === 'string' && COMMERCIAL_PRICE_CATALOG.some((item) => item.code === value)
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const rows = await getCommercialPriceRows()
  const priceMap = Object.fromEntries(rows.map((row) => [row.code, row.priceCOP]))

  return NextResponse.json({
    ok: true,
    rows: COMMERCIAL_PRICE_CATALOG.map((item) => ({
      code: item.code,
      title: item.title,
      category: item.category,
      description: item.description,
      defaultPriceCOP: item.defaultPriceCOP,
      priceCOP: priceMap[item.code] ?? item.defaultPriceCOP,
    })),
  })
}

export async function PUT(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const code = body.code
  const priceCOP = Number(body.priceCOP)

  if (!isCommercialCode(code)) {
    return NextResponse.json({ ok: false, error: 'Código comercial inválido' }, { status: 400 })
  }

  if (!Number.isFinite(priceCOP) || priceCOP < 0) {
    return NextResponse.json({ ok: false, error: 'priceCOP inválido' }, { status: 400 })
  }

  const row = await saveCommercialPrice({ code, priceCOP: Math.round(priceCOP) })
  return NextResponse.json({ ok: true, row })
}