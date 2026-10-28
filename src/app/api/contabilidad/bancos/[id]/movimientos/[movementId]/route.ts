import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string; movementId: string }> }

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

async function resolveMovement(bankAccountId: string, movementId: string, empresaId: string) {
  return prisma.treasuryBankMovement.findFirst({
    where: { id: movementId, bankAccountId, empresaId },
    select: { id: true, journalEntryId: true },
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id, movementId } = await context.params
  const movement = await resolveMovement(id, movementId, access.empresaId)
  if (!movement) {
    return NextResponse.json({ ok: false, error: 'Movimiento no encontrado' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const data: {
    date?: Date
    description?: string
    amount?: number
    referenceType?: string | null
    referenceId?: string | null
    journalEntryId?: string | null
  } = {}

  if (body.description !== undefined) {
    const description = asString(body.description).trim()
    if (!description) {
      return NextResponse.json({ ok: false, error: 'description no puede estar vacía' }, { status: 400 })
    }
    data.description = description
  }

  if (body.amount !== undefined) {
    const amount =
      typeof body.amount === 'number' ? body.amount : Number(asString(body.amount).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ ok: false, error: 'amount debe ser un número distinto de cero' }, { status: 400 })
    }
    data.amount = amount
  }

  if (body.date !== undefined) {
    const dateInput = asString(body.date).trim()
    const date = dateInput ? new Date(dateInput) : new Date('')
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ ok: false, error: 'date inválida' }, { status: 400 })
    }
    data.date = date
  }

  if (body.referenceType !== undefined) {
    data.referenceType = asString(body.referenceType).trim() || null
  }

  if (body.referenceId !== undefined) {
    data.referenceId = asString(body.referenceId).trim() || null
  }

  if (body.journalEntryId !== undefined) {
    const journalEntryId = asString(body.journalEntryId).trim() || null

    if (journalEntryId) {
      const entry = await prisma.accountingJournalEntry.findFirst({
        where: { id: journalEntryId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!entry) {
        return NextResponse.json({ ok: false, error: 'Asiento no encontrado' }, { status: 400 })
      }
    }

    data.journalEntryId = journalEntryId
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const updated = await prisma.treasuryBankMovement.update({
    where: { id: movement.id },
    data,
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

  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id, movementId } = await context.params
  const movement = await resolveMovement(id, movementId, access.empresaId)
  if (!movement) {
    return NextResponse.json({ ok: false, error: 'Movimiento no encontrado' }, { status: 404 })
  }

  if (movement.journalEntryId) {
    return NextResponse.json(
      { ok: false, error: 'El movimiento está vinculado a un asiento contable. Desvincúlalo antes de eliminarlo.' },
      { status: 400 }
    )
  }

  await prisma.treasuryBankMovement.delete({ where: { id: movement.id } })

  return NextResponse.json({ ok: true })
}
