import { prisma } from '@/lib/prisma'
import { getMetaMessagingDispatchConfig } from '@/lib/crm-meta'
import { logger } from '@/lib/logger'

/**
 * Sincroniza nombres y mensajes faltantes de Messenger/Facebook
 * - Enriquece leads sin nombre haciendo lookup en Graph API
 * - Sincroniza mensajes enviados desde Messenger app (no capturados por webhook)
 * 
 * Corre: cada hora via cron job o manualmente
 * node scripts/sync-messenger-metadata.ts
 */

interface MetaUserProfile {
  id: string
  name?: string
  first_name?: string
  last_name?: string
}

interface MetaMessage {
  id: string
  created_timestamp: number
  from: { id: string; name?: string }
  to?: { data: Array<{ id: string }> }
  message?: string
  sticker?: string
  attachments?: Array<{ type: string; url?: string }>
}

async function metaGet<T>(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value))
    }
  }

  const response = await fetch(`https://graph.facebook.com/v23.0/${path}?${searchParams.toString()}`, {
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Meta API ${response.status}: ${body}`)
  }

  return response.json() as Promise<T>
}

function resolveLeadNamePlaceholder(args: { nombre: string; telefono?: string | null; celular?: string | null; email?: string | null }) {
  const placeholders = new Set([
    'Lead sin nombre',
    args.telefono || '',
    args.celular || '',
    args.email || '',
  ])

  return placeholders.has(args.nombre)
}

function resolveMessageType(message: MetaMessage) {
  if (message.sticker) return 'DOCUMENT' as const

  const attachmentType = message.attachments?.[0]?.type?.toUpperCase()
  if (attachmentType === 'IMAGE' || attachmentType === 'AUDIO' || attachmentType === 'DOCUMENT') {
    return attachmentType
  }

  return 'TEXT' as const
}

async function enrichLeadNames() {
  logger.info('🔄 Iniciando enriquecimiento de nombres de Messenger/Facebook...')

  const conversations = await prisma.crmConversation.findMany({
    where: {
      externalThreadId: { not: null },
      leadId: { not: null },
      channelConnection: {
        provider: { in: ['MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM'] },
      },
    },
    include: {
      lead: true,
      channelConnection: {
        select: {
          id: true,
          provider: true,
          settingsJson: true,
        },
      },
    },
    take: 50, // Procesa 50 por ejecución para no sobrecargar
  })

  logger.info(`📌 Encontradas ${conversations.length} conversaciones Meta para enriquecer`)

  for (const conversation of conversations) {
    try {
      if (!conversation.lead || !conversation.externalThreadId) continue

      const accessToken = getMetaMessagingDispatchConfig(conversation.channelConnection.settingsJson).accessToken
      if (!accessToken) continue

      const shouldUpdateConversationName = !conversation.contactDisplayName
      const shouldUpdateLeadName = resolveLeadNamePlaceholder({
        nombre: conversation.lead.nombre,
        telefono: conversation.lead.telefono,
        celular: conversation.lead.celular,
        email: conversation.lead.email,
      })

      if (!shouldUpdateConversationName && !shouldUpdateLeadName) continue

      // Query Graph API para obtener el perfil del usuario
      const response = await metaGet<MetaUserProfile>(conversation.externalThreadId, {
        fields: 'id,name,first_name,last_name',
        access_token: accessToken,
      })

      const userName = response.name || `${response.first_name || ''} ${response.last_name || ''}`.trim()

      if (userName) {
        await prisma.$transaction([
          ...(shouldUpdateLeadName
            ? [prisma.crmLead.update({
                where: { id: conversation.lead.id },
                data: { nombre: userName },
              })]
            : []),
          ...(shouldUpdateConversationName
            ? [prisma.crmConversation.update({
                where: { id: conversation.id },
                data: { contactDisplayName: userName },
              })]
            : []),
        ])

        logger.info(`✅ Nombre enriquecido: ${conversation.id} → ${userName}`)
      }
    } catch (error) {
      logger.warn(`⚠️ No se pudo enriquecer la conversación ${conversation.id}:`, error instanceof Error ? error.message : String(error))
    }
  }

  logger.info('✨ Enriquecimiento completado')
}

async function syncMessengerConversations() {
  logger.info('🔄 Sincronizando conversaciones de Messenger...')

  // Busca todas las conexiones Meta activas
  const metaConnections = await prisma.crmChannelConnection.findMany({
    where: {
      provider: { in: ['MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM'] },
      status: { in: ['TESTING', 'ACTIVE'] },
    },
    include: {
      conversations: {
        include: {
          messages: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  logger.info(`📌 Sincronizando ${metaConnections.length} conexiones Meta`)

  for (const connection of metaConnections) {
    const accessToken = getMetaMessagingDispatchConfig(connection.settingsJson).accessToken
    if (!accessToken) continue

    for (const conversation of connection.conversations) {
      try {
        if (!conversation.externalThreadId) continue

        // Obtén el último timestamp sincronizado
        const lastMessage = conversation.messages[0]
        const afterTimestamp = lastMessage ? Math.floor(lastMessage.occurredAt.getTime() / 1000) : 0

        logger.info(`📨 Sincronizando conversación ${conversation.id} (último timestamp: ${afterTimestamp})`)

        // Query Graph API para obtener mensajes recientes
        const response = await metaGet<{ data: MetaMessage[] }>(`${conversation.externalThreadId}/messages`, {
          fields: 'id,created_timestamp,from,message,sticker,attachments',
          limit: 25,
          after: afterTimestamp || undefined,
          access_token: accessToken,
        })

        const messages = [...(response.data || [])].sort((a, b) => a.created_timestamp - b.created_timestamp)
        logger.info(`   → Encontrados ${messages.length} mensajes nuevos`)

        // Procesa cada mensaje
        for (const metaMsg of messages) {
          // Verifica si ya existe en la BD
          const existing = await prisma.crmMessage.findFirst({
            where: {
              providerMessageId: metaMsg.id,
              conversationId: conversation.id,
            },
          })

          if (existing) continue

          // Determina dirección (INBOUND = del usuario, OUTBOUND = del CRM/página)
          const isFromPage = metaMsg.from.id === connection.externalPageId || metaMsg.from.id === connection.externalAccountId
          const direction = isFromPage ? 'OUTBOUND' : 'INBOUND'

          // Extrae texto/contenido
          let bodyText = metaMsg.message || null
          const messageType = resolveMessageType(metaMsg)

          if (metaMsg.sticker) {
            bodyText = '[Sticker]'
          } else if (metaMsg.attachments?.length) {
            bodyText = `[${messageType}]`
          }

          // Crea el mensaje
          await prisma.crmMessage.create({
            data: {
              empresaId: conversation.empresaId,
              sedeId: conversation.sedeId,
              conversationId: conversation.id,
              providerMessageId: metaMsg.id,
              direction,
              messageType,
              status: 'RECEIVED',
              bodyText,
              payloadJson: {
                from: metaMsg.from,
                to: metaMsg.to?.data ?? [],
                timestamp: metaMsg.created_timestamp,
                attachments: metaMsg.attachments ?? [],
                ingestionSource: 'SYNC_MESSENGER_METADATA',
              },
              attachmentsJson: metaMsg.attachments ?? [],
              occurredAt: new Date(metaMsg.created_timestamp * 1000),
            },
          })

          await prisma.crmConversation.update({
            where: { id: conversation.id },
            data: {
              contactDisplayName: conversation.contactDisplayName || metaMsg.from.name || undefined,
              directionLastMessage: direction,
              lastMessageAt: new Date(metaMsg.created_timestamp * 1000),
              unreadCount: direction === 'INBOUND' ? { increment: 1 } : undefined,
              firstInboundAt: direction === 'INBOUND' && !conversation.firstInboundAt
                ? new Date(metaMsg.created_timestamp * 1000)
                : undefined,
            },
          })

          logger.info(
            `   ✅ Mensaje sincronizado: ${metaMsg.id} (${direction}) - ${messageType}`
          )

          // Si es INBOUND, enriquece el nombre del lead
          if (direction === 'INBOUND' && !isFromPage && conversation.leadId && metaMsg.from.name) {
            const lead = await prisma.crmLead.findUnique({
              where: { id: conversation.leadId },
              select: { id: true, nombre: true, telefono: true, celular: true, email: true },
            })

            if (lead && resolveLeadNamePlaceholder(lead)) {
              await prisma.crmLead.update({
                where: { id: lead.id },
                data: { nombre: metaMsg.from.name },
              })
            }
          }
        }
      } catch (error) {
        logger.warn(
          `⚠️ Error sincronizando conversación ${conversation.id}:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  }

  logger.info('✨ Sincronización completada')
}

async function main() {
  try {
    logger.info('▶️ Iniciando sync de metadata de Messenger...')
    await enrichLeadNames()
    await syncMessengerConversations()
    logger.info('🎉 Sync completado exitosamente')
  } catch (error) {
    logger.error('❌ Error en sync:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
