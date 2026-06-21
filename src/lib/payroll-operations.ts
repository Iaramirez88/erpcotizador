import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, nextPayrollCode } from '@/lib/payroll'

export type PayrollAttendanceEntryRow = {
  id: string
  employeeId: string
  employeeName: string
  periodId: string | null
  periodLabel: string
  entryDate: string
  shiftName: string
  status: string
  checkInAt: string | null
  checkOutAt: string | null
  minutesLate: number
  overtimeMinutes: number
  leaveType: string | null
  notes: string | null
}

export type PayrollBenefitRequestRow = {
  id: string
  employeeId: string
  employeeName: string
  type: string
  title: string
  description: string
  planName: string | null
  vendorName: string | null
  status: string
  pointsCost: number
  amount: number | null
  requestedAt: string
  approvedAt: string | null
  deliveredAt: string | null
}

export type PayrollBenefitOfferingRow = {
  id: string
  title: string
  kind: string
  category: string
  vendorName: string | null
  status: string
  pricingModel: string
  pointsCost: number
  employerCost: number | null
  employeeCopay: number | null
  discountRate: number | null
  spotlight: boolean
  description: string
}

export type PayrollNoveltyDemoRow = {
  id: string
  employeeId: string
  employeeName: string
  periodId: string | null
  periodLabel: string
  type: string
  detail: string
  amount: number | null
  quantity: number | null
  days: number | null
  status: string
  source: string
  occurredOn: string | null
  startsAt: string | null
  endsAt: string | null
  supportNumber: string | null
}

export type PayrollSettlementDemoRow = {
  id: string
  employeeId: string
  employeeName: string
  periodId: string | null
  reason: string
  retirementDate: string
  liquidationDate: string | null
  paymentDate: string | null
  workedDays: number
  total: number
  status: string
  notes: string | null
  accountingStatus: string
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function atTime(base: Date, hours: number, minutes: number) {
  const result = new Date(base)
  result.setHours(hours, minutes, 0, 0)
  return result
}

export async function ensurePayrollDemoEmployees(empresaId: string) {
  const [employees, firstSede] = await Promise.all([
    prisma.payrollEmployee.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      take: 3,
      select: {
        id: true,
        code: true,
        firstName: true,
        middleName: true,
        lastName: true,
        secondLastName: true,
        jobTitle: true,
        sedeId: true,
      },
    }),
    prisma.sede.findFirst({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true },
    }),
  ])

  if (employees.length >= 3 || !firstSede?.id) {
    return employees
  }

  const templates = [
    { firstName: 'Valentina', lastName: 'Rojas', documentNumber: '1002003001', jobTitle: 'Analista de Nómina' },
    { firstName: 'Mateo', lastName: 'Gómez', documentNumber: '1002003002', jobTitle: 'Coordinador de Talento' },
    { firstName: 'Sara', lastName: 'López', documentNumber: '1002003003', jobTitle: 'Business Partner' },
  ]

  const missing = templates.slice(employees.length)
  for (const [index, item] of missing.entries()) {
    await prisma.payrollEmployee.create({
      data: {
        empresaId,
        sedeId: firstSede.id,
        code: nextPayrollCode(employees.length + index + 1),
        documentType: 'CC',
        documentNumber: item.documentNumber,
        firstName: item.firstName,
        lastName: item.lastName,
        jobTitle: item.jobTitle,
        hireDate: daysAgo(150 + index * 20),
      },
    })
  }

  return prisma.payrollEmployee.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'asc' }],
    take: 3,
    select: {
      id: true,
      code: true,
      firstName: true,
      middleName: true,
      lastName: true,
      secondLastName: true,
      jobTitle: true,
      sedeId: true,
    },
  })
}

export async function ensurePayrollAttendanceDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollAttendanceEntry.count({ where: { empresaId } })
  if (count) return

  const [employees, firstPeriod] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const refs = employees.slice(0, 3)
  const firstDate = daysAgo(1)
  const secondDate = daysAgo(2)
  const thirdDate = daysAgo(3)

  await prisma.payrollAttendanceEntry.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        entryDate: firstDate,
        shiftName: 'Turno administrativo',
        status: 'PRESENTE',
        checkInAt: atTime(firstDate, 8, 1),
        checkOutAt: atTime(firstDate, 17, 32),
        overtimeMinutes: 32,
        createdById: userId ?? null,
        approvedById: userId ?? null,
        approvedAt: daysAgo(1),
        notes: 'Marcación completa con 32 minutos extra.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        entryDate: secondDate,
        shiftName: 'Turno híbrido',
        status: 'TARDE',
        checkInAt: atTime(secondDate, 8, 24),
        checkOutAt: atTime(secondDate, 17, 5),
        minutesLate: 24,
        createdById: userId ?? null,
        notes: 'Ingreso con novedad de movilidad reportada.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        entryDate: thirdDate,
        shiftName: 'Turno administrativo',
        status: 'PERMISO',
        leaveType: 'Permiso remunerado',
        createdById: userId ?? null,
        approvedById: userId ?? null,
        approvedAt: thirdDate,
        notes: 'Permiso aprobado para diligencia personal.',
      },
    ],
  })
}

export async function ensurePayrollBenefitDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollBenefitRequest.count({ where: { empresaId } })
  if (count) return

  const employees = await ensurePayrollDemoEmployees(empresaId)
  if (!employees.length) return

  const refs = employees.slice(0, 3)

  await prisma.payrollBenefitRequest.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        type: 'PUNTOS',
        title: 'Redención gimnasio',
        description: 'Canje de puntos para plan mensual de bienestar físico.',
        planName: 'Wellness 360',
        vendorName: 'Smart Fit Empresas',
        status: 'APROBADA',
        pointsCost: 120,
        amount: 95000,
        requestedAt: daysAgo(6),
        approvedAt: daysAgo(5),
        createdById: userId ?? null,
        approvedById: userId ?? null,
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        type: 'ADELANTO',
        title: 'Adelanto de nómina parcial',
        description: 'Solicitud de adelanto ligada al periodo actual.',
        planName: 'Liquidez inmediata',
        vendorName: 'Tesorería interna',
        status: 'SOLICITADA',
        pointsCost: 0,
        amount: 350000,
        requestedAt: daysAgo(2),
        createdById: userId ?? null,
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        type: 'DESCUENTO',
        title: 'Pack de descuentos salud',
        description: 'Activación del paquete de descuentos para salud preventiva.',
        planName: 'Buk Benefits Health',
        vendorName: 'Aliados SGDigital',
        status: 'ENTREGADA',
        pointsCost: 80,
        amount: 0,
        requestedAt: daysAgo(12),
        approvedAt: daysAgo(11),
        deliveredAt: daysAgo(10),
        createdById: userId ?? null,
        approvedById: userId ?? null,
      },
    ],
  })
}

export async function ensurePayrollBenefitOfferingDemoData(empresaId: string) {
  const count = await prisma.payrollBenefitOffering.count({ where: { empresaId } })
  if (count) return

  await prisma.payrollBenefitOffering.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        title: 'Plan bienestar integral',
        kind: 'PLAN',
        category: 'SALUD',
        vendorName: 'Smart Fit Empresas',
        status: 'ACTIVO',
        pricingModel: 'PUNTOS',
        pointsCost: 120,
        employerCost: 95000,
        employeeCopay: 0,
        spotlight: true,
        description: 'Plan mensual con gimnasio, telemedicina y seguimiento de hábitos saludables.',
      },
      {
        id: randomUUID(),
        empresaId,
        title: 'Pack descuentos familia',
        kind: 'PACK',
        category: 'DESCUENTOS',
        vendorName: 'Aliados SGDigital',
        status: 'ACTIVO',
        pricingModel: 'COPAGO',
        pointsCost: 80,
        employerCost: 0,
        employeeCopay: 35000,
        discountRate: 25,
        spotlight: true,
        description: 'Convenios en salud preventiva, educación y recreación para el núcleo familiar.',
      },
      {
        id: randomUUID(),
        empresaId,
        title: 'Bolsa de liquidez programada',
        kind: 'PLAN',
        category: 'FINANCIERO',
        vendorName: 'Tesorería interna',
        status: 'ACTIVO',
        pricingModel: 'NOMINA',
        pointsCost: 0,
        employerCost: 0,
        employeeCopay: 0,
        discountRate: null,
        spotlight: false,
        description: 'Regla operativa para adelantos parciales con cupo mensual y aprobación de jefatura.',
      },
    ],
  })
}

export async function ensurePayrollNoveltyDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollNovelty.count({ where: { empresaId } })
  if (count) return

  const [employees, firstPeriod] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const refs = employees.slice(0, 3)
  const today = daysAgo(0)
  const twoDaysAgo = daysAgo(2)
  const fourDaysAgo = daysAgo(4)

  await prisma.payrollNovelty.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        type: 'HORA_EXTRA',
        detail: 'Horas extra por cierre operativo del mes.',
        amount: 185000,
        quantity: 6,
        status: 'APLICADA',
        source: 'MANUAL',
        occurredOn: fourDaysAgo,
        createdById: userId ?? null,
        approvedById: userId ?? null,
        approvedAt: fourDaysAgo,
        supportNumber: 'HEX-2401',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        type: 'INCAPACIDAD',
        detail: 'Incapacidad general con soporte médico radicado.',
        days: 3,
        status: 'VALIDADA',
        source: 'PORTAL',
        occurredOn: twoDaysAgo,
        startsAt: twoDaysAgo,
        endsAt: today,
        createdById: userId ?? null,
        approvedById: userId ?? null,
        approvedAt: twoDaysAgo,
        supportNumber: 'MED-8821',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        type: 'DESCUENTO',
        detail: 'Descuento por préstamo interno según acuerdo vigente.',
        amount: 120000,
        status: 'RADICADA',
        source: 'MANUAL',
        occurredOn: today,
        createdById: userId ?? null,
        supportNumber: 'PRE-1034',
      },
    ],
  })
}

export async function ensurePayrollSettlementDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollSettlement.count({ where: { empresaId } })
  if (count) return

  const [employees, firstPeriod] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const refs = employees.slice(0, 3)
  const retirementA = daysAgo(18)
  const retirementB = daysAgo(9)
  const retirementC = daysAgo(3)

  await prisma.payrollSettlement.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        reason: 'RENUNCIA',
        status: 'PENDIENTE',
        retirementDate: retirementA,
        workedDays: 18,
        total: 2450000,
        notes: 'Pendiente visto bueno de tesorería.',
        createdById: userId ?? null,
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        reason: 'FIN_CONTRATO',
        status: 'LIQUIDADA',
        retirementDate: retirementB,
        liquidationDate: daysAgo(7),
        workedDays: 30,
        total: 3180000,
        notes: 'Lista para contabilizar y programar pago.',
        createdById: userId ?? null,
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        reason: 'MUTUO_ACUERDO',
        status: 'PAGADA',
        retirementDate: retirementC,
        liquidationDate: daysAgo(2),
        paymentDate: daysAgo(1),
        workedDays: 12,
        total: 1745000,
        notes: 'Liquidación cerrada y pagada.',
        createdById: userId ?? null,
      },
    ],
  })
}

export async function serializePayrollAttendance(empresaId: string): Promise<PayrollAttendanceEntryRow[]> {
  const rows = await prisma.payrollAttendanceEntry.findMany({
    where: { empresaId },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
      period: { select: { label: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    periodId: item.periodId ?? null,
    periodLabel: item.period?.label ?? 'Sin período',
    entryDate: item.entryDate.toISOString(),
    shiftName: item.shiftName,
    status: item.status,
    checkInAt: iso(item.checkInAt),
    checkOutAt: iso(item.checkOutAt),
    minutesLate: item.minutesLate,
    overtimeMinutes: item.overtimeMinutes,
    leaveType: item.leaveType ?? null,
    notes: item.notes ?? null,
  }))
}

export async function serializePayrollBenefits(empresaId: string): Promise<PayrollBenefitRequestRow[]> {
  const rows = await prisma.payrollBenefitRequest.findMany({
    where: { empresaId },
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    type: item.type,
    title: item.title,
    description: item.description,
    planName: item.planName ?? null,
    vendorName: item.vendorName ?? null,
    status: item.status,
    pointsCost: item.pointsCost,
    amount: item.amount ?? null,
    requestedAt: item.requestedAt.toISOString(),
    approvedAt: iso(item.approvedAt),
    deliveredAt: iso(item.deliveredAt),
  }))
}

export async function serializePayrollBenefitOfferings(empresaId: string): Promise<PayrollBenefitOfferingRow[]> {
  const rows = await prisma.payrollBenefitOffering.findMany({
    where: { empresaId },
    orderBy: [{ spotlight: 'desc' }, { createdAt: 'desc' }],
  })

  return rows.map((item) => ({
    id: item.id,
    title: item.title,
    kind: item.kind,
    category: item.category,
    vendorName: item.vendorName ?? null,
    status: item.status,
    pricingModel: item.pricingModel,
    pointsCost: item.pointsCost,
    employerCost: item.employerCost ?? null,
    employeeCopay: item.employeeCopay ?? null,
    discountRate: item.discountRate ?? null,
    spotlight: item.spotlight,
    description: item.description,
  }))
}