import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'
import {
  agendaCalendarInclude,
  getAccessibleAgendaCalendars,
  getAgendaCalendarKindMeta,
  normalizeAgendaCalendarColor,
  normalizeAgendaCalendarDescription,
  normalizeAgendaCalendarMemberIds,
  normalizeAgendaCalendarName,
  parseAgendaCalendarKind,
  parseAgendaCalendarVisibility,
} from '@/lib/crm-agenda-calendars'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const calendars = await getAccessibleAgendaCalendars(prisma, {
      empresaId: access.empresaId,
      userId: access.userId,
    })

    return NextResponse.json({ success: true, data: calendars, currentUserId: access.userId })
  } catch (error) {
    console.error('Error listando calendarios de agenda:', error)
    return NextResponse.json({ error: 'Error listando calendarios de agenda' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeAgendaCalendarName(body?.name)
    if (!name) return NextResponse.json({ error: 'El nombre del calendario es obligatorio.' }, { status: 400 })

    const kind = parseAgendaCalendarKind(body?.kind)
    const kindMeta = getAgendaCalendarKindMeta(kind)
    const colorHex = normalizeAgendaCalendarColor(body?.colorHex ?? kindMeta.colorHex)
    const visibility = parseAgendaCalendarVisibility(body?.visibility)
    const description = normalizeAgendaCalendarDescription(body?.description)
    const memberUserIds = normalizeAgendaCalendarMemberIds(body?.memberUserIds).filter((id) => id !== access.userId)

    if (memberUserIds.length) {
      const members = await prisma.user.findMany({
        where: { id: { in: memberUserIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (members.length !== memberUserIds.length) {
        return NextResponse.json({ error: 'Uno de los usuarios invitados no pertenece a la empresa.' }, { status: 400 })
      }
    }

    const calendar = await prisma.$transaction(async (tx) => {
      const created = await tx.crmAgendaCalendar.create({
        data: {
          empresaId: access.empresaId,
          name,
          description: description || null,
          colorHex,
          kind,
          visibility,
          ownerUserId: access.userId,
          createdById: access.userId,
        },
      })

      await tx.crmAgendaCalendarMember.createMany({
        data: [access.userId, ...memberUserIds].map((userId) => ({
          empresaId: access.empresaId,
          calendarId: created.id,
          userId,
          role: userId === access.userId ? 'OWNER' : 'VIEWER',
        })),
      })

      return tx.crmAgendaCalendar.findUniqueOrThrow({ where: { id: created.id }, include: agendaCalendarInclude })
    })

    return NextResponse.json({ success: true, data: calendar }, { status: 201 })
  } catch (error) {
    console.error('Error creando calendario de agenda:', error)
    return NextResponse.json({ error: 'Error creando calendario de agenda' }, { status: 500 })
  }
}
