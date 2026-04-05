import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, AccountingVoucherStatus, AccountingVoucherType, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { nextAccountingVoucherCode, type AccountingVoucherRow } from '@/lib/accounting-core'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function isVoucherType(value: string): value is AccountingVoucherType {
  return ['DIARIO', 'INGRESO', 'EGRESO', 'AJUSTE', 'CIERRE', 'APERTURA'].includes(value)
}

function isVoucherStatus(value: string): value is AccountingVoucherStatus {
  return ['DRAFT', 'APPROVED', 'POSTED', 'VOIDED'].includes(value)
}

type VoucherLineInput = {
  accountId?: string
  costCenterId?: string | null
  debit?: number
  credit?: number
  memo?: string | null
  thirdPartyName?: string | null
  thirdPartyDocument?: string | null
}

async function serializeVouchers(empresaId: string): Promise<AccountingVoucherRow[]> {
  const rows = await prisma.accountingVoucher.findMany({
    where: { empresaId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      period: { select: { label: true } },
      _count: { select: { lines: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    code: item.code,
    voucherType: item.voucherType,
    status: item.status,
    periodLabel: item.period?.label ?? 'Sin período',
    date: item.date.toISOString(),
    description: item.description,
    thirdPartyName: item.thirdPartyName,
    totalDebit: item.totalDebit,
    totalCredit: item.totalCredit,
    linesCount: item._count.lines,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const data = await serializeVouchers(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const voucherType = asString(body.voucherType)
  const status = asString(body.status) || 'DRAFT'
  const date = asDate(body.date)
  const description = asString(body.description)
  const lines = (Array.isArray(body.lines) ? body.lines : []) as VoucherLineInput[]

  if (!isVoucherType(voucherType) || !isVoucherStatus(status) || !date || !description || !lines.length) {
    return NextResponse.json({ ok: false, error: 'voucherType, date, description y lines son requeridos' }, { status: 400 })
  }

  const normalizedLines = lines.map((line, index) => ({
    order: index + 1,
    accountId: asString(line.accountId),
    costCenterId: asString(line.costCenterId) || null,
    thirdPartyName: asString(line.thirdPartyName) || null,
    thirdPartyDocument: asString(line.thirdPartyDocument) || null,
    debit: asNumber(line.debit) ?? 0,
    credit: asNumber(line.credit) ?? 0,
    memo: asString(line.memo) || null,
  }))

  if (normalizedLines.some((line) => !line.accountId)) {
    return NextResponse.json({ ok: false, error: 'Todas las líneas deben tener accountId' }, { status: 400 })
  }

  const totalDebit = Math.round(normalizedLines.reduce((sum, line) => sum + line.debit, 0))
  const totalCredit = Math.round(normalizedLines.reduce((sum, line) => sum + line.credit, 0))

  if (totalDebit <= 0 || totalCredit <= 0 || totalDebit !== totalCredit) {
    return NextResponse.json({ ok: false, error: 'El comprobante debe cuadrar en débito y crédito' }, { status: 400 })
  }

  const periodId = asString(body.periodId) || null
  if (periodId) {
    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, empresaId: access.empresaId },
      select: { id: true, status: true },
    })

    if (!period) {
      return NextResponse.json({ ok: false, error: 'Período contable no encontrado' }, { status: 404 })
    }

    if (period.status !== 'OPEN') {
      return NextResponse.json({ ok: false, error: 'El período debe estar abierto para registrar comprobantes' }, { status: 400 })
    }
  }

  const count = await prisma.accountingVoucher.count({ where: { empresaId: access.empresaId, voucherType } })

  await prisma.accountingVoucher.create({
    data: {
      empresaId: access.empresaId,
      periodId,
      voucherType,
      status,
      code: asString(body.code) || nextAccountingVoucherCode(voucherType, count + 1),
      date,
      description,
      externalReference: asString(body.externalReference) || null,
      thirdPartyName: asString(body.thirdPartyName) || null,
      thirdPartyDocument: asString(body.thirdPartyDocument) || null,
      notes: asString(body.notes) || null,
      totalDebit,
      totalCredit,
      createdById: access.userId,
      approvedById: status === 'APPROVED' || status === 'POSTED' ? access.userId : null,
      approvedAt: status === 'APPROVED' || status === 'POSTED' ? new Date() : null,
      lines: {
        create: normalizedLines,
      },
    },
  })

  const data = await serializeVouchers(access.empresaId)
  return NextResponse.json({ ok: true, data })
}