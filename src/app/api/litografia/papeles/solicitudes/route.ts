import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, type Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

function asInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return null
  return Math.trunc(num)
}

function buildPaperSummary(args: {
  nombre: string
  tipo: string | null
  gramaje: number | null
  pliegoWidthCm: number
  pliegoHeightCm: number
  costoPliego: number
}) {
  const details = [
    args.tipo ? args.tipo : null,
    args.gramaje ? `${args.gramaje}g` : null,
    `${args.pliegoWidthCm}x${args.pliegoHeightCm} cm`,
    `$${Math.trunc(args.costoPliego).toLocaleString('es-CO')}/pliego`,
  ].filter(Boolean)
  return `${args.nombre}${details.length ? ` (${details.join(' • ')})` : ''}`
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

async function getAdminsForSede(tx: Prisma.TransactionClient, sedeId: string, excludeUserId?: string) {
  const memberships = await tx.sedeMembership.findMany({
    where: { sedeId, user: { role: 'ADMIN' } },
    select: { userId: true },
  })

  return Array.from(new Set(memberships.map((membership) => membership.userId)))
    .filter(Boolean)
    .filter((userId) => userId !== excludeUserId)
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const me = await prisma.user.findUnique({
    where: { id: access.userId },
    select: { role: true },
  })

  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Solo los administradores pueden revisar solicitudes.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusRaw = asString(searchParams.get('status')).toUpperCase()
  const status = statusRaw === 'APPROVED' || statusRaw === 'REJECTED' || statusRaw === 'PENDING' ? statusRaw : 'PENDING'

  const rows = await prisma.litografiaPaperRequest.findMany({
    where: {
      empresaId: access.empresaId,
      status,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      createdByUser: { select: { id: true, name: true, email: true, role: true } },
      approvedByUser: { select: { id: true, name: true, email: true, role: true } },
      paperRate: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          gramaje: true,
          pliegoWidthCm: true,
          pliegoHeightCm: true,
          costoPliego: true,
          activo: true,
          updatedAt: true,
        },
      },
    },
  })

  return NextResponse.json({ ok: true, data: rows })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, 'WRITE')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const nombre = asString(body.nombre)
  if (!nombre) return NextResponse.json({ ok: false, error: 'Nombre es requerido' }, { status: 400 })

  const tipo = body.tipo === undefined ? null : asString(body.tipo) || null
  const gramajeRaw = body.gramaje === undefined ? null : asInt(body.gramaje)
  const gramaje = gramajeRaw !== null && gramajeRaw > 0 ? gramajeRaw : null

  const pliegoWidthCm = Math.max(0, asNumber(body.pliegoWidthCm, 70))
  const pliegoHeightCm = Math.max(0, asNumber(body.pliegoHeightCm, 100))
  const costoPliego = Math.max(0, asNumber(body.costoPliego, 0))

  const summary = buildPaperSummary({ nombre, tipo, gramaje, pliegoWidthCm, pliegoHeightCm, costoPliego })

  try {
    const created = await prisma.$transaction(async (tx) => {
      const requestRow = await tx.litografiaPaperRequest.create({
        data: {
          empresaId,
          sedeId: access.sedeId,
          createdByUserId: access.userId,
          nombre,
          tipo,
          gramaje,
          pliegoWidthCm,
          pliegoHeightCm,
          costoPliego,
        },
        include: {
          createdByUser: { select: { id: true, name: true, email: true, role: true } },
          approvedByUser: { select: { id: true, name: true, email: true, role: true } },
        },
      })

      const recipients = await getAdminsForSede(tx, access.sedeId, access.userId)
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            empresaId,
            sedeId: access.sedeId,
            type: 'INFO',
            title: 'Nueva solicitud de papel litográfico',
            body: `${summary}. Revisa “Solicitudes de papeles”.`,
          })),
        })
      }

      return requestRow
    })

    return NextResponse.json({
      ok: true,
      mode: 'requested',
      message: 'Solicitud enviada. No tienes permisos para agregarlo directamente; espera a que un administrador lo agregue.',
      data: created,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al crear la solicitud de papel' }, { status: 500 })
  }
}