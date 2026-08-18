import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollContractStatus, PayrollContractType, PayrollFrequency, Prisma } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { sendPayrollContractExpirationReminders } from '@/lib/payroll-contract-reminders'
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

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

function asPositiveInteger(value: unknown, fallback: number) {
  const next = Number(value)
  return Number.isInteger(next) && next > 0 ? next : fallback
}

function parseMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseExtensionHistory(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<Record<string, unknown>>
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function diffDays(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
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
    ...(() => {
      const metadata = parseMetadata(item.metadata)
      const extensions = parseExtensionHistory(metadata.extensions)
      const lastExtension = extensions[0] ?? null
      const reminderDays = asPositiveInteger(metadata.renewalReminderDays, 15)
      const adminOnlyReminder = typeof metadata.adminOnlyReminder === 'boolean' ? metadata.adminOnlyReminder : true
      const daysToExpiration = item.endDate ? diffDays(new Date(), item.endDate) : null
      return {
        extensionCount: extensions.length,
        lastExtensionDate: typeof lastExtension?.effectiveUntil === 'string' ? lastExtension.effectiveUntil : null,
        lastExtensionReason: typeof lastExtension?.reason === 'string' ? lastExtension.reason : null,
        renewalReminderDays: reminderDays,
        adminOnlyReminder,
        daysToExpiration,
        expiresSoon: daysToExpiration !== null && daysToExpiration >= 0 && daysToExpiration <= reminderDays,
      }
    })(),
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

function buildContractMetadata(input: {
  renewalReminderDays: number
  adminOnlyReminder: boolean
  extensions: Array<Record<string, unknown>>
  currentMetadata?: Record<string, unknown>
}) {
  return {
    ...(input.currentMetadata ?? {}),
    renewalReminderDays: input.renewalReminderDays,
    adminOnlyReminder: input.adminOnlyReminder,
    extensions: input.extensions as Prisma.InputJsonArray,
  } satisfies Prisma.InputJsonObject
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
      metadata: buildContractMetadata({
        renewalReminderDays: asPositiveInteger(body.renewalReminderDays, 15),
        adminOnlyReminder: body.adminOnlyReminder === undefined ? true : asBoolean(body.adminOnlyReminder),
        extensions: [],
      }),
    },
  })

  const createdContract = await prisma.payrollContract.findFirst({
    where: { empresaId: access.empresaId, employeeId, startDate },
    orderBy: [{ createdAt: 'desc' }],
    include: { employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } } },
  })

  if (createdContract) {
    await sendPayrollContractExpirationReminders({ empresaId: access.empresaId, contractId: createdContract.id })
  }

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

  const currentContract = await prisma.payrollContract.findUnique({
    where: { id },
    select: { endDate: true, metadata: true, employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } } },
  })

  const currentMetadata = parseMetadata(currentContract?.metadata)
  const existingExtensions = parseExtensionHistory(currentMetadata.extensions)
  const extensionEndDate = asDate(body.extensionEndDate)
  const extensionReason = asNullableString(body.extensionReason)
  const shouldAppendExtension = Boolean(extensionEndDate && extensionEndDate.toISOString() !== currentContract?.endDate?.toISOString())
  const nextExtensions = shouldAppendExtension
    ? [{
        effectiveUntil: extensionEndDate?.toISOString(),
        reason: extensionReason,
        recordedAt: new Date().toISOString(),
        recordedById: access.userId,
      }, ...existingExtensions]
    : existingExtensions

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
      endDate: extensionEndDate ?? asDate(body.endDate),
      baseSalary,
      variableSalary: body.variableSalary === true,
      integralSalary: body.integralSalary === true,
      transportationAllowance: body.transportationAllowance === true,
      payrollGroup: asNullableString(body.payrollGroup),
      notes: asNullableString(body.notes),
      metadata: buildContractMetadata({
        currentMetadata,
        renewalReminderDays: asPositiveInteger(body.renewalReminderDays ?? currentMetadata.renewalReminderDays, 15),
        adminOnlyReminder: body.adminOnlyReminder === undefined
          ? (typeof currentMetadata.adminOnlyReminder === 'boolean' ? currentMetadata.adminOnlyReminder : true)
          : asBoolean(body.adminOnlyReminder),
        extensions: nextExtensions,
      }),
    },
  })

  await sendPayrollContractExpirationReminders({ empresaId: access.empresaId, contractId: id })

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