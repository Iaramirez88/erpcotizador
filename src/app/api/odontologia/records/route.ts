import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { normalizeOdontogramPayload } from '@/lib/odontology'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableString(value: unknown) {
  const normalized = asString(value)
  return normalized || null
}

function asNullableDate(value: unknown) {
  const normalized = asString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'READ')
    if (!access.ok) return access.response

    const url = new URL(request.url)
    const clienteId = asString(url.searchParams.get('clienteId'))

    const records = await prisma.odontologyClinicalRecord.findMany({
      where: {
        empresaId: access.empresaId,
        ...(clienteId ? { clienteId } : {}),
      },
      orderBy: [{ appointmentDate: 'desc' }, { createdAt: 'desc' }],
      take: clienteId ? 24 : 12,
      select: {
        id: true,
        appointmentDate: true,
        consultationReason: true,
        treatmentStatus: true,
        diagnosis: true,
        procedureSummary: true,
        observations: true,
        nextVisitAt: true,
        odontogram: true,
        patientProfile: {
          select: {
            birthDate: true,
            bloodType: true,
            allergies: true,
            currentMedications: true,
          },
        },
        cliente: { select: { id: true, nombre: true, documento: true } },
      },
    })

    return NextResponse.json({ ok: true, data: records })
  } catch (error) {
    console.error('GET /api/odontologia/records error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el historial clínico' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const clienteId = asString(body.clienteId)
    const consultationReason = asString(body.consultationReason)

    if (!clienteId) {
      return NextResponse.json({ ok: false, error: 'clienteId es requerido' }, { status: 400 })
    }
    if (!consultationReason) {
      return NextResponse.json({ ok: false, error: 'El motivo de consulta es requerido' }, { status: 400 })
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, empresaId: access.empresaId },
      select: { id: true, empresaId: true },
    })

    if (!cliente) {
      return NextResponse.json({ ok: false, error: 'Paciente no encontrado' }, { status: 404 })
    }

    const appointmentId = asNullableString(body.appointmentId)
    const treatmentPlanId = asNullableString(body.treatmentPlanId)

    const [appointment, treatmentPlan] = await Promise.all([
      appointmentId
        ? prisma.odontologyAppointment.findFirst({
            where: { id: appointmentId, empresaId: access.empresaId, clienteId: cliente.id },
            select: { id: true, status: true },
          })
        : Promise.resolve(null),
      treatmentPlanId
        ? prisma.odontologyTreatmentPlan.findFirst({
            where: { id: treatmentPlanId, empresaId: access.empresaId, clienteId: cliente.id },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])

    if (appointmentId && !appointment) {
      return NextResponse.json({ ok: false, error: 'La cita vinculada no existe para este paciente' }, { status: 400 })
    }

    if (treatmentPlanId && !treatmentPlan) {
      return NextResponse.json({ ok: false, error: 'El plan vinculado no existe para este paciente' }, { status: 400 })
    }

    const profile = await prisma.odontologyPatientProfile.upsert({
      where: { clienteId: cliente.id },
      create: {
        empresaId: access.empresaId,
        clienteId: cliente.id,
        birthDate: asNullableDate(body.birthDate),
        bloodType: asNullableString(body.bloodType),
        allergies: asNullableString(body.allergies),
        currentMedications: asNullableString(body.currentMedications),
        emergencyContactName: asNullableString(body.emergencyContactName),
        emergencyContactPhone: asNullableString(body.emergencyContactPhone),
        insuranceProvider: asNullableString(body.insuranceProvider),
        notes: asNullableString(body.profileNotes),
      },
      update: {
        birthDate: asNullableDate(body.birthDate) ?? undefined,
        bloodType: asNullableString(body.bloodType) ?? undefined,
        allergies: asNullableString(body.allergies) ?? undefined,
        currentMedications: asNullableString(body.currentMedications) ?? undefined,
        emergencyContactName: asNullableString(body.emergencyContactName) ?? undefined,
        emergencyContactPhone: asNullableString(body.emergencyContactPhone) ?? undefined,
        insuranceProvider: asNullableString(body.insuranceProvider) ?? undefined,
        notes: asNullableString(body.profileNotes) ?? undefined,
      },
      select: { id: true },
    })

    const record = await prisma.odontologyClinicalRecord.create({
      data: {
        empresaId: access.empresaId,
        clienteId: cliente.id,
        patientProfileId: profile.id,
        appointmentId: appointment?.id ?? null,
        treatmentPlanId: treatmentPlan?.id ?? null,
        createdByUserId: access.userId,
        appointmentDate: asNullableDate(body.appointmentDate) ?? new Date(),
        consultationReason,
        diagnosis: asNullableString(body.diagnosis),
        procedureSummary: asNullableString(body.procedureSummary),
        treatmentStatus: asNullableString(body.treatmentStatus),
        observations: asNullableString(body.observations),
        nextVisitAt: asNullableDate(body.nextVisitAt),
        odontogram: normalizeOdontogramPayload(body.odontogram),
      },
      select: {
        id: true,
        appointmentDate: true,
        consultationReason: true,
        treatmentStatus: true,
        nextVisitAt: true,
        odontogram: true,
      },
    })

    if (appointment && appointment.status !== 'COMPLETED') {
      await prisma.odontologyAppointment.update({
        where: { id: appointment.id },
        data: { status: 'COMPLETED' },
      })
    }

    return NextResponse.json({ ok: true, data: record })
  } catch (error) {
    console.error('POST /api/odontologia/records error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo registrar la evolución clínica' }, { status: 500 })
  }
}