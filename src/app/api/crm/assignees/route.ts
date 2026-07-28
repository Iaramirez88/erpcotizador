import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const [rows, activeConversations] = await Promise.all([
      prisma.user.findMany({
        where: { empresaId: access.empresaId },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          sedeDefaultId: true,
          lastLoginAt: true,
          sedeMemberships: {
            select: { sedeId: true, role: true },
          },
        },
        take: 200,
      }),
      prisma.crmConversation.findMany({
        where: {
          empresaId: access.empresaId,
          assignedToUserId: { not: null },
          status: { in: ['OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE'] },
        },
        select: {
          assignedToUserId: true,
          status: true,
          unreadCount: true,
          lastMessageAt: true,
        },
      }),
    ])
    const conversationBuckets = new Map<string, { activeCount: number; immediateCount: number; waitingCustomerCount: number; unreadCount: number }>()
    for (const row of activeConversations) {
      if (!row.assignedToUserId) continue
      const bucket = conversationBuckets.get(row.assignedToUserId) ?? { activeCount: 0, immediateCount: 0, waitingCustomerCount: 0, unreadCount: 0 }
      bucket.activeCount += 1
      bucket.unreadCount += row.unreadCount || 0

      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - row.lastMessageAt.getTime()) / 60000))
      const breachThreshold = row.unreadCount > 0 ? 15 : 60
      if (elapsedMinutes >= breachThreshold || row.unreadCount >= 3) {
        bucket.immediateCount += 1
      }
      if (row.status === 'PENDING') {
        bucket.waitingCustomerCount += 1
      }

      conversationBuckets.set(row.assignedToUserId, bucket)
    }

    const data = rows.map((row) => {
      const bucket = conversationBuckets.get(row.id)
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        image: row.image,
        role: row.role,
        sedeDefaultId: row.sedeDefaultId,
        sedeMembershipIds: row.sedeMemberships.map((membership) => membership.sedeId),
        lastLoginAt: row.lastLoginAt,
        activeCount: bucket?.activeCount ?? 0,
        immediateCount: bucket?.immediateCount ?? 0,
        waitingCustomerCount: bucket?.waitingCustomerCount ?? 0,
        unreadCount: bucket?.unreadCount ?? 0,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listando usuarios asignables CRM:', error)
    return NextResponse.json({ error: 'Error listando usuarios asignables CRM' }, { status: 500 })
  }
}