import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollFrequency, PayrollPeriodStatus } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollDateRange, type PayrollPeriodRow } from '@/lib/payroll'

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

function isFrequency(value: string): value is PayrollFrequency {
  return ['QUINCENAL', 'MENSUAL', 'SEMANAL', 'JORNAL'].includes(value)
}

function isStatus(value: string): value is PayrollPeriodStatus {
  return ['BORRADOR', 'CALCULADA', 'PAGADA', 'CERRADA'].includes(value)
}

async function serializePeriods(empresaId: string): Promise<PayrollPeriodRow[]> {
  const rows = await prisma.payrollPeriod.findMany({
    where: { empresaId },
    orderBy: [{ startsAt: 'desc' }],
    select: {
      id: true,
      label: true,
      frequency: true,
      status: true,
      startsAt: true,
      endsAt: true,
      paymentDate: true,
      employeesCount: true,
      grossTotal: true,
      deductionsTotal: true,
      netTotal: true,
      socialSecurityTotal: true,
      parafiscalesTotal: true,
      accountingStatus: true,
    },
  })

  return rows.map((item) => ({
    id: item.id,
    label: item.label,
    frequency: item.frequency,
    status: item.status,
    range: buildPayrollDateRange(item.startsAt, item.endsAt),
    paymentDate: item.paymentDate.toISOString(),
    employeesCount: item.employeesCount,
    grossTotal: item.grossTotal,
    deductionsTotal: item.deductionsTotal,
    netTotal: item.netTotal,
    socialSecurityTotal: item.socialSecurityTotal,
    parafiscalesTotal: item.parafiscalesTotal,
    accountingStatus: item.accountingStatus,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const frequency = asString(body.frequency)
  const label = asString(body.label)
  const startsAt = asDate(body.startsAt)
  const endsAt = asDate(body.endsAt)
  const paymentDate = asDate(body.paymentDate)
  const status = asString(body.status) || 'BORRADOR'

  if (!label || !isFrequency(frequency) || !startsAt || !endsAt || !paymentDate || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'label, frequency, startsAt, endsAt y paymentDate son requeridos' }, { status: 400 })
  }

  const count = await prisma.payrollPeriod.count({ where: { empresaId: access.empresaId } })

  await prisma.payrollPeriod.create({
    data: {
      empresaId: access.empresaId,
      sedeId: asString(body.sedeId) || access.sedeId,
      code: asString(body.code) || `PER-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      label,
      frequency,
      status,
      startsAt,
      endsAt,
      paymentDate,
      notes: asString(body.notes) || null,
    },
  })

  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}