import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { isBusinessType } from '@/lib/company-onboarding'
import {
  listOnboardingBusinessTypeSettings,
  saveOnboardingBusinessTypeSetting,
} from '@/lib/onboarding-business-type-settings'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

export async function GET() {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const rows = await listOnboardingBusinessTypeSettings({ includeInactive: true })
  return NextResponse.json({ ok: true, rows })
}

export async function PUT(request: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const businessType = typeof body.businessType === 'string' ? body.businessType.trim() : ''
  const sortOrderRaw = Number(body.sortOrder)

  if (!isBusinessType(businessType)) {
    return NextResponse.json({ ok: false, error: 'Nicho inválido' }, { status: 400 })
  }

  if (!Number.isFinite(sortOrderRaw) || sortOrderRaw < 0) {
    return NextResponse.json({ ok: false, error: 'El orden debe ser mayor o igual a cero.' }, { status: 400 })
  }

  const row = await saveOnboardingBusinessTypeSetting({
    businessType,
    active: Boolean(body.active),
    sortOrder: Math.trunc(sortOrderRaw),
  })

  return NextResponse.json({ ok: true, row })
}