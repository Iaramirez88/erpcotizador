import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail } from '@/lib/email-template'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { fetchGoogleSheetsRows } from '@/lib/crm-google-sheets'
import { getMetaMessagingDispatchConfig, sendMetaMediaMessage, sendMetaTextMessage } from '@/lib/crm-meta'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { sendTelegramMessage } from '@/lib/telegram'
import { ensureInvoiceFromQuote } from '@/lib/quote-invoicing'
import { ensureWorkOrderFromQuote } from '@/lib/work-orders'
import {
  findChatbotFlowResponseOption,
  findChatbotQuickAction,
  findChatbotFlowStage,
  getStageQuickActions,
  getStageResponseOptions,
  isHumanHandoffStage,
  matchChatbotFlowResponseOption,
  type ChatbotFlowNextField,
  type ChatbotQuickActionNotificationConfig,
  type ChatbotFlowResponseOption,
  type ChatbotFlowStage,
  type ChatbotQuickAction,
} from '@/lib/crm-chatbot-flow'
import {
  getChatbotAutomationFlowById,
  getDefaultChatbotAutomationFlowFromSettings,
  getChatbotStudioSettings,
  interpolateChatbotVariables,
  resolveChatbotAutomationFlowByTrigger,
  resolveChatbotAssignmentUserId,
  type ChatbotAutomationProvider,
  type ChatbotFlowTrigger,
  type ChatbotFlowTriggerCondition,
  type ChatbotStudioPauseNode,
} from '@/lib/crm-chatbot-studio'
import { normalizeChatbotInactivityRule, type ChatbotInactivityRule } from '@/lib/crm-chatbot-inactivity'
import { extractHostFromUrl, getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'
import { normalizeRichTextHtml, richTextToPlainText } from '@/lib/chatbot-rich-text'

export const runtime = 'nodejs'

type MaterialMatch = {
  id: string
  nombre: string
  imagenUrl: string | null
  tipoNombre: string | null
  categoria: string | null
  proveedor: string | null
  precioM2: number | null
  precioMetro: number | null
  precioUnidad: number | null
  stockActual: number
  stockMinimo: number
  unidadMedida: string
  requiresWorkOrder: boolean
}

type MaterialLookupKind = 'any' | 'product' | 'service'

type CatalogInsight = {
  primary: MaterialMatch | null
  alternatives: MaterialMatch[]
  catalog: MaterialMatch[]
  query: string
  catalogIntent: boolean
  lookupKind: MaterialLookupKind
}

type BusinessActionResult = {
  kind: 'create_quote' | 'create_invoice' | 'create_work_order'
  quoteId: string
  quoteNumber: string
  invoiceNumber?: string | null
  workOrderNumber?: string | null
}

type ChatbotRuntimeState = {
  botSubscriptionActive: boolean
  pauseUntil: string | null
  variables: Record<string, string>
  googleSheetsRow: Record<string, string> | null
  lastA360EventName: string | null
}

type ChatbotWebhookJob = {
  url: string
  payload: Record<string, unknown>
}

type ChatbotNotificationChannel = 'email' | 'whatsapp' | 'telegram'

type SupportedChatbotRuntimeProvider = 'WEB_CHATBOT' | 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'INSTAGRAM_DM' | 'FACEBOOK_PAGE' | 'MESSENGER'

const SUPPORTED_CHATBOT_RUNTIME_PROVIDERS = ['WEB_CHATBOT', 'WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'INSTAGRAM_DM', 'FACEBOOK_PAGE', 'MESSENGER'] as const

type ChatbotRuntimeChannel = {
  id: string
  name: string
  provider: SupportedChatbotRuntimeProvider
  status: string
  empresaId: string
  sedeId: string | null
  verifyToken: string | null
  settingsJson: Prisma.JsonValue | null
  externalPageId: string | null
  externalPhoneNumberId: string | null
  createdBy: { id: string }
}

type ChatbotRuntimeArtifacts = Awaited<ReturnType<typeof createInboundArtifacts>>

type ChatbotAutomationExecutionArgs = {
  tx?: Prisma.TransactionClient
  channel: ChatbotRuntimeChannel
  eventAt: Date
  provider: ChatbotAutomationProvider
  artifacts: ChatbotRuntimeArtifacts
  nombre: string
  email: string
  phone: string
  whatsapp: string
  requestedProduct: string
  empresaNombre: string
  ciudad: string
  document: string
  address: string
  messageText: string
  expectedField: string
  requestHuman: boolean
  quickActionId: string
  responseOptionId: string
  currentStageId: string
  currentFlowId: string
  landingPageUrl: string
  referrerUrl: string
  inboundAttachments: ChatbotInboundAttachment[]
}

type ChatbotDispatchResult = {
  dispatch: string
  messageStatus: 'SENT' | 'FAILED'
  providerMessageId: string | null
  payloadJson: Prisma.InputJsonValue
  errorMessage: string | null
}

type ResolvedChatbotNotificationRecipients = {
  internalUserIds: string[]
  emails: string[]
  whatsapp: string[]
  telegram: string[]
}

export function resolveChatbotAutomationProvider(provider: SupportedChatbotRuntimeProvider): ChatbotAutomationProvider {
  return provider === 'WHATSAPP_SANDBOX' ? 'WHATSAPP_CLOUD' : provider
}

export function isSupportedChatbotRuntimeProvider(provider: string): provider is SupportedChatbotRuntimeProvider {
  return (SUPPORTED_CHATBOT_RUNTIME_PROVIDERS as readonly string[]).includes(provider)
}

function withChatbotMessageOrigin(payload: Prisma.InputJsonValue, messageOrigin: 'BOT' | 'SYSTEM') {
  const base = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}

  return {
    ...base,
    messageOrigin,
  } as Prisma.InputJsonValue
}

async function dispatchChatbotAutoReply(args: {
  channel: ChatbotRuntimeChannel
  conversation: { contactPhone: string | null; externalThreadId: string | null }
  assistantBody: string
  attachments: Array<{ type: 'image'; url: string; alt: string | null } | { type: 'document'; url: string; alt?: string | null; name: string | null }>
}): Promise<ChatbotDispatchResult> {
  if (args.channel.provider === 'WEB_CHATBOT') {
    return {
      dispatch: 'guided-chatbot-autoreply',
      messageStatus: 'SENT',
      providerMessageId: `chatbot-assistant-${Date.now()}`,
      payloadJson: { provider: 'WEB_CHATBOT', dispatch: 'guided-chatbot-autoreply' },
      errorMessage: null,
    }
  }

  const firstAttachment = args.attachments[0] ?? null
  const isWhatsApp = args.channel.provider === 'WHATSAPP_CLOUD' || args.channel.provider === 'WHATSAPP_SANDBOX'
  const isMetaMessaging = args.channel.provider === 'FACEBOOK_PAGE' || args.channel.provider === 'MESSENGER' || args.channel.provider === 'INSTAGRAM_DM'

  if (isWhatsApp) {
    const config = getWhatsAppDispatchConfig(args.channel)
    const recipientPhone = normalizeWhatsAppRecipient(args.conversation.contactPhone)

    if (!recipientPhone) {
      return {
        dispatch: 'whatsapp-cloud',
        messageStatus: 'FAILED',
        providerMessageId: null,
        payloadJson: { provider: args.channel.provider, dispatch: 'whatsapp-cloud', error: 'La conversación no tiene teléfono válido para responder por WhatsApp.' },
        errorMessage: 'La conversación no tiene teléfono válido para responder por WhatsApp.',
      }
    }

    if (!config.enabled) {
      return {
        dispatch: 'local-demo',
        messageStatus: 'SENT',
        providerMessageId: null,
        payloadJson: { testing: true, provider: args.channel.provider, dispatch: 'local-demo', reason: 'El canal no tiene access token y phone number id configurados.' },
        errorMessage: null,
      }
    }

    try {
      const result = firstAttachment
        ? await sendWhatsAppMediaMessage({
            config,
            to: recipientPhone,
            attachment: {
              type: firstAttachment.type === 'image' ? 'IMAGE' : 'DOCUMENT',
              url: firstAttachment.url,
              filename: firstAttachment.type === 'document' ? firstAttachment.name : null,
              caption: args.assistantBody || null,
            },
          })
        : await sendWhatsAppTextMessage({
            config,
            to: recipientPhone,
            bodyText: args.assistantBody,
          })

      return {
        dispatch: 'whatsapp-cloud',
        messageStatus: 'SENT',
        providerMessageId: result.providerMessageId,
        payloadJson: result.payloadJson,
        errorMessage: null,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo enviar la respuesta automática por WhatsApp.'
      return {
        dispatch: 'whatsapp-cloud',
        messageStatus: 'FAILED',
        providerMessageId: null,
        payloadJson: { provider: args.channel.provider, dispatch: 'whatsapp-cloud', error: errorMessage },
        errorMessage,
      }
    }
  }

  if (isMetaMessaging) {
    const config = getMetaMessagingDispatchConfig(args.channel.settingsJson)
    const recipientThreadId = normalizeString(args.conversation.externalThreadId)

    if (!recipientThreadId) {
      return {
        dispatch: 'meta-send-api',
        messageStatus: 'FAILED',
        providerMessageId: null,
        payloadJson: { provider: args.channel.provider, dispatch: 'meta-send-api', error: 'La conversación no tiene externalThreadId para responder por Meta.' },
        errorMessage: 'La conversación no tiene externalThreadId para responder por Meta.',
      }
    }

    if (!config.enabled) {
      return {
        dispatch: 'local-demo',
        messageStatus: 'SENT',
        providerMessageId: null,
        payloadJson: { testing: true, provider: args.channel.provider, dispatch: 'local-demo', reason: 'El canal no tiene page access token sincronizado desde Meta.' },
        errorMessage: null,
      }
    }

    try {
      const result = firstAttachment
        ? await sendMetaMediaMessage({
            config,
            recipientId: recipientThreadId,
            provider: args.channel.provider,
            attachment: {
              type: firstAttachment.type === 'image' ? 'IMAGE' : 'DOCUMENT',
              url: firstAttachment.url,
              filename: firstAttachment.type === 'document' ? firstAttachment.name : null,
              caption: args.assistantBody || null,
            },
          })
        : await sendMetaTextMessage({
            config,
            recipientId: recipientThreadId,
            bodyText: args.assistantBody,
            provider: args.channel.provider,
          })

      return {
        dispatch: 'meta-send-api',
        messageStatus: 'SENT',
        providerMessageId: result.providerMessageId,
        payloadJson: result.payloadJson,
        errorMessage: null,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo enviar la respuesta automática por Meta.'
      return {
        dispatch: 'meta-send-api',
        messageStatus: 'FAILED',
        providerMessageId: null,
        payloadJson: { provider: args.channel.provider, dispatch: 'meta-send-api', error: errorMessage },
        errorMessage,
      }
    }
  }

  return {
    dispatch: 'unsupported-provider',
    messageStatus: 'FAILED',
    providerMessageId: null,
    payloadJson: { provider: args.channel.provider, dispatch: 'unsupported-provider', error: 'El proveedor no soporta respuesta automática del chatbot.' },
    errorMessage: 'El proveedor no soporta respuesta automática del chatbot.',
  }
}

export async function processChatbotInboundAutomation(args: ChatbotAutomationExecutionArgs) {
  const execute = async (tx: Prisma.TransactionClient) => {
    const settings = getPublicChatbotSettings(args.channel.settingsJson)
    const studioSettings = getChatbotStudioSettings(args.channel.settingsJson)
    const conversationSnapshot = await tx.crmConversation.findUnique({
      where: { id: args.artifacts.conversation.id },
      select: {
        id: true,
        status: true,
        assignedToUserId: true,
        opportunityId: true,
        externalThreadId: true,
        contactPhone: true,
        captures: {
          orderBy: [{ createdAt: 'desc' }],
          take: 2,
          select: { id: true, normalizedDataJson: true },
        },
      },
    })

    const previousCapture = conversationSnapshot?.captures.find((item) => item.id !== args.artifacts.capture.id) ?? null
    const priorRuntimeState = parseRuntimeState(previousCapture?.normalizedDataJson)
    const defaultFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)
    const conversationFlow = getChatbotAutomationFlowById(studioSettings.automationFlows, args.currentFlowId) ?? defaultFlow
    const flowVariables = studioSettings.flowVariables.filter((item: { enabled: boolean }) => item.enabled)
    const resolvedIdentity = resolveChatIdentity({
      nombre: args.nombre,
      email: args.email,
      phone: args.phone,
      whatsapp: args.whatsapp,
      requestedProduct: args.requestedProduct,
      companyName: args.empresaNombre,
      document: args.document,
      city: args.ciudad,
      address: args.address,
      messageText: args.messageText,
      expectedField: args.expectedField,
    })
    const effectiveProduct = resolvedIdentity.requestedProduct
    const previewFlowStages = conversationFlow.flowStages.length ? conversationFlow.flowStages : settings.flowStages
    const previewQuickActions = conversationFlow.quickActions.length ? conversationFlow.quickActions : settings.quickActions
    const previewCurrentStage = findChatbotFlowStage(previewFlowStages, args.currentStageId) ?? resolveInitialFlowStage(previewFlowStages, conversationFlow.startStageId) ?? null
    const previewMatchedResponseOption = findChatbotFlowResponseOption(previewCurrentStage, args.responseOptionId)
      ?? matchChatbotFlowResponseOption(previewCurrentStage, args.messageText)
    const previewSelectedQuickAction = findChatbotQuickAction(previewQuickActions, args.quickActionId)
    const previewSelectedOptionsList = previewMatchedResponseOption?.label
      ? mergeRuntimeList(priorRuntimeState.variables.selected_options_list, [previewMatchedResponseOption.label])
      : (priorRuntimeState.variables.selected_options_list || '')
    const leadQualified = Boolean((resolvedIdentity.email || resolvedIdentity.phone || resolvedIdentity.whatsapp) && effectiveProduct && resolvedIdentity.quantity)
    const triggerMatchContext = {
      contact_name: resolvedIdentity.nombre,
      contact_email: resolvedIdentity.email,
      contact_phone: resolvedIdentity.phone || resolvedIdentity.whatsapp,
      contact_whatsapp: resolvedIdentity.whatsapp,
      product_name: effectiveProduct,
      quantity: resolvedIdentity.quantity,
      company_name: resolvedIdentity.companyName,
      document: resolvedIdentity.document,
      city: resolvedIdentity.city,
      address: resolvedIdentity.address,
      channel_name: args.channel.name,
      assistant_name: settings.assistantName,
      lead_tags: args.artifacts.lead.tags.join(', '),
      last_response_option_id: previewMatchedResponseOption?.id || args.responseOptionId,
      last_response_option_label: previewMatchedResponseOption?.label || '',
      last_response_option_message: previewMatchedResponseOption?.userMessage || '',
      selected_options_list: previewSelectedOptionsList,
      last_quick_action_id: previewSelectedQuickAction?.id || args.quickActionId,
      last_quick_action_label: previewSelectedQuickAction?.label || '',
      ...priorRuntimeState.variables,
    }

    let activeFlow = conversationFlow
    const matchedTrigger = args.requestHuman
      ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: args.provider, event: 'human_request', value: 'human_request', context: triggerMatchContext })
      : leadQualified
        ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: args.provider, event: 'lead_qualified', value: 'lead_qualified', context: triggerMatchContext })
        : args.responseOptionId
          ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: args.provider, event: 'response_option', value: args.responseOptionId, context: triggerMatchContext })
          : args.quickActionId
            ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: args.provider, event: 'quick_action', value: args.quickActionId, context: triggerMatchContext })
            : resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: args.provider, event: 'message', value: args.messageText, context: triggerMatchContext })

    if (matchedTrigger.flow?.id) {
      activeFlow = matchedTrigger.flow
    }

    const flowStages = activeFlow.flowStages.length ? activeFlow.flowStages : settings.flowStages
    const quickActions = activeFlow.quickActions.length ? activeFlow.quickActions : settings.quickActions
    const flowTriggers = activeFlow.flowTriggers.length ? activeFlow.flowTriggers : studioSettings.flowTriggers
    const pauseNodes = activeFlow.pauseNodes
    const matchedTriggerCondition = matchedTrigger.matchedTrigger?.matchedCondition ?? null
    const currentStage = findChatbotFlowStage(flowStages, args.currentStageId) ?? resolveInitialFlowStage(flowStages, activeFlow.startStageId) ?? null
    const matchedResponseOption = findChatbotFlowResponseOption(currentStage, args.responseOptionId)
      ?? matchChatbotFlowResponseOption(currentStage, args.messageText)
    const matchedTriggerDestination = resolveFlowDestination({
      targetStageId: matchedTriggerCondition?.targetStageId || matchedTrigger.matchedTrigger?.targetStageId,
      targetActionId: matchedTriggerCondition?.targetActionId || matchedTrigger.matchedTrigger?.targetActionId,
      targetTriggerId: matchedTriggerCondition?.targetTriggerId || matchedTrigger.matchedTrigger?.targetTriggerId,
      flowTriggers,
      flowStages,
      quickActions,
      messageText: args.messageText,
      context: triggerMatchContext,
    })
    const matchedResponseDestination = matchedResponseOption
      ? resolveFlowDestination({
          targetStageId: matchedResponseOption.targetStageId,
          targetActionId: matchedResponseOption.targetActionId,
          targetTriggerId: matchedResponseOption.targetTriggerId,
          flowTriggers,
          flowStages,
          quickActions,
          messageText: args.messageText,
          context: triggerMatchContext,
        })
      : { stageId: '', quickActionId: '' }
    const effectiveQuickActionId = matchedTriggerDestination.quickActionId || matchedResponseDestination.quickActionId || args.quickActionId
    const selectedQuickAction = findChatbotQuickAction(quickActions, effectiveQuickActionId)
    const selectedQuickActionDestination = selectedQuickAction
      ? resolveFlowDestination({
          targetStageId: selectedQuickAction.targetStageId,
          targetTriggerId: selectedQuickAction.targetTriggerId,
          flowTriggers,
          flowStages,
          quickActions,
          messageText: args.messageText,
          context: triggerMatchContext,
        })
      : { stageId: '', quickActionId: '' }
    const selectedAutomation = selectedQuickAction?.automation || null

    const interactionRuntimeVariables = { ...priorRuntimeState.variables }
    if (matchedResponseOption) {
      interactionRuntimeVariables.last_response_option_id = matchedResponseOption.id
      interactionRuntimeVariables.last_response_option_label = matchedResponseOption.label
      interactionRuntimeVariables.last_response_option_message = matchedResponseOption.userMessage
      interactionRuntimeVariables.selected_options_list = mergeRuntimeList(interactionRuntimeVariables.selected_options_list, [matchedResponseOption.label])
    }
    if (selectedQuickAction) {
      interactionRuntimeVariables.last_quick_action_id = selectedQuickAction.id
      interactionRuntimeVariables.last_quick_action_label = selectedQuickAction.label
    }

    if (!selectedAutomation?.chat.openChat && (priorRuntimeState.botSubscriptionActive === false || hasFuturePause(priorRuntimeState.pauseUntil))) {
      const blockedConversationStatus = priorRuntimeState.botSubscriptionActive === false
        ? (conversationSnapshot?.status === 'HUMAN_ACTIVE' || conversationSnapshot?.status === 'PENDING'
            ? conversationSnapshot.status
            : 'RESOLVED')
        : 'PENDING'

      await tx.crmLeadCapture.update({
        where: { id: args.artifacts.capture.id },
        data: {
          normalizedDataJson: buildNormalizedCaptureData(args.artifacts.capture.normalizedDataJson, {
            ...priorRuntimeState,
            variables: interactionRuntimeVariables,
          }),
        },
      })

      await tx.crmConversation.update({
        where: { id: args.artifacts.conversation.id },
        data: {
          status: blockedConversationStatus,
          directionLastMessage: 'INBOUND',
          lastMessageAt: new Date(),
          resolvedAt: blockedConversationStatus === 'RESOLVED' ? new Date() : null,
        },
      })

      await tx.crmChannelConnection.update({
        where: { id: args.channel.id },
        data: { lastWebhookAt: args.eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return { artifacts: args.artifacts, autoReply: false, webhookJobs: [] as ChatbotWebhookJob[] }
    }

    const catalogInsight = await resolveCatalogInsight({
      tx,
      empresaId: args.channel.empresaId,
      requestedProduct: effectiveProduct,
      messageText: args.messageText,
      lookupKind: resolveMaterialLookupKind({ messageText: args.messageText, requestedProduct: effectiveProduct, quickAction: selectedQuickAction }),
    })

    const businessActionResult = selectedQuickAction && (
      selectedQuickAction.kind === 'create_quote'
      || selectedQuickAction.kind === 'create_invoice'
      || selectedQuickAction.kind === 'create_work_order'
    )
      ? await createBusinessEntityFromChatbot(tx, {
          kind: selectedQuickAction.kind,
          empresaId: args.channel.empresaId,
          sedeId: args.channel.sedeId,
          createdById: args.channel.createdBy.id,
          nombre: resolvedIdentity.nombre,
          email: resolvedIdentity.email,
          phone: resolvedIdentity.phone,
          whatsapp: resolvedIdentity.whatsapp,
          requestedProduct: effectiveProduct,
          quantity: resolvedIdentity.quantity,
          companyName: resolvedIdentity.companyName,
          document: resolvedIdentity.document,
          city: resolvedIdentity.city,
          address: resolvedIdentity.address,
          material: catalogInsight.primary,
        })
      : null

    const assistantReply = buildAssistantReply({
      insight: catalogInsight,
      messageText: args.messageText,
      requestedProduct: effectiveProduct,
      requestHuman: args.requestHuman,
      leadQualified,
      nombre: resolvedIdentity.nombre,
      email: resolvedIdentity.email,
      phone: resolvedIdentity.phone,
      whatsapp: resolvedIdentity.whatsapp,
      companyName: resolvedIdentity.companyName,
      document: resolvedIdentity.document,
      city: resolvedIdentity.city,
      address: resolvedIdentity.address,
      quantity: resolvedIdentity.quantity,
      expectedField: args.expectedField,
      businessActionResult,
      showProductField: settings.showProductField,
      currentStageId: args.currentStageId,
      startStageId: activeFlow.startStageId,
      quickActionId: effectiveQuickActionId,
      responseOptionId: args.responseOptionId,
      flowStages,
      flowTriggers,
      quickActions,
      triggerContext: triggerMatchContext,
    })

    const resolvedStageId = matchedTriggerDestination.stageId || selectedQuickActionDestination.stageId || matchedResponseDestination.stageId || ''
    const resolvedStage = resolvedStageId
      ? findChatbotFlowStage(flowStages, resolvedStageId) ?? assistantReply.stage
      : assistantReply.stage
    const resolvedPauseNode = resolveChatPauseNode({
      currentStageId: args.currentStageId,
      resolvedStage,
      pauseNodes,
    })

    let runtimeState: ChatbotRuntimeState = {
      ...priorRuntimeState,
      variables: interactionRuntimeVariables,
    }
    let assistantContext = {
      contact_name: resolvedIdentity.nombre,
      contact_email: resolvedIdentity.email,
      contact_phone: resolvedIdentity.phone || resolvedIdentity.whatsapp,
      contact_whatsapp: resolvedIdentity.whatsapp,
      product_name: effectiveProduct,
      quantity: resolvedIdentity.quantity,
      company_name: resolvedIdentity.companyName,
      document: resolvedIdentity.document,
      city: resolvedIdentity.city,
      address: resolvedIdentity.address,
      channel_name: args.channel.name,
      assistant_name: settings.assistantName,
      lead_tags: args.artifacts.lead.tags.join(', '),
      ...runtimeState.variables,
    }

    let automationPauseDescription: string | null = null
    let automationPauseDurationMinutes: number | null = null
    const webhookJobs: ChatbotWebhookJob[] = []

    const assignedToUserIdCandidate = resolveChatbotAssignmentUserId({
      rules: studioSettings.assignmentRules,
      requestHuman: args.requestHuman,
      leadQualified,
      channelOwnerUserId: args.channel.createdBy.id,
    })

    const assignedToUser = assignedToUserIdCandidate === args.channel.createdBy.id
      ? { id: args.channel.createdBy.id }
      : await tx.user.findFirst({ where: { id: assignedToUserIdCandidate, empresaId: args.channel.empresaId }, select: { id: true } })

    let conversationAssignedToUserId: string | null = assignedToUser?.id || conversationSnapshot?.assignedToUserId || args.channel.createdBy.id
    let conversationStatus: 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM' = args.requestHuman ? 'HUMAN_ACTIVE' : 'BOT_ACTIVE'
    let conversationResolvedAt: Date | null = null

    if (selectedAutomation) {
      if (selectedAutomation.chat.openChat) {
        runtimeState = {
          ...runtimeState,
          botSubscriptionActive: true,
          pauseUntil: null,
        }
        conversationStatus = args.requestHuman ? 'HUMAN_ACTIVE' : 'BOT_ACTIVE'
      }

      if (selectedAutomation.chat.changeAssignee && selectedAutomation.chat.assigneeUserId) {
        const nextAssignee = await tx.user.findFirst({
          where: { id: selectedAutomation.chat.assigneeUserId, empresaId: args.channel.empresaId },
          select: { id: true },
        })
        if (nextAssignee) {
          conversationAssignedToUserId = nextAssignee.id
        }
      }

      if (selectedAutomation.chat.unassignOperator) {
        conversationAssignedToUserId = null
      }

      if (selectedAutomation.chat.pauseAutomation) {
        const durationMinutes = parsePauseDurationMinutes(selectedAutomation.chat.pauseDuration)
        if (durationMinutes) {
          runtimeState = {
            ...runtimeState,
            pauseUntil: new Date(Date.now() + (durationMinutes * 60 * 1000)).toISOString(),
          }
          automationPauseDescription = `Pausa automática desde la acción ${selectedQuickAction?.label || 'chatbot'}`
          automationPauseDurationMinutes = durationMinutes
          conversationStatus = 'PENDING'
        }
      }

      if (selectedAutomation.chat.closeChat) {
        conversationStatus = 'RESOLVED'
        conversationResolvedAt = new Date()
      }

      if (selectedAutomation.chat.cancelBotSubscription) {
        runtimeState = {
          ...runtimeState,
          botSubscriptionActive: false,
          pauseUntil: null,
        }
        conversationStatus = 'RESOLVED'
        conversationResolvedAt = new Date()
      }

      const nextLeadTags = new Set(args.artifacts.lead.tags)
      if (selectedAutomation.variables.addTagEnabled) {
        for (const tag of selectedAutomation.variables.addTags) {
          if (normalizeString(tag)) nextLeadTags.add(tag.trim())
        }
      }
      if (selectedAutomation.variables.removeTagEnabled) {
        for (const tag of selectedAutomation.variables.removeTags) {
          nextLeadTags.delete(tag)
        }
      }
      if (selectedAutomation.variables.addTagEnabled || selectedAutomation.variables.removeTagEnabled) {
        await tx.crmLead.update({
          where: { id: args.artifacts.lead.id },
          data: { tags: Array.from(nextLeadTags) },
        })
      }

      const nextRuntimeVariables = { ...runtimeState.variables }
      if (selectedAutomation.variables.setVariableEnabled && selectedAutomation.variables.variableKey) {
        nextRuntimeVariables[selectedAutomation.variables.variableKey] = interpolateChatbotVariables({
          template: selectedAutomation.variables.variableValue,
          variables: flowVariables,
          context: assistantContext,
        })
      }
      if (selectedAutomation.variables.deleteVariableEnabled && selectedAutomation.variables.deleteVariableKey) {
        delete nextRuntimeVariables[selectedAutomation.variables.deleteVariableKey]
      }
      runtimeState = {
        ...runtimeState,
        variables: nextRuntimeVariables,
      }
      assistantContext = {
        ...assistantContext,
        ...runtimeState.variables,
      }

      let opportunityId = conversationSnapshot?.opportunityId || args.artifacts.conversation.opportunityId || null
      if (selectedAutomation.crm.createDeal && !opportunityId) {
        const opportunity = await tx.crmOpportunity.create({
          data: {
            empresaId: args.channel.empresaId,
            sedeId: args.channel.sedeId,
            title: effectiveProduct ? `Oportunidad · ${effectiveProduct}` : `Oportunidad · ${resolvedIdentity.nombre || 'Chatbot omnicanal'}`,
            description: [
              selectedAutomation.crm.pipelineName ? `Pipeline: ${selectedAutomation.crm.pipelineName}` : '',
              args.messageText ? `Mensaje: ${args.messageText}` : '',
            ].filter(Boolean).join('\n'),
            stage: normalizeOpportunityStage(selectedAutomation.crm.dealStage),
            leadId: args.artifacts.lead.id,
            assignedToUserId: conversationAssignedToUserId,
            createdById: args.channel.createdBy.id,
          },
          select: { id: true },
        })
        opportunityId = opportunity.id
        await tx.crmConversation.update({
          where: { id: args.artifacts.conversation.id },
          data: { opportunityId },
        })
      }

      if (selectedAutomation.crm.editDeal && opportunityId) {
        await tx.crmOpportunity.update({
          where: { id: opportunityId },
          data: {
            stage: normalizeOpportunityStage(selectedAutomation.crm.dealStage),
            assignedToUserId: conversationAssignedToUserId,
            description: selectedAutomation.crm.pipelineName
              ? { set: `Pipeline: ${selectedAutomation.crm.pipelineName}` }
              : undefined,
          },
        })
      }

      if (selectedAutomation.googleSheets.fetchRow && selectedAutomation.googleSheets.spreadsheetId) {
        const lookupColumn = normalizeString(selectedAutomation.googleSheets.lookupColumn)
        const lookupValue = interpolateChatbotVariables({
          template: selectedAutomation.googleSheets.lookupValue,
          variables: flowVariables,
          context: assistantContext,
        })
        if (lookupColumn && lookupValue) {
          try {
            const sheetResult = await fetchGoogleSheetsRows({
              googleSheetsSpreadsheetId: selectedAutomation.googleSheets.spreadsheetId,
              googleSheetsSheetName: selectedAutomation.googleSheets.sheetName,
            })
            const matchedRow = sheetResult.rows.find((row) => normalizeString(row.raw[lookupColumn]).toLowerCase() === normalizeString(lookupValue).toLowerCase())
            if (matchedRow) {
              runtimeState = {
                ...runtimeState,
                googleSheetsRow: matchedRow.raw,
              }
            }
          } catch (error) {
            console.error('Error leyendo Google Sheets desde chatbot:', error)
          }
        }
      }

      const notificationRecipients = selectedAutomation.notifications.notifyMe
        ? buildNotificationRecipientsFromConfig(selectedAutomation.notifications)
        : []

      const externalWhatsAppTargets = resolveExternalWhatsAppNotificationTargets({
        notifyOtherContact: selectedAutomation.notifications.notifyOtherContact,
        targetContact: selectedAutomation.notifications.targetContact,
        fallbackWhatsapp: resolvedIdentity.whatsapp,
        fallbackPhone: resolvedIdentity.phone,
      })

      if (selectedAutomation.notifications.notifyMe) {
        const resolvedRecipients = await resolveChatbotNotificationRecipients(tx, {
          empresaId: args.channel.empresaId,
          rawRecipients: notificationRecipients,
        })
        const targetUserIds = uniqueStrings([
          ...resolvedRecipients.internalUserIds,
          notificationRecipients.length ? null : conversationAssignedToUserId,
          notificationRecipients.length ? null : args.channel.createdBy.id,
        ])
        if (!notificationRecipients.length && targetUserIds.length) {
          const fallbackUsers = await tx.user.findMany({
            where: {
              empresaId: args.channel.empresaId,
              id: { in: targetUserIds },
            },
            select: { email: true, telefono: true },
          })
          resolvedRecipients.emails = uniqueStrings([
            ...resolvedRecipients.emails,
            ...fallbackUsers.map((user) => user.email),
          ])
          resolvedRecipients.whatsapp = uniqueStrings([
            ...resolvedRecipients.whatsapp,
            ...fallbackUsers.map((user) => normalizeWhatsAppRecipient(user.telefono)),
          ])
        }
        const notificationBodyText = buildChatbotNotificationText({
          actionLabel: selectedQuickAction?.label || 'Acción del chatbot',
          contactName: resolvedIdentity.nombre,
          companyName: resolvedIdentity.companyName,
          requestedProduct: effectiveProduct,
          quantity: resolvedIdentity.quantity,
          whatsapp: resolvedIdentity.whatsapp,
          email: resolvedIdentity.email,
          summary: richTextToPlainText(assistantReply.body),
        })

        if (targetUserIds.length) {
          await tx.notification.createMany({
            data: targetUserIds.map((userId) => ({
              type: 'INFO',
              title: selectedQuickAction?.label ? `Automatización del chatbot: ${selectedQuickAction.label}` : 'Automatización del chatbot',
              body: [
                resolvedIdentity.nombre ? `Contacto: ${resolvedIdentity.nombre}` : '',
                effectiveProduct ? `Interés: ${effectiveProduct}` : '',
                selectedAutomation.notifications.notifyChannels.length ? `Canales: ${selectedAutomation.notifications.notifyChannels.join(', ')}` : '',
              ].filter(Boolean).join(' · ') || 'Se ejecutó una acción avanzada desde el chatbot.',
              empresaId: args.channel.empresaId,
              sedeId: args.channel.sedeId,
              userId,
              actionUrl: '/dashboard/crm',
              actionLabel: 'Abrir CRM',
            })),
          })
        }

        const normalizedChannels = normalizeNotificationChannels(selectedAutomation.notifications.notifyChannels)
        if (normalizedChannels.has('email')) {
          await sendChatbotNotificationEmail({
            to: resolvedRecipients.emails,
            actionLabel: selectedQuickAction?.label || 'Acción del chatbot',
            companyName: resolvedIdentity.companyName,
            bodyText: notificationBodyText,
          })
        }

        if (normalizedChannels.has('whatsapp')) {
          await sendChatbotNotificationWhatsApp(tx, {
            empresaId: args.channel.empresaId,
            sedeId: args.channel.sedeId,
            channelId: normalizeString(selectedAutomation.notifications.whatsappChannelId) || undefined,
            to: uniqueStrings([...resolvedRecipients.whatsapp, ...externalWhatsAppTargets]),
            bodyText: notificationBodyText,
          })
        }

        if (normalizedChannels.has('telegram')) {
          await sendChatbotNotificationTelegram({
            to: resolvedRecipients.telegram,
            bodyText: notificationBodyText,
          })
        }
      }

      if (externalWhatsAppTargets.length && !selectedAutomation.notifications.notifyMe) {
        await sendChatbotNotificationWhatsApp(tx, {
          empresaId: args.channel.empresaId,
          sedeId: args.channel.sedeId,
          channelId: normalizeString(selectedAutomation.notifications.whatsappChannelId) || undefined,
          to: externalWhatsAppTargets,
          bodyText: buildChatbotNotificationText({
            actionLabel: selectedQuickAction?.label || 'Acción del chatbot',
            contactName: resolvedIdentity.nombre,
            companyName: resolvedIdentity.companyName,
            requestedProduct: effectiveProduct,
            quantity: resolvedIdentity.quantity,
            whatsapp: resolvedIdentity.whatsapp,
            email: resolvedIdentity.email,
            summary: richTextToPlainText(assistantReply.body),
          }),
        })
      }

      if (selectedAutomation.notifications.addNote && selectedAutomation.notifications.noteText) {
        await tx.crmActivity.create({
          data: {
            empresaId: args.channel.empresaId,
            sedeId: args.channel.sedeId,
            type: 'NOTE',
            summary: 'Nota privada agregada por acción del chatbot',
            details: interpolateChatbotVariables({
              template: selectedAutomation.notifications.noteText,
              variables: flowVariables,
              context: assistantContext,
            }),
            leadId: args.artifacts.lead.id,
            opportunityId: conversationSnapshot?.opportunityId || args.artifacts.conversation.opportunityId || null,
            occurredAt: new Date(),
            createdById: args.channel.createdBy.id,
          },
        })
      }

      if (selectedAutomation.notifications.startA360Event && selectedAutomation.notifications.a360EventName) {
        runtimeState = {
          ...runtimeState,
          lastA360EventName: selectedAutomation.notifications.a360EventName,
        }
        await tx.crmActivity.create({
          data: {
            empresaId: args.channel.empresaId,
            sedeId: args.channel.sedeId,
            type: 'OTHER',
            summary: 'Evento A360 solicitado por chatbot',
            details: selectedAutomation.notifications.a360EventName,
            leadId: args.artifacts.lead.id,
            opportunityId: conversationSnapshot?.opportunityId || args.artifacts.conversation.opportunityId || null,
            occurredAt: new Date(),
            createdById: args.channel.createdBy.id,
          },
        })
      }

      if (selectedAutomation.notifications.sendWebhook && selectedAutomation.notifications.webhookUrl) {
        webhookJobs.push({
          url: selectedAutomation.notifications.webhookUrl,
          payload: {
            source: 'crm-chatbot',
            channelId: args.channel.id,
            quickActionId: selectedQuickAction?.id || null,
            quickActionLabel: selectedQuickAction?.label || null,
            leadId: args.artifacts.lead.id,
            conversationId: args.artifacts.conversation.id,
            contact: {
              name: resolvedIdentity.nombre,
              email: resolvedIdentity.email,
              phone: resolvedIdentity.phone,
              whatsapp: resolvedIdentity.whatsapp,
            },
            product: effectiveProduct,
            quantity: resolvedIdentity.quantity,
            runtime: runtimeState,
            targetContact: selectedAutomation.notifications.notifyOtherContact ? selectedAutomation.notifications.targetContact : null,
            a360EventName: selectedAutomation.notifications.startA360Event ? selectedAutomation.notifications.a360EventName : null,
            requestedAt: new Date().toISOString(),
          },
        })
      }
    }

    const shouldHandoffToHuman = args.requestHuman
      || selectedQuickAction?.kind === 'human'
      || matchedTrigger.matchedTrigger?.event === 'human_request'

    if (shouldHandoffToHuman || isHumanHandoffStage(resolvedStage)) {
      runtimeState = {
        ...runtimeState,
        botSubscriptionActive: false,
        pauseUntil: null,
      }
      conversationStatus = 'HUMAN_ACTIVE'
      conversationResolvedAt = null
    }

    const assistantBodyTemplate = matchedTrigger.matchedTrigger?.assistantReply || assistantReply.body
    const assistantBodyHtml = normalizeRichTextHtml(interpolateChatbotVariables({
      template: resolvedPauseNode
        ? appendPauseCopy(assistantBodyTemplate, resolvedPauseNode)
        : decorateAssistantReply(assistantBodyTemplate),
      variables: flowVariables,
      context: assistantContext,
    }))
    const assistantBody = richTextToPlainText(assistantBodyHtml)

    const stageQuickActions = getStageQuickActions(resolvedStage, quickActions)
    const stageResponseOptions = getStageResponseOptions(resolvedStage)

    let pauseUntil = resolvedPauseNode
      ? new Date(Date.now() + (resolvedPauseNode.durationMinutes * 60 * 1000)).toISOString()
      : null
    let pauseDescription = resolvedPauseNode?.description || null
    let pauseDurationMinutes = resolvedPauseNode?.durationMinutes || null

    if (runtimeState.pauseUntil && (!pauseUntil || Date.parse(runtimeState.pauseUntil) > Date.parse(pauseUntil))) {
      pauseUntil = runtimeState.pauseUntil
      pauseDescription = automationPauseDescription || pauseDescription
      pauseDurationMinutes = automationPauseDurationMinutes || pauseDurationMinutes
    }

    const activeInactivityRule = resolveActiveInactivityRule({
      stage: resolvedStage,
      quickAction: selectedQuickAction,
      trigger: matchedTrigger.matchedTrigger ?? null,
    })

    const quickActionAttachments = buildQuickActionAttachments(selectedQuickAction)
    const catalogAttachments = [catalogInsight.primary, ...catalogInsight.alternatives]
      .filter((item): item is MaterialMatch => Boolean(item?.imagenUrl))
      .slice(0, 3)
      .map((item) => ({ type: 'image' as const, url: item.imagenUrl!, alt: item.nombre }))
    const outboundAttachments = [...quickActionAttachments, ...catalogAttachments]
    const dispatchResult = await dispatchChatbotAutoReply({
      channel: args.channel,
      conversation: {
        contactPhone: args.artifacts.conversation.contactPhone,
        externalThreadId: args.artifacts.conversation.externalThreadId,
      },
      assistantBody,
      attachments: outboundAttachments,
    })

    const providerPayload = dispatchResult.payloadJson && typeof dispatchResult.payloadJson === 'object' && !Array.isArray(dispatchResult.payloadJson)
      ? dispatchResult.payloadJson as Record<string, unknown>
      : {}

    await tx.crmMessage.create({
      data: {
        empresaId: args.channel.empresaId,
        sedeId: args.channel.sedeId,
        conversationId: args.artifacts.conversation.id,
        providerMessageId: dispatchResult.providerMessageId,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        status: dispatchResult.messageStatus,
        bodyText: assistantBody,
        payloadJson: withChatbotMessageOrigin({
          ...providerPayload,
          provider: args.channel.provider,
          dispatch: dispatchResult.dispatch,
          chatRenderedHtml: assistantBodyHtml,
          matchedMaterialId: catalogInsight.primary?.id || null,
          alternativeMaterialIds: catalogInsight.alternatives.map((item) => item.id),
          catalogIntent: catalogInsight.catalogIntent,
          requestedProduct: effectiveProduct,
          chatFlowNextField: resolvedStage?.nextField === 'none' ? null : (assistantReply.nextField ?? resolvedStage?.nextField ?? null),
          chatFlowStageId: resolvedStage?.id || null,
          chatFlowId: activeFlow.id,
          chatFlowName: activeFlow.name,
          chatQuickActionIds: stageQuickActions.map((item) => item.id),
          chatFlowResponseOptionIds: stageResponseOptions.map((item) => item.id),
          chatPauseNodeId: resolvedPauseNode?.id || null,
          chatPauseDurationMinutes: pauseDurationMinutes,
          chatPauseDescription: pauseDescription,
          chatPauseUntil: pauseUntil,
          chatInactivityRule: activeInactivityRule as ChatbotInactivityRule | null,
          chatbotRuntime: runtimeState,
          quantity: resolvedIdentity.quantity,
          whatsapp: resolvedIdentity.whatsapp,
          address: resolvedIdentity.address,
          businessActionKind: businessActionResult?.kind || null,
          businessQuoteId: businessActionResult?.quoteId || null,
          businessQuoteNumber: businessActionResult?.quoteNumber || null,
          businessInvoiceNumber: businessActionResult?.invoiceNumber || null,
          businessWorkOrderNumber: businessActionResult?.workOrderNumber || null,
          matchedTriggerId: matchedTrigger.matchedTrigger?.id || null,
          error: dispatchResult.errorMessage,
        }, 'BOT'),
        attachmentsJson: outboundAttachments,
        occurredAt: new Date(),
      },
    })

    if (dispatchResult.messageStatus === 'FAILED') {
      conversationStatus = 'PENDING'
    }

    await tx.crmConversation.update({
      where: { id: args.artifacts.conversation.id },
      data: {
        assignedToUserId: conversationAssignedToUserId,
        status: conversationStatus,
        directionLastMessage: 'OUTBOUND',
        lastMessageAt: new Date(),
        resolvedAt: conversationResolvedAt,
      },
    })

    await tx.crmLeadCapture.update({
      where: { id: args.artifacts.capture.id },
      data: {
        normalizedDataJson: buildNormalizedCaptureData(args.artifacts.capture.normalizedDataJson, runtimeState),
      },
    })

    if (leadQualified && args.artifacts.lead.status === 'NEW') {
      await tx.crmLead.update({
        where: { id: args.artifacts.lead.id },
        data: {
          status: 'QUALIFIED',
          notes: [args.artifacts.lead.notes, `Producto consultado: ${effectiveProduct}`, resolvedIdentity.quantity ? `Cantidad solicitada: ${resolvedIdentity.quantity}` : '', resolvedIdentity.whatsapp ? `WhatsApp: ${resolvedIdentity.whatsapp}` : '', resolvedIdentity.address ? `Dirección: ${resolvedIdentity.address}` : ''].filter(Boolean).join('\n\n'),
        },
      })
    }

    await tx.crmActivity.create({
      data: {
        empresaId: args.channel.empresaId,
        sedeId: args.channel.sedeId,
        type: 'OTHER',
        summary: dispatchResult.messageStatus === 'FAILED'
          ? 'El chatbot generó respuesta pero falló el envío al canal'
          : catalogInsight.primary || catalogInsight.catalogIntent
            ? 'Respuesta automática del chatbot con catálogo e inventario'
            : 'Respuesta automática del chatbot',
        details: dispatchResult.messageStatus === 'FAILED' && dispatchResult.errorMessage
          ? `${assistantBody}\n\nError de envío: ${dispatchResult.errorMessage}`
          : assistantBody,
        leadId: args.artifacts.lead.id,
        occurredAt: new Date(),
        createdById: args.channel.createdBy.id,
      },
    })

    await tx.crmChannelConnection.update({
      where: { id: args.channel.id },
      data: { lastWebhookAt: args.eventAt, lastErrorAt: null, lastErrorMessage: null },
    })

    return { artifacts: args.artifacts, autoReply: true, webhookJobs }
  }

  return args.tx ? execute(args.tx) : prisma.$transaction(execute)
}

const SERVICE_HINT_TERMS = [
  'servicio',
  'servicios',
  'digital',
  'hosting',
  'dominio',
  'dominios',
  'plan',
  'planes',
  'mantenimiento',
  'asesoria',
  'consultoria',
  'diseno',
  'web',
  'landing',
  'seo',
  'redes',
  'marketing',
  'campana',
  'suscripcion',
]

type ChatFlowNextField = Exclude<ChatbotFlowNextField, 'none'> | null

type ChatbotInboundAttachment = {
  type: 'image' | 'document'
  url: string
  name: string | null
}

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
  const normalizedType = normalizeString(material.tipoNombre).toLowerCase()
  const normalizedCategory = normalizeString(material.categoria).toLowerCase()
  const normalizedSupplier = normalizeString(material.proveedor).toLowerCase()
  const haystack = [normalizedName, normalizedType, normalizedCategory, normalizedSupplier].filter(Boolean)
  if (normalizedName === normalizedQuery) return 100
  if (normalizedName.startsWith(normalizedQuery)) return 80
  if (haystack.some((value) => value.includes(normalizedQuery))) return 60

  const terms = splitSearchTerms(query)
  return terms.reduce((score, term) => (haystack.some((value) => value.includes(term)) ? score + 10 : score), 0)
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

function formatMaterialStock(material: MaterialMatch) {
  if (material.stockActual <= 0) return `Sin stock ahora mismo (${material.unidadMedida})`
  if (material.stockActual <= material.stockMinimo) return `Stock bajo: ${material.stockActual} ${material.unidadMedida}`
  return `Stock disponible: ${material.stockActual} ${material.unidadMedida}`
}

function isCatalogIntent(messageText: string, requestedProduct: string) {
  const source = normalizeString(requestedProduct || messageText).toLowerCase()
  if (!source) return false
  return [
    /\bcatal(ogo|ago)\b/i,
    /\bque\s+(productos|servicios|manejan|tienen|ofrecen)\b/i,
    /\b(stock|inventario|disponible|disponibilidad)\b/i,
    /\bmu[eé]strame\b.*\b(productos|catalogo|inventario)\b/i,
  ].some((pattern) => pattern.test(source))
}

function isUrlIntent(messageText: string) {
  const source = normalizeString(messageText).toLowerCase()
  if (!source) return false
  return [
    /\b(url|link|enlace|sitio|pagina|página|web|portafolio|portfolio)\b/i,
    /\bmandame\b.*\b(link|enlace|url|pagina|página|web)\b/i,
  ].some((pattern) => pattern.test(source))
}

function isServiceLikeMaterial(material: Pick<MaterialMatch, 'nombre' | 'tipoNombre' | 'categoria'>) {
  const source = normalizeString([material.nombre, material.tipoNombre, material.categoria].filter(Boolean).join(' ')).toLowerCase()
  return SERVICE_HINT_TERMS.some((term) => source.includes(term))
}

function resolveMaterialLookupKind(args: { messageText: string; requestedProduct: string; quickAction?: ChatbotQuickAction | null }): MaterialLookupKind {
  if (args.quickAction?.kind === 'product_lookup') return 'product'
  if (args.quickAction?.kind === 'service_lookup') return 'service'

  const source = normalizeString(args.requestedProduct || args.messageText).toLowerCase()
  if (!source) return 'any'
  return SERVICE_HINT_TERMS.some((term) => source.includes(term)) ? 'service' : 'any'
}

function prioritizeMaterialsByLookupKind(items: MaterialMatch[], lookupKind: MaterialLookupKind) {
  if (lookupKind === 'any') return items
  const preferred = items.filter((item) => lookupKind === 'service' ? isServiceLikeMaterial(item) : !isServiceLikeMaterial(item))
  const others = items.filter((item) => !preferred.some((preferredItem) => preferredItem.id === item.id))
  return [...preferred, ...others]
}

function resolveUrlQuickAction(args: { messageText: string; quickActions: ChatbotQuickAction[]; selectedQuickAction: ChatbotQuickAction | null }) {
  if (args.selectedQuickAction?.kind === 'url' && args.selectedQuickAction.actionUrl) return args.selectedQuickAction
  if (!isUrlIntent(args.messageText)) return null
  return args.quickActions.find((item) => item.enabled && item.kind === 'url' && item.actionUrl) ?? null
}

function dedupeMaterials(items: MaterialMatch[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function formatCatalogLines(items: MaterialMatch[]) {
  return items.map((item) => {
    const context = [item.categoria, item.proveedor].filter(Boolean).join(' · ')
    return `- ${item.nombre}: ${formatMaterialStock(item)}${context ? ` · ${context}` : ''} · ${formatMaterialPrice(item)}`
  }).join('\n')
}

async function resolveCatalogInsight(args: {
  tx: Prisma.TransactionClient
  empresaId: string
  requestedProduct: string
  messageText: string
  lookupKind: MaterialLookupKind
}) {
  const catalogIntent = isCatalogIntent(args.messageText, args.requestedProduct)
  const materialSearchText = args.requestedProduct || args.messageText
  const materialTerms = splitSearchTerms(materialSearchText)

  const materialCandidates = materialSearchText
    ? await args.tx.material.findMany({
        where: {
          empresaId: args.empresaId,
          activo: true,
          OR: materialTerms.length > 0
            ? materialTerms.flatMap((term) => ([
                { nombre: { contains: term, mode: 'insensitive' as const } },
                { tipoNombre: { contains: term, mode: 'insensitive' as const } },
                { categoria: { contains: term, mode: 'insensitive' as const } },
                { proveedor: { contains: term, mode: 'insensitive' as const } },
              ]))
            : [{ nombre: { contains: materialSearchText, mode: 'insensitive' as const } }],
        },
        select: {
          id: true,
          nombre: true,
          imagenUrl: true,
          tipoNombre: true,
          categoria: true,
          proveedor: true,
          precioM2: true,
          precioMetro: true,
          precioUnidad: true,
          stockActual: true,
          stockMinimo: true,
          unidadMedida: true,
          requiresWorkOrder: true,
        },
        take: 8,
      })
    : []

  const rankedMatches = prioritizeMaterialsByLookupKind(dedupeMaterials(
    materialCandidates
      .map((item) => ({ item, score: scoreMaterialMatch(item, materialSearchText) }))
      .sort((left, right) => right.score - left.score)
      .filter((entry) => entry.score > 0)
      .map((entry) => entry.item),
  ), args.lookupKind)

  const rawCatalog = catalogIntent
    ? await args.tx.material.findMany({
        where: {
          empresaId: args.empresaId,
          activo: true,
          ...(args.lookupKind === 'product' ? { stockActual: { gt: 0 } } : {}),
        },
        select: {
          id: true,
          nombre: true,
          imagenUrl: true,
          tipoNombre: true,
          categoria: true,
          proveedor: true,
          precioM2: true,
          precioMetro: true,
          precioUnidad: true,
          stockActual: true,
          stockMinimo: true,
          unidadMedida: true,
          requiresWorkOrder: true,
        },
        orderBy: [{ stockActual: 'desc' }, { updatedAt: 'desc' }],
        take: args.lookupKind === 'service' ? 12 : 5,
      })
    : []

  const catalog = prioritizeMaterialsByLookupKind(dedupeMaterials(rawCatalog), args.lookupKind)
    .filter((item) => args.lookupKind !== 'service' || isServiceLikeMaterial(item))
    .slice(0, 5)

  return {
    primary: rankedMatches[0] ?? null,
    alternatives: rankedMatches.slice(1, 4),
    catalog,
    query: materialSearchText,
    catalogIntent,
    lookupKind: args.lookupKind,
  } satisfies CatalogInsight
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

function isAffirmativeMessage(value: string) {
  const normalized = normalizeString(value).toLowerCase()
  return /^(si|sí|ok|dale|confirmo|confirmar|correcto|continuar|acepto|listo)\b/.test(normalized)
}

function isNegativeMessage(value: string) {
  const normalized = normalizeString(value).toLowerCase()
  return /^(no|corregir|editar|cambiar|ajustar)\b/.test(normalized)
}

function guessDocumentType(document: string, companyName: string) {
  const digits = document.replace(/\D+/g, '')
  if (companyName.trim()) return 'NIT'
  if (digits.length >= 9) return 'NIT'
  return 'CC'
}

function formatChatSummary(args: {
  nombre: string
  email: string
  phone: string
  whatsapp: string
  requestedProduct: string
  quantity: number | null
  companyName: string
  document: string
  city: string
  address: string
}) {
  return [
    'Resumen de tu solicitud:',
    `Nombre: ${args.nombre || 'Pendiente'}`,
    `Correo: ${args.email || 'Pendiente'}`,
    `Teléfono: ${args.phone || 'Pendiente'}`,
    `WhatsApp: ${args.whatsapp || 'Pendiente'}`,
    `Producto: ${args.requestedProduct || 'Pendiente'}`,
    `Cantidad: ${args.quantity || 'Pendiente'}`,
    `Empresa: ${args.companyName || 'Pendiente'}`,
    `Documento/NIT: ${args.document || 'Pendiente'}`,
    `Ciudad: ${args.city || 'Pendiente'}`,
    `Dirección: ${args.address || 'Pendiente'}`,
  ].join('\n')
}

async function ensureChatbotCliente(tx: Prisma.TransactionClient, args: {
  empresaId: string
  sedeId: string | null
  nombre: string
  document: string
  companyName: string
  email: string
  phone: string
  whatsapp: string
  city: string
  address: string
}) {
  const normalizedDocument = normalizeString(args.document)
  const clienteNombre = normalizeString(args.companyName || args.nombre)

  if (!normalizedDocument || !clienteNombre) return null

  const existing = await tx.cliente.findFirst({
    where: { empresaId: args.empresaId, documento: normalizedDocument },
    select: { id: true },
  })

  if (existing) {
    return tx.cliente.update({
      where: { id: existing.id },
      data: {
        nombre: clienteNombre,
        tipoDocumento: guessDocumentType(normalizedDocument, args.companyName),
        email: args.email || null,
        telefono: args.phone || null,
        celular: args.whatsapp || args.phone || null,
        direccion: args.address || null,
        ciudad: args.city || null,
        sedeId: args.sedeId,
      },
      select: { id: true, nombre: true },
    })
  }

  return tx.cliente.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      nombre: clienteNombre,
      tipoDocumento: guessDocumentType(normalizedDocument, args.companyName),
      documento: normalizedDocument,
      email: args.email || null,
      telefono: args.phone || null,
      celular: args.whatsapp || args.phone || null,
      direccion: args.address || null,
      ciudad: args.city || null,
    },
    select: { id: true, nombre: true },
  })
}

async function createBusinessEntityFromChatbot(tx: Prisma.TransactionClient, args: {
  kind: 'create_quote' | 'create_invoice' | 'create_work_order'
  empresaId: string
  sedeId: string | null
  createdById: string
  nombre: string
  email: string
  phone: string
  whatsapp: string
  requestedProduct: string
  quantity: number | null
  companyName: string
  document: string
  city: string
  address: string
  material: MaterialMatch | null
}) {
  if (!args.sedeId) throw new Error('CHATBOT_CHANNEL_WITHOUT_SEDE')
  if (!args.document || !args.requestedProduct || !args.quantity) return null

  const cliente = await ensureChatbotCliente(tx, args)
  if (!cliente) return null

  const sede = await tx.sede.findUnique({
    where: { id: args.sedeId },
    select: {
      codigo: true,
      cotizacionesPricesIncludeIva: true,
      cotizacionesIvaPct: true,
    },
  })
  const sedeCodigo = (sede?.codigo || '').trim() || '00'
  const pricesIncludeIva = sede?.cotizacionesPricesIncludeIva ?? true
  const ivaPct = Math.min(100, Math.max(0, sede?.cotizacionesIvaPct ?? 19))
  const seq = await tx.cotizacionSequence.upsert({
    where: { sedeId: args.sedeId },
    update: { currentNumber: { increment: 1 } },
    create: { sedeId: args.sedeId, currentNumber: 1 },
    select: { currentNumber: true },
  })

  const numero = `COT-${sedeCodigo}-${String(seq.currentNumber).padStart(4, '0')}`
  const unitPrice = args.material?.precioUnidad ?? args.material?.precioMetro ?? args.material?.precioM2 ?? 0
  const lineSubtotal = Math.max(0, unitPrice * args.quantity)
  const denom = 1 + (ivaPct / 100)
  const subtotal = pricesIncludeIva && denom > 0 ? lineSubtotal / denom : lineSubtotal
  const iva = pricesIncludeIva ? lineSubtotal - subtotal : subtotal * (ivaPct / 100)
  const total = pricesIncludeIva ? lineSubtotal : subtotal + iva
  const approved = args.kind !== 'create_quote'

  const cotizacion = await tx.cotizacion.create({
    data: {
      numero,
      sedeId: args.sedeId,
      clienteId: cliente.id,
      vendedorId: args.createdById,
      subtotal,
      descuento: 0,
      iva,
      total,
      validezDias: 15,
      estado: approved ? 'APROBADA' : 'BORRADOR',
      observaciones: [
        'Cotización generada automáticamente desde chatbot.',
        args.companyName ? `Empresa: ${args.companyName}` : null,
        args.city ? `Ciudad: ${args.city}` : null,
        args.address ? `Dirección: ${args.address}` : null,
        args.whatsapp ? `WhatsApp: ${args.whatsapp}` : null,
      ].filter(Boolean).join('\n'),
      items: {
        create: {
          descripcion: args.material?.nombre || args.requestedProduct,
          material: args.material?.id ? { connect: { id: args.material.id } } : undefined,
          cantidad: args.quantity,
          unidad: args.material?.unidadMedida || 'unidad',
          precioUnitario: unitPrice,
          subtotal: lineSubtotal,
          costoMaterial: unitPrice,
          costoImpresion: 0,
          costoAcabados: 0,
          costoInstalacion: 0,
        },
      },
    },
    select: { id: true, numero: true },
  })

  const result: BusinessActionResult = {
    kind: args.kind,
    quoteId: cotizacion.id,
    quoteNumber: cotizacion.numero,
  }

  if (args.kind === 'create_invoice') {
    const invoice = await ensureInvoiceFromQuote(tx, {
      cotizacionId: cotizacion.id,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      createdById: args.createdById,
    })
    result.invoiceNumber = invoice.numero
  }

  if (args.kind === 'create_work_order') {
    const workOrder = await ensureWorkOrderFromQuote(tx, {
      cotizacionId: cotizacion.id,
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      createdById: args.createdById,
    })
    result.workOrderNumber = workOrder?.numero || null
  }

  return result
}

function resolveChatIdentity(args: { nombre: string; email: string; phone: string; whatsapp: string; requestedProduct: string; companyName: string; document: string; city: string; address: string; messageText: string; expectedField?: string }) {
  const expectedField = normalizeString(args.expectedField).toLowerCase()
  const inferredName = extractName(args.messageText)
  const inferredEmail = extractEmail(args.messageText)
  const inferredPhone = extractPhone(args.messageText)

  return {
    nombre: args.nombre || (expectedField === 'name' ? inferredName || normalizeString(args.messageText) : inferredName),
    email: args.email || inferredEmail,
    phone: args.phone || inferredPhone,
    whatsapp: args.whatsapp || (expectedField === 'whatsapp' ? inferredPhone || normalizeString(args.messageText) : args.whatsapp),
    requestedProduct: args.requestedProduct || (expectedField === 'product' ? normalizeString(args.messageText) : args.requestedProduct),
    companyName: args.companyName || (expectedField === 'company' ? normalizeString(args.messageText) : args.companyName),
    document: args.document || (expectedField === 'document' ? normalizeString(args.messageText) : args.document),
    city: args.city || (expectedField === 'city' ? normalizeString(args.messageText) : args.city),
    address: args.address || (expectedField === 'address' ? normalizeString(args.messageText) : args.address),
    quantity: extractQuantity(args.messageText),
  }
}

function getNextChatField(args: { nombre: string; email: string; phone: string; whatsapp: string; requestedProduct: string; companyName: string; document: string; city: string; address: string; quantity: number | null; showProductField: boolean }) {
  if (!args.nombre) return 'name' satisfies ChatFlowNextField
  if (!args.email) return 'email' satisfies ChatFlowNextField
  if (!args.phone && !args.whatsapp && !args.requestedProduct) return 'phone' satisfies ChatFlowNextField
  if (!args.whatsapp) return 'whatsapp' satisfies ChatFlowNextField
  if (args.showProductField && !args.requestedProduct) return 'product' satisfies ChatFlowNextField
  if (args.requestedProduct && !args.quantity) return 'quantity' satisfies ChatFlowNextField
  if (!args.companyName) return 'company' satisfies ChatFlowNextField
  if (!args.document) return 'document' satisfies ChatFlowNextField
  if (!args.city) return 'city' satisfies ChatFlowNextField
  if (!args.address) return 'address' satisfies ChatFlowNextField
  return 'confirmation' satisfies ChatFlowNextField
}

function matchesTriggerCondition(args: {
  condition: ChatbotFlowTriggerCondition
  messageText: string
  context: Record<string, string | number | boolean | null | undefined>
}) {
  const candidateValue = normalizeString(args.context[args.condition.variableKey] ?? (args.condition.variableKey === 'ultimo_mensaje' ? args.messageText : '')).toLowerCase()
  const terms = args.condition.matchValue
    .split(/[\n,;|]+/)
    .map((item) => normalizeString(item).toLowerCase())
    .filter(Boolean)
  if (!terms.length && args.condition.matchMode !== 'regex') return false
  if (args.condition.matchMode === 'exact' || args.condition.matchMode === 'equals') return terms.some((term) => term === candidateValue)
  if (args.condition.matchMode === 'starts_with') return terms.some((term) => candidateValue.startsWith(term))
  if (args.condition.matchMode === 'regex') {
    try {
      return Boolean(new RegExp(args.condition.matchValue, 'i').test(candidateValue))
    } catch {
      return false
    }
  }
  return terms.some((term) => candidateValue.includes(term))
}

function resolveFlowDestination(args: {
  targetStageId?: string | null
  targetActionId?: string | null
  targetTriggerId?: string | null
  flowTriggers: ChatbotFlowTrigger[]
  flowStages: ChatbotFlowStage[]
  quickActions: ChatbotQuickAction[]
  messageText: string
  context: Record<string, string | number | boolean | null | undefined>
  visited?: Set<string>
}): { stageId: string; quickActionId: string } {
  const visited = args.visited ?? new Set<string>()

  if (args.targetActionId) {
    const action = findChatbotQuickAction(args.quickActions, args.targetActionId)
    if (!action) return { stageId: '', quickActionId: '' }
    if (action.targetTriggerId && !visited.has(`trigger:${action.targetTriggerId}`)) {
      visited.add(`action:${action.id}`)
      const resolved = resolveFlowDestination({
        targetTriggerId: action.targetTriggerId,
        flowTriggers: args.flowTriggers,
        flowStages: args.flowStages,
        quickActions: args.quickActions,
        messageText: args.messageText,
        context: args.context,
        visited,
      })
      return {
        stageId: resolved.stageId,
        quickActionId: action.id,
      }
    }
    return {
      stageId: action.targetStageId,
      quickActionId: action.id,
    }
  }

  if (args.targetTriggerId) {
    const triggerKey = `trigger:${args.targetTriggerId}`
    if (visited.has(triggerKey)) return { stageId: '', quickActionId: '' }
    visited.add(triggerKey)
    const trigger = args.flowTriggers.find((item) => item.id === args.targetTriggerId && item.enabled)
    if (!trigger) return { stageId: '', quickActionId: '' }
    const matchedCondition = trigger.conditions.find((condition) => matchesTriggerCondition({ condition, messageText: args.messageText, context: args.context })) ?? null
    return resolveFlowDestination({
      targetStageId: matchedCondition?.targetStageId || trigger.targetStageId,
      targetActionId: matchedCondition?.targetActionId || trigger.targetActionId,
      targetTriggerId: matchedCondition?.targetTriggerId || trigger.targetTriggerId,
      flowTriggers: args.flowTriggers,
      flowStages: args.flowStages,
      quickActions: args.quickActions,
      messageText: args.messageText,
      context: args.context,
      visited,
    })
  }

  return {
    stageId: args.targetStageId || '',
    quickActionId: '',
  }
}

function resolveInitialFlowStage(flowStages: ChatbotFlowStage[], startStageId: string) {
  if (startStageId) {
    const configuredStage = findChatbotFlowStage(flowStages, startStageId)
    if (configuredStage) return configuredStage
  }
  return findChatbotFlowStage(flowStages, 'welcome') ?? null
}

function resolveChatStage(args: {
  currentStageId: string
  startStageId: string
  flowStages: ChatbotFlowStage[]
  flowTriggers: ChatbotFlowTrigger[]
  quickActions: ChatbotQuickAction[]
  quickActionId: string
  matchedResponseOption: ChatbotFlowResponseOption | null
  messageText: string
  triggerContext: Record<string, string | number | boolean | null | undefined>
  requestedProduct: string
  requestHuman: boolean
  leadQualified: boolean
  catalogIntent: boolean
  nextField: ChatFlowNextField
}) {
  const currentStage = findChatbotFlowStage(args.flowStages, args.currentStageId)
    ?? resolveInitialFlowStage(args.flowStages, args.startStageId)
    ?? null

  const matchedResponseDestination = args.matchedResponseOption
    ? resolveFlowDestination({
        targetStageId: args.matchedResponseOption.targetStageId,
        targetActionId: args.matchedResponseOption.targetActionId,
        targetTriggerId: args.matchedResponseOption.targetTriggerId,
        flowTriggers: args.flowTriggers,
        flowStages: args.flowStages,
        quickActions: args.quickActions,
        messageText: args.messageText,
        context: args.triggerContext,
      })
    : null

  if (matchedResponseDestination?.stageId) {
    return findChatbotFlowStage(args.flowStages, matchedResponseDestination.stageId)
      ?? currentStage
      ?? null
  }

  const selectedQuickAction = findChatbotQuickAction(args.quickActions, args.quickActionId)
  const quickActionDestination = selectedQuickAction
    ? resolveFlowDestination({
        targetStageId: selectedQuickAction.targetStageId,
        targetTriggerId: selectedQuickAction.targetTriggerId,
        flowTriggers: args.flowTriggers,
        flowStages: args.flowStages,
        quickActions: args.quickActions,
        messageText: args.messageText,
        context: args.triggerContext,
      })
    : null

  if (quickActionDestination?.stageId) {
    return findChatbotFlowStage(args.flowStages, quickActionDestination.stageId)
      ?? currentStage
      ?? null
  }

  if (args.requestHuman || selectedQuickAction?.kind === 'human') {
    const humanStage = args.flowStages.find((stage) => getStageQuickActions(stage, args.quickActions).some((action) => action.kind === 'human'))
    return humanStage
      ?? findChatbotFlowStage(args.flowStages, 'handoff')
      ?? currentStage
      ?? args.flowStages.at(-1)
      ?? null
  }

  if (selectedQuickAction && selectedQuickAction.kind !== 'message') {
    return currentStage
  }

  if (args.leadQualified || args.catalogIntent || args.requestedProduct || args.nextField) {
    return currentStage
  }

  return currentStage
    ?? null
}

function decorateAssistantReply(baseBody: string, _stage?: ChatbotFlowStage | null, _currentStageId?: string, _quickActionId?: string) {
  return normalizeRichTextHtml(baseBody)
}

function stripGenericStudioFlowCopy(value: string | null | undefined) {
  const html = normalizeRichTextHtml(value || '')
  const plain = normalizeString(richTextToPlainText(html)).toLowerCase()
  if (!plain) return ''

  const genericCopies = new Set([
    'perfecto. te llevo al siguiente paso.',
    'perfecto. continuemos con la siguiente etapa.',
  ])

  return genericCopies.has(plain) ? '' : html
}

function resolveChatPauseNode(args: {
  currentStageId: string
  resolvedStage: ChatbotFlowStage | null
  pauseNodes: ChatbotStudioPauseNode[]
}) {
  if (!args.currentStageId || !args.resolvedStage?.id || args.currentStageId === args.resolvedStage.id) return null
  return args.pauseNodes.find((item) => item.enabled && item.sourceStageId === args.currentStageId && item.targetStageId === args.resolvedStage?.id) ?? null
}

function appendPauseCopy(baseBody: string, pauseNode: ChatbotStudioPauseNode | null) {
  if (!pauseNode) return baseBody
  const pauseSummary = pauseNode.description.trim()
    ? `${pauseNode.description.trim()}\nDuracion estimada: ${pauseNode.durationMinutes} min.`
    : `Haré una pausa automática de ${pauseNode.durationMinutes} min antes de continuar con el siguiente paso.`
  return [baseBody.trim(), pauseSummary].filter(Boolean).join('\n\n')
}

function buildQuickActionAttachments(action: ChatbotQuickAction | null) {
  if (!action?.responseAttachmentType || !action.responseAttachmentUrl) {
    return [] as Array<{ type: 'image'; url: string; alt: string | null } | { type: 'document'; url: string; alt?: string | null; name: string | null }>
  }

  if (action.responseAttachmentType === 'document') {
    return [{
      type: 'document' as const,
      url: action.responseAttachmentUrl,
      alt: action.responseAttachmentName || action.label || null,
      name: action.responseAttachmentName || null,
    }]
  }

  return [{
    type: 'image' as const,
    url: action.responseAttachmentUrl,
    alt: action.responseAttachmentName || action.label || null,
  }]
}

function splitConfigValues(value: string) {
  return value.split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean)
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => normalizeString(item)).filter(Boolean)))
}

function mergeRuntimeList(currentValue: string | undefined, nextValues: Array<string | null | undefined>) {
  return uniqueStrings([
    ...splitConfigValues(currentValue || ''),
    ...nextValues,
  ]).join(', ')
}

function buildNotificationRecipientsFromConfig(config: ChatbotQuickActionNotificationConfig) {
  const separated = [
    ...splitConfigValues(config.emailRecipients),
    ...splitConfigValues(config.whatsappRecipients).map((item) => `wa:${item}`),
    ...splitConfigValues(config.telegramRecipients).map((item) => `tg:${item}`),
  ]
  return uniqueStrings(separated.length ? separated : splitConfigValues(config.notifyRecipients))
}

function normalizeNotificationChannels(values: string[]) {
  const channels = new Set<ChatbotNotificationChannel>()

  for (const value of values) {
    const normalized = normalizeString(value).toLowerCase()
    if (!normalized) continue
    if (normalized === 'email' || normalized === 'correo' || normalized === 'mail') {
      channels.add('email')
      continue
    }
    if (normalized === 'whatsapp' || normalized === 'wa') {
      channels.add('whatsapp')
      continue
    }
    if (normalized === 'telegram' || normalized === 'tg') {
      channels.add('telegram')
    }
  }

  return channels
}

async function resolveChatbotNotificationRecipients(tx: Prisma.TransactionClient, args: { empresaId: string; rawRecipients: string[] }) {
  const explicitEmails = new Set<string>()
  const explicitPhones = new Set<string>()
  const explicitTelegram = new Set<string>()
  const candidateUserIds = new Set<string>()
  const candidateUserEmails = new Set<string>()

  for (const rawValue of args.rawRecipients) {
    const value = normalizeString(rawValue)
    if (!value) continue
    const lowered = value.toLowerCase()

    if (lowered.startsWith('tg:') || lowered.startsWith('telegram:')) {
      const chatId = value.includes(':') ? value.slice(value.indexOf(':') + 1).trim() : ''
      if (chatId) explicitTelegram.add(chatId)
      continue
    }

    if (lowered.startsWith('wa:') || lowered.startsWith('whatsapp:')) {
      const phone = normalizeWhatsAppRecipient(value.slice(value.indexOf(':') + 1))
      if (phone) explicitPhones.add(phone)
      continue
    }

    if (value.includes('@')) {
      explicitEmails.add(value)
      candidateUserEmails.add(value)
      continue
    }

    const normalizedPhone = normalizeWhatsAppRecipient(value)
    if (normalizedPhone && normalizedPhone.replace(/\D/g, '').length >= 8) {
      explicitPhones.add(normalizedPhone)
      continue
    }

    candidateUserIds.add(value)
  }

  const users = (candidateUserIds.size || candidateUserEmails.size)
    ? await tx.user.findMany({
        where: {
          empresaId: args.empresaId,
          OR: [
            ...(candidateUserIds.size ? [{ id: { in: Array.from(candidateUserIds) } }] : []),
            ...(candidateUserEmails.size ? [{ email: { in: Array.from(candidateUserEmails) } }] : []),
          ],
        },
        select: { id: true, email: true, telefono: true },
      })
    : []

  users.forEach((user) => {
    if (user.email) explicitEmails.add(user.email)
    const phone = normalizeWhatsAppRecipient(user.telefono)
    if (phone) explicitPhones.add(phone)
  })

  return {
    internalUserIds: users.map((user) => user.id),
    emails: Array.from(explicitEmails),
    whatsapp: Array.from(explicitPhones),
    telegram: Array.from(explicitTelegram),
  } satisfies ResolvedChatbotNotificationRecipients
}

function buildChatbotNotificationText(args: {
  actionLabel: string
  contactName: string
  companyName: string
  requestedProduct: string
  quantity: number | null
  whatsapp: string
  email: string
  summary: string
}) {
  return [
    `Automatización del chatbot: ${args.actionLabel}`,
    args.contactName ? `Contacto: ${args.contactName}` : '',
    args.companyName ? `Empresa: ${args.companyName}` : '',
    args.requestedProduct ? `Interés: ${args.requestedProduct}` : '',
    args.quantity ? `Cantidad: ${args.quantity}` : '',
    args.whatsapp ? `WhatsApp: ${args.whatsapp}` : '',
    args.email ? `Correo: ${args.email}` : '',
    args.summary,
  ].filter(Boolean).join('\n')
}

async function sendChatbotNotificationEmail(args: {
  to: string[]
  actionLabel: string
  companyName: string
  bodyText: string
}) {
  if (!args.to.length) return
  const html = renderEmail({
    title: `Automatización del chatbot: ${args.actionLabel}`,
    preheader: `Se ejecutó la acción ${args.actionLabel}`,
    intro: args.companyName ? `Empresa: ${args.companyName}` : 'Se ejecutó una automatización del chatbot.',
    bodyHtml: args.bodyText
      .split('\n')
      .map((line) => `<p style="margin:0 0 10px; color:#374151;">${escapeHtml(line)}</p>`)
      .join(''),
  })
  await sendEmail({
    to: args.to,
    subject: `Chatbot: ${args.actionLabel}`,
    html,
  })
}

async function sendChatbotNotificationWhatsApp(tx: Prisma.TransactionClient, args: {
  empresaId: string
  sedeId: string | null
  channelId?: string
  to: string[]
  bodyText: string
}) {
  if (!args.to.length) return

  const channels = await tx.crmChannelConnection.findMany({
    where: {
      empresaId: args.empresaId,
      provider: { in: ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX'] },
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: args.sedeId ? [{ sedeId: args.sedeId }, { sedeId: null }] : [{ sedeId: null }, {}],
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
  })

  const enabledChannels = channels.filter((channel) => getWhatsAppDispatchConfig(channel).enabled)
  const selectedChannel = args.channelId
    ? enabledChannels.find((channel) => channel.id === args.channelId) ?? null
    : enabledChannels[0] ?? null
  if (!selectedChannel) return

  const config = getWhatsAppDispatchConfig(selectedChannel)
  await Promise.allSettled(args.to.map((phone) => sendWhatsAppTextMessage({
    config,
    to: phone,
    bodyText: args.bodyText,
  })))
}

function resolveExternalWhatsAppNotificationTargets(args: {
  notifyOtherContact: boolean
  targetContact: string
  fallbackWhatsapp: string
  fallbackPhone: string
}) {
  if (!args.notifyOtherContact) return [] as string[]

  return uniqueStrings([
    normalizeWhatsAppRecipient(args.targetContact),
    normalizeWhatsAppRecipient(args.fallbackWhatsapp),
    normalizeWhatsAppRecipient(args.fallbackPhone),
  ])
}

async function sendChatbotNotificationTelegram(args: { to: string[]; bodyText: string }) {
  if (!args.to.length) return
  await Promise.allSettled(args.to.map((chatId) => sendTelegramMessage({ chatId, message: args.bodyText })))
}

function parsePauseDurationMinutes(value: string) {
  const normalized = normalizeString(value).toLowerCase()
  if (!normalized) return null

  const numericMatch = normalized.match(/(\d+(?:[.,]\d+)?)/)
  const numericValue = numericMatch ? Number.parseFloat(numericMatch[1].replace(',', '.')) : NaN
  const amount = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1

  if (normalized.includes('dia')) return Math.round(amount * 24 * 60)
  if (normalized.includes('hora') || normalized === 'h') return Math.round(amount * 60)
  if (normalized.includes('min')) return Math.round(amount)
  return Math.round(amount * 60)
}

function normalizeOpportunityStage(value: string) {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'NEW' || normalized === 'QUALIFIED' || normalized === 'PROPOSAL' || normalized === 'NEGOTIATION' || normalized === 'WON' || normalized === 'LOST') {
    return normalized as 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
  }
  return 'QUALIFIED' as const
}

function getDefaultRuntimeState(): ChatbotRuntimeState {
  return {
    botSubscriptionActive: true,
    pauseUntil: null,
    variables: {},
    googleSheetsRow: null,
    lastA360EventName: null,
  }
}

function parseRuntimeState(value: unknown): ChatbotRuntimeState {
  const normalizedData = parseJsonObject(value)
  const runtime = parseJsonObject(normalizedData.chatbotRuntime)
  const rawVariables = parseJsonObject(runtime.variables)
  const rawSheetsRow = parseJsonObject(runtime.googleSheetsRow)

  return {
    botSubscriptionActive: typeof runtime.botSubscriptionActive === 'boolean' ? runtime.botSubscriptionActive : true,
    pauseUntil: typeof runtime.pauseUntil === 'string' && runtime.pauseUntil.trim() ? runtime.pauseUntil : null,
    variables: Object.fromEntries(
      Object.entries(rawVariables)
        .map(([key, item]) => [key, normalizeString(item)] as const)
        .filter(([, item]) => Boolean(item)),
    ),
    googleSheetsRow: Object.keys(rawSheetsRow).length
      ? Object.fromEntries(
          Object.entries(rawSheetsRow)
            .map(([key, item]) => [key, normalizeString(item)] as const)
            .filter(([, item]) => Boolean(item)),
        )
      : null,
    lastA360EventName: typeof runtime.lastA360EventName === 'string' && runtime.lastA360EventName.trim()
      ? runtime.lastA360EventName
      : null,
  }
}

function buildNormalizedCaptureData(value: unknown, runtimeState: ChatbotRuntimeState) {
  return {
    ...parseJsonObject(value),
    chatbotRuntime: {
      botSubscriptionActive: runtimeState.botSubscriptionActive,
      pauseUntil: runtimeState.pauseUntil,
      variables: runtimeState.variables,
      googleSheetsRow: runtimeState.googleSheetsRow,
      lastA360EventName: runtimeState.lastA360EventName,
    },
  } satisfies Prisma.InputJsonValue
}

function hasFuturePause(pauseUntil: string | null) {
  if (!pauseUntil) return false
  const pauseUntilMs = Date.parse(pauseUntil)
  return Number.isFinite(pauseUntilMs) && pauseUntilMs > Date.now()
}

function resolveActiveInactivityRule(args: {
  stage: ChatbotFlowStage | null
  quickAction: ChatbotQuickAction | null
  trigger: ChatbotFlowTrigger | null
}) {
  if (args.quickAction?.inactivityRule?.enabled) return normalizeChatbotInactivityRule(args.quickAction.inactivityRule)
  if (args.trigger?.inactivityRule?.enabled) return normalizeChatbotInactivityRule(args.trigger.inactivityRule)
  if (args.stage?.inactivityRule?.enabled) return normalizeChatbotInactivityRule(args.stage.inactivityRule)
  return null
}

function buildAssistantReply(args: {
  insight: CatalogInsight
  messageText: string
  requestedProduct: string
  requestHuman: boolean
  leadQualified: boolean
  nombre: string
  email: string
  phone: string
  whatsapp: string
  quantity: number | null
  companyName: string
  document: string
  city: string
  address: string
  expectedField?: string
  businessActionResult?: BusinessActionResult | null
  showProductField: boolean
  currentStageId: string
  startStageId: string
  quickActionId: string
  responseOptionId: string
  flowStages: ChatbotFlowStage[]
  flowTriggers: ChatbotFlowTrigger[]
  quickActions: ChatbotQuickAction[]
  triggerContext: Record<string, string | number | boolean | null | undefined>
}) {
  const currentStage = findChatbotFlowStage(args.flowStages, args.currentStageId) ?? resolveInitialFlowStage(args.flowStages, args.startStageId) ?? null
  const matchedResponseOption = findChatbotFlowResponseOption(currentStage, args.responseOptionId)
    ?? matchChatbotFlowResponseOption(currentStage, args.messageText)
  const selectedQuickAction = findChatbotQuickAction(args.quickActions, args.quickActionId)

  if (args.requestHuman) {
    const handoffStage = resolveChatStage({
      currentStageId: args.currentStageId,
      startStageId: args.startStageId,
      flowStages: args.flowStages,
      flowTriggers: args.flowTriggers,
      quickActions: args.quickActions,
      quickActionId: args.quickActionId,
      matchedResponseOption,
      messageText: args.messageText,
      triggerContext: args.triggerContext,
      requestedProduct: args.requestedProduct,
      requestHuman: true,
      leadQualified: args.leadQualified,
      catalogIntent: args.insight.catalogIntent,
      nextField: null,
    })
    return {
      body: decorateAssistantReply('Listo. Ya registramos tu solicitud para que un asesor humano continúe la conversación desde el CRM.', handoffStage, args.currentStageId, args.quickActionId),
      nextField: null as ChatFlowNextField,
      stage: handoffStage,
    }
  }

  const nextField = getNextChatField({
    nombre: args.nombre,
    email: args.email,
    phone: args.phone,
    whatsapp: args.whatsapp,
    requestedProduct: args.requestedProduct,
    companyName: args.companyName,
    document: args.document,
    city: args.city,
    address: args.address,
    quantity: args.quantity,
    showProductField: args.showProductField,
  })

  const nextStage = resolveChatStage({
    currentStageId: args.currentStageId,
    startStageId: args.startStageId,
    flowStages: args.flowStages,
    flowTriggers: args.flowTriggers,
    quickActions: args.quickActions,
    quickActionId: args.quickActionId,
    matchedResponseOption,
    messageText: args.messageText,
    triggerContext: args.triggerContext,
    requestedProduct: args.requestedProduct,
    requestHuman: false,
    leadQualified: args.leadQualified,
    catalogIntent: args.insight.catalogIntent,
    nextField,
  })
  const preferredUrlAction = resolveUrlQuickAction({ messageText: args.messageText, quickActions: args.quickActions, selectedQuickAction })

  if (preferredUrlAction?.actionUrl) {
    return {
      body: decorateAssistantReply(`Te conviene revisar ${preferredUrlAction.label.toLowerCase()} aquí: ${preferredUrlAction.actionUrl}`, nextStage, args.currentStageId, args.quickActionId),
      nextField: null as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (
    selectedQuickAction
    && (selectedQuickAction.kind === 'create_quote' || selectedQuickAction.kind === 'create_invoice' || selectedQuickAction.kind === 'create_work_order')
    && !args.businessActionResult
  ) {
    return {
      body: decorateAssistantReply(`${formatChatSummary({ nombre: args.nombre, email: args.email, phone: args.phone, whatsapp: args.whatsapp, requestedProduct: args.requestedProduct, quantity: args.quantity, companyName: args.companyName, document: args.document, city: args.city, address: args.address })}\n\nAún no puedo ejecutar esa acción porque faltan datos clave o el producto no tiene suficiente contexto comercial. Completa el resumen y vuelve a intentarlo.`, nextStage, args.currentStageId, args.quickActionId),
      nextField: 'confirmation' as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (matchedResponseOption) {
    const stageField = nextStage?.nextField === 'none' ? null : nextStage?.nextField || null
    const optionReply = stripGenericStudioFlowCopy(matchedResponseOption.assistantReply)
    const stagePrompt = stripGenericStudioFlowCopy(nextStage?.prompt)
    return {
      body: decorateAssistantReply(optionReply || stagePrompt || '', nextStage, args.currentStageId, args.quickActionId),
      nextField: stageField as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (nextField === 'name') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Hola. Gracias por escribirnos. Me gustaría que me dijeras tu nombre para continuar.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'email') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, `Mucho gusto${args.nombre ? `, ${args.nombre}` : ''}. Ahora me gustaría que me dejaras tu correo para enviarte la información comercial.`), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'phone') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Perfecto. Si gustas, déjame también un teléfono o WhatsApp para que el centro de ventas pueda comunicarse contigo más rápido. Si prefieres, también puedes escribirme de una vez el producto que te interesa.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'whatsapp') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Gracias. Ahora déjame un WhatsApp de contacto para enviarte seguimiento y confirmar la solicitud.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'product') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Gracias. Ahora cuéntame qué producto o servicio te interesa para revisar inventario y precio de referencia.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'company') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Perfecto. Para dejar la solicitud más completa, indícame el nombre de la empresa o razón social.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'document') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Ahora compárteme el documento, NIT o identificación con la que debemos registrar la solicitud.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'city') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Gracias. ¿En qué ciudad debemos registrar esta solicitud?'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'address') {
    return { body: decorateAssistantReply(buildStagePromptFallback(nextStage, 'Perfecto. Ahora compárteme la dirección de entrega o facturación que debemos tener como referencia.'), nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (args.businessActionResult) {
    const businessSummary = args.businessActionResult.kind === 'create_invoice'
      ? `Ya generé la cotización ${args.businessActionResult.quoteNumber} y la factura ${args.businessActionResult.invoiceNumber || 'en borrador'}.`
      : args.businessActionResult.kind === 'create_work_order'
        ? `Ya generé la cotización ${args.businessActionResult.quoteNumber}${args.businessActionResult.workOrderNumber ? ` y la orden ${args.businessActionResult.workOrderNumber}` : ', aunque este ítem no produjo una orden de trabajo automática'}.`
        : `Ya generé la cotización ${args.businessActionResult.quoteNumber}.`
    return {
      body: decorateAssistantReply(`${businessSummary} El equipo comercial puede continuar desde el CRM con ese registro.`, nextStage, args.currentStageId, args.quickActionId),
      nextField: null as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (nextField === 'confirmation') {
    if (args.expectedField === 'confirmation' && isAffirmativeMessage(args.messageText)) {
      return {
        body: decorateAssistantReply('Perfecto. Ya validé el resumen. Si este flujo tiene una acción de negocio activa, ya puedes dispararla; si no, lo dejo listo para seguimiento comercial.', nextStage, args.currentStageId, args.quickActionId),
        nextField: null as ChatFlowNextField,
        stage: nextStage,
      }
    }

    if (args.expectedField === 'confirmation' && isNegativeMessage(args.messageText)) {
      return {
        body: decorateAssistantReply('Entendido. Escríbeme qué dato quieres corregir y hacemos el ajuste antes de continuar.', nextStage, args.currentStageId, args.quickActionId),
        nextField: 'confirmation' as ChatFlowNextField,
        stage: nextStage,
      }
    }

    return {
      body: decorateAssistantReply(`${formatChatSummary({ nombre: args.nombre, email: args.email, phone: args.phone, whatsapp: args.whatsapp, requestedProduct: args.requestedProduct, quantity: args.quantity, companyName: args.companyName, document: args.document, city: args.city, address: args.address })}\n\nSi todo está correcto, responde confirmar. Si el flujo tiene botones de negocio, también puedes usarlos ahora.`, nextStage, args.currentStageId, args.quickActionId),
      nextField,
      stage: nextStage,
    }
  }

  if (args.insight.catalogIntent && args.insight.catalog.length > 0 && !args.requestedProduct) {
    return {
      body: decorateAssistantReply([
        args.insight.lookupKind === 'service'
          ? 'Puedo ofrecerte estas opciones activas ahora mismo:'
          : 'Estas son algunas opciones activas ahora mismo:',
        formatCatalogLines(args.insight.catalog.slice(0, 3)),
        args.insight.lookupKind === 'service'
          ? 'Si una te sirve, dime cuál y te sigo guiando.'
          : 'Si una te interesa, dime cuál y la cantidad aproximada.',
      ].join('\n'), nextStage, args.currentStageId, args.quickActionId),
      nextField: 'product' as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (args.insight.primary) {
    const stockLabel = formatMaterialStock(args.insight.primary)
    const alternativesLabel = args.insight.alternatives.length
      ? ` También te puedo mostrar alternativas como ${args.insight.alternatives.map((item) => item.nombre).join(', ')}.`
      : ''
    if (nextField === 'quantity') {
      return {
        body: decorateAssistantReply([
          `Encontré ${args.insight.primary.nombre}.`,
          `Precio ref.: ${formatMaterialPrice(args.insight.primary)}.`,
          `${stockLabel}.`,
          'Ahora dime la cantidad.',
          alternativesLabel.trim(),
        ].join(' '), nextStage, args.currentStageId, args.quickActionId),
        nextField,
        stage: nextStage,
      }
    }

    return {
      body: decorateAssistantReply([
        `Encontré ${args.insight.primary.nombre}.`,
        `Precio ref.: ${formatMaterialPrice(args.insight.primary)}.`,
        `${stockLabel}.`,
        args.leadQualified
          ? `Tomo ${args.quantity || 'la cantidad solicitada'} como referencia y lo dejo listo para el equipo comercial.`
          : 'Con esto ya quedó encaminado para seguimiento comercial.',
        alternativesLabel.trim(),
      ].join(' '), nextStage, args.currentStageId, args.quickActionId),
      nextField: null as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (args.requestedProduct && args.insight.alternatives.length > 0) {
    return {
      body: decorateAssistantReply([
        `No encontré una coincidencia exacta para ${args.requestedProduct}. Estas referencias se parecen:`,
        formatCatalogLines(args.insight.alternatives),
        'Respóndeme con la más cercana o con medida, referencia o cantidad.',
      ].join('\n'), nextStage, args.currentStageId, args.quickActionId),
      nextField: 'quantity' as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (args.requestedProduct) {
    return {
      body: decorateAssistantReply(`Recibí tu consulta por ${args.requestedProduct}. No veo una coincidencia exacta todavía. Si me das cantidad, medida o referencia, afino la búsqueda; si prefieres, te paso con un asesor.`, nextStage, args.currentStageId, args.quickActionId),
      nextField: 'quantity' as ChatFlowNextField,
      stage: nextStage,
    }
  }

  return {
    body: decorateAssistantReply('Recibí tu mensaje. Si me dices el producto o servicio de interés, te respondo con la mejor ruta: catálogo, enlace útil o asesor.', nextStage, args.currentStageId, args.quickActionId),
    nextField: args.showProductField ? 'product' : null,
    stage: nextStage,
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
    const studioSettings = getChatbotStudioSettings(channel.settingsJson)
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
    const whatsapp = normalizeString(body?.whatsapp || body?.celular || payload.whatsapp || payload.celular)
    const requestedProduct = normalizeString(body?.producto || body?.product || payload.producto || payload.product)
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.question)
    const expectedField = normalizeString(payload.chatFlowNextField)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const address = normalizeString(body?.direccion || payload.direccion || payload.address)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const requestHuman = Boolean(body?.requestHuman || payload.requestHuman)
    const quickActionId = normalizeString(body?.quickActionId || payload.quickActionId)
    const responseOptionId = normalizeString(body?.responseOptionId || payload.responseOptionId)
    const currentStageId = normalizeString(body?.currentStageId || payload.currentStageId)
    const currentFlowId = normalizeString(body?.currentFlowId || payload.currentFlowId || payload.chatFlowId)
    const externalThreadId = normalizeString(body?.externalThreadId || payload.externalThreadId || `${channel.id}-${phone || email || Date.now()}`)
    const inboundAttachments = normalizeInboundAttachments(body?.attachments || payload.attachments)
    const inboundMessageType = inboundAttachments[0]?.type === 'image'
      ? 'IMAGE'
      : inboundAttachments[0]?.type === 'document'
        ? 'DOCUMENT'
        : 'TEXT'

    if (publicEmbedEnabled) {
      const requestHost = await getRequestHost()
      const referrerHost = await getReferrerHost()
      const embedHost = referrerHost === requestHost ? extractHostFromUrl(referrerUrl || landingPageUrl) : referrerHost
      if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: embedHost || requestHost, appHost: requestHost })) {
        return NextResponse.json({ error: 'Dominio no autorizado para este chatbot' }, { status: 403 })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const resolvedIdentity = resolveChatIdentity({ nombre, email, phone, whatsapp, requestedProduct, companyName: empresaNombre, document, city: ciudad, address, messageText, expectedField })
      const effectiveProduct = resolvedIdentity.requestedProduct
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
        messageType: inboundMessageType,
        eventAt,
        nombre: resolvedIdentity.nombre,
        empresaNombre: resolvedIdentity.companyName,
        email: resolvedIdentity.email,
        phone: resolvedIdentity.phone || resolvedIdentity.whatsapp,
        document: resolvedIdentity.document,
        ciudad: resolvedIdentity.city,
        messageText,
        externalThreadId,
        providerMessageId: normalizeString(body?.providerMessageId || payload.providerMessageId || `chatbot-${Date.now()}`),
        providerLeadId: normalizeString(body?.providerLeadId || resolvedIdentity.whatsapp || resolvedIdentity.phone || resolvedIdentity.email || null),
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
          phone: resolvedIdentity.phone || resolvedIdentity.whatsapp,
          whatsapp: resolvedIdentity.whatsapp,
          requestedProduct: effectiveProduct,
          empresaNombre: resolvedIdentity.companyName,
          ciudad: resolvedIdentity.city,
          document: resolvedIdentity.document,
          address: resolvedIdentity.address,
          messageText,
          requestHuman,
          quantity: resolvedIdentity.quantity,
          landingPageUrl,
          referrerUrl,
          attachments: inboundAttachments,
        },
        attachmentsJson: inboundAttachments,
      })

      return processChatbotInboundAutomation({
        tx,
        channel: {
          id: channel.id,
          name: channel.name,
          provider: 'WEB_CHATBOT',
          status: channel.status,
          empresaId: channel.empresaId,
          sedeId: channel.sedeId,
          verifyToken: channel.verifyToken,
          settingsJson: channel.settingsJson,
          externalPageId: channel.externalPageId,
          externalPhoneNumberId: channel.externalPhoneNumberId,
          createdBy: channel.createdBy,
        },
        eventAt,
        provider: 'WEB_CHATBOT',
        artifacts,
        nombre,
        email,
        phone,
        whatsapp,
        requestedProduct,
        empresaNombre,
        ciudad,
        document,
        address,
        messageText,
        expectedField,
        requestHuman,
        quickActionId,
        responseOptionId,
        currentStageId,
        currentFlowId,
        landingPageUrl,
        referrerUrl,
        inboundAttachments,
      })
    })

    if (result.webhookJobs.length) {
      await Promise.allSettled(
        result.webhookJobs.map(async (job) => {
          const response = await fetch(job.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job.payload),
          })
          if (!response.ok) {
            throw new Error(`Webhook ${job.url} respondió ${response.status}`)
          }
        }),
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.artifacts.lead.id,
        conversationId: result.artifacts.conversation.id,
        messageId: result.artifacts.message.id,
        captureId: result.artifacts.capture.id,
        autoReply: result.autoReply,
        testing: channel.status === 'TESTING',
        publicEmbedEnabled,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando chatbot CRM:', error)
    return NextResponse.json({ error: 'Error capturando chatbot CRM' }, { status: 500 })
  }
}

function normalizeInboundAttachments(value: unknown): ChatbotInboundAttachment[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const raw = item as Record<string, unknown>
      const type = normalizeString(raw.type).toLowerCase()
      const url = normalizeString(raw.url)
      if (!url || (type !== 'image' && type !== 'document')) return null
      return {
        type: type as ChatbotInboundAttachment['type'],
        url,
        name: normalizeString(raw.name || raw.alt) || null,
      } satisfies ChatbotInboundAttachment
    })
    .filter((item): item is ChatbotInboundAttachment => Boolean(item))
}

function buildStagePromptFallback(nextStage: ChatbotFlowStage | null, fallbackCopy: string) {
  const stagePrompt = richTextToPlainText(normalizeRichTextHtml(nextStage?.prompt || ''))
  return stagePrompt || fallbackCopy
}