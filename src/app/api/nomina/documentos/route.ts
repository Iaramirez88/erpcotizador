import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { ensurePayrollDocumentDemoData, serializePayrollDocuments } from '@/lib/payroll-documents'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function asBoolean(value: unknown) {
  return value === true || value === 'true'
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildDocumentMetadata(body: Record<string, unknown>) {
  return {
    legalFormName: asNullableString(body.legalFormName),
    signatureMode: asString(body.signatureMode) || 'PLATAFORMA',
    signableInPlatform: body.signableInPlatform === undefined ? true : asBoolean(body.signableInPlatform),
    hrApprovalStatus: asString(body.hrApprovalStatus) || 'PENDIENTE',
    hrApproverName: asNullableString(body.hrApproverName),
    hrApprovedAt: asDate(body.hrApprovedAt)?.toISOString() ?? null,
    directorApprovalStatus: asString(body.directorApprovalStatus) || 'PENDIENTE',
    directorApproverName: asNullableString(body.directorApproverName),
    directorApprovedAt: asDate(body.directorApprovedAt)?.toISOString() ?? null,
    approvalStatus: asString(body.approvalStatus) || 'PENDIENTE',
    formSummary: asNullableString(body.formSummary),
  }
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollDocumentDemoData(access.empresaId, access.userId)
  const data = await serializePayrollDocuments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const category = asString(body.category)
  const documentType = asString(body.documentType)

  if (!employeeId || !title || !category || !documentType) {
    return NextResponse.json({ ok: false, error: 'employeeId, title, category y documentType son requeridos' }, { status: 400 })
  }

  await prisma.payrollEmployeeDocument.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      periodId: asNullableString(body.periodId),
      title,
      category,
      documentType,
      status: asString(body.status) || 'BORRADOR',
      signatureRequired: body.signatureRequired === undefined ? true : asBoolean(body.signatureRequired),
      signatureStatus: asString(body.signatureStatus) || 'PENDIENTE',
      visibleInPortal: body.visibleInPortal === undefined ? true : asBoolean(body.visibleInPortal),
      deliveryChannel: asString(body.deliveryChannel) || 'PORTAL',
      fileFormat: asString(body.fileFormat) || 'PDF',
      requestedAt: asDate(body.requestedAt),
      deliveredAt: asDate(body.deliveredAt),
      signedAt: asDate(body.signedAt),
      expiresAt: asDate(body.expiresAt),
      notes: asNullableString(body.notes),
      signedById: asDate(body.signedAt) ? access.userId : null,
      metadata: buildDocumentMetadata(body),
    },
  })

  const data = await serializePayrollDocuments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const category = asString(body.category)
  const documentType = asString(body.documentType)

  if (!id || !employeeId || !title || !category || !documentType) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, title, category y documentType son requeridos' }, { status: 400 })
  }

  const document = await prisma.payrollEmployeeDocument.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!document) {
    return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  const signedAt = asDate(body.signedAt)

  await prisma.payrollEmployeeDocument.update({
    where: { id },
    data: {
      employeeId,
      periodId: asNullableString(body.periodId),
      title,
      category,
      documentType,
      status: asString(body.status) || 'BORRADOR',
      signatureRequired: body.signatureRequired === undefined ? true : asBoolean(body.signatureRequired),
      signatureStatus: asString(body.signatureStatus) || 'PENDIENTE',
      visibleInPortal: body.visibleInPortal === undefined ? true : asBoolean(body.visibleInPortal),
      deliveryChannel: asString(body.deliveryChannel) || 'PORTAL',
      fileFormat: asString(body.fileFormat) || 'PDF',
      requestedAt: asDate(body.requestedAt),
      deliveredAt: asDate(body.deliveredAt),
      signedAt,
      expiresAt: asDate(body.expiresAt),
      notes: asNullableString(body.notes),
      signedById: signedAt ? access.userId : null,
      metadata: buildDocumentMetadata(body),
    },
  })

  const data = await serializePayrollDocuments(access.empresaId)
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

  const document = await prisma.payrollEmployeeDocument.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!document) {
    return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
  }

  await prisma.payrollEmployeeDocument.delete({ where: { id } })
  const data = await serializePayrollDocuments(access.empresaId)
  return NextResponse.json({ ok: true, data })
}