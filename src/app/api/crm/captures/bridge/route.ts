import { NextResponse } from 'next/server'
import { Prisma, type CrmConversationStatus, type CrmLeadStatus, type CrmOpportunityStage } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { analyzeEmailLead } from '@/lib/crm-email-ai'
import { createInboundArtifacts, getConnectionToken, parseJsonObject, parseMaybeDate } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const SUPPORTED_BRIDGES = new Set(['GMAIL', 'OUTLOOK', 'META_LEAD_ADS', 'EXTERNAL_FORM', 'TIKTOK', 'YOUTUBE'])

type EmailAutomationCategory = 'QUOTE' | 'PURCHASE' | 'SUPPORT' | 'INFORMATION' | 'GENERAL'

type EmailAutomationPlan = {
  category: EmailAutomationCategory
  leadStatus?: CrmLeadStatus
  opportunityStage?: CrmOpportunityStage
  shouldCreateOpportunity: boolean
  shouldCreateTask: boolean
  conversationStatus?: CrmConversationStatus
  tags: string[]
}

function containsAny(source: string, tokens: string[]) {
  return tokens.some((token) => source.includes(token))
}

function mergeTags(existing: string[] | null | undefined, next: string[]) {
  return Array.from(new Set([...(existing || []), ...next.map((item) => normalizeString(item).toUpperCase()).filter(Boolean)]))
}

function shouldPromoteLead(current: string, target?: CrmLeadStatus) {
  if (!target) return false
  const score: Record<string, number> = { NEW: 0, CONTACTED: 1, QUALIFIED: 2, LOST: -1, CONVERTED: 99 }
  if (current === 'LOST' || current === 'CONVERTED') return false
  return (score[target] ?? 0) > (score[current] ?? 0)
}

function shouldAdvanceOpportunity(current: string, target?: CrmOpportunityStage) {
  if (!target) return false
  const score: Record<string, number> = { NEW: 0, QUALIFIED: 1, PROPOSAL: 2, NEGOTIATION: 3, WON: 99, LOST: -1 }
  if (current === 'WON' || current === 'LOST') return false
  return (score[target] ?? 0) > (score[current] ?? 0)
}

function classifyEmailAutomation(args: {
  subject: string
  messageText: string
  aiIntent: string
  aiUrgency: string
  hasContactInfo: boolean
}) {
  const normalized = normalizeString(`${args.subject}\n${args.messageText}`).toLowerCase()
  const supportKeywords = ['soporte', 'ayuda', 'error', 'falla', 'falla', 'problema', 'no funciona', 'incidencia', 'garantia', 'garantía', 'reclamo']
  const purchaseKeywords = ['comprar', 'compra', 'pedido', 'orden de compra', 'ordenar', 'facturar', 'adquirir']
  const quoteKeywords = ['cotizacion', 'cotización', 'presupuesto', 'quote', 'valor', 'precio', 'cuanto cuesta', 'cuánto cuesta']
  const infoKeywords = ['informacion', 'información', 'detalle', 'catalogo', 'catálogo', 'asesoria', 'asesoría', 'consulta']

  const urgent = normalizeString(args.aiUrgency).toUpperCase() === 'HIGH' || normalized.includes('urgente')

  if (containsAny(normalized, supportKeywords)) {
    return {
      category: 'SUPPORT' as const,
      leadStatus: args.hasContactInfo ? 'CONTACTED' : undefined,
      shouldCreateOpportunity: false,
      shouldCreateTask: true,
      conversationStatus: 'HUMAN_ACTIVE' as const,
      tags: ['EMAIL_SUPPORT', ...(urgent ? ['URGENT'] : [])],
    } satisfies EmailAutomationPlan
  }

  if (args.aiIntent === 'PURCHASE_INTENT' || containsAny(normalized, purchaseKeywords)) {
    return {
      category: 'PURCHASE' as const,
      leadStatus: args.hasContactInfo ? 'QUALIFIED' : 'CONTACTED',
      opportunityStage: 'NEGOTIATION' as const,
      shouldCreateOpportunity: true,
      shouldCreateTask: false,
      conversationStatus: 'HUMAN_ACTIVE' as const,
      tags: ['EMAIL_PURCHASE_INTENT', ...(urgent ? ['URGENT'] : [])],
    } satisfies EmailAutomationPlan
  }

  if (args.aiIntent === 'QUOTE_REQUEST' || containsAny(normalized, quoteKeywords)) {
    return {
      category: 'QUOTE' as const,
      leadStatus: args.hasContactInfo ? 'QUALIFIED' : 'CONTACTED',
      opportunityStage: 'QUALIFIED' as const,
      shouldCreateOpportunity: true,
      shouldCreateTask: false,
      conversationStatus: 'HUMAN_ACTIVE' as const,
      tags: ['EMAIL_QUOTE_REQUEST', ...(urgent ? ['URGENT'] : [])],
    } satisfies EmailAutomationPlan
  }

  if (args.aiIntent === 'INFORMATION_REQUEST' || containsAny(normalized, infoKeywords)) {
    return {
      category: 'INFORMATION' as const,
      leadStatus: args.hasContactInfo ? 'CONTACTED' : undefined,
      shouldCreateOpportunity: false,
      shouldCreateTask: false,
      conversationStatus: 'OPEN' as const,
      tags: ['EMAIL_INFORMATION_REQUEST', ...(urgent ? ['URGENT'] : [])],
    } satisfies EmailAutomationPlan
  }

  return {
    category: 'GENERAL' as const,
    leadStatus: args.hasContactInfo ? 'CONTACTED' : undefined,
    shouldCreateOpportunity: false,
    shouldCreateTask: false,
    conversationStatus: 'OPEN' as const,
    tags: ['EMAIL_INBOUND', ...(urgent ? ['URGENT'] : [])],
  } satisfies EmailAutomationPlan
}

function buildOpportunityTitle(args: { category: EmailAutomationCategory; subject: string; productOrService: string; fromName: string; fromAddress: string }) {
  const focus = normalizeString(args.productOrService) || normalizeString(args.subject)
  const contact = normalizeString(args.fromName) || normalizeString(args.fromAddress) || 'prospecto'
  if (args.category === 'PURCHASE') return focus ? `Compra · ${focus}` : `Compra · ${contact}`
  return focus ? `Cotización · ${focus}` : `Cotización · ${contact}`
}

function buildSupportTaskTitle(args: { subject: string; fromName: string; fromAddress: string }) {
  const focus = normalizeString(args.subject) || normalizeString(args.fromName) || normalizeString(args.fromAddress) || 'correo inbound'
  return `Soporte · ${focus}`
}

function findFieldValue(payload: Record<string, unknown>, aliases: string[]) {
  const groups = [payload, parseJsonObject(payload.payload), parseJsonObject(payload.data)]

  for (const group of groups) {
    for (const alias of aliases) {
      const direct = normalizeString(group[alias])
      if (direct) return direct
    }

    const fieldData = Array.isArray(group.field_data)
      ? group.field_data
      : Array.isArray(group.fieldData)
        ? group.fieldData
        : []

    for (const row of fieldData) {
      const item = parseJsonObject(row)
      const name = normalizeString(item.name).toLowerCase()
      if (!name || !aliases.includes(name)) continue

      const values = Array.isArray(item.values) ? item.values.map((value) => normalizeString(value)).filter(Boolean) : []
      if (values.length) return values.join(', ')

      const singleValue = normalizeString(item.value)
      if (singleValue) return singleValue
    }
  }

  return ''
}

function resolveBridgeMetadata(bridgeKind: string) {
  switch (bridgeKind) {
    case 'GMAIL':
      return {
        source: 'IMPORT' as const,
        captureType: 'MANUAL_IMPORT' as const,
        activityType: 'EMAIL' as const,
        sourceLabel: 'Gmail Inbox Bridge',
        sourceMedium: 'gmail-bridge',
        landingPageUrl: 'gmail://inbox',
      }
    case 'OUTLOOK':
      return {
        source: 'IMPORT' as const,
        captureType: 'MANUAL_IMPORT' as const,
        activityType: 'EMAIL' as const,
        sourceLabel: 'Outlook Inbox Bridge',
        sourceMedium: 'outlook-bridge',
        landingPageUrl: 'outlook://mail',
      }
    case 'META_LEAD_ADS':
      return {
        source: 'WEB' as const,
        captureType: 'WEB_FORM' as const,
        activityType: 'NOTE' as const,
        sourceLabel: 'Meta Lead Ads Bridge',
        sourceMedium: 'meta-lead-ads-bridge',
        landingPageUrl: null,
      }
    case 'EXTERNAL_FORM':
      return {
        source: 'WEB' as const,
        captureType: 'WEB_FORM' as const,
        activityType: 'NOTE' as const,
        sourceLabel: 'Formulario externo Bridge',
        sourceMedium: 'external-form-bridge',
        landingPageUrl: null,
      }
    case 'TIKTOK':
      return {
        source: 'IMPORT' as const,
        captureType: 'MANUAL_IMPORT' as const,
        activityType: 'NOTE' as const,
        sourceLabel: 'TikTok Lead Bridge',
        sourceMedium: 'tiktok-bridge',
        landingPageUrl: null,
      }
    case 'YOUTUBE':
      return {
        source: 'IMPORT' as const,
        captureType: 'MANUAL_IMPORT' as const,
        activityType: 'NOTE' as const,
        sourceLabel: 'YouTube Lead Bridge',
        sourceMedium: 'youtube-bridge',
        landingPageUrl: null,
      }
    default:
      return null
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

    if (!channel || channel.provider !== 'WEB_FORM') {
      return NextResponse.json({ error: 'Canal bridge no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para capturas' }, { status: 409 })
    }

    const settings = parseJsonObject(channel.settingsJson)
    const bridgeKind = normalizeString(settings.bridgeKind).toUpperCase()
    if (!SUPPORTED_BRIDGES.has(bridgeKind)) {
      return NextResponse.json({ error: 'Canal no configurado como bridge soportado' }, { status: 409 })
    }

    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para bridge CRM' }, { status: 403 })
    }

    const metadata = resolveBridgeMetadata(bridgeKind)
    if (!metadata) {
      return NextResponse.json({ error: 'Bridge no soportado' }, { status: 400 })
    }

    const payload = parseJsonObject(body?.payload)
    const fromName = normalizeString(body?.fromName || body?.nombre || payload.fromName || payload.nombre || payload.name || findFieldValue(payload, ['full_name', 'name', 'nombre']))
    const fromAddress = normalizeString(body?.fromAddress || body?.email || payload.fromAddress || payload.email || findFieldValue(payload, ['email', 'correo', 'correo_electronico'])).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.celular || payload.phone || findFieldValue(payload, ['phone_number', 'telefono', 'celular', 'mobile_phone']))
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.bodyPreview || payload.body || findFieldValue(payload, ['message', 'mensaje', 'comentarios', 'comentario']))
    const subject = normalizeString(body?.subject || payload.subject)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company || findFieldValue(payload, ['company_name', 'empresa', 'company']))
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city || findFieldValue(payload, ['city', 'ciudad']))
    const document = normalizeString(body?.documento || payload.documento || findFieldValue(payload, ['document', 'documento', 'identificacion']))
    const sourceCampaign = normalizeString(body?.sourceCampaign || payload.sourceCampaign || payload.campaign || payload.campaign_name)
    const eventAt = parseMaybeDate(body?.eventAt || payload.eventAt || payload.receivedAt)
    const externalThreadId = normalizeString(
      body?.externalThreadId
      || payload.externalThreadId
      || payload.threadId
      || payload.conversationId
      || payload.messageId
      || payload.id,
    )
    const providerMessageId = normalizeString(body?.providerMessageId || payload.providerMessageId || payload.messageId || payload.id)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.sourceUrl) || metadata.landingPageUrl

    if (!fromName && !fromAddress && !phone) {
      return NextResponse.json({ error: 'Se requiere al menos remitente, email o teléfono' }, { status: 400 })
    }

    const aiExtraction = bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK'
      ? await analyzeEmailLead({
          messageText,
          subject,
          fromName,
          fromAddress,
          phone,
          company: empresaNombre,
          city: ciudad,
        })
      : null
    const aiData = parseJsonObject(aiExtraction?.extractedData)
    const aiContact = parseJsonObject(aiData.contact)
    const aiRequest = parseJsonObject(aiData.request)
    const resolvedFromName = fromName || normalizeString(aiContact.name)
    const resolvedFromAddress = fromAddress || normalizeString(aiContact.email).toLowerCase()
    const resolvedPhone = phone || normalizeString(aiContact.phone)
    const resolvedEmpresaNombre = empresaNombre || normalizeString(aiContact.company)
    const resolvedCiudad = ciudad || normalizeString(aiContact.city)
    const resolvedDocument = document || normalizeString(aiContact.document)
    const resolvedMessageText = messageText || normalizeString(aiRequest.summary)
    const aiProductOrService = normalizeString(aiRequest.productOrService)
    const aiIntent = normalizeString(aiRequest.intent)
    const aiUrgency = normalizeString(aiRequest.urgency)
    const automationPlan = classifyEmailAutomation({
      subject,
      messageText: resolvedMessageText,
      aiIntent,
      aiUrgency,
      hasContactInfo: Boolean(resolvedFromAddress || resolvedPhone),
    })
    const normalizedDataPayload = {
      bridgeKind,
      fromName: resolvedFromName,
      fromAddress: resolvedFromAddress,
      phone: resolvedPhone,
      empresaNombre: resolvedEmpresaNombre,
      ciudad: resolvedCiudad,
      document: resolvedDocument,
      messageText: resolvedMessageText,
      externalThreadId,
      providerMessageId,
      subject: subject || null,
      aiName: normalizeString(aiContact.name) || null,
      aiEmail: normalizeString(aiContact.email).toLowerCase() || null,
      aiPhone: normalizeString(aiContact.phone) || null,
      aiCompany: normalizeString(aiContact.company) || null,
      aiCity: normalizeString(aiContact.city) || null,
      aiDocument: normalizeString(aiContact.document) || null,
      aiRequestSummary: normalizeString(aiRequest.summary) || null,
      aiProductOrService: aiProductOrService || null,
      aiIntent: aiIntent || null,
      aiUrgency: aiUrgency || null,
      autoCategory: automationPlan.category,
      autoLeadStatus: automationPlan.leadStatus || null,
      autoOpportunityStage: automationPlan.opportunityStage || null,
      autoTags: automationPlan.tags,
      aiCapturePercent: aiExtraction?.capturePercent ?? null,
      eventAt: eventAt.toISOString(),
    }
    const normalizedDataJson = JSON.parse(JSON.stringify(normalizedDataPayload)) as Prisma.InputJsonValue

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: metadata.source,
        captureType: metadata.captureType,
        activityType: metadata.activityType,
        messageType: 'TEXT',
        eventAt,
        nombre: resolvedFromName,
        empresaNombre: resolvedEmpresaNombre,
        email: resolvedFromAddress,
        phone: resolvedPhone,
        document: resolvedDocument,
        ciudad: resolvedCiudad,
        messageText: resolvedMessageText,
        externalThreadId,
        providerMessageId,
        sourceLabel: metadata.sourceLabel,
        sourceCampaign: sourceCampaign || null,
        sourceMedium: metadata.sourceMedium,
        sourceContent: normalizeString(body?.sourceContent || payload.sourceContent || payload.subject) || null,
        utmSource: normalizeString(body?.utmSource || payload.utmSource) || null,
        utmMedium: normalizeString(body?.utmMedium || payload.utmMedium) || metadata.sourceMedium,
        utmCampaign: normalizeString(body?.utmCampaign || payload.utmCampaign) || null,
        utmContent: normalizeString(body?.utmContent || payload.utmContent) || null,
        utmTerm: normalizeString(body?.utmTerm || payload.utmTerm) || null,
        landingPageUrl,
        referrerUrl: normalizeString(body?.referrerUrl || payload.referrerUrl) || null,
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: normalizedDataJson as Prisma.InputJsonValue,
      })

      let lead = artifacts.lead
      let conversation = artifacts.conversation
      let autoOpportunityId: string | null = conversation.opportunityId ?? null
      let autoTaskId: string | null = null

      const nextTags = mergeTags(lead.tags, automationPlan.tags)
      const nextLeadData: Prisma.CrmLeadUpdateInput = {
        ...(nextTags.length !== (lead.tags || []).length ? { tags: nextTags } : {}),
      }

      if (shouldPromoteLead(lead.status, automationPlan.leadStatus)) {
        nextLeadData.status = automationPlan.leadStatus
      }

      const noteAppend = [
        automationPlan.category !== 'GENERAL' ? `Clasificación automática email: ${automationPlan.category}` : '',
        aiProductOrService ? `Producto/servicio detectado: ${aiProductOrService}` : '',
        normalizeString(aiRequest.summary) ? `Solicitud detectada: ${normalizeString(aiRequest.summary)}` : '',
      ].filter(Boolean).join('\n')

      if (noteAppend && !(lead.notes || '').includes(noteAppend)) {
        nextLeadData.notes = [lead.notes, noteAppend].filter(Boolean).join('\n\n')
      }

      if (Object.keys(nextLeadData).length > 0) {
        lead = await tx.crmLead.update({ where: { id: lead.id }, data: nextLeadData })
      }

      if (automationPlan.shouldCreateOpportunity && lead.id) {
        const existingOpportunity = conversation.opportunityId
          ? await tx.crmOpportunity.findUnique({ where: { id: conversation.opportunityId } })
          : await tx.crmOpportunity.findFirst({
              where: {
                empresaId: channel.empresaId,
                leadId: lead.id,
                stage: { in: ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'] },
              },
              orderBy: { updatedAt: 'desc' },
            })

        if (existingOpportunity) {
          autoOpportunityId = existingOpportunity.id
          if (shouldAdvanceOpportunity(existingOpportunity.stage, automationPlan.opportunityStage)) {
            await tx.crmOpportunity.update({
              where: { id: existingOpportunity.id },
              data: { stage: automationPlan.opportunityStage },
            })
          }
        } else {
          const createdOpportunity = await tx.crmOpportunity.create({
            data: {
              empresaId: channel.empresaId,
              sedeId: channel.sedeId,
              title: buildOpportunityTitle({
                category: automationPlan.category,
                subject,
                productOrService: aiProductOrService,
                fromName: resolvedFromName,
                fromAddress: resolvedFromAddress,
              }),
              description: normalizeString(aiRequest.summary) || resolvedMessageText || subject || null,
              stage: automationPlan.opportunityStage || 'QUALIFIED',
              leadId: lead.id,
              assignedToUserId: conversation.assignedToUserId || channel.createdBy.id,
              createdById: channel.createdBy.id,
              probabilityPct: automationPlan.category === 'PURCHASE' ? 70 : 40,
            },
          })
          autoOpportunityId = createdOpportunity.id
        }
      }

      if (automationPlan.shouldCreateTask && lead.id) {
        const supportTitle = buildSupportTaskTitle({ subject, fromName: resolvedFromName, fromAddress: resolvedFromAddress })
        const existingTask = await tx.crmTask.findFirst({
          where: {
            empresaId: channel.empresaId,
            leadId: lead.id,
            title: supportTitle,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (existingTask) {
          autoTaskId = existingTask.id
        } else {
          const createdTask = await tx.crmTask.create({
            data: {
              empresaId: channel.empresaId,
              sedeId: channel.sedeId,
              title: supportTitle,
              description: normalizeString(aiRequest.summary) || resolvedMessageText || subject || 'Correo clasificado como soporte',
              priority: aiUrgency === 'HIGH' ? 'HIGH' : 'NORMAL',
              leadId: lead.id,
              assignedToUserId: conversation.assignedToUserId || channel.createdBy.id,
              createdById: channel.createdBy.id,
            },
          })
          autoTaskId = createdTask.id
        }
      }

      if ((automationPlan.conversationStatus && conversation.status !== automationPlan.conversationStatus) || (autoOpportunityId && conversation.opportunityId !== autoOpportunityId)) {
        conversation = await tx.crmConversation.update({
          where: { id: conversation.id },
          data: {
            ...(automationPlan.conversationStatus ? { status: automationPlan.conversationStatus } : {}),
            ...(autoOpportunityId ? { opportunityId: autoOpportunityId } : {}),
          },
        })
      }

      if (automationPlan.category !== 'GENERAL') {
        await tx.crmActivity.create({
          data: {
            empresaId: channel.empresaId,
            sedeId: channel.sedeId,
            type: 'OTHER',
            summary: `Automatización email: ${automationPlan.category}`,
            details: [normalizeString(aiRequest.summary), aiProductOrService ? `Producto: ${aiProductOrService}` : '', subject ? `Asunto: ${subject}` : ''].filter(Boolean).join(' · ') || null,
            leadId: lead.id,
            opportunityId: autoOpportunityId,
            occurredAt: eventAt,
            createdById: channel.createdBy.id,
          },
        })
      }

      const normalizedDataWithAutomation = JSON.parse(JSON.stringify({
        ...normalizedDataPayload,
        autoCategory: automationPlan.category,
        autoLeadStatusApplied: lead.status,
        autoOpportunityId,
        autoTaskId,
        autoConversationStatus: conversation.status,
      })) as Prisma.InputJsonValue

      await tx.crmLeadCapture.update({
        where: { id: artifacts.capture.id },
        data: { normalizedDataJson: normalizedDataWithAutomation },
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return {
        ...artifacts,
        lead,
        conversation,
        autoCategory: automationPlan.category,
        autoOpportunityId,
        autoTaskId,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
        autoCategory: result.autoCategory,
        opportunityId: result.autoOpportunityId,
        taskId: result.autoTaskId,
        bridgeKind,
        testing: channel.status === 'TESTING',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando bridge CRM:', error)
    return NextResponse.json({ error: 'Error capturando bridge CRM' }, { status: 500 })
  }
}