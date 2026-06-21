import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensurePayrollRecruitmentDemoData, serializePayrollRecruitmentCandidates } from '@/lib/payroll-recruitment'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const raw = asString(value)
  return raw || null
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asInteger(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.round(next) : fallback
}

function asNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollRecruitmentDemoData(access.empresaId, access.userId)
  const data = await serializePayrollRecruitmentCandidates(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const openingTitle = asString(body.openingTitle)
  const department = asString(body.department)
  const candidateName = asString(body.candidateName)

  if (!openingTitle || !department || !candidateName) {
    return NextResponse.json({ ok: false, error: 'openingTitle, department y candidateName son requeridos' }, { status: 400 })
  }

  await prisma.payrollRecruitmentCandidate.create({
    data: {
      empresaId: access.empresaId,
      ownerUserId: access.userId,
      openingTitle,
      department,
      locationLabel: asNullableString(body.locationLabel),
      candidateName,
      candidateEmail: asNullableString(body.candidateEmail),
      candidatePhone: asNullableString(body.candidatePhone),
      source: asString(body.source) || 'REFERIDO',
      stage: asString(body.stage) || 'SCREENING',
      status: asString(body.status) || 'ACTIVO',
      score: asInteger(body.score),
      salaryExpectation: asNumber(body.salaryExpectation),
      expectedStartDate: asDate(body.expectedStartDate),
      interviewerNotes: asNullableString(body.interviewerNotes),
      decisionSummary: asNullableString(body.decisionSummary),
      resumeUrl: asNullableString(body.resumeUrl),
    },
  })

  const data = await serializePayrollRecruitmentCandidates(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const openingTitle = asString(body.openingTitle)
  const department = asString(body.department)
  const candidateName = asString(body.candidateName)

  if (!id || !openingTitle || !department || !candidateName) {
    return NextResponse.json({ ok: false, error: 'id, openingTitle, department y candidateName son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollRecruitmentCandidate.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Candidato no encontrado' }, { status: 404 })
  }

  await prisma.payrollRecruitmentCandidate.update({
    where: { id },
    data: {
      ownerUserId: access.userId,
      openingTitle,
      department,
      locationLabel: asNullableString(body.locationLabel),
      candidateName,
      candidateEmail: asNullableString(body.candidateEmail),
      candidatePhone: asNullableString(body.candidatePhone),
      source: asString(body.source) || 'REFERIDO',
      stage: asString(body.stage) || 'SCREENING',
      status: asString(body.status) || 'ACTIVO',
      score: asInteger(body.score),
      salaryExpectation: asNumber(body.salaryExpectation),
      expectedStartDate: asDate(body.expectedStartDate),
      interviewerNotes: asNullableString(body.interviewerNotes),
      decisionSummary: asNullableString(body.decisionSummary),
      resumeUrl: asNullableString(body.resumeUrl),
    },
  })

  const data = await serializePayrollRecruitmentCandidates(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollRecruitmentCandidate.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Candidato no encontrado' }, { status: 404 })
  }

  await prisma.payrollRecruitmentCandidate.delete({ where: { id } })
  const data = await serializePayrollRecruitmentCandidates(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
