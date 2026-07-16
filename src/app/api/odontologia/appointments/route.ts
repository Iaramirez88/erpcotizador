import { NextResponse } from 'next/server'
import { OdontologyAppointmentStatus } from '@prisma/client'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const normalized = asString(value)
  return normalized || null
}

function asDate(value: unknown) {
  const normalized = asString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.round(parsed)
}

function normalizeAppointmentStatus(value: unknown) {
  const normalized = asString(value).toUpperCase()
  const allowed = new Set(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  return (allowed.has(normalized) ? normalized : 'SCHEDULED') as OdontologyAppointmentStatus
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'READ', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const appointments = await prisma.odontologyAppointment.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ startsAt: 'asc' }],
      take: 30,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        reason: true,
        chairName: true,
        notes: true,
        cliente: { select: { id: true, nombre: true, documento: true } },
        assignedDentist: { select: { id: true, name: true, email: true } },
        treatmentPlan: { select: { id: true, title: true, status: true } },
      },
    })

    return NextResponse.json({ ok: true, data: appointments })
  } catch (error) {
    console.error('GET /api/odontologia/appointments error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar la agenda odontológica' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'UPDATE', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const clienteId = asString(body.clienteId)
    const reason = asString(body.reason)
    const startsAt = asDate(body.startsAt)
    const durationMinutes = asPositiveInt(body.durationMinutes, 45)
    const treatmentPlanId = asNullableString(body.treatmentPlanId)

    if (!clienteId) {
      return NextResponse.json({ ok: false, error: 'clienteId es requerido' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ ok: false, error: 'El motivo de la cita es requerido' }, { status: 400 })
    }
    if (!startsAt) {
      return NextResponse.json({ ok: false, error: 'La fecha y hora de la cita son requeridas' }, { status: 400 })
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, empresaId: access.empresaId },
      select: { id: true },
    })

    if (!cliente) {
      return NextResponse.json({ ok: false, error: 'Paciente no encontrado' }, { status: 404 })
    }

    const treatmentPlan = treatmentPlanId
      ? await prisma.odontologyTreatmentPlan.findFirst({
          where: { id: treatmentPlanId, empresaId: access.empresaId, clienteId },
          select: { id: true },
        })
      : null

    if (treatmentPlanId && !treatmentPlan) {
      return NextResponse.json({ ok: false, error: 'El plan asociado no existe para este paciente' }, { status: 400 })
    }

    const profile = await prisma.odontologyPatientProfile.upsert({
      where: { clienteId },
      create: { empresaId: access.empresaId, clienteId },
      update: {},
      select: { id: true },
    })

    const endsAt = new Date(startsAt)
    endsAt.setMinutes(endsAt.getMinutes() + durationMinutes)

    const appointment = await prisma.odontologyAppointment.create({
      data: {
        empresaId: access.empresaId,
        clienteId,
        patientProfileId: profile.id,
        treatmentPlanId: treatmentPlan?.id ?? null,
        assignedDentistUserId: access.userId,
        createdByUserId: access.userId,
        startsAt,
        endsAt,
        status: normalizeAppointmentStatus(body.status),
        reason,
        chairName: asNullableString(body.chairName),
        notes: asNullableString(body.notes),
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        reason: true,
      },
    })

    return NextResponse.json({ ok: true, data: appointment })
  } catch (error) {
    console.error('POST /api/odontologia/appointments error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo crear la cita odontológica' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'UPDATE', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const appointmentId = asString(body.id)
    const status = normalizeAppointmentStatus(body.status)

    if (!appointmentId) {
      return NextResponse.json({ ok: false, error: 'id es requerido' }, { status: 400 })
    }

    const current = await prisma.odontologyAppointment.findFirst({
      where: { id: appointmentId, empresaId: access.empresaId },
      select: { id: true },
    })

    if (!current) {
      return NextResponse.json({ ok: false, error: 'Cita no encontrada' }, { status: 404 })
    }

    const appointment = await prisma.odontologyAppointment.update({
      where: { id: current.id },
      data: { status },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        reason: true,
        chairName: true,
      },
    })

    return NextResponse.json({ ok: true, data: appointment })
  } catch (error) {
    console.error('PATCH /api/odontologia/appointments error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar el estado de la cita' }, { status: 500 })
  }
}