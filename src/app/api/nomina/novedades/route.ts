import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, PayrollNoveltyStatus, PayrollNoveltyType } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { resolvePayrollNoveltyAmounts } from '@/lib/payroll-compensation'
import { ensurePayrollNoveltyDemoData } from '@/lib/payroll-operations'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollNoveltyRow } from '@/lib/payroll'

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

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function getSupportExtension(mime: string) {
  const lower = mime.toLowerCase()
  if (lower === 'application/pdf') return '.pdf'
  if (lower === 'image/png') return '.png'
  if (lower === 'image/jpeg' || lower === 'image/jpg') return '.jpg'
  return ''
}

type ParsedNoveltyPayload = {
  fields: Record<string, unknown>
  file: File | null
}

async function parseNoveltyPayload(request: NextRequest): Promise<ParsedNoveltyPayload> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    if (!form) return { fields: {}, file: null }

    const fileValue = form.get('file')
    const file = fileValue instanceof File ? fileValue : null
    const fields: Record<string, unknown> = {}
    form.forEach((value, key) => {
      if (key === 'file') return
      fields[key] = typeof value === 'string' ? value : ''
    })
    return { fields, file }
  }

  const fields = (await request.json().catch(() => ({}))) as Record<string, unknown>
  return { fields, file: null }
}

async function storeNoveltySupportFile(file: File, empresaId: string, employeeId: string) {
  const ext = getSupportExtension(file.type || '')
  if (!ext) {
    return { ok: false as const, error: 'Solo se permiten PDF, JPG o PNG.' }
  }

  if (Number.isFinite(file.size) && file.size > MAX_SUPPORT_BYTES) {
    return { ok: false as const, error: 'El soporte supera el máximo de 4MB.' }
  }

  const relDir = path.posix.join('uploads', 'nomina', 'novedades', empresaId, employeeId)
  const absDir = path.join(process.cwd(), 'public', relDir)
  await fs.mkdir(absDir, { recursive: true })

  const filename = `${Date.now()}-${randomUUID()}${ext}`
  const absPath = path.join(absDir, filename)
  await fs.writeFile(absPath, Buffer.from(await file.arrayBuffer()))
  return {
    ok: true as const,
    supportUrl: `/${relDir}/${filename}`,
    supportNumber: String(file.name || filename),
  }
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
    contractId: item.contractId,
    periodId: item.periodId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    type: item.type,
    periodLabel: item.period?.label ?? 'Sin período',
    detail: item.detail,
    amount: item.amount ?? undefined,
    quantity: item.quantity ?? undefined,
    days: item.days ?? undefined,
    status: item.status,
    source: item.source,
    occurredOn: item.occurredOn?.toISOString() ?? null,
    startsAt: item.startsAt?.toISOString() ?? null,
    endsAt: item.endsAt?.toISOString() ?? null,
    supportNumber: item.supportNumber ?? null,
    supportUrl: item.supportUrl ?? null,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  await ensurePayrollNoveltyDemoData(access.empresaId, access.userId)
  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { fields: body, file } = await parseNoveltyPayload(request)
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const detail = asString(body.detail)
  const status = asString(body.status) || 'RADICADA'

  if (!employeeId || !isType(type) || !detail || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'employeeId, type y detail son requeridos' }, { status: 400 })
  }

  let supportUrl = asString(body.supportUrl) || null
  let supportNumber = asString(body.supportNumber) || null

  if (file) {
    const upload = await storeNoveltySupportFile(file, access.empresaId, employeeId)
    if (!upload.ok) {
      return NextResponse.json({ ok: false, error: upload.error }, { status: 400 })
    }
    supportUrl = upload.supportUrl
    supportNumber = supportNumber || upload.supportNumber
  }

  if (type === 'INCAPACIDAD' && !supportUrl) {
    return NextResponse.json({ ok: false, error: 'La incapacidad requiere adjuntar un soporte en PDF o imagen.' }, { status: 400 })
  }

  const resolvedCompensation = await resolvePayrollNoveltyAmounts({
    empresaId: access.empresaId,
    employeeId,
    contractId: asString(body.contractId) || null,
    type,
    amount: asNumber(body.amount),
    quantity: asNumber(body.quantity),
    days: asNumber(body.days),
    occurredOn: asDate(body.occurredOn),
    startsAt: asDate(body.startsAt),
    endsAt: asDate(body.endsAt),
  })

  await prisma.payrollNovelty.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      contractId: resolvedCompensation.contractId,
      periodId: asString(body.periodId) || null,
      type,
      status,
      source: asString(body.source) || 'MANUAL',
      detail,
      amount: resolvedCompensation.amount,
      quantity: resolvedCompensation.quantity,
      days: resolvedCompensation.days,
      occurredOn: asDate(body.occurredOn),
      startsAt: asDate(body.startsAt),
      endsAt: asDate(body.endsAt),
      supportNumber,
      supportUrl,
      createdById: access.userId,
      metadata: resolvedCompensation.metadata,
    },
  })

  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { fields: body, file } = await parseNoveltyPayload(request)
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const detail = asString(body.detail)
  const status = asString(body.status) || 'RADICADA'

  if (!id || !employeeId || !isType(type) || !detail || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, type, detail y status son requeridos' }, { status: 400 })
  }

  const novelty = await prisma.payrollNovelty.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true, supportUrl: true, supportNumber: true } })
  if (!novelty) {
    return NextResponse.json({ ok: false, error: 'Novedad no encontrada' }, { status: 404 })
  }

  let supportUrl = novelty.supportUrl ?? null
  let supportNumber = asNullableString(body.supportNumber) ?? novelty.supportNumber ?? null

  if (file) {
    const upload = await storeNoveltySupportFile(file, access.empresaId, employeeId)
    if (!upload.ok) {
      return NextResponse.json({ ok: false, error: upload.error }, { status: 400 })
    }
    supportUrl = upload.supportUrl
    supportNumber = asNullableString(body.supportNumber) ?? upload.supportNumber
  }

  if (type === 'INCAPACIDAD' && !supportUrl) {
    return NextResponse.json({ ok: false, error: 'La incapacidad requiere adjuntar un soporte en PDF o imagen.' }, { status: 400 })
  }

  const resolvedCompensation = await resolvePayrollNoveltyAmounts({
    empresaId: access.empresaId,
    employeeId,
    contractId: asNullableString(body.contractId),
    type,
    amount: asNumber(body.amount),
    quantity: asNumber(body.quantity),
    days: asNumber(body.days),
    occurredOn: asDate(body.occurredOn),
    startsAt: asDate(body.startsAt),
    endsAt: asDate(body.endsAt),
  })

  await prisma.payrollNovelty.update({
    where: { id },
    data: {
      employeeId,
      contractId: resolvedCompensation.contractId,
      periodId: asNullableString(body.periodId),
      type,
      status,
      source: asString(body.source) || 'MANUAL',
      detail,
      amount: resolvedCompensation.amount,
      quantity: resolvedCompensation.quantity,
      days: resolvedCompensation.days,
      occurredOn: asDate(body.occurredOn),
      startsAt: asDate(body.startsAt),
      endsAt: asDate(body.endsAt),
      supportNumber,
      supportUrl,
      approvedAt: status === 'VALIDADA' || status === 'APLICADA' ? new Date() : null,
      approvedById: status === 'VALIDADA' || status === 'APLICADA' ? access.userId : null,
      metadata: resolvedCompensation.metadata,
    },
  })

  const data = await serializeNovelties(access.empresaId)
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

  const novelty = await prisma.payrollNovelty.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, _count: { select: { conceptLines: true } } },
  })

  if (!novelty) {
    return NextResponse.json({ ok: false, error: 'Novedad no encontrada' }, { status: 404 })
  }

  if (novelty._count.conceptLines) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar una novedad ya aplicada al cálculo' }, { status: 400 })
  }

  await prisma.payrollNovelty.delete({ where: { id } })
  const data = await serializeNovelties(access.empresaId)
  return NextResponse.json({ ok: true, data })
}