import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function buildPaperSummary(args: { nombre: string; tipo: string | null; gramaje: number | null }) {
  const details = [args.tipo, args.gramaje ? `${args.gramaje}g` : null].filter(Boolean)
  return `${args.nombre}${details.length ? ` (${details.join(' • ')})` : ''}`
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
    if (!access.ok) return access.response

    const me = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { role: true },
    })

    if (me?.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Solo los administradores pueden decidir solicitudes.' }, { status: 403 })
    }

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const action = asString(body?.action).trim().toUpperCase()
    const decisionNote = asString(body?.decisionNote).trim() || null

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ ok: false, error: 'action inválida (APPROVE|REJECT)' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const requestRow = await tx.litografiaPaperRequest.findFirst({
        where: { id, empresaId: access.empresaId },
      })

      if (!requestRow) {
        return {
          status: 404 as const,
          payload: NextResponse.json({ ok: false, error: 'Solicitud no encontrada' }, { status: 404 }),
        }
      }

      if (requestRow.status !== 'PENDING') {
        return {
          status: 409 as const,
          payload: NextResponse.json({ ok: false, error: 'La solicitud ya fue procesada.' }, { status: 409 }),
        }
      }

      if (action === 'REJECT') {
        const row = await tx.litografiaPaperRequest.update({
          where: { id: requestRow.id },
          data: {
            status: 'REJECTED',
            decisionNote,
            approvedByUserId: access.userId,
          },
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

        await tx.notification.create({
          data: {
            userId: requestRow.createdByUserId,
            empresaId: access.empresaId,
            sedeId: requestRow.sedeId,
            type: 'WARNING',
            title: `Solicitud rechazada: ${requestRow.nombre}`,
            body: decisionNote ? `Motivo: ${decisionNote}` : 'Un administrador rechazó tu solicitud de papel litográfico.',
            actionUrl: '/dashboard/litografia',
            actionLabel: 'Ver litografía',
          },
        })

        return { status: 200 as const, row }
      }

      const duplicate = await tx.litografiaPaperRate.findFirst({
        where: { empresaId: access.empresaId, nombre: requestRow.nombre },
        select: { id: true },
      })

      if (duplicate?.id) {
        return {
          status: 409 as const,
          payload: NextResponse.json({ ok: false, error: 'Ya existe un papel con ese nombre en tu empresa.' }, { status: 409 }),
        }
      }

      const paperRate = await tx.litografiaPaperRate.create({
        data: {
          empresaId: access.empresaId,
          nombre: requestRow.nombre,
          tipo: requestRow.tipo,
          gramaje: requestRow.gramaje,
          pliegoWidthCm: requestRow.pliegoWidthCm,
          pliegoHeightCm: requestRow.pliegoHeightCm,
          costoPliego: requestRow.costoPliego,
          activo: true,
        },
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
      })

      const row = await tx.litografiaPaperRequest.update({
        where: { id: requestRow.id },
        data: {
          status: 'APPROVED',
          decisionNote,
          approvedByUserId: access.userId,
          paperRateId: paperRate.id,
        },
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

      await tx.notification.create({
        data: {
          userId: requestRow.createdByUserId,
          empresaId: access.empresaId,
          sedeId: requestRow.sedeId,
          type: 'SUCCESS',
          title: `Solicitud aprobada: ${requestRow.nombre}`,
          body: decisionNote
            ? `Comentario: ${decisionNote}`
            : `Ya puedes usar el papel ${buildPaperSummary({ nombre: requestRow.nombre, tipo: requestRow.tipo, gramaje: requestRow.gramaje })} en litografía.`,
          actionUrl: '/dashboard/litografia',
          actionLabel: 'Ver litografía',
        },
      })

      return { status: 200 as const, row }
    })

    if ('payload' in updated) return updated.payload

    return NextResponse.json({ ok: true, data: updated.row }, { status: updated.status })
  } catch (error) {
    console.error('Error decidiendo solicitud de papel litográfico:', error)
    return NextResponse.json({ ok: false, error: 'Error procesando solicitud' }, { status: 500 })
  }
}