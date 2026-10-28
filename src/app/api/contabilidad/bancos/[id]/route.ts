import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

async function resolveBankAccount(bankAccountId: string, empresaId: string) {
  return prisma.treasuryBankAccount.findFirst({
    where: { id: bankAccountId, empresaId },
    select: { id: true },
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const bankAccount = await resolveBankAccount(id, access.empresaId)
  if (!bankAccount) {
    return NextResponse.json({ ok: false, error: 'Cuenta bancaria no encontrada' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const data: {
    name?: string
    bankName?: string | null
    accountNumber?: string | null
    currency?: string
    accountingAccountId?: string | null
    isActive?: boolean
  } = {}

  if (body.name !== undefined) {
    const name = asString(body.name).trim()
    if (!name) {
      return NextResponse.json({ ok: false, error: 'name no puede estar vacío' }, { status: 400 })
    }
    data.name = name
  }

  if (body.bankName !== undefined) {
    data.bankName = asString(body.bankName).trim() || null
  }

  if (body.accountNumber !== undefined) {
    data.accountNumber = asString(body.accountNumber).trim() || null
  }

  if (body.currency !== undefined) {
    data.currency = (asString(body.currency).trim() || 'COP').toUpperCase()
  }

  if (body.accountingAccountId !== undefined) {
    const accountingAccountId = asString(body.accountingAccountId).trim() || null

    if (accountingAccountId) {
      const account = await prisma.accountingAccount.findFirst({
        where: { id: accountingAccountId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!account) {
        return NextResponse.json({ ok: false, error: 'Cuenta contable no encontrada' }, { status: 400 })
      }
    }

    data.accountingAccountId = accountingAccountId
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'isActive debe ser booleano' }, { status: 400 })
    }
    data.isActive = body.isActive
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const updated = await prisma.treasuryBankAccount.update({
    where: { id: bankAccount.id },
    data,
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

  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const bankAccount = await prisma.treasuryBankAccount.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, _count: { select: { movements: true } } },
  })

  if (!bankAccount) {
    return NextResponse.json({ ok: false, error: 'Cuenta bancaria no encontrada' }, { status: 404 })
  }

  if (bankAccount._count.movements > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `La cuenta tiene ${bankAccount._count.movements} movimientos registrados. Desactívala en lugar de eliminarla para conservar el historial.`,
      },
      { status: 400 }
    )
  }

  await prisma.treasuryBankAccount.delete({ where: { id: bankAccount.id } })

  return NextResponse.json({ ok: true })
}
