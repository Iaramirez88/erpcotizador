import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollNoveltyStatus, PayrollNoveltyType } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollNoveltyRow } from '@/lib/payroll'

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

function isType(value: string): value is PayrollNoveltyType {
  return ['INCAPACIDAD', 'HORA_EXTRA', 'AUSENCIA', 'LICENCIA', 'BONIFICACION', 'DESCUENTO', 'RECARGO', 'COMISION', 'EMBARGO', 'PRESTAMO', 'VACACIONES'].includes(value)
}

function isStatus(value: string): value is PayrollNoveltyStatus {
  return ['RADICADA', 'VALIDADA', 'APLICADA', 'RECHAZADA'].includes(value)
}

async function serializeNovelties(empresaId: string): Promise<PayrollNoveltyRow[]> {
  const rows = await prisma.payrollNovelty.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      employee: {
        select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
      },
      period: { select: { label: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    type: item.type,
    periodLabel: item.period?.label ?? 'Sin período',
    detail: item.detail,
    amount: item.amount ?? undefined,
    days: item.days ?? undefined,
    status: item.status,
    source: item.source,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const detail = asString(body.detail)
  const status = asString(body.status) || 'RADICADA'

  if (!employeeId || !isType(type) || !detail || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'employeeId, type y detail son requeridos' }, { status: 400 })
  }

  await prisma.payrollNovelty.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      contractId: asString(body.contractId) || null,
      periodId: asString(body.periodId) || null,
      type,
      status,
      source: asString(body.source) || 'MANUAL',
      detail,
      amount: asNumber(body.amount),
      quantity: asNumber(body.quantity),
      days: asNumber(body.days),
      occurredOn: asDate(body.occurredOn),
      startsAt: asDate(body.startsAt),
      endsAt: asDate(body.endsAt),
      supportNumber: asString(body.supportNumber) || null,
      supportUrl: asString(body.supportUrl) || null,
      createdById: access.userId,
    },
  })

  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}