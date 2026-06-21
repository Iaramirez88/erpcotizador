import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollBenefitOfferingDemoData, serializePayrollBenefitOfferings } from '@/lib/payroll-operations'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function asInteger(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.round(next) : 0
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollBenefitOfferingDemoData(access.empresaId)
  const data = await serializePayrollBenefitOfferings(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = asString(body.title)
  const kind = asString(body.kind)
  const category = asString(body.category)
  const description = asString(body.description)

  if (!title || !kind || !category || !description) {
    return NextResponse.json({ ok: false, error: 'title, kind, category y description son requeridos' }, { status: 400 })
  }

  await prisma.payrollBenefitOffering.create({
    data: {
      empresaId: access.empresaId,
      title,
      kind,
      category,
      vendorName: asNullableString(body.vendorName),
      status: asString(body.status) || 'ACTIVO',
      pricingModel: asString(body.pricingModel) || 'PUNTOS',
      pointsCost: asInteger(body.pointsCost),
      employerCost: asNumber(body.employerCost),
      employeeCopay: asNumber(body.employeeCopay),
      discountRate: asNumber(body.discountRate),
      spotlight: asBoolean(body.spotlight),
      description,
    },
  })

  const data = await serializePayrollBenefitOfferings(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const title = asString(body.title)
  const kind = asString(body.kind)
  const category = asString(body.category)
  const description = asString(body.description)

  if (!id || !title || !kind || !category || !description) {
    return NextResponse.json({ ok: false, error: 'id, title, kind, category y description son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollBenefitOffering.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Oferta de beneficio no encontrada' }, { status: 404 })
  }

  await prisma.payrollBenefitOffering.update({
    where: { id },
    data: {
      title,
      kind,
      category,
      vendorName: asNullableString(body.vendorName),
      status: asString(body.status) || 'ACTIVO',
      pricingModel: asString(body.pricingModel) || 'PUNTOS',
      pointsCost: asInteger(body.pointsCost),
      employerCost: asNumber(body.employerCost),
      employeeCopay: asNumber(body.employeeCopay),
      discountRate: asNumber(body.discountRate),
      spotlight: asBoolean(body.spotlight),
      description,
    },
  })

  const data = await serializePayrollBenefitOfferings(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollBenefitOffering.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Oferta de beneficio no encontrada' }, { status: 404 })
  }

  await prisma.payrollBenefitOffering.delete({ where: { id } })
  const data = await serializePayrollBenefitOfferings(access.empresaId)
  return NextResponse.json({ ok: true, data })
}