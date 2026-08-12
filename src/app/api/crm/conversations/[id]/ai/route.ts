import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { generateCrmConversationSuggestion, getCrmConversationAiConnectionStatus } from '@/lib/crm-conversation-ai'
import { appendAiWorkspaceHistory, listAiWorkspaceHistory, updateAiWorkspaceHistoryEntry } from '@/lib/ai-workspace-history'
import type { CrmConversationAiContext } from '@/lib/crm-conversation-ai'

export const runtime = 'nodejs'

function getConversationOperationalContext(args: {
  status: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'DISABLED' | 'RESOLVED' | 'SPAM'
  unreadCount: number
  lastMessageAt: string | Date
  hasAssignedTo: boolean
}): Pick<CrmConversationAiContext, 'slaState' | 'priorityLabel'> {
  if (args.status === 'RESOLVED' || args.status === 'DISABLED' || args.status === 'SPAM') {
    return {
      slaState: 'paused' as const,
      priorityLabel: 'Prioridad baja' as const,
    }
  }

  const lastMessageTimestamp = new Date(args.lastMessageAt).getTime()
  const elapsedMinutes = Number.isNaN(lastMessageTimestamp)
    ? 0
    : Math.max(0, Math.round((Date.now() - lastMessageTimestamp) / 60000))

  const warningThreshold = args.unreadCount > 0 || !args.hasAssignedTo ? 5 : 30
  const breachThreshold = args.unreadCount > 0 || !args.hasAssignedTo ? 15 : 60

  const slaState = elapsedMinutes >= breachThreshold
    ? 'breached'
    : elapsedMinutes >= warningThreshold
      ? 'warning'
      : 'healthy'

  const priorityLabel = slaState === 'breached' || args.unreadCount >= 3 || !args.hasAssignedTo
    ? 'Prioridad alta'
    : slaState === 'warning' || args.unreadCount > 0 || args.status === 'PENDING' || args.status === 'BOT_ACTIVE'
      ? 'Prioridad media'
      : 'Prioridad baja'

  return { slaState, priorityLabel }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'IA',
      subdomain: 'COMMERCIAL_AI',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const row = await prisma.crmConversation.findUnique({
      where: { id },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        contactDisplayName: true,
        contactPhone: true,
        contactEmail: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true, status: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        cliente: { select: { id: true, nombre: true } },
        channelConnection: { select: { name: true } },
        messages: {
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
          take: 40,
          select: {
            direction: true,
            bodyText: true,
            occurredAt: true,
            sentByUser: { select: { name: true, email: true } },
          },
        },
      },
    })

    if (!row || row.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (row.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: row.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const messages = row.messages
      .map((message) => ({
        direction: message.direction,
        bodyText: normalizeString(message.bodyText) || null,
        occurredAt: message.occurredAt,
        sentByName: message.sentByUser?.name || message.sentByUser?.email || null,
      }))
      .filter((message) => message.bodyText)

    const transcript = messages
      .map((message) => `${message.direction}:${message.sentByName || ''}:${message.bodyText || ''}`)
      .join('\n')

    const snapshotSignature = crypto
      .createHash('sha1')
      .update(JSON.stringify({
        conversationId: row.id,
        status: row.status,
        leadStatus: row.lead?.status || null,
        opportunityStage: row.opportunity?.stage || null,
        assignedToUserId: row.assignedTo?.id || null,
        transcript,
      }))
      .digest('hex')

    const suggestion = await generateCrmConversationSuggestion({
      contactName: normalizeString(row.contactDisplayName) || normalizeString(row.contactPhone) || normalizeString(row.contactEmail) || null,
      channelName: row.channelConnection.name,
      messages,
      context: {
        conversationStatus: row.status,
        assignedToName: row.assignedTo?.name || row.assignedTo?.email || null,
        assignedToUserId: row.assignedTo?.id || null,
        unreadCount: row.unreadCount,
        isUnassigned: !row.assignedTo,
        ...getConversationOperationalContext({
          status: row.status,
          unreadCount: row.unreadCount,
          lastMessageAt: row.lastMessageAt,
          hasAssignedTo: Boolean(row.assignedTo),
        }),
        lead: row.lead,
        opportunity: row.opportunity,
        cliente: row.cliente,
      },
    })

    const history = await listAiWorkspaceHistory({
      empresaId: access.empresaId,
      limit: 40,
      kinds: ['CRM_CONVERSATION_COPILOT'],
      actorUserId: access.userId,
    })

    const existing = history.find((entry) => (
      entry.kind === 'CRM_CONVERSATION_COPILOT'
      && entry.metadata
      && entry.metadata.conversationId === row.id
      && entry.metadata.snapshotSignature === snapshotSignature
    ))

    const metadata = {
      conversationId: row.id,
      snapshotSignature,
      conversationStatus: row.status,
      assignedToUserId: row.assignedTo?.id || null,
      assignedToLabel: row.assignedTo?.name || row.assignedTo?.email || null,
      unreadCount: row.unreadCount,
      lastMessageAt: row.lastMessageAt.toISOString(),
      leadId: row.lead?.id || null,
      leadStatus: row.lead?.status || null,
      opportunityId: row.opportunity?.id || null,
      opportunityStage: row.opportunity?.stage || null,
      clienteId: row.cliente?.id || null,
      channelName: row.channelConnection.name,
      taskSuggestion: suggestion.taskSuggestion,
      engine: suggestion.engine,
      nextActions: suggestion.nextActions,
    }

    let auditEntryId = existing?.id || null
    if (existing) {
      const updated = await updateAiWorkspaceHistoryEntry({
        empresaId: access.empresaId,
        entryId: existing.id,
        patch: {
          summary: suggestion.summary,
          responseText: suggestion.suggestedReply,
          metadata,
        },
      })
      auditEntryId = updated?.id || existing.id
    } else {
      const created = await appendAiWorkspaceHistory({
        empresaId: access.empresaId,
        entry: {
          kind: 'CRM_CONVERSATION_COPILOT',
          prompt: transcript || `conversation:${row.id}`,
          actorUserId: access.userId,
          actorLabel: access.session.user.name || access.session.user.email || null,
          summary: suggestion.summary,
          responseText: suggestion.suggestedReply,
          metadata,
          asset: null,
        },
      })
      auditEntryId = created.id
    }

    return NextResponse.json({
      success: true,
      data: {
        ...suggestion,
        connection: getCrmConversationAiConnectionStatus(),
        auditEntryId,
      },
    })
  } catch (error) {
    console.error('Error generando sugerencia IA para conversación CRM:', error)
    return NextResponse.json({ error: 'Error generando sugerencia IA para conversación CRM' }, { status: 500 })
  }
}