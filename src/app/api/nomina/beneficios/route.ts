import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollBenefitDemoData, serializePayrollBenefits } from '@/lib/payroll-operations'

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
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asInteger(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.round(next) : 0
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

const BENEFIT_STATUSES = ['SOLICITADA', 'APROBADA', 'RECHAZADA', 'ENTREGADA'] as const

function isStatus(value: string): value is (typeof BENEFIT_STATUSES)[number] {
  return BENEFIT_STATUSES.includes(value as (typeof BENEFIT_STATUSES)[number])
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollBenefitDemoData(access.empresaId, access.userId)
  const data = await serializePayrollBenefits(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const title = asString(body.title)
  const description = asString(body.description)
  const status = asString(body.status) || 'SOLICITADA'

  if (!employeeId || !type || !title || !description || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'employeeId, type, title, description y status son requeridos' }, { status: 400 })
  }

  await prisma.payrollBenefitRequest.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      type,
      title,
      description,
      planName: asNullableString(body.planName),
      vendorName: asNullableString(body.vendorName),
      status,
      pointsCost: asInteger(body.pointsCost),
      amount: asNumber(body.amount),
      requestedAt: asDate(body.requestedAt) ?? new Date(),
      approvedAt: status === 'APROBADA' || status === 'ENTREGADA' ? new Date() : null,
      deliveredAt: status === 'ENTREGADA' ? new Date() : null,
      createdById: access.userId,
      approvedById: status === 'APROBADA' || status === 'ENTREGADA' ? access.userId : null,
    },
  })

  const data = await serializePayrollBenefits(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const type = asString(body.type)
  const title = asString(body.title)
  const description = asString(body.description)
  const status = asString(body.status) || 'SOLICITADA'

  if (!id || !employeeId || !type || !title || !description || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, type, title, description y status son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollBenefitRequest.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Solicitud de beneficio no encontrada' }, { status: 404 })
  }

  await prisma.payrollBenefitRequest.update({
    where: { id },
    data: {
      employeeId,
      type,
      title,
      description,
      planName: asNullableString(body.planName),
      vendorName: asNullableString(body.vendorName),
      status,
      pointsCost: asInteger(body.pointsCost),
      amount: asNumber(body.amount),
      requestedAt: asDate(body.requestedAt) ?? new Date(),
      approvedAt: status === 'APROBADA' || status === 'ENTREGADA' ? new Date() : null,
      deliveredAt: status === 'ENTREGADA' ? new Date() : null,
      approvedById: status === 'APROBADA' || status === 'ENTREGADA' ? access.userId : null,
    },
  })

  const data = await serializePayrollBenefits(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollBenefitRequest.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Solicitud de beneficio no encontrada' }, { status: 404 })
  }

  await prisma.payrollBenefitRequest.delete({ where: { id } })
  const data = await serializePayrollBenefits(access.empresaId)
  return NextResponse.json({ ok: true, data })
}