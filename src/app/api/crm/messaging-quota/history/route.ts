import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const channelId = normalizeString(searchParams.get('channelId')) || null
    const provider = normalizeString(searchParams.get('provider')) || null
    const status = normalizeString(searchParams.get('status')) || null
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const limit = Math.min(100, Number.parseInt(searchParams.get('limit') || '50', 10) || 50)
    const page = Math.max(0, Number.parseInt(searchParams.get('page') || '0', 10) || 0)

    const conversationFilter: Record<string, unknown> = {}
    if (channelId) conversationFilter.channelConnectionId = channelId
    if (provider) conversationFilter.channelConnection = { provider }

    const where: Record<string, unknown> = {
      empresaId: access.empresaId,
      direction: 'OUTBOUND',
      providerMessageId: { not: null },
    }
    if (Object.keys(conversationFilter).length) where.conversation = conversationFilter
    if (status) where.status = status

    const occurredAt: Record<string, Date> = {}
    if (fromRaw) occurredAt.gte = new Date(fromRaw)
    if (toRaw) occurredAt.lte = new Date(toRaw)
    if (Object.keys(occurredAt).length) where.occurredAt = occurredAt

    const [rows, total] = await Promise.all([
      prisma.crmMessage.findMany({
        where,
        include: {
          conversation: {
            select: {
              channelConnection: { select: { name: true, provider: true } },
              contactDisplayName: true,
              contactPhone: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: page * limit,
      }),
      prisma.crmMessage.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        total,
        page,
        limit,
        rows: rows.map((row) => ({
          id: row.id,
          occurredAt: row.occurredAt,
          status: row.status,
          messageType: row.messageType,
          bodyText: row.bodyText,
          channelName: row.conversation.channelConnection?.name ?? null,
          provider: row.conversation.channelConnection?.provider ?? null,
          contactDisplayName: row.conversation?.contactDisplayName ?? null,
          contactPhone: row.conversation?.contactPhone ?? null,
        })),
      },
    })
  } catch (error) {
    console.error('Error obteniendo historial de mensajería:', error)
    return NextResponse.json({ error: 'Error obteniendo historial de mensajería' }, { status: 500 })
  }
}
