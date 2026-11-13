import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'
import {
  agendaCalendarInclude,
  canManageAgendaCalendar,
  getAgendaCalendarKindMeta,
  getAgendaCalendarRole,
  normalizeAgendaCalendarColor,
  normalizeAgendaCalendarDescription,
  normalizeAgendaCalendarMemberIds,
  normalizeAgendaCalendarName,
  parseAgendaCalendarKind,
  parseAgendaCalendarVisibility,
} from '@/lib/crm-agenda-calendars'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const existing = await prisma.crmAgendaCalendar.findFirst({
      where: { id, empresaId: access.empresaId, archivedAt: null },
      include: agendaCalendarInclude,
    })
    if (!existing) return NextResponse.json({ error: 'Calendario no encontrado.' }, { status: 404 })
    if (!canManageAgendaCalendar(existing, access.userId)) {
      return NextResponse.json({ error: 'No tienes permisos para editar este calendario.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const data: Prisma.CrmAgendaCalendarUpdateInput = {}

    if (body?.name !== undefined) {
      const name = normalizeAgendaCalendarName(body.name)
      if (!name) return NextResponse.json({ error: 'El nombre del calendario es obligatorio.' }, { status: 400 })
      data.name = name
    }
    if (body?.description !== undefined) {
      data.description = normalizeAgendaCalendarDescription(body.description) || null
    }
    if (body?.kind !== undefined) {
      const kind = parseAgendaCalendarKind(body.kind)
      data.kind = kind
      if (body?.colorHex === undefined) data.colorHex = getAgendaCalendarKindMeta(kind).colorHex
    }
    if (body?.colorHex !== undefined) {
      data.colorHex = normalizeAgendaCalendarColor(body.colorHex)
    }
    if (body?.visibility !== undefined) {
      data.visibility = parseAgendaCalendarVisibility(body.visibility)
    }

    let memberUserIds: string[] | null = null
    if (body?.memberUserIds !== undefined) {
      memberUserIds = normalizeAgendaCalendarMemberIds(body.memberUserIds)
        .filter((userId) => userId !== access.userId && userId !== existing.ownerUserId && userId !== existing.createdById)
      if (memberUserIds.length) {
        const members = await prisma.user.findMany({
          where: { id: { in: memberUserIds }, empresaId: access.empresaId },
          select: { id: true },
        })
        if (members.length !== memberUserIds.length) {
          return NextResponse.json({ error: 'Uno de los usuarios invitados no pertenece a la empresa.' }, { status: 400 })
        }
      }
    }

    const calendar = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.crmAgendaCalendar.update({ where: { id }, data })
      }

      if (memberUserIds) {
        const keepUserIds = Array.from(new Set([
          access.userId,
          ...(existing.ownerUserId ? [existing.ownerUserId] : []),
          existing.createdById,
          ...memberUserIds,
        ]))
        await tx.crmAgendaCalendarMember.deleteMany({
          where: { calendarId: id, userId: { notIn: keepUserIds } },
        })
        if (memberUserIds.length) {
          await tx.crmAgendaCalendarMember.createMany({
            data: memberUserIds.map((userId) => ({
              empresaId: access.empresaId,
              calendarId: id,
              userId,
              role: 'VIEWER',
            })),
            skipDuplicates: true,
          })
        }
      }

      return tx.crmAgendaCalendar.findUniqueOrThrow({ where: { id }, include: agendaCalendarInclude })
    })

    return NextResponse.json({
      success: true,
      data: {
        ...calendar,
        canManage: canManageAgendaCalendar(calendar, access.userId),
        role: getAgendaCalendarRole(calendar, access.userId),
      },
    })
  } catch (error) {
    console.error('Error actualizando calendario de agenda:', error)
    return NextResponse.json({ error: 'Error actualizando calendario de agenda' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const existing = await prisma.crmAgendaCalendar.findFirst({
      where: { id, empresaId: access.empresaId, archivedAt: null },
      include: agendaCalendarInclude,
    })
    if (!existing) return NextResponse.json({ error: 'Calendario no encontrado.' }, { status: 404 })
    if (getAgendaCalendarRole(existing, access.userId) !== 'OWNER') {
      return NextResponse.json({ error: 'Solo el propietario puede archivar el calendario.' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.crmTask.updateMany({ where: { calendarId: id }, data: { calendarId: null } }),
      prisma.crmAgendaCalendar.update({ where: { id }, data: { archivedAt: new Date() } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error archivando calendario de agenda:', error)
    return NextResponse.json({ error: 'Error archivando calendario de agenda' }, { status: 500 })
  }
}
