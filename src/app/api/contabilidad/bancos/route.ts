import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const accounts = await prisma.treasuryBankAccount.findMany({
    where: { empresaId: access.empresaId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      bankName: true,
      accountNumber: true,
      currency: true,
      isActive: true,
      accountingAccountId: true,
      createdAt: true,
    },
  })

  const movements = await prisma.treasuryBankMovement.findMany({
    where: { empresaId: access.empresaId },
    select: { bankAccountId: true, amount: true },
  })

  const statsByAccount = new Map<string, { balance: number; movementsCount: number }>()
  for (const movement of movements) {
    const current = statsByAccount.get(movement.bankAccountId) ?? { balance: 0, movementsCount: 0 }
    current.balance += movement.amount ?? 0
    current.movementsCount += 1
    statsByAccount.set(movement.bankAccountId, current)
  }

  const data = accounts.map((account) => {
    const stats = statsByAccount.get(account.id)
    return {
      ...account,
      balance: stats?.balance ?? 0,
      movementsCount: stats?.movementsCount ?? 0,
    }
  })

  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const name = asString(body.name).trim()
  const bankName = asString(body.bankName).trim() || null
  const accountNumber = asString(body.accountNumber).trim() || null
  const currency = (asString(body.currency).trim() || 'COP').toUpperCase()
  const accountingAccountId = asString(body.accountingAccountId).trim() || null

  if (!name) {
    return NextResponse.json({ ok: false, error: 'name es requerido' }, { status: 400 })
  }

  if (accountingAccountId) {
    const account = await prisma.accountingAccount.findFirst({
      where: { id: accountingAccountId, empresaId: access.empresaId },
      select: { id: true },
    })
    if (!account) {
      return NextResponse.json({ ok: false, error: 'Cuenta contable no encontrada' }, { status: 400 })
    }
  }

  const created = await prisma.treasuryBankAccount.create({
    data: {
      empresaId: access.empresaId,
      name,
      bankName,
      accountNumber,
      currency,
      accountingAccountId,
    },
    select: {
      id: true,
      name: true,
      bankName: true,
      accountNumber: true,
      currency: true,
      isActive: true,
      accountingAccountId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: { ...created, balance: 0, movementsCount: 0 } })
}
