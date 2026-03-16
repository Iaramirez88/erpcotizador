import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseOptionalDate,
  parseTaskPriority,
  parseTaskStatus,
} from '@/lib/crm'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmTask.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
      },
    })
    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const explicitSedeId = normalizeString(body?.sedeId)
    const status = Object.prototype.hasOwnProperty.call(body ?? {}, 'status') ? parseTaskStatus(body?.status) : undefined
    const priority = Object.prototype.hasOwnProperty.call(body ?? {}, 'priority') ? parseTaskPriority(body?.priority) : undefined
    const dueAt = parseOptionalDate(body?.dueAt)

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'status') && !status) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'priority') && !priority) {
      return NextResponse.json({ error: 'priority inválido' }, { status: 400 })
    }
    if (dueAt === undefined) return NextResponse.json({ error: 'dueAt inválido' }, { status: 400 })

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') && assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') && explicitSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: explicitSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const nextStatus = status ?? current.status
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmTask.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'title') ? { title: title || current.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description') ? { description: description || null } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(dueAt !== undefined ? { dueAt: dueAt ?? null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'assignedToUserId') ? { assignedToUserId: assignedToUserId || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') ? { sedeId: explicitSedeId || null } : {}),
          ...(nextStatus === 'DONE' ? { completedAt: current.completedAt ?? new Date() } : {}),
          ...(nextStatus !== 'DONE' ? { completedAt: null } : {}),
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, nombre: true } },
          opportunity: { select: { id: true, title: true, stage: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
        },
      })

      if (nextStatus === 'DONE' && current.status !== 'DONE') {
        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: updated.sedeId,
            type: 'TASK_DONE',
            summary: `Tarea completada: ${updated.title}`,
            leadId: updated.leadId,
            opportunityId: updated.opportunityId,
            clienteId: updated.clienteId,
            occurredAt: updated.completedAt ?? new Date(),
            createdById: access.userId,
          },
        })

        if (updated.leadId) {
          await tx.crmLead.update({ where: { id: updated.leadId }, data: { lastActivityAt: updated.completedAt ?? new Date() } })
        }
      }

      return updated
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error actualizando tarea CRM:', error)
    return NextResponse.json({ error: 'Error actualizando tarea CRM' }, { status: 500 })
  }
}