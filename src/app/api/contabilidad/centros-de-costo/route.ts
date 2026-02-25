import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const rows = await prisma.accountingCostCenter.findMany({
    where: { empresaId: access.empresaId, isActive: true },
    orderBy: [{ code: 'asc' }],
    select: { id: true, code: true, name: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ ok: true, data: rows })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const code = asString(body.code).trim()
  const name = asString(body.name).trim()

  if (!code || !name) {
    return NextResponse.json({ ok: false, error: 'code y name son requeridos' }, { status: 400 })
  }

  const created = await prisma.accountingCostCenter.create({
    data: { empresaId: access.empresaId, code, name },
    select: { id: true, code: true, name: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ ok: true, data: created })
}
