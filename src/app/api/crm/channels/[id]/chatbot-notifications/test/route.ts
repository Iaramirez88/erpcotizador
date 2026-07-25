import { AccessLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { getDefaultChatbotQuickActionAutomationConfig, type ChatbotQuickActionNotificationConfig } from '@/lib/crm-chatbot-flow'
import { dispatchChatbotActionNotifications, normalizeChatbotNotificationChannels } from '@/lib/chatbot-notifications'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeNotificationConfig(value: unknown): ChatbotQuickActionNotificationConfig {
  const defaults = getDefaultChatbotQuickActionAutomationConfig().notifications
  const record = asRecord(value)

  return {
    ...defaults,
    notifyOtherContact: Boolean(record?.notifyOtherContact),
    targetContact: normalizeString(record?.targetContact),
    startA360Event: Boolean(record?.startA360Event),
    a360EventName: normalizeString(record?.a360EventName),
    notifyMe: Boolean(record?.notifyMe),
    notifyChannels: Array.isArray(record?.notifyChannels)
      ? record.notifyChannels.map((item) => normalizeString(item)).filter(Boolean)
      : defaults.notifyChannels,
    notifyRecipients: normalizeString(record?.notifyRecipients),
    emailRecipients: normalizeString(record?.emailRecipients),
    whatsappRecipients: normalizeString(record?.whatsappRecipients),
    telegramRecipients: normalizeString(record?.telegramRecipients),
    whatsappChannelId: normalizeString(record?.whatsappChannelId),
    addNote: Boolean(record?.addNote),
    noteText: normalizeString(record?.noteText),
    sendWebhook: Boolean(record?.sendWebhook),
    webhookUrl: normalizeString(record?.webhookUrl),
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        name: true,
        empresaId: true,
        sedeId: true,
        provider: true,
        status: true,
        createdBy: { select: { id: true } },
      },
    })

    if (!channel || channel.provider !== 'WEB_CHATBOT') {
      return NextResponse.json({ error: 'Canal chatbot no encontrado.' }, { status: 404 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const actionLabel = normalizeString(body?.actionLabel) || 'Prueba manual del Studio'
    const companyName = normalizeString(body?.companyName)
    const notificationConfig = normalizeNotificationConfig(body?.notifications)
    const selectedChannels = Array.from(normalizeChatbotNotificationChannels(notificationConfig.notifyChannels))

    if (!notificationConfig.notifyMe) {
      return NextResponse.json({ error: 'La acción no tiene Notificarme activo.' }, { status: 400 })
    }

    if (!selectedChannels.length) {
      return NextResponse.json({ error: 'Selecciona al menos un canal para la prueba.' }, { status: 400 })
    }

    if (selectedChannels.includes('telegram') && !notificationConfig.telegramRecipients.trim() && !notificationConfig.notifyRecipients.toLowerCase().includes('tg:')) {
      return NextResponse.json({ error: 'Telegram requiere al menos un destinatario con formato tg:chatId para la prueba.' }, { status: 400 })
    }

    const actorLabel = normalizeString(access.session.user?.name) || normalizeString(access.session.user?.email) || 'usuario actual'
    const channelLabel = normalizeString(channel.name) || 'canal chatbot'
    const bodyText = [
      `Prueba manual de notificacion desde el Studio.`,
      `Accion: ${actionLabel}`,
      `Canal: ${channelLabel}`,
      `Ejecutado por: ${actorLabel}`,
      'Este mensaje confirma que la configuracion actual de Notificarme puede despachar por los canales seleccionados.',
    ].join('\n')

    const result = await dispatchChatbotActionNotifications({
      db: prisma,
      empresaId: channel.empresaId,
      sedeId: channel.sedeId,
      createdByUserId: channel.createdBy.id,
      fallbackUserIds: [access.userId],
      notificationConfig,
      actionLabel,
      notificationBodyText: bodyText,
      companyName,
      internalNotificationBody: `Prueba manual ejecutada para ${actionLabel}. Canales: ${selectedChannels.join(', ')}`,
      internalNotificationActionUrl: '/dashboard/crm',
      internalNotificationActionLabel: 'Abrir CRM',
    })

    return NextResponse.json({
      success: true,
      data: {
        actionLabel,
        channels: result.normalizedChannels,
        counts: result.counts,
        warnings: result.warnings,
      },
    })
  } catch (error) {
    console.error('Error enviando prueba de notificacion del chatbot:', error)
    return NextResponse.json({ error: 'No se pudo enviar la prueba de notificacion.' }, { status: 500 })
  }
}
