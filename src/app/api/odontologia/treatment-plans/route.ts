import { NextResponse } from 'next/server'
import { OdontologyTreatmentItemStatus, OdontologyTreatmentPlanStatus } from '@prisma/client'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { normalizeToothCode } from '@/lib/odontology'

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

function asNonNegativeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function normalizePlanStatus(value: unknown) {
  const normalized = asString(value).toUpperCase()
  const allowed = new Set(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'])
  return (allowed.has(normalized) ? normalized : 'ACTIVE') as OdontologyTreatmentPlanStatus
}

function normalizeItemStatus(value: unknown) {
  const normalized = asString(value).toUpperCase()
  const allowed = new Set(['PLANNED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  return (allowed.has(normalized) ? normalized : 'PLANNED') as OdontologyTreatmentItemStatus
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'READ', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const plans = await prisma.odontologyTreatmentPlan.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        diagnosisSummary: true,
        estimatedTotal: true,
        updatedAt: true,
        cliente: { select: { id: true, nombre: true, documento: true } },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            toothCode: true,
            procedureType: true,
            status: true,
            estimatedCost: true,
            scheduledAt: true,
          },
        },
      },
    })

    return NextResponse.json({ ok: true, data: plans })
  } catch (error) {
    console.error('GET /api/odontologia/treatment-plans error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudieron cargar los planes de tratamiento' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', action: 'UPDATE', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const clienteId = asString(body.clienteId)
    const title = asString(body.title)
    const rawItems = Array.isArray(body.items) ? body.items : []

    if (!clienteId) {
      return NextResponse.json({ ok: false, error: 'clienteId es requerido' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: 'El título del plan es requerido' }, { status: 400 })
    }

    const items = rawItems
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const procedureType = asString((item as { procedureType?: unknown }).procedureType)
        if (!procedureType) return null

        const toothCode = normalizeToothCode((item as { toothCode?: unknown }).toothCode)

        return {
          toothCode,
          procedureType,
          description: asNullableString((item as { description?: unknown }).description),
          status: normalizeItemStatus((item as { status?: unknown }).status),
          estimatedCost: asNonNegativeNumber((item as { estimatedCost?: unknown }).estimatedCost),
          scheduledAt: asNullableDate((item as { scheduledAt?: unknown }).scheduledAt),
          notes: asNullableString((item as { notes?: unknown }).notes),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: 'Agrega al menos un procedimiento al plan' }, { status: 400 })
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, empresaId: access.empresaId },
      select: { id: true },
    })

    if (!cliente) {
      return NextResponse.json({ ok: false, error: 'Paciente no encontrado' }, { status: 404 })
    }

    const profile = await prisma.odontologyPatientProfile.upsert({
      where: { clienteId },
      create: { empresaId: access.empresaId, clienteId },
      update: {},
      select: { id: true },
    })

    const estimatedTotal = items.reduce((sum, item) => sum + item.estimatedCost, 0)

    const plan = await prisma.odontologyTreatmentPlan.create({
      data: {
        empresaId: access.empresaId,
        clienteId,
        patientProfileId: profile.id,
        createdByUserId: access.userId,
        title,
        status: normalizePlanStatus(body.status),
        diagnosisSummary: asNullableString(body.diagnosisSummary),
        objectives: asNullableString(body.objectives),
        notes: asNullableString(body.notes),
        estimatedTotal,
        items: {
          create: items.map((item) => ({
            empresa: { connect: { id: access.empresaId } },
            toothCode: item.toothCode,
            procedureType: item.procedureType,
            description: item.description,
            status: item.status,
            estimatedCost: item.estimatedCost,
            scheduledAt: item.scheduledAt,
            notes: item.notes,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        estimatedTotal: true,
        items: {
          select: {
            id: true,
            toothCode: true,
            procedureType: true,
            status: true,
            estimatedCost: true,
          },
        },
      },
    })

    return NextResponse.json({ ok: true, data: plan })
  } catch (error) {
    console.error('POST /api/odontologia/treatment-plans error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo crear el plan de tratamiento' }, { status: 500 })
  }
}