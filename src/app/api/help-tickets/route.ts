import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  helpTicketListInclude,
  isHelpTicketManager,
  normalizeText,
  parseHelpTicketChannel,
  parseHelpTicketPriority,
  parseHelpTicketStatus,
  parseHelpTicketType,
} from '@/lib/help-tickets'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'HELP_TICKETS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeText(searchParams.get('search'), 120)
    const status = parseHelpTicketStatus(searchParams.get('status'))
    const priority = parseHelpTicketPriority(searchParams.get('priority'))
    const assignedToId = normalizeText(searchParams.get('assignedToId'), 80)
    const view = searchParams.get('view')
    const manager = isHelpTicketManager(access)

    const where: Prisma.HelpTicketWhereInput = {
      empresaId: access.empresaId,
      sedeId: access.sedeId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(!manager || view === 'mine'
        ? { OR: [{ requesterId: access.userId }, { assignedToId: access.userId }] }
        : {}),
      ...(search
        ? {
            AND: [{
              OR: [
                { number: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { module: { contains: search, mode: 'insensitive' } },
                { requester: { name: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
              ],
            }],
          }
        : {}),
    }

    const [tickets, statusGroups] = await Promise.all([
      prisma.helpTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        include: helpTicketListInclude,
        take: 200,
      }),
      prisma.helpTicket.groupBy({
        by: ['status'],
        where: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          ...(!manager ? { OR: [{ requesterId: access.userId }, { assignedToId: access.userId }] } : {}),
        },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: tickets,
      meta: {
        canManageAll: manager,
        currentUserId: access.userId,
        counts: Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])),
      },
    })
  } catch (error) {
    console.error('Error listando tickets de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los tickets.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'HELP_TICKETS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const subject = normalizeText(body?.subject, 180)
    const description = normalizeText(body?.description, 12000)
    const category = normalizeText(body?.category, 80)
    const moduleName = normalizeText(body?.module, 80)
    const submodule = normalizeText(body?.submodule, 80)
    const clienteId = normalizeText(body?.clienteId, 80)
    const linkedEntityType = normalizeText(body?.linkedEntityType, 80)
    const linkedEntityId = normalizeText(body?.linkedEntityId, 100)
    const priority = parseHelpTicketPriority(body?.priority) ?? 'MEDIUM'
    const type = parseHelpTicketType(body?.type) ?? 'REQUEST'
    const channel = parseHelpTicketChannel(body?.channel) ?? 'WEB_PANEL'

    if (!subject || !description || !category) {
      return NextResponse.json({ success: false, error: 'Asunto, descripción y categoría son obligatorios.' }, { status: 400 })
    }

    if (clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: clienteId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!cliente) return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
    }

    const year = new Date().getFullYear()
    const ticket = await prisma.$transaction(async (tx) => {
      const sequence = await tx.helpTicketSequence.upsert({
        where: { sedeId_year: { sedeId: access.sedeId, year } },
        create: { sedeId: access.sedeId, year, currentNumber: 1 },
        update: { currentNumber: { increment: 1 } },
        select: { currentNumber: true },
      })
      const number = `TKT-${year}-${String(sequence.currentNumber).padStart(6, '0')}`

      return tx.helpTicket.create({
        data: {
          number,
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          requesterId: access.userId,
          clienteId: clienteId || null,
          subject,
          description,
          category,
          module: moduleName || null,
          submodule: submodule || null,
          priority,
          type,
          channel,
          linkedEntityType: linkedEntityType || null,
          linkedEntityId: linkedEntityId || null,
          activities: {
            create: {
              empresaId: access.empresaId,
              actorId: access.userId,
              type: 'CREATED',
              summary: 'Ticket creado',
              metadata: { channel, priority, category },
            },
          },
        },
        include: helpTicketListInclude,
      })
    })

    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch (error) {
    console.error('Error creando ticket de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudo crear el ticket.' }, { status: 500 })
  }
}
