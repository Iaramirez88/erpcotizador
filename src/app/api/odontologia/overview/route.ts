import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { ensureOdontologySeedsForEmpresa, getOdontologyDropdownKeys } from '@/lib/business-type-seeds'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'READ', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    await ensureOdontologySeedsForEmpresa(empresaId)

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const [patientProfiles, clinicalRecords, scheduledAppointments, activeTreatmentPlans, recentRecords, upcomingAppointments, treatmentPlans, dropdowns] = await Promise.all([
      prisma.odontologyPatientProfile.count({ where: { empresaId } }),
      prisma.odontologyClinicalRecord.count({ where: { empresaId } }),
      prisma.odontologyAppointment.count({
        where: {
          empresaId,
          startsAt: { gte: todayStart },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
      }),
      prisma.odontologyTreatmentPlan.count({
        where: {
          empresaId,
          status: { in: ['DRAFT', 'ACTIVE'] },
        },
      }),
      prisma.odontologyClinicalRecord.findMany({
        where: { empresaId },
        orderBy: [{ appointmentDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          appointmentDate: true,
          consultationReason: true,
          treatmentStatus: true,
          diagnosis: true,
          nextVisitAt: true,
          odontogram: true,
          cliente: { select: { id: true, nombre: true, documento: true } },
        },
      }),
      prisma.odontologyAppointment.findMany({
        where: {
          empresaId,
          startsAt: { gte: todayStart },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        orderBy: [{ startsAt: 'asc' }],
        take: 10,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          reason: true,
          chairName: true,
          cliente: { select: { id: true, nombre: true, documento: true } },
          assignedDentist: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.odontologyTreatmentPlan.findMany({
        where: {
          empresaId,
          status: { in: ['DRAFT', 'ACTIVE'] },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          estimatedTotal: true,
          diagnosisSummary: true,
          updatedAt: true,
          cliente: { select: { id: true, nombre: true, documento: true } },
          items: {
            orderBy: [{ createdAt: 'asc' }],
            take: 4,
            select: {
              id: true,
              toothCode: true,
              procedureType: true,
              status: true,
              estimatedCost: true,
            },
          },
          _count: {
            select: {
              items: true,
              appointments: true,
              clinicalRecords: true,
            },
          },
        },
      }),
      prisma.configDropdown.findMany({
        where: { empresaId, key: { in: getOdontologyDropdownKeys() } },
        orderBy: [{ nombre: 'asc' }],
        select: {
          id: true,
          key: true,
          nombre: true,
          items: {
            where: { activo: true },
            orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
            select: { id: true, value: true, label: true, sortOrder: true, meta: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        totals: {
          patientProfiles,
          clinicalRecords,
          scheduledAppointments,
          activeTreatmentPlans,
        },
        recentRecords,
        upcomingAppointments,
        treatmentPlans,
        dropdowns,
      },
    })
  } catch (error) {
    console.error('GET /api/odontologia/overview error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar el panel odontológico' }, { status: 500 })
  }
}