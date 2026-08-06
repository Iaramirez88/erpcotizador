import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { buildPayrollEmployeeFullName } from '@/lib/payroll'

export const runtime = 'nodejs'

const MAX_SUPPORT_BYTES = 4 * 1024 * 1024

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toRoundedDays(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

function resolveVacationBalance(hireDate: Date, novelties: Array<{ type: string; days: number | null }>) {
  const elapsedMs = Date.now() - hireDate.getTime()
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24))
  const earnedDays = toRoundedDays((elapsedDays / 365) * 15)
  const takenDays = toRoundedDays(
    novelties
      .filter((item) => item.type === 'VACACIONES')
      .reduce((sum, item) => sum + (item.days ?? 0), 0),
  )

  return {
    earnedDays,
    takenDays,
    availableDays: toRoundedDays(Math.max(0, earnedDays - takenDays)),
  }
}

function getSupportExtension(mime: string) {
  const lower = mime.toLowerCase()
  if (lower === 'application/pdf') return '.pdf'
  if (lower === 'image/png') return '.png'
  if (lower === 'image/jpeg' || lower === 'image/jpg') return '.jpg'
  return ''
}

async function resolvePortalContext() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      empresaId: true,
      name: true,
      email: true,
      telefono: true,
      cargo: true,
      sedeDefault: { select: { nombre: true } },
    },
  })

  if (!user?.empresaId) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Usuario sin empresa asociada' }, { status: 404 }) }
  }

  const empresaId = user.empresaId

  const employeeWhere = user.email
    ? { empresaId, OR: [{ userId: user.id }, { personalEmail: user.email }] }
    : { empresaId, OR: [{ userId: user.id }] }

  const employee = await prisma.payrollEmployee.findFirst({
    where: employeeWhere,
    include: {
      sede: { select: { nombre: true } },
      costCenter: { select: { name: true } },
      contracts: {
        orderBy: [{ startDate: 'desc' }],
        select: { id: true, contractType: true, status: true, frequency: true, baseSalary: true },
      },
      payslips: {
        orderBy: [{ generatedAt: 'desc' }],
        take: 6,
        include: { period: { select: { label: true, paymentDate: true } } },
      },
      documents: {
        where: { visibleInPortal: true },
        orderBy: [{ createdAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          title: true,
          category: true,
          documentType: true,
          status: true,
          signatureStatus: true,
          requestedAt: true,
          deliveredAt: true,
          fileUrl: true,
        },
      },
      benefitRequests: {
        orderBy: [{ requestedAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          planName: true,
          vendorName: true,
          status: true,
          pointsCost: true,
          amount: true,
          requestedAt: true,
          deliveredAt: true,
        },
      },
      novelties: {
        where: { type: { in: ['INCAPACIDAD', 'VACACIONES'] } },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          type: true,
          detail: true,
          status: true,
          occurredOn: true,
          startsAt: true,
          endsAt: true,
          days: true,
          supportNumber: true,
          supportUrl: true,
          createdAt: true,
        },
      },
      whistleblowerCases: {
        orderBy: [{ createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          severity: true,
          status: true,
          anonymousReport: true,
          createdAt: true,
          summary: true,
        },
      },
    },
  })

  return { ok: true as const, user: { ...user, empresaId }, employee }
}

async function buildPortalPayload() {
  const context = await resolvePortalContext()
  if (!context.ok) return context

  const { user, employee } = context

  if (!employee) {
    return {
      ok: true as const,
      data: {
        user,
        employee: null,
        offers: [],
      },
    }
  }

  const offers = await prisma.payrollBenefitOffering.findMany({
    where: { empresaId: user.empresaId, status: 'ACTIVO', OR: [{ spotlight: true }, { category: { in: ['SALUD', 'BIENESTAR', 'FINANCIERO', 'DESCUENTOS'] } }] },
    orderBy: [{ spotlight: 'desc' }, { updatedAt: 'desc' }],
    take: 6,
    select: {
      id: true,
      title: true,
      kind: true,
      category: true,
      vendorName: true,
      pointsCost: true,
      employeeCopay: true,
      discountRate: true,
      description: true,
      spotlight: true,
    },
  })

  const vacation = resolveVacationBalance(employee.hireDate, employee.novelties)
  const activeContract = employee.contracts.find((item) => item.status === 'ACTIVE') ?? employee.contracts[0] ?? null

  return {
    ok: true as const,
    data: {
      user,
      employee: {
        id: employee.id,
        fullName: buildPayrollEmployeeFullName(employee),
        role: employee.jobTitle,
        document: `${employee.documentType} ${employee.documentNumber}`,
        sede: employee.sede.nombre,
        costCenter: employee.costCenter?.name ?? 'Sin centro de costo',
        personalEmail: employee.personalEmail,
        phone: employee.phone,
        city: employee.city,
        address: employee.address,
        notes: employee.notes,
        hireDate: employee.hireDate.toISOString(),
        salary: activeContract?.baseSalary ?? 0,
        contractType: activeContract?.contractType ?? null,
        frequency: activeContract?.frequency ?? null,
        vacation,
      },
      payslips: employee.payslips.map((item) => ({
        id: item.id,
        periodLabel: item.period.label,
        paymentDate: item.period.paymentDate.toISOString(),
        netPay: item.netTotal,
        signed: Boolean(item.signedAt),
        deliveredAt: item.deliveredAt?.toISOString() ?? null,
        fileUrl: item.fileUrl,
      })),
      documents: employee.documents.map((item) => ({
        ...item,
        requestedAt: item.requestedAt?.toISOString() ?? null,
        deliveredAt: item.deliveredAt?.toISOString() ?? null,
      })),
      benefits: employee.benefitRequests.map((item) => ({
        ...item,
        requestedAt: item.requestedAt.toISOString(),
        deliveredAt: item.deliveredAt?.toISOString() ?? null,
      })),
      novelties: employee.novelties.map((item) => ({
        ...item,
        occurredOn: item.occurredOn?.toISOString() ?? null,
        startsAt: item.startsAt?.toISOString() ?? null,
        endsAt: item.endsAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      complaints: employee.whistleblowerCases.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      offers,
    },
  }
}

export async function GET() {
  const payload = await buildPortalPayload()
  if (!payload.ok) return payload.response
  return NextResponse.json({ success: true, data: payload.data })
}

export async function PATCH(request: NextRequest) {
  const context = await resolvePortalContext()
  if (!context.ok) return context.response
  if (!context.employee) {
    return NextResponse.json({ success: false, error: 'No hay ficha de empleado asociada para este usuario.' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const personalEmail = asString(body.personalEmail) || null
  const phone = asString(body.phone) || null
  const city = asString(body.city) || null
  const address = asString(body.address) || null
  const jobTitle = asString(body.jobTitle)
  const notes = asString(body.notes) || null

  await prisma.$transaction([
    prisma.payrollEmployee.update({
      where: { id: context.employee.id },
      data: {
        personalEmail,
        phone,
        city,
        address,
        jobTitle: jobTitle || context.employee.jobTitle,
        notes,
      },
    }),
    prisma.user.update({
      where: { id: context.user.id },
      data: {
        telefono: phone,
        cargo: jobTitle || context.user.cargo,
      },
    }),
  ])

  const payload = await buildPortalPayload()
  if (!payload.ok) return payload.response
  return NextResponse.json({ success: true, data: payload.data })
}

export async function POST(request: NextRequest) {
  const context = await resolvePortalContext()
  if (!context.ok) return context.response
  if (!context.employee) {
    return NextResponse.json({ success: false, error: 'No hay ficha de empleado asociada para este usuario.' }, { status: 404 })
  }

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ success: false, error: 'Formulario inválido.' }, { status: 400 })
    }

    const action = asString(form.get('action'))
    if (action !== 'incapacidad') {
      return NextResponse.json({ success: false, error: 'Acción multipart no soportada.' }, { status: 400 })
    }

    const detail = asString(form.get('detail'))
    const startsAt = asDate(form.get('startsAt'))
    const endsAt = asDate(form.get('endsAt'))
    const daysValue = Number(asString(form.get('days')) || '0')
    const occurredOn = asDate(form.get('occurredOn')) ?? startsAt
    if (!detail || !startsAt || !endsAt) {
      return NextResponse.json({ success: false, error: 'Debes indicar detalle y rango de incapacidad.' }, { status: 400 })
    }

    let supportUrl: string | null = null
    let supportNumber: string | null = null
    const file = form.get('file')
    const isUpload = !!file && typeof file === 'object' && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'

    if (isUpload) {
      const mime = String((file as { type?: unknown }).type || '')
      const ext = getSupportExtension(mime)
      const size = Number((file as { size?: unknown }).size || 0)
      if (!ext) {
        return NextResponse.json({ success: false, error: 'Solo se permiten PDF, JPG o PNG.' }, { status: 400 })
      }
      if (Number.isFinite(size) && size > MAX_SUPPORT_BYTES) {
        return NextResponse.json({ success: false, error: 'El soporte supera el máximo de 4MB.' }, { status: 400 })
      }

      const relDir = path.posix.join('uploads', 'nomina', 'incapacidades', context.user.empresaId, context.employee.id)
      const absDir = path.join(process.cwd(), 'public', relDir)
      await fs.mkdir(absDir, { recursive: true })

      const filename = `${Date.now()}-${randomUUID()}${ext}`
      const absPath = path.join(absDir, filename)
      await fs.writeFile(absPath, Buffer.from(await file.arrayBuffer()))
      await fs.stat(absPath)
      supportUrl = `/${relDir}/${filename}`
      supportNumber = String((file as { name?: unknown }).name || filename)
    }

    const activeContract = await prisma.payrollContract.findFirst({
      where: { employeeId: context.employee.id, status: 'ACTIVE' },
      orderBy: [{ startDate: 'desc' }],
      select: { id: true },
    })

    const period = await prisma.payrollPeriod.findFirst({
      where: { empresaId: context.user.empresaId, status: { in: ['BORRADOR', 'CALCULADA'] } },
      orderBy: [{ startsAt: 'desc' }],
      select: { id: true },
    })

    await prisma.payrollNovelty.create({
      data: {
        empresaId: context.user.empresaId,
        employeeId: context.employee.id,
        contractId: activeContract?.id ?? null,
        periodId: period?.id ?? null,
        type: 'INCAPACIDAD',
        status: 'RADICADA',
        source: 'PORTAL',
        detail,
        days: Number.isFinite(daysValue) && daysValue > 0 ? daysValue : null,
        occurredOn,
        startsAt,
        endsAt,
        supportNumber,
        supportUrl,
        createdById: context.user.id,
        metadata: { sourceArea: 'portal-empleado' },
      },
    })

    const payload = await buildPortalPayload()
    if (!payload.ok) return payload.response
    return NextResponse.json({ success: true, data: payload.data })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = asString(body.action)
  if (action !== 'denuncia') {
    return NextResponse.json({ success: false, error: 'Acción no soportada.' }, { status: 400 })
  }

  const title = asString(body.title)
  const summary = asString(body.summary)
  if (!title || !summary) {
    return NextResponse.json({ success: false, error: 'Título y descripción del caso son obligatorios.' }, { status: 400 })
  }

  await prisma.payrollWhistleblowerCase.create({
    data: {
      empresaId: context.user.empresaId,
      employeeId: context.employee.id,
      title,
      category: asString(body.category) || 'ETICA',
      severity: asString(body.severity) || 'MEDIA',
      status: 'RECIBIDA',
      anonymousReport: body.anonymousReport === true,
      confidentialityLevel: asString(body.confidentialityLevel) || 'ALTA',
      reportedChannel: 'PORTAL',
      reporterName: body.anonymousReport === true ? null : (context.user.name || buildPayrollEmployeeFullName(context.employee)),
      reporterEmail: body.anonymousReport === true ? null : context.user.email,
      reporterRole: context.employee.jobTitle,
      accusedArea: asString(body.accusedArea) || null,
      occurredAt: asDate(body.occurredAt),
      summary,
      evidenceSummary: asString(body.evidenceSummary) || null,
      followUpRequired: true,
      notes: asString(body.notes) || null,
      metadata: { sourceArea: 'portal-empleado' },
    },
  })

  const payload = await buildPortalPayload()
  if (!payload.ok) return payload.response
  return NextResponse.json({ success: true, data: payload.data })
}