import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

async function requireSuperAdmin() {
  const session = await auth()
  if (!isSuperAdminEmail(session?.user?.email)) {
    return { ok: false as const, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  return { ok: true as const }
}

function parsePct(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback
}

export async function GET(request: Request) {
  const access = await requireSuperAdmin()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const empresaId = normalizeString(searchParams.get('empresaId')) || null

  const policies = await prisma.messagingQuotaPolicy.findMany({
    where: empresaId ? { OR: [{ empresaId: null }, { empresaId }] } : {},
    orderBy: [{ empresaId: 'asc' }, { scope: 'asc' }, { window: 'asc' }],
  })

  return NextResponse.json({ success: true, data: policies })
}

export async function POST(request: Request) {
  const access = await requireSuperAdmin()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const limitValue = Number.parseInt(String(body.limitValue ?? ''), 10)
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    return NextResponse.json({ error: 'limitValue debe ser un entero positivo' }, { status: 400 })
  }

  const id = normalizeString(body.id) || undefined
  const scope = normalizeString(body.scope) || 'EMPRESA'
  const window = normalizeString(body.window) || 'MONTHLY'

  const data = {
    empresaId: normalizeString(body.empresaId) || null,
    channelConnectionId: normalizeString(body.channelConnectionId) || null,
    provider: normalizeString(body.provider) || null,
    category: normalizeString(body.category) || null,
    scope: ['GLOBAL', 'EMPRESA', 'CHANNEL'].includes(scope) ? scope : 'EMPRESA',
    window: ['DAILY', 'MONTHLY'].includes(window) ? window : 'MONTHLY',
    limitValue,
    overagePolicy: ['BLOCK', 'SOFT', 'ALLOW'].includes(String(body.overagePolicy)) ? String(body.overagePolicy) : 'BLOCK',
    warningPct: parsePct(body.warningPct, 70),
    criticalPct: parsePct(body.criticalPct, 85),
    blockPct: parsePct(body.blockPct, 100),
    timezone: normalizeString(body.timezone) || 'America/Bogota',
    enabled: body.enabled !== false,
    notes: normalizeString(body.notes) || null,
  }

  const policy = id
    ? await prisma.messagingQuotaPolicy.update({ where: { id }, data })
    : await prisma.messagingQuotaPolicy.create({ data })

  return NextResponse.json({ success: true, data: policy })
}
