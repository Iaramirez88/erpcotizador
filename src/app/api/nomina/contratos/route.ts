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
    employeeName: buildPayrollEmployeeFullName(item.employee),
    contractType: item.contractType,
    status: item.status,
    frequency: item.frequency,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate?.toISOString() ?? null,
    salary: item.baseSalary,
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