import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { canAccessHelpTicket, canManageHelpTicket, normalizeHelpTicketAttachments, normalizeText } from '@/lib/help-tickets'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({ domain: 'OPERACIONES', subdomain: 'HELP_TICKETS', action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const ticket = await prisma.helpTicket.findUnique({ where: { id } })
    if (!ticket || !canAccessHelpTicket(access, ticket)) {
      return NextResponse.json({ success: false, error: 'Ticket no encontrado.' }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const bodyText = normalizeText(body?.bodyText, 12000)
    const visibility = body?.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC'
    const attachments = normalizeHelpTicketAttachments(body?.attachments)
    const canManage = canManageHelpTicket(access, ticket)

    if (!bodyText && !attachments.length) return NextResponse.json({ success: false, error: 'Escribe un mensaje o adjunta un archivo.' }, { status: 400 })
    if (visibility === 'INTERNAL' && !canManage) return NextResponse.json({ success: false, error: 'No puedes agregar notas internas.' }, { status: 403 })
    if (['CLOSED', 'CANCELED'].includes(ticket.status)) return NextResponse.json({ success: false, error: 'El ticket está cerrado.' }, { status: 409 })

    const now = new Date()
    const isFirstAgentResponse = canManage && visibility === 'PUBLIC' && !ticket.firstResponseAt
    const shouldResume = !canManage && ticket.status === 'WAITING_CUSTOMER'

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.helpTicketMessage.create({
        data: {
          empresaId: access.empresaId,
          ticketId: ticket.id,
          authorId: access.userId,
          visibility,
          bodyText: bodyText || 'Adjunto',
          attachmentsJson: attachments,
        },
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
      })

      await tx.helpTicketActivity.create({
        data: {
          empresaId: access.empresaId,
          ticketId: ticket.id,
          actorId: access.userId,
          type: visibility === 'INTERNAL' ? 'INTERNAL_NOTE_ADDED' : 'MESSAGE_ADDED',
          summary: visibility === 'INTERNAL' ? 'Nota interna agregada' : 'Respuesta pública agregada',
          metadata: { messageId: message.id, attachments: attachments.length },
        },
      })

      if (isFirstAgentResponse || shouldResume) {
        await tx.helpTicket.update({
          where: { id: ticket.id },
          data: {
            ...(isFirstAgentResponse ? { firstResponseAt: now } : {}),
            ...(shouldResume ? { status: 'IN_PROGRESS', waitingSince: null, startedAt: ticket.startedAt ?? now } : {}),
          },
        })
        if (shouldResume) {
          await tx.helpTicketActivity.create({ data: { empresaId: access.empresaId, ticketId: ticket.id, actorId: access.userId, type: 'STATUS_CHANGED', summary: 'Cliente respondió; ticket reanudado', metadata: { from: 'WAITING_CUSTOMER', to: 'IN_PROGRESS' } } })
        }
      }

      return message
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Error agregando mensaje al ticket:', error)
    return NextResponse.json({ success: false, error: 'No se pudo enviar el mensaje.' }, { status: 500 })
  }
}
