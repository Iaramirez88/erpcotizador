import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicChatbotSettings, getRequestHost, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'

export const runtime = 'nodejs'

type MaterialMatch = {
  id: string
  nombre: string
  imagenUrl: string | null
  precioM2: number | null
  precioMetro: number | null
  precioUnidad: number | null
  stockActual: number
  unidadMedida: string
}

type ChatFlowNextField = 'name' | 'email' | 'phone' | 'product' | 'quantity' | null

function splitSearchTerms(value: string) {
  return Array.from(
    new Set(
      normalizeString(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3),
    ),
  ).slice(0, 6)
}

function scoreMaterialMatch(material: MaterialMatch, query: string) {
  const normalizedQuery = normalizeString(query).toLowerCase()
  const normalizedName = normalizeString(material.nombre).toLowerCase()
  if (normalizedName === normalizedQuery) return 100
  if (normalizedName.startsWith(normalizedQuery)) return 80
  if (normalizedName.includes(normalizedQuery)) return 60

  const terms = splitSearchTerms(query)
  return terms.reduce((score, term) => (normalizedName.includes(term) ? score + 10 : score), 0)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMaterialPrice(material: MaterialMatch) {
  if (typeof material.precioUnidad === 'number' && Number.isFinite(material.precioUnidad) && material.precioUnidad > 0) {
    return `${formatMoney(material.precioUnidad)} por unidad`
  }
  if (typeof material.precioMetro === 'number' && Number.isFinite(material.precioMetro) && material.precioMetro > 0) {
    return `${formatMoney(material.precioMetro)} por metro lineal`
  }
  if (typeof material.precioM2 === 'number' && Number.isFinite(material.precioM2) && material.precioM2 > 0) {
    return `${formatMoney(material.precioM2)} por m2`
  }
  return 'Precio a confirmar con asesor'
}

function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0]?.trim() || ''
}

function extractPhone(value: string) {
  const digits = value.replace(/\D+/g, '')
  return digits.length >= 7 ? digits : ''
}

function extractName(value: string) {
  const patterns = [
    /me llamo\s+([a-záéíóúñ\s]{2,40})/i,
    /mi nombre es\s+([a-záéíóúñ\s]{2,40})/i,
    /^soy\s+([a-záéíóúñ\s]{2,40})$/i,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/\s+/g, ' ')
  }
  return ''
}

function extractQuantity(value: string) {
  const match = value.match(/(?:^|\s)(\d{1,6})(?:[\s,.]|$)/)
  return match ? Number(match[1]) : null
}

function resolveChatIdentity(args: { nombre: string; email: string; phone: string; requestedProduct: string; messageText: string; expectedField?: string }) {
  const expectedField = normalizeString(args.expectedField).toLowerCase()
  const inferredName = extractName(args.messageText)
  const inferredEmail = extractEmail(args.messageText)
  const inferredPhone = extractPhone(args.messageText)

  return {
    nombre: args.nombre || (expectedField === 'name' ? inferredName || normalizeString(args.messageText) : inferredName),
    email: args.email || inferredEmail,
    phone: args.phone || inferredPhone,
    requestedProduct: args.requestedProduct || (expectedField === 'product' ? normalizeString(args.messageText) : args.requestedProduct),
    quantity: extractQuantity(args.messageText),
  }
}

function getNextChatField(args: { nombre: string; email: string; phone: string; requestedProduct: string; quantity: number | null; showProductField: boolean }) {
  if (!args.nombre) return 'name' satisfies ChatFlowNextField
  if (!args.email) return 'email' satisfies ChatFlowNextField
  if (!args.phone && !args.requestedProduct) return 'phone' satisfies ChatFlowNextField
  if (args.showProductField && !args.requestedProduct) return 'product' satisfies ChatFlowNextField
  if (args.requestedProduct && !args.quantity) return 'quantity' satisfies ChatFlowNextField
  return null
}

function buildAssistantReply(args: {
  material: MaterialMatch | null
  requestedProduct: string
  requestHuman: boolean
  leadQualified: boolean
  nombre: string
  email: string
  phone: string
  quantity: number | null
  showProductField: boolean
}) {
  if (args.requestHuman) {
    return { body: 'Listo. Ya registramos tu solicitud para que un asesor humano continúe la conversación desde el CRM.', nextField: null as ChatFlowNextField }
  }

  const nextField = getNextChatField({
    nombre: args.nombre,
    email: args.email,
    phone: args.phone,
    requestedProduct: args.requestedProduct,
    quantity: args.quantity,
    showProductField: args.showProductField,
  })

  if (nextField === 'name') {
    return { body: 'Hola. Gracias por escribirnos. Me gustaría que me dijeras tu nombre para continuar.', nextField }
  }

  if (nextField === 'email') {
    return { body: `Mucho gusto${args.nombre ? `, ${args.nombre}` : ''}. Ahora me gustaría que me dejaras tu correo para enviarte la información comercial.`, nextField }
  }

  if (nextField === 'phone') {
    return { body: 'Perfecto. Si gustas, déjame también un teléfono o WhatsApp para que el centro de ventas pueda comunicarse contigo más rápido. Si prefieres, también puedes escribirme de una vez el producto que te interesa.', nextField }
  }

  if (nextField === 'product') {
    return { body: 'Gracias. Ahora cuéntame qué producto o servicio te interesa para revisar inventario y precio de referencia.', nextField }
  }

  if (args.material) {
    const stockLabel = `${args.material.stockActual} ${args.material.unidadMedida}`
    if (nextField === 'quantity') {
      return {
        body: [
          `Encontré ${args.material.nombre} en inventario.`,
          `Precio de referencia: ${formatMaterialPrice(args.material)}.`,
          `Disponibilidad actual: ${stockLabel}.`,
          'Ahora dime qué cantidad necesitas para dejar la solicitud lista.',
        ].join(' '),
        nextField,
      }
    }

    return {
      body: [
        `Encontré ${args.material.nombre} en inventario.`,
        `Precio de referencia: ${formatMaterialPrice(args.material)}.`,
        `Disponibilidad actual: ${stockLabel}.`,
        args.leadQualified
          ? `Perfecto. Tomo ${args.quantity || 'la cantidad solicitada'} como referencia y tu lead quedó marcado como calificado. El centro de ventas puede continuar el seguimiento.`
          : 'Con esto ya dejamos la conversación encaminada para seguimiento comercial.',
      ].join(' '),
      nextField: null as ChatFlowNextField,
    }
  }

  if (args.requestedProduct) {
    return {
      body: `Recibí tu consulta por ${args.requestedProduct}. No encontré una coincidencia exacta en inventario, pero la conversación quedó registrada para validarla con el equipo comercial. Si puedes, responde con cantidad, medida o referencia.`,
      nextField: 'quantity' as ChatFlowNextField,
    }
  }

  return {
    body: 'Recibí tu mensaje y ya quedó registrado en el CRM. Si me indicas el producto o servicio de interés, puedo buscar una referencia disponible y seguir guiándote.',
    nextField: args.showProductField ? 'product' : null,
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const channelId = normalizeString(body?.channelId)
    const providedToken = normalizeString(request.headers.get('x-crm-channel-token') || body?.token)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel || channel.provider !== 'WEB_CHATBOT') {
      return NextResponse.json({ error: 'Canal chatbot no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para chatbot' }, { status: 409 })
    }

    const settings = getPublicChatbotSettings(channel.settingsJson)
    const publicEmbedEnabled = settings.publicEmbedEnabled
    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    if (expectedToken && !publicEmbedEnabled && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para chatbot' }, { status: 403 })
    }

    const eventAt = new Date()
    const payload = parseJsonObject(body?.payload)
    const nombre = normalizeString(body?.nombre || payload.nombre || payload.name)
    const email = normalizeString(body?.email || payload.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.celular || payload.phone)
    const requestedProduct = normalizeString(body?.producto || body?.product || payload.producto || payload.product)
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.question)
    const expectedField = normalizeString(payload.chatFlowNextField)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const requestHuman = Boolean(body?.requestHuman || payload.requestHuman)

    if (publicEmbedEnabled) {
      const requestHost = await getRequestHost()
      const embedHost = extractHostFromUrl(referrerUrl || landingPageUrl)
      if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: embedHost || requestHost, appHost: requestHost })) {
        return NextResponse.json({ error: 'Dominio no autorizado para este chatbot' }, { status: 403 })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const resolvedIdentity = resolveChatIdentity({ nombre, email, phone, requestedProduct, messageText, expectedField })
      const effectiveProduct = resolvedIdentity.requestedProduct
      const materialSearchText = effectiveProduct || messageText
      const materialTerms = splitSearchTerms(materialSearchText)
      const materialCandidates = materialSearchText
        ? await tx.material.findMany({
            where: {
              empresaId: channel.empresaId,
              activo: true,
              OR: materialTerms.length > 0
                ? materialTerms.map((term) => ({
                    nombre: { contains: term, mode: 'insensitive' },
                  }))
                : [{ nombre: { contains: materialSearchText, mode: 'insensitive' } }],
            },
            select: {
              id: true,
              nombre: true,
              imagenUrl: true,
              precioM2: true,
              precioMetro: true,
              precioUnidad: true,
              stockActual: true,
              unidadMedida: true,
            },
            take: 6,
          })
        : []

      const matchedMaterial = materialCandidates
        .map((item) => ({ item, score: scoreMaterialMatch(item, materialSearchText) }))
        .sort((left, right) => right.score - left.score)[0]?.item ?? null

      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'WEB',
        captureType: 'CHATBOT_START',
        activityType: 'NOTE',
        messageType: 'TEXT',
        eventAt,
        nombre: resolvedIdentity.nombre,
        empresaNombre,
        email: resolvedIdentity.email,
        phone: resolvedIdentity.phone,
        document,
        ciudad,
        messageText,
        externalThreadId: normalizeString(body?.externalThreadId || payload.externalThreadId || `${channel.id}-${resolvedIdentity.phone || resolvedIdentity.email || Date.now()}`),
        providerMessageId: normalizeString(body?.providerMessageId || payload.providerMessageId || `chatbot-${Date.now()}`),
        providerLeadId: normalizeString(body?.providerLeadId || resolvedIdentity.phone || resolvedIdentity.email || null),
        sourceLabel: 'Chatbot web',
        sourceCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign),
        sourceMedium: normalizeString(body?.utmMedium || payload.utmMedium) || 'web-chatbot',
        sourceContent: normalizeString(body?.utmContent || payload.utmContent),
        utmSource: normalizeString(body?.utmSource || payload.utmSource),
        utmMedium: normalizeString(body?.utmMedium || payload.utmMedium),
        utmCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign),
        utmContent: normalizeString(body?.utmContent || payload.utmContent),
        utmTerm: normalizeString(body?.utmTerm || payload.utmTerm),
        landingPageUrl,
        referrerUrl,
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          nombre: resolvedIdentity.nombre,
          email: resolvedIdentity.email,
          phone: resolvedIdentity.phone,
          requestedProduct: effectiveProduct,
          empresaNombre,
          ciudad,
          document,
          messageText,
          requestHuman,
          quantity: resolvedIdentity.quantity,
          landingPageUrl,
          referrerUrl,
        },
      })

      const leadQualified = Boolean((resolvedIdentity.email || resolvedIdentity.phone) && effectiveProduct && resolvedIdentity.quantity)

      const assistantReply = buildAssistantReply({
        material: matchedMaterial,
        requestedProduct: effectiveProduct,
        requestHuman,
        leadQualified,
        nombre: resolvedIdentity.nombre,
        email: resolvedIdentity.email,
        phone: resolvedIdentity.phone,
        quantity: resolvedIdentity.quantity,
        showProductField: settings.showProductField,
      })

      await tx.crmMessage.create({
        data: {
          empresaId: channel.empresaId,
          sedeId: channel.sedeId,
          conversationId: artifacts.conversation.id,
          providerMessageId: `chatbot-assistant-${Date.now()}`,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          status: 'SENT',
          bodyText: assistantReply.body,
          payloadJson: {
            provider: 'WEB_CHATBOT',
            dispatch: 'guided-chatbot-autoreply',
            matchedMaterialId: matchedMaterial?.id || null,
            requestedProduct: effectiveProduct,
            chatFlowNextField: assistantReply.nextField,
            quantity: resolvedIdentity.quantity,
          },
          attachmentsJson: matchedMaterial?.imagenUrl
            ? [{ type: 'image', url: matchedMaterial.imagenUrl, alt: matchedMaterial.nombre }]
            : [],
          occurredAt: new Date(),
        },
      })

      await tx.crmConversation.update({
        where: { id: artifacts.conversation.id },
        data: {
          status: requestHuman ? 'HUMAN_ACTIVE' : 'BOT_ACTIVE',
          directionLastMessage: 'OUTBOUND',
          lastMessageAt: new Date(),
        },
      })

      if (leadQualified && artifacts.lead.status === 'NEW') {
        await tx.crmLead.update({
          where: { id: artifacts.lead.id },
          data: {
            status: 'QUALIFIED',
            notes: [artifacts.lead.notes, `Producto consultado: ${effectiveProduct}`, resolvedIdentity.quantity ? `Cantidad solicitada: ${resolvedIdentity.quantity}` : ''].filter(Boolean).join('\n\n'),
          },
        })
      }

      await tx.crmActivity.create({
        data: {
          empresaId: channel.empresaId,
          sedeId: channel.sedeId,
          type: 'OTHER',
          summary: matchedMaterial ? 'Respuesta automática del chatbot con inventario' : 'Respuesta automática del chatbot',
          details: assistantReply.body,
          leadId: artifacts.lead.id,
          occurredAt: new Date(),
          createdById: channel.createdBy.id,
        },
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return artifacts
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
        autoReply: true,
        testing: channel.status === 'TESTING',
        publicEmbedEnabled,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando chatbot CRM:', error)
    return NextResponse.json({ error: 'Error capturando chatbot CRM' }, { status: 500 })
  }
}