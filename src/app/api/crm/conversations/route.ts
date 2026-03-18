import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString, parseConversationStatus } from '@/lib/crm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const assignedToUserId = normalizeString(searchParams.get('assignedToUserId'))
    const channelConnectionId = normalizeString(searchParams.get('channelConnectionId'))
    const provider = normalizeString(searchParams.get('provider'))
    const status = parseConversationStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmConversation.findMany({
      where: {
        empresaId: access.empresaId,
        ...(sedeId ? { sedeId } : {}),
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(channelConnectionId ? { channelConnectionId } : {}),
        ...(provider ? { channelConnection: { provider: provider as never } } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { contactDisplayName: { contains: search, mode: 'insensitive' } },
                { contactPhone: { contains: search, mode: 'insensitive' } },
                { contactEmail: { contains: search, mode: 'insensitive' } },
                { lead: { nombre: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
                { opportunity: { title: { contains: search, mode: 'insensitive' } } },
                { messages: { some: { bodyText: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        channelConnection: { select: { id: true, name: true, provider: true, status: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true, status: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        messages: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: {
            id: true,
            direction: true,
            messageType: true,
            status: true,
            bodyText: true,
            occurredAt: true,
            sentByUser: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { messages: true, captures: true } },
      },
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando conversaciones CRM:', error)
    return NextResponse.json({ error: 'Error listando conversaciones CRM' }, { status: 500 })
  }
}