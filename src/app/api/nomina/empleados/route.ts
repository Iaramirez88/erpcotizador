import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollContractStatus } from '@prisma/client'
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
      fullName: buildPayrollEmployeeFullName(employee),
      document: [employee.documentType, employee.documentNumber].filter(Boolean).join(' '),
      role: employee.jobTitle,
      sede: employee.sede.nombre,
      costCenter: employee.costCenter?.name ?? 'Sin centro de costo',
      contractType: activeContract?.contractType ?? null,
      frequency: activeContract?.frequency ?? null,
      salary: activeContract?.baseSalary ?? 0,
      status: employee.status,
      startDate: employee.hireDate.toISOString(),
      endDate: employee.retirementDate?.toISOString() ?? null,
      eps: employee.epsEntity ?? 'Sin EPS',
      pension: employee.pensionEntity ?? 'Sin pensión',
      arlRiskClass: employee.arlRiskClass ?? 'Sin clase ARL',
      bankAccount: bankAccount || 'Sin cuenta bancaria',
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