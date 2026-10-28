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

export async function GET(_: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const { id } = await context.params
  const bankAccount = await resolveBankAccount(id, access.empresaId)
  if (!bankAccount) {
    return NextResponse.json({ ok: false, error: 'Cuenta bancaria no encontrada' }, { status: 404 })
  }

  const movements = await prisma.treasuryBankMovement.findMany({
    where: { empresaId: access.empresaId, bankAccountId: id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      referenceType: true,
      referenceId: true,
      journalEntryId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: movements })
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const bankAccount = await resolveBankAccount(id, access.empresaId)
  if (!bankAccount) {
    return NextResponse.json({ ok: false, error: 'Cuenta bancaria no encontrada' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const description = asString(body.description).trim()
  const amount =
    typeof body.amount === 'number' ? body.amount : Number(asString(body.amount).replace(/[^\d.-]/g, ''))
  const dateInput = asString(body.date).trim()
  const date = dateInput ? new Date(dateInput) : new Date()
  const referenceType = asString(body.referenceType).trim() || null
  const referenceId = asString(body.referenceId).trim() || null
  const journalEntryId = asString(body.journalEntryId).trim() || null

  if (!description) {
    return NextResponse.json({ ok: false, error: 'description es requerida' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ ok: false, error: 'amount debe ser un número distinto de cero' }, { status: 400 })
  }
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ ok: false, error: 'date inválida' }, { status: 400 })
  }

  if (journalEntryId) {
    const entry = await prisma.accountingJournalEntry.findFirst({
      where: { id: journalEntryId, empresaId: access.empresaId },
      select: { id: true },
    })
    if (!entry) {
      return NextResponse.json({ ok: false, error: 'Asiento no encontrado' }, { status: 400 })
    }
  }

  const created = await prisma.treasuryBankMovement.create({
    data: {
      empresaId: access.empresaId,
      bankAccountId: id,
      date,
      description,
      amount,
      referenceType,
      referenceId,
      journalEntryId,
    },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      referenceType: true,
      referenceId: true,
      journalEntryId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: created })
}
