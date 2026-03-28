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

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const myMembership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: access.sedeId, userId: access.userId } },
      select: { role: true },
    })
    const canManageRequests = myMembership?.role === 'ADMIN' || myMembership?.role === 'MANAGER'

    if (!canManageRequests) {
      return NextResponse.json({ success: false, error: 'Prohibido' }, { status: 403 })
    }

    const { id } = await context.params

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const action = asString(body?.action).trim().toUpperCase()
    const decisionNote = asString(body?.decisionNote).trim() || null

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { success: false, error: 'action inválida (APPROVE|REJECT)' },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reqRow = await tx.customProductRequest.findFirst({
        where: { id, empresaId: access.empresaId },
        include: { terminados: { select: { terminadoId: true } } },
      })

      if (!reqRow) {
        return { status: 404 as const, payload: NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 }) }
      }

      if (String(reqRow.status) !== 'PENDING') {
        return {
          status: 409 as const,
          payload: NextResponse.json(
            { success: false, error: 'La solicitud ya fue procesada.' },
            { status: 409 }
          ),
        }
      }

      if (action === 'REJECT') {
        const row = await tx.customProductRequest.update({
          where: { id: reqRow.id },
          data: {
            status: 'REJECTED',
            decisionNote,
            approvedByUserId: access.userId,
          },
          include: {
            createdByUser: { select: { id: true, name: true, email: true, role: true } },
            approvedByUser: { select: { id: true, name: true, email: true, role: true } },
            terminados: { include: { terminado: { select: { id: true, nombre: true } } } },
            material: { select: { id: true, nombre: true, externalId: true, isCustom: true, customOwnerUserId: true, customSedeId: true } },
          },
        })

        await tx.notification.create({
          data: {
            userId: reqRow.createdByUserId,
            empresaId: access.empresaId,
            sedeId: reqRow.sedeId,
            type: 'WARNING',
            title: `Solicitud rechazada: ${reqRow.nombre}`,
            body: decisionNote ? `Motivo: ${decisionNote}` : 'Un administrador rechazó tu solicitud de producto personalizado.',
            actionUrl: '/dashboard/productos?notif=my-custom-requests',
            actionLabel: 'Ver solicitud',
          },
        })

        return { status: 200 as const, row }
      }

      // APPROVE
      if (reqRow.externalId) {
        const dup = await tx.material.findFirst({
          where: {
            empresaId: access.empresaId,
            externalId: reqRow.externalId,
          },
          select: { id: true },
        })

        if (dup?.id) {
          return {
            status: 409 as const,
            payload: NextResponse.json(
              { success: false, error: 'Ya existe un producto con ese código/ID externo en tu empresa.' },
              { status: 409 }
            ),
          }
        }
      }

      const material = await tx.material.create({
        data: {
          empresaId: access.empresaId,
          externalId: reqRow.externalId,
          nombre: reqRow.nombre,
          tipo: reqRow.tipo,
          categoria: reqRow.categoria,
          proveedor: reqRow.proveedor,
          observaciones: reqRow.observaciones,
          ancho: reqRow.ancho,
          largo: reqRow.largo,
          unidadMedida: reqRow.unidadMedida,
          precioM2: reqRow.precioM2,
          precioMetro: reqRow.precioMetro,
          precioUnidad: reqRow.precioUnidad,
          isCustom: true,
          customOwnerUserId: reqRow.createdByUserId,
          customSedeId: reqRow.sedeId,
          activo: true,
          stockActual: 0,
          stockMinimo: 0,
        },
        select: { id: true },
      })

      const terminadoIds = Array.from(new Set(reqRow.terminados.map((t) => t.terminadoId)))
      if (terminadoIds.length) {
        await tx.materialAllowedTerminado.createMany({
          data: terminadoIds.map((terminadoId) => ({ materialId: material.id, terminadoId })),
          skipDuplicates: true,
        })
      }

      const row = await tx.customProductRequest.update({
        where: { id: reqRow.id },
        data: {
          status: 'APPROVED',
          decisionNote,
          approvedByUserId: access.userId,
          materialId: material.id,
        },
        include: {
          createdByUser: { select: { id: true, name: true, email: true, role: true } },
          approvedByUser: { select: { id: true, name: true, email: true, role: true } },
          terminados: { include: { terminado: { select: { id: true, nombre: true } } } },
          material: { select: { id: true, nombre: true, externalId: true, isCustom: true, customOwnerUserId: true, customSedeId: true } },
        },
      })

      await tx.notification.create({
        data: {
          userId: reqRow.createdByUserId,
          empresaId: access.empresaId,
          sedeId: reqRow.sedeId,
          type: 'SUCCESS',
          title: `Solicitud aprobada: ${reqRow.nombre}`,
          body: decisionNote
            ? `Comentario: ${decisionNote}`
            : 'Un administrador aprobó tu solicitud de producto personalizado. Ya puedes usar el material en el cotizador.',
          actionUrl: '/dashboard/productos?notif=my-custom-requests',
          actionLabel: 'Ver solicitud',
        },
      })

      return { status: 200 as const, row }
    })

    if ('payload' in updated) return updated.payload

    return NextResponse.json({ success: true, data: updated.row }, { status: updated.status })
  } catch (error) {
    console.error('Error decidiendo custom product request:', error)
    return NextResponse.json({ success: false, error: 'Error procesando solicitud' }, { status: 500 })
  }
}
