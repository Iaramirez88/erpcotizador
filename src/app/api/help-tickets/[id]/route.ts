import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  activityTypeForStatus,
  canAccessHelpTicket,
  canManageHelpTicket,
  helpTicketDetailInclude,
  normalizeText,
  parseHelpTicketPriority,
  parseHelpTicketStatus,
} from '@/lib/help-tickets'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({ domain: 'OPERACIONES', subdomain: 'HELP_TICKETS', action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const ticket = await prisma.helpTicket.findUnique({ where: { id }, include: helpTicketDetailInclude })
    if (!ticket || !canAccessHelpTicket(access, ticket)) {
      return NextResponse.json({ success: false, error: 'Ticket no encontrado.' }, { status: 404 })
    }

    const canManage = canManageHelpTicket(access, ticket)
    return NextResponse.json({
      success: true,
      data: {
        ...ticket,
        messages: canManage ? ticket.messages : ticket.messages.filter((message) => message.visibility === 'PUBLIC'),
      },
      meta: { canManage },
    })
  } catch (error) {
    console.error('Error cargando ticket de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar el ticket.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({ domain: 'OPERACIONES', subdomain: 'HELP_TICKETS', action: 'UPDATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.helpTicket.findUnique({ where: { id } })
    if (!current || !canAccessHelpTicket(access, current)) {
      return NextResponse.json({ success: false, error: 'Ticket no encontrado.' }, { status: 404 })
    }
    if (!canManageHelpTicket(access, current)) {
      return NextResponse.json({ success: false, error: 'No tienes permiso para gestionar este ticket.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nextStatus = body?.status === undefined ? null : parseHelpTicketStatus(body.status)
    const nextPriority = body?.priority === undefined ? null : parseHelpTicketPriority(body.priority)
    const assignedToId = body?.assignedToId === undefined ? undefined : normalizeText(body.assignedToId, 80) || null
    const category = body?.category === undefined ? undefined : normalizeText(body.category, 80)
    const moduleName = body?.module === undefined ? undefined : normalizeText(body.module, 80) || null
    const submodule = body?.submodule === undefined ? undefined : normalizeText(body.submodule, 80) || null

    if (body?.status !== undefined && !nextStatus) return NextResponse.json({ success: false, error: 'Estado inválido.' }, { status: 400 })
    if (body?.priority !== undefined && !nextPriority) return NextResponse.json({ success: false, error: 'Prioridad inválida.' }, { status: 400 })
    if (body?.category !== undefined && !category) return NextResponse.json({ success: false, error: 'Categoría inválida.' }, { status: 400 })

    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, empresaId: access.empresaId, sedeMemberships: { some: { sedeId: access.sedeId } } },
        select: { id: true },
      })
      if (!assignee) return NextResponse.json({ success: false, error: 'Responsable inválido.' }, { status: 400 })
    }

    const now = new Date()
    const data: Prisma.HelpTicketUncheckedUpdateInput = {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextPriority ? { priority: nextPriority } : {}),
      ...(assignedToId !== undefined ? { assignedToId, assignedAt: assignedToId ? now : null } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(moduleName !== undefined ? { module: moduleName } : {}),
      ...(submodule !== undefined ? { submodule } : {}),
    }

    if (nextStatus && nextStatus !== current.status) {
      if (nextStatus === 'IN_PROGRESS' && !current.startedAt) data.startedAt = now
      data.waitingSince = nextStatus === 'WAITING_CUSTOMER' ? now : null
      if (nextStatus === 'RESOLVED') data.resolvedAt = now
      if (nextStatus === 'CLOSED') data.closedAt = now
      if (!['RESOLVED', 'CLOSED'].includes(nextStatus)) {
        if (current.status === 'RESOLVED') data.resolvedAt = null
        if (current.status === 'CLOSED') data.closedAt = null
      }
    }

    const activities: Prisma.HelpTicketActivityCreateWithoutTicketInput[] = []
    if (nextStatus && nextStatus !== current.status) {
      activities.push({
        empresa: { connect: { id: access.empresaId } },
        actor: { connect: { id: access.userId } },
        type: current.status === 'RESOLVED' && nextStatus !== 'CLOSED' ? 'REOPENED' : activityTypeForStatus(nextStatus),
        summary: `Estado: ${current.status} → ${nextStatus}`,
        metadata: { from: current.status, to: nextStatus },
      })
    }
    if (nextPriority && nextPriority !== current.priority) {
      activities.push({ empresa: { connect: { id: access.empresaId } }, actor: { connect: { id: access.userId } }, type: 'PRIORITY_CHANGED', summary: `Prioridad: ${current.priority} → ${nextPriority}`, metadata: { from: current.priority, to: nextPriority } })
    }
    if (assignedToId !== undefined && assignedToId !== current.assignedToId) {
      activities.push({ empresa: { connect: { id: access.empresaId } }, actor: { connect: { id: access.userId } }, type: 'ASSIGNED', summary: assignedToId ? 'Responsable actualizado' : 'Ticket sin responsable', metadata: { from: current.assignedToId, to: assignedToId } })
    }
    if (category !== undefined && category !== current.category) {
      activities.push({ empresa: { connect: { id: access.empresaId } }, actor: { connect: { id: access.userId } }, type: 'CATEGORY_CHANGED', summary: `Categoría: ${current.category} → ${category}`, metadata: { from: current.category, to: category } })
    }
    if (activities.length) data.activities = { create: activities }

    const ticket = await prisma.helpTicket.update({ where: { id }, data, include: helpTicketDetailInclude })
    return NextResponse.json({ success: true, data: ticket, meta: { canManage: true } })
  } catch (error) {
    console.error('Error actualizando ticket de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el ticket.' }, { status: 500 })
  }
}
