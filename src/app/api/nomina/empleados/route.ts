import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollContractStatus, PayrollEmployeeStatus } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, nextPayrollCode, type PayrollEmployeeRow } from '@/lib/payroll'

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

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[]
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function isEmployeeStatus(value: string): value is PayrollEmployeeStatus {
  return ['ACTIVE', 'SUSPENDED', 'RETIRED'].includes(value)
}

async function serializeEmployees(empresaId: string): Promise<PayrollEmployeeRow[]> {
  const rows = await prisma.payrollEmployee.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      sede: { select: { nombre: true } },
      costCenter: { select: { name: true } },
      contracts: {
        orderBy: [{ startDate: 'desc' }],
      },
      novelties: {
        where: { status: { in: ['RADICADA', 'VALIDADA'] } },
        select: { type: true },
      },
      payslips: {
        where: { signedAt: null },
        select: { id: true },
        take: 1,
        orderBy: [{ generatedAt: 'desc' }],
      },
      settlements: {
        where: { status: { in: ['PENDIENTE', 'LIQUIDADA'] } },
        select: { id: true },
        take: 1,
        orderBy: [{ retirementDate: 'desc' }],
      },
    },
  })

  return rows.map((employee) => {
    const activeContract = employee.contracts.find((item) => item.status === PayrollContractStatus.ACTIVE) ?? employee.contracts[0] ?? null
    const bankAccount = [employee.bankName, employee.bankAccountNumber].filter(Boolean).join(' · ')
    const alerts = compact<string>([
      employee.novelties.some((item) => item.type === 'INCAPACIDAD') ? 'Incapacidad vigente' : null,
      employee.novelties.some((item) => item.type !== 'INCAPACIDAD') ? 'Novedades pendientes' : null,
      employee.payslips.length ? 'Pendiente firmar desprendible' : null,
      employee.settlements.length ? 'Liquidación pendiente de pago' : null,
    ])

    return {
      id: employee.id,
      code: employee.code,
      sedeId: employee.sedeId,
      costCenterId: employee.costCenterId,
      fullName: buildPayrollEmployeeFullName(employee),
      firstName: employee.firstName,
      middleName: employee.middleName,
      lastName: employee.lastName,
      secondLastName: employee.secondLastName,
      documentType: employee.documentType,
      documentNumber: employee.documentNumber,
      document: [employee.documentType, employee.documentNumber].filter(Boolean).join(' '),
      role: employee.jobTitle,
      sede: employee.sede.nombre,
      costCenter: employee.costCenter?.name ?? 'Sin centro de costo',
      contractType: activeContract?.contractType ?? null,
      activeContractId: activeContract?.id ?? null,
      frequency: activeContract?.frequency ?? null,
      salary: activeContract?.baseSalary ?? 0,
      status: employee.status,
      startDate: employee.hireDate.toISOString(),
      endDate: employee.retirementDate?.toISOString() ?? null,
      personalEmail: employee.personalEmail,
      phone: employee.phone,
      city: employee.city,
      address: employee.address,
      eps: employee.epsEntity ?? 'Sin EPS',
      epsEntity: employee.epsEntity,
      pension: employee.pensionEntity ?? 'Sin pensión',
      pensionEntity: employee.pensionEntity,
      arlEntity: employee.arlEntity,
      arlRiskClass: employee.arlRiskClass ?? 'Sin clase ARL',
      bankAccount: bankAccount || 'Sin cuenta bancaria',
      bankName: employee.bankName,
      bankAccountType: employee.bankAccountType,
      bankAccountNumber: employee.bankAccountNumber,
      notes: employee.notes,
      alerts,
    }
  })
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const data = await serializeEmployees(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const firstName = asString(body.firstName)
  const lastName = asString(body.lastName)
  const documentNumber = asString(body.documentNumber)
  const jobTitle = asString(body.jobTitle)
  const hireDate = asDate(body.hireDate)

  if (!firstName || !lastName || !documentNumber || !jobTitle || !hireDate) {
    return NextResponse.json({ ok: false, error: 'firstName, lastName, documentNumber, jobTitle y hireDate son requeridos' }, { status: 400 })
  }

  const count = await prisma.payrollEmployee.count({ where: { empresaId: access.empresaId } })

  await prisma.payrollEmployee.create({
    data: {
      empresaId: access.empresaId,
      sedeId: asString(body.sedeId) || access.sedeId,
      costCenterId: asString(body.costCenterId) || null,
      code: asString(body.code) || nextPayrollCode(count + 1),
      documentType: asString(body.documentType) || 'CC',
      documentNumber,
      firstName,
      middleName: asString(body.middleName) || null,
      lastName,
      secondLastName: asString(body.secondLastName) || null,
      personalEmail: asString(body.personalEmail) || null,
      phone: asString(body.phone) || null,
      address: asString(body.address) || null,
      city: asString(body.city) || null,
      jobTitle,
      hireDate,
      bankName: asString(body.bankName) || null,
      bankAccountType: asString(body.bankAccountType) || null,
      bankAccountNumber: asString(body.bankAccountNumber) || null,
      epsEntity: asString(body.epsEntity) || null,
      pensionEntity: asString(body.pensionEntity) || null,
      cesantiasEntity: asString(body.cesantiasEntity) || null,
      compensationFundEntity: asString(body.compensationFundEntity) || null,
      arlEntity: asString(body.arlEntity) || null,
      arlRiskClass: asString(body.arlRiskClass) || null,
      notes: asString(body.notes) || null,
    },
  })

  const data = await serializeEmployees(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const firstName = asString(body.firstName)
  const lastName = asString(body.lastName)
  const documentNumber = asString(body.documentNumber)
  const jobTitle = asString(body.jobTitle)
  const hireDate = asDate(body.hireDate)
  const status = asString(body.status)

  if (!id || !firstName || !lastName || !documentNumber || !jobTitle || !hireDate) {
    return NextResponse.json({ ok: false, error: 'id, firstName, lastName, documentNumber, jobTitle y hireDate son requeridos' }, { status: 400 })
  }

  if (status && !isEmployeeStatus(status)) {
    return NextResponse.json({ ok: false, error: 'status inválido' }, { status: 400 })
  }

  const nextStatus: PayrollEmployeeStatus | undefined = status && isEmployeeStatus(status) ? status : undefined

  const employee = await prisma.payrollEmployee.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!employee) {
    return NextResponse.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 })
  }

  await prisma.payrollEmployee.update({
    where: { id },
    data: {
      sedeId: asString(body.sedeId) || access.sedeId,
      costCenterId: asNullableString(body.costCenterId),
      code: asString(body.code) || undefined,
      documentType: asString(body.documentType) || 'CC',
      documentNumber,
      firstName,
      middleName: asNullableString(body.middleName),
      lastName,
      secondLastName: asNullableString(body.secondLastName),
      personalEmail: asNullableString(body.personalEmail),
      phone: asNullableString(body.phone),
      address: asNullableString(body.address),
      city: asNullableString(body.city),
      jobTitle,
      hireDate,
      retirementDate: asDate(body.retirementDate),
      status: nextStatus,
      bankName: asNullableString(body.bankName),
      bankAccountType: asNullableString(body.bankAccountType),
      bankAccountNumber: asNullableString(body.bankAccountNumber),
      epsEntity: asNullableString(body.epsEntity),
      pensionEntity: asNullableString(body.pensionEntity),
      cesantiasEntity: asNullableString(body.cesantiasEntity),
      compensationFundEntity: asNullableString(body.compensationFundEntity),
      arlEntity: asNullableString(body.arlEntity),
      arlRiskClass: asNullableString(body.arlRiskClass),
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializeEmployees(access.empresaId)
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

  const employee = await prisma.payrollEmployee.findFirst({
    where: { id, empresaId: access.empresaId },
    select: {
      id: true,
      _count: { select: { contracts: true, novelties: true, settlements: true, payslips: true, periodItems: true } },
    },
  })

  if (!employee) {
    return NextResponse.json({ ok: false, error: 'Empleado no encontrado' }, { status: 404 })
  }

  if (employee._count.contracts || employee._count.novelties || employee._count.settlements || employee._count.payslips || employee._count.periodItems) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar un empleado con historial. Retíralo o actualízalo.' }, { status: 400 })
  }

  await prisma.payrollEmployee.delete({ where: { id } })
  const data = await serializeEmployees(access.empresaId)
  return NextResponse.json({ ok: true, data })
}