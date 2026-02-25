import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, AccountingAccountType, AccountingNormalBalance, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const rows = await prisma.accountingAccount.findMany({
    where: { empresaId: access.empresaId, isActive: true },
    orderBy: [{ code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      parentId: true,
      isPosting: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: rows })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const code = asString(body.code).trim()
  const name = asString(body.name).trim()
  const type = asString(body.type).trim() as AccountingAccountType
  const normalBalance = asString(body.normalBalance).trim() as AccountingNormalBalance
  const parentId = asString(body.parentId).trim() || null
  const isPosting = body.isPosting === false ? false : true

  if (!code || !name) {
    return NextResponse.json({ ok: false, error: 'code y name son requeridos' }, { status: 400 })
  }

  const validTypes: AccountingAccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ ok: false, error: 'type inválido' }, { status: 400 })
  }

  const validBalances: AccountingNormalBalance[] = ['DEBIT', 'CREDIT']
  if (!validBalances.includes(normalBalance)) {
    return NextResponse.json({ ok: false, error: 'normalBalance inválido' }, { status: 400 })
  }

  const created = await prisma.accountingAccount.create({
    data: {
      empresaId: access.empresaId,
      code,
      name,
      type,
      normalBalance,
      parentId,
      isPosting,
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      parentId: true,
      isPosting: true,
      isActive: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: created })
}
