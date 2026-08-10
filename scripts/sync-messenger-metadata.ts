import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import axios from 'axios'

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

async function enrichLeadNames() {
  logger.info('🔄 Iniciando enriquecimiento de nombres de Messenger/Facebook...')

  // Buscar leads sin nombre en canales Meta (MESSENGER, FACEBOOK_PAGE, INSTAGRAM_DM)
  const leadsWithoutNames = await prisma.crmLead.findMany({
    where: {
      nombre: null,
      externalThreadId: { not: null },
      conversation: {
        channelConnection: {
          provider: { in: ['MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM'] },
        },
      },
    },
    include: {
      conversation: {
        include: {
          channelConnection: true,
        },
      },
    },
    take: 50, // Procesa 50 por ejecución para no sobrecargar
  })

  logger.info(`📌 Encontrados ${leadsWithoutNames.length} leads sin nombre`)

  for (const lead of leadsWithoutNames) {
    try {
      const { externalThreadId, conversation } = lead
      const { channelConnection } = conversation

      if (!channelConnection.accessToken || !externalThreadId) continue

      // Query Graph API para obtener el perfil del usuario
      const response = await axios.get<MetaUserProfile>(
        `https://graph.instagram.com/v23.0/${externalThreadId}`,
        {
          params: {
            fields: 'id,name,first_name,last_name',
            access_token: channelConnection.accessToken,
          },
          timeout: 5000,
        }
      )

      const userName = response.data.name || `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim()

      if (userName) {
        await prisma.crmLead.update({
          where: { id: lead.id },
          data: { nombre: userName },
        })
        logger.info(`✅ Nombre enriquecido: ${lead.id} → ${userName}`)
      }
    } catch (error) {
      logger.warn(`⚠️ No se pudo obtener nombre para lead ${lead.id}:`, error instanceof Error ? error.message : String(error))
    }
  }

  logger.info('✨ Enriquecimiento completado')
}

async function syncMessengerConversations() {
  logger.info('🔄 Sincronizando conversaciones de Messenger...')

  // Busca todas las conexiones Meta activas
  const metaConnections = await prisma.crmChannelConnection.findMany({
    where: {
      provider: { in: ['MESSENGER', 'FACEBOOK_PAGE'] },
      isActive: true,
    },
    include: {
      conversations: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  logger.info(`📌 Sincronizando ${metaConnections.length} conexiones Meta`)

  for (const connection of metaConnections) {
    if (!connection.accessToken) continue

    for (const conversation of connection.conversations) {
      try {
        // Obtén el último timestamp sincronizado
        const lastMessage = conversation.messages[0]
        const afterTimestamp = lastMessage ? Math.floor(lastMessage.createdAt.getTime() / 1000) : 0

        logger.info(`📨 Sincronizando conversación ${conversation.id} (último timestamp: ${afterTimestamp})`)

        // Query Graph API para obtener mensajes recientes
        const conversationId = conversation.externalThreadId
        if (!conversationId) continue

        const response = await axios.get<{ data: MetaMessage[] }>(
          `https://graph.instagram.com/v23.0/${conversationId}/messages`,
          {
            params: {
              fields: 'id,created_timestamp,from,message,sticker,attachments',
              limit: 25,
              after: afterTimestamp ? Math.floor(afterTimestamp / 1000) : undefined,
              access_token: connection.accessToken,
            },
            timeout: 5000,
          }
        )

        const messages = response.data.data || []
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
          const isFromPage = metaMsg.from.id === connection.externalResourceId
          const direction = isFromPage ? 'OUTBOUND' : 'INBOUND'

          // Extrae texto/contenido
          let bodyText = metaMsg.message || null
          let messageType = 'TEXT'

          if (metaMsg.sticker) {
            messageType = 'STICKER'
            bodyText = '[Sticker]'
          } else if (metaMsg.attachments?.length) {
            const attachment = metaMsg.attachments[0]
            messageType = attachment.type.toUpperCase() || 'ATTACHMENT'
            bodyText = `[${messageType}]`
          }

          // Crea el mensaje
          const createdMessage = await prisma.crmMessage.create({
            data: {
              conversationId: conversation.id,
              providerMessageId: metaMsg.id,
              eventDirection: direction,
              messageType: messageType as any,
              bodyText,
              bodyJson: {
                from: metaMsg.from.name || metaMsg.from.id,
                timestamp: metaMsg.created_timestamp,
                attachments: metaMsg.attachments,
              },
              externalThreadId: metaMsg.from.id,
              createdAt: new Date(metaMsg.created_timestamp * 1000),
            },
          })

          logger.info(
            `   ✅ Mensaje sincronizado: ${metaMsg.id} (${direction}) - ${messageType}`
          )

          // Si es INBOUND, enriquece el nombre del lead
          if (direction === 'INBOUND' && !isFromPage) {
            const lead = await prisma.crmLead.findFirst({
              where: {
                conversationId: conversation.id,
                externalThreadId: metaMsg.from.id,
              },
            })

            if (lead && !lead.nombre && metaMsg.from.name) {
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
