import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

const ACCESS_LEVEL_ORDER: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
}

function sedeRoleToBaseAccess(role: SedeRole): AccessLevel {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN'
    case 'MANAGER':
      return 'WRITE'
    case 'MEMBER':
      return 'WRITE'
    case 'READER':
    default:
      return 'READ'
  }
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const [rows, activeConversations] = await Promise.all([
      prisma.user.findMany({
        where: { empresaId: access.empresaId },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sedeDefaultId: true,
          lastLoginAt: true,
          globalAccess: { select: { level: true } },
          sedeMemberships: {
            where: { sedeId: access.sedeId },
            select: { sedeId: true, role: true },
          },
          moduleAccess: {
            where: { sedeId: access.sedeId, module: ModuleKey.CRM },
            select: { sedeId: true, level: true },
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

    const eligibleRows = rows.filter((row) => {
      const globalBase = row.globalAccess?.level ?? 'NONE'
      const membership = row.sedeMemberships[0]
      const base = membership ? sedeRoleToBaseAccess(membership.role) : globalBase
      const explicit = row.moduleAccess[0]?.level
      const effective = explicit ?? base
      return ACCESS_LEVEL_ORDER[effective] >= ACCESS_LEVEL_ORDER.WRITE
    })

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

    const data = eligibleRows.map((row) => {
      const bucket = conversationBuckets.get(row.id)
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        sedeDefaultId: row.sedeDefaultId,
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