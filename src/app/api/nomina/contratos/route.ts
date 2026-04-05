import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollContractStatus, PayrollContractType, PayrollFrequency } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollContractRow } from '@/lib/payroll'

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

function isContractType(value: string): value is PayrollContractType {
  return ['INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'APRENDIZAJE', 'PRESTACION'].includes(value)
}

function isFrequency(value: string): value is PayrollFrequency {
  return ['QUINCENAL', 'MENSUAL', 'SEMANAL', 'JORNAL'].includes(value)
}

function isStatus(value: string): value is PayrollContractStatus {
  return ['ACTIVE', 'SUSPENDED', 'FINALIZED'].includes(value)
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

async function serializeContracts(empresaId: string): Promise<PayrollContractRow[]> {
  const rows = await prisma.payrollContract.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
      sede: { select: { nombre: true } },
      costCenter: { select: { name: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    sedeId: item.sedeId,
    costCenterId: item.costCenterId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    contractType: item.contractType,
    status: item.status,
    frequency: item.frequency,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate?.toISOString() ?? null,
    salary: item.baseSalary,
    variableSalary: item.variableSalary,
    integralSalary: item.integralSalary,
    transportationAllowance: item.transportationAllowance,
    payrollGroup: item.payrollGroup,
    notes: item.notes,
    sede: item.sede.nombre,
    costCenter: item.costCenter?.name ?? 'Sin centro de costo',
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const data = await serializeContracts(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const contractType = asString(body.contractType)
  const frequency = asString(body.frequency)
  const startDate = asDate(body.startDate)
  const baseSalary = Number(body.baseSalary)
  const status = asString(body.status) || 'ACTIVE'

  if (!employeeId || !isContractType(contractType) || !isFrequency(frequency) || !startDate || !Number.isFinite(baseSalary)) {
    return NextResponse.json({ ok: false, error: 'employeeId, contractType, frequency, startDate y baseSalary son requeridos' }, { status: 400 })
  }

  if (!isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'status inválido' }, { status: 400 })
  }

  await prisma.payrollContract.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      sedeId: asString(body.sedeId) || access.sedeId,
      costCenterId: asString(body.costCenterId) || null,
      contractType,
      status,
      frequency,
      startDate,
      endDate: asDate(body.endDate),
      baseSalary,
      variableSalary: body.variableSalary === true,
      integralSalary: body.integralSalary === true,
      transportationAllowance: body.transportationAllowance === true,
      payrollGroup: asString(body.payrollGroup) || null,
      notes: asString(body.notes) || null,
    },
  })

  const data = await serializeContracts(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const contractType = asString(body.contractType)
  const frequency = asString(body.frequency)
  const startDate = asDate(body.startDate)
  const baseSalary = Number(body.baseSalary)
  const status = asString(body.status) || 'ACTIVE'

  if (!id || !employeeId || !isContractType(contractType) || !isFrequency(frequency) || !startDate || !Number.isFinite(baseSalary) || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, contractType, frequency, startDate, baseSalary y status son requeridos' }, { status: 400 })
  }

  const contract = await prisma.payrollContract.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!contract) {
    return NextResponse.json({ ok: false, error: 'Contrato no encontrado' }, { status: 404 })
  }

  await prisma.payrollContract.update({
    where: { id },
    data: {
      employeeId,
      sedeId: asString(body.sedeId) || access.sedeId,
      costCenterId: asNullableString(body.costCenterId),
      contractType,
      status,
      frequency,
      startDate,
      endDate: asDate(body.endDate),
      baseSalary,
      variableSalary: body.variableSalary === true,
      integralSalary: body.integralSalary === true,
      transportationAllowance: body.transportationAllowance === true,
      payrollGroup: asNullableString(body.payrollGroup),
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializeContracts(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })
  }

  const contract = await prisma.payrollContract.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, _count: { select: { novelties: true, periodItems: true, settlements: true } } },
  })
  if (!contract) {
    return NextResponse.json({ ok: false, error: 'Contrato no encontrado' }, { status: 404 })
  }

  if (contract._count.novelties || contract._count.periodItems || contract._count.settlements) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar un contrato con movimientos o liquidaciones asociadas' }, { status: 400 })
  }

  await prisma.payrollContract.delete({ where: { id } })
  const data = await serializeContracts(access.empresaId)
  return NextResponse.json({ ok: true, data })
}