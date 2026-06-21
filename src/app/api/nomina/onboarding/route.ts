import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { defaultChecklist, ensurePayrollOnboardingDemoData, serializePayrollOnboardingJourneys } from '@/lib/payroll-onboarding'

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

function parseChecklistInput(value: unknown, phase: string) {
  if (!Array.isArray(value)) return defaultChecklist(phase)
  const rows = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const title = asString(source.title)
      const owner = asString(source.owner)
      const status = asString(source.status)
      if (!title || !owner || !status) return null
      return {
        id: asString(source.id) || `step-${index + 1}`,
        title,
        owner,
        status,
        dueLabel: asNullableString(source.dueLabel),
      }
    })
    .filter((item): item is { id: string; title: string; owner: string; status: string; dueLabel: string | null } => item !== null)

  return rows.length ? rows : defaultChecklist(phase)
}

function buildProgress(checklist: ReturnType<typeof parseChecklistInput>) {
  if (!checklist.length) return 0
  const done = checklist.filter((item) => item.status === 'COMPLETADA').length
  return Math.round((done / checklist.length) * 100)
}

const JOURNEY_STATUSES = ['PLANIFICADO', 'EN_CURSO', 'BLOQUEADO', 'COMPLETADO'] as const
const JOURNEY_PHASES = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'HABILITACION'] as const

function isJourneyStatus(value: string): value is (typeof JOURNEY_STATUSES)[number] {
  return JOURNEY_STATUSES.includes(value as (typeof JOURNEY_STATUSES)[number])
}

function isJourneyPhase(value: string): value is (typeof JOURNEY_PHASES)[number] {
  return JOURNEY_PHASES.includes(value as (typeof JOURNEY_PHASES)[number])
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  await ensurePayrollOnboardingDemoData(access.empresaId, access.userId)
  const data = await serializePayrollOnboardingJourneys(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const status = asString(body.status) || 'PLANIFICADO'
  const phase = asString(body.phase) || 'PRE_INGRESO'
  const startDate = asDate(body.startDate)

  if (!employeeId || !title || !startDate || !isJourneyStatus(status) || !isJourneyPhase(phase)) {
    return NextResponse.json({ ok: false, error: 'employeeId, title, status, phase y startDate son requeridos' }, { status: 400 })
  }

  const checklist = parseChecklistInput(body.checklist, phase)

  await prisma.payrollOnboardingJourney.create({
    data: {
      empresaId: access.empresaId,
      employeeId,
      periodId: asNullableString(body.periodId),
      workflowTemplateId: asNullableString(body.workflowTemplateId),
      ownerUserId: access.userId,
      title,
      status,
      phase,
      progress: buildProgress(checklist),
      employeeRole: asNullableString(body.employeeRole),
      locationLabel: asNullableString(body.locationLabel),
      welcomeMessage: asNullableString(body.welcomeMessage),
      checklist,
      startDate,
      targetDate: asDate(body.targetDate),
      completedAt: status === 'COMPLETADO' ? asDate(body.completedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollOnboardingJourneys(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  const employeeId = asString(body.employeeId)
  const title = asString(body.title)
  const status = asString(body.status) || 'PLANIFICADO'
  const phase = asString(body.phase) || 'PRE_INGRESO'
  const startDate = asDate(body.startDate)

  if (!id || !employeeId || !title || !startDate || !isJourneyStatus(status) || !isJourneyPhase(phase)) {
    return NextResponse.json({ ok: false, error: 'id, employeeId, title, status, phase y startDate son requeridos' }, { status: 400 })
  }

  const row = await prisma.payrollOnboardingJourney.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Journey de onboarding no encontrado' }, { status: 404 })
  }

  const checklist = parseChecklistInput(body.checklist, phase)

  await prisma.payrollOnboardingJourney.update({
    where: { id },
    data: {
      employeeId,
      periodId: asNullableString(body.periodId),
      workflowTemplateId: asNullableString(body.workflowTemplateId),
      ownerUserId: access.userId,
      title,
      status,
      phase,
      progress: buildProgress(checklist),
      employeeRole: asNullableString(body.employeeRole),
      locationLabel: asNullableString(body.locationLabel),
      welcomeMessage: asNullableString(body.welcomeMessage),
      checklist,
      startDate,
      targetDate: asDate(body.targetDate),
      completedAt: status === 'COMPLETADO' ? asDate(body.completedAt) ?? new Date() : null,
      notes: asNullableString(body.notes),
    },
  })

  const data = await serializePayrollOnboardingJourneys(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = asString(body.id)
  if (!id) return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })

  const row = await prisma.payrollOnboardingJourney.findFirst({ where: { id, empresaId: access.empresaId }, select: { id: true } })
  if (!row) {
    return NextResponse.json({ ok: false, error: 'Journey de onboarding no encontrado' }, { status: 404 })
  }

  await prisma.payrollOnboardingJourney.delete({ where: { id } })
  const data = await serializePayrollOnboardingJourneys(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
