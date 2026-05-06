import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import {
  findChatbotFlowResponseOption,
  findChatbotQuickAction,
  findChatbotFlowStage,
  getStageQuickActions,
  getStageResponseOptions,
  matchChatbotFlowResponseOption,
  type ChatbotFlowNextField,
  type ChatbotFlowResponseOption,
  type ChatbotFlowStage,
  type ChatbotQuickAction,
} from '@/lib/crm-chatbot-flow'
import {
  applyChatbotMessageCoherence,
  getChatbotAutomationFlowById,
  getDefaultChatbotAutomationFlowFromSettings,
  getChatbotStudioSettings,
  interpolateChatbotVariables,
  resolveChatbotAutomationFlowByTrigger,
  resolveChatbotAssignmentUserId,
  type ChatbotStudioPauseNode,
} from '@/lib/crm-chatbot-studio'
import { extractHostFromUrl, getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'

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

function resolveChatStage(args: {
  currentStageId: string
  flowStages: ChatbotFlowStage[]
  quickActions: ChatbotQuickAction[]
  quickActionId: string
  matchedResponseOption: ChatbotFlowResponseOption | null
  requestedProduct: string
  requestHuman: boolean
  leadQualified: boolean
  catalogIntent: boolean
  nextField: ChatFlowNextField
}) {
  if (args.matchedResponseOption) {
    return findChatbotFlowStage(args.flowStages, args.matchedResponseOption.targetStageId)
      ?? findChatbotFlowStage(args.flowStages, args.currentStageId)
      ?? args.flowStages[0]
      ?? null
  }

  const selectedQuickAction = findChatbotQuickAction(args.quickActions, args.quickActionId)

  if (args.requestHuman || selectedQuickAction?.kind === 'human') {
    return findChatbotFlowStage(args.flowStages, 'handoff') ?? args.flowStages.at(-1) ?? null
  }

  if (args.leadQualified) {
    return findChatbotFlowStage(args.flowStages, 'handoff')
      ?? findChatbotFlowStage(args.flowStages, 'qualification')
      ?? args.flowStages[0]
      ?? null
  }

  if (selectedQuickAction?.kind === 'catalog' || selectedQuickAction?.kind === 'stock' || args.catalogIntent || args.requestedProduct) {
    return findChatbotFlowStage(args.flowStages, 'catalog')
      ?? findChatbotFlowStage(args.flowStages, args.currentStageId)
      ?? args.flowStages[0]
      ?? null
  }

  if (selectedQuickAction?.kind === 'product_lookup' || selectedQuickAction?.kind === 'service_lookup') {
    return findChatbotFlowStage(args.flowStages, 'catalog')
      ?? findChatbotFlowStage(args.flowStages, args.currentStageId)
      ?? args.flowStages[0]
      ?? null
  }

  if (args.nextField === 'name') {
    return findChatbotFlowStage(args.flowStages, 'welcome')
      ?? findChatbotFlowStage(args.flowStages, args.currentStageId)
      ?? args.flowStages[0]
      ?? null
  }

  if (args.nextField) {
    return findChatbotFlowStage(args.flowStages, 'qualification')
      ?? findChatbotFlowStage(args.flowStages, args.currentStageId)
      ?? args.flowStages[0]
      ?? null
  }

  return findChatbotFlowStage(args.flowStages, args.currentStageId)
    ?? findChatbotFlowStage(args.flowStages, 'qualification')
    ?? args.flowStages[0]
    ?? null
}

function decorateAssistantReply(baseBody: string, stage: ChatbotFlowStage | null, currentStageId: string, quickActionId: string) {
  if (!stage?.prompt.trim()) return baseBody
  const normalizedBody = normalizeString(baseBody).toLowerCase()
  const normalizedPrompt = normalizeString(stage.prompt).toLowerCase()
  if (normalizedPrompt && normalizedBody.includes(normalizedPrompt)) return baseBody
  if (!quickActionId && currentStageId === stage.id) return baseBody
  return `${stage.prompt}\n\n${baseBody}`
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

function buildAssistantReply(args: {
  insight: CatalogInsight
  messageText: string
  requestedProduct: string
  requestHuman: boolean
  leadQualified: boolean
  nombre: string
  email: string
  phone: string
  quantity: number | null
  showProductField: boolean
  currentStageId: string
  quickActionId: string
  responseOptionId: string
  flowStages: ChatbotFlowStage[]
  quickActions: ChatbotQuickAction[]
}) {
  const currentStage = findChatbotFlowStage(args.flowStages, args.currentStageId) ?? args.flowStages[0] ?? null
  const matchedResponseOption = findChatbotFlowResponseOption(currentStage, args.responseOptionId)
    ?? matchChatbotFlowResponseOption(currentStage, args.messageText)
  const selectedQuickAction = findChatbotQuickAction(args.quickActions, args.quickActionId)

  if (args.requestHuman) {
    const handoffStage = resolveChatStage({
      currentStageId: args.currentStageId,
      flowStages: args.flowStages,
      quickActions: args.quickActions,
      quickActionId: args.quickActionId,
      matchedResponseOption,
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
    requestedProduct: args.requestedProduct,
    quantity: args.quantity,
    showProductField: args.showProductField,
  })

  const nextStage = resolveChatStage({
    currentStageId: args.currentStageId,
    flowStages: args.flowStages,
    quickActions: args.quickActions,
    quickActionId: args.quickActionId,
    matchedResponseOption,
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

  if (matchedResponseOption) {
    const stageField = nextStage?.nextField === 'none' ? null : nextStage?.nextField || null
    return {
      body: decorateAssistantReply(matchedResponseOption.assistantReply || nextStage?.prompt || 'Perfecto. Continuemos con la siguiente etapa.', nextStage, args.currentStageId, args.quickActionId),
      nextField: stageField as ChatFlowNextField,
      stage: nextStage,
    }
  }

  if (nextField === 'name') {
    return { body: decorateAssistantReply('Hola. Gracias por escribirnos. Me gustaría que me dijeras tu nombre para continuar.', nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'email') {
    return { body: decorateAssistantReply(`Mucho gusto${args.nombre ? `, ${args.nombre}` : ''}. Ahora me gustaría que me dejaras tu correo para enviarte la información comercial.`, nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'phone') {
    return { body: decorateAssistantReply('Perfecto. Si gustas, déjame también un teléfono o WhatsApp para que el centro de ventas pueda comunicarse contigo más rápido. Si prefieres, también puedes escribirme de una vez el producto que te interesa.', nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
  }

  if (nextField === 'product') {
    return { body: decorateAssistantReply('Gracias. Ahora cuéntame qué producto o servicio te interesa para revisar inventario y precio de referencia.', nextStage, args.currentStageId, args.quickActionId), nextField, stage: nextStage }
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
    const requestedProduct = normalizeString(body?.producto || body?.product || payload.producto || payload.product)
    const messageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message || payload.question)
    const expectedField = normalizeString(payload.chatFlowNextField)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const requestHuman = Boolean(body?.requestHuman || payload.requestHuman)
    const quickActionId = normalizeString(body?.quickActionId || payload.quickActionId)
    const responseOptionId = normalizeString(body?.responseOptionId || payload.responseOptionId)
    const currentStageId = normalizeString(body?.currentStageId || payload.currentStageId)
    const currentFlowId = normalizeString(body?.currentFlowId || payload.currentFlowId || payload.chatFlowId)

    if (publicEmbedEnabled) {
      const requestHost = await getRequestHost()
      const referrerHost = await getReferrerHost()
      const embedHost = referrerHost === requestHost ? extractHostFromUrl(referrerUrl || landingPageUrl) : referrerHost
      if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: embedHost || requestHost, appHost: requestHost })) {
        return NextResponse.json({ error: 'Dominio no autorizado para este chatbot' }, { status: 403 })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const defaultFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)
      const conversationFlow = getChatbotAutomationFlowById(studioSettings.automationFlows, currentFlowId) ?? defaultFlow
      const flowVariables = studioSettings.flowVariables.filter((item: { enabled: boolean }) => item.enabled)
      const resolvedIdentity = resolveChatIdentity({ nombre, email, phone, requestedProduct, messageText, expectedField })
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

      let activeFlow = conversationFlow
      let matchedTrigger = requestHuman
        ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: 'WEB_CHATBOT', event: 'human_request', value: 'human_request' })
        : leadQualified
          ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: 'WEB_CHATBOT', event: 'lead_qualified', value: 'lead_qualified' })
          : responseOptionId
            ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: 'WEB_CHATBOT', event: 'response_option', value: responseOptionId })
            : quickActionId
              ? resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: 'WEB_CHATBOT', event: 'quick_action', value: quickActionId })
              : resolveChatbotAutomationFlowByTrigger({ settings: studioSettings, provider: 'WEB_CHATBOT', event: 'message', value: messageText })

      if (matchedTrigger.flow?.id) {
        activeFlow = matchedTrigger.flow
      }

      const flowStages = activeFlow.flowStages.length ? activeFlow.flowStages : settings.flowStages
      const quickActions = activeFlow.quickActions.length ? activeFlow.quickActions : settings.quickActions
      const pauseNodes = activeFlow.pauseNodes
      const selectedQuickAction = findChatbotQuickAction(quickActions, quickActionId)
      const catalogInsight = await resolveCatalogInsight({
        tx,
        empresaId: channel.empresaId,
        requestedProduct: effectiveProduct,
        messageText,
        lookupKind: resolveMaterialLookupKind({ messageText, requestedProduct: effectiveProduct, quickAction: selectedQuickAction }),
      })

      const assistantReply = buildAssistantReply({
        insight: catalogInsight,
        messageText,
        requestedProduct: effectiveProduct,
        requestHuman,
        leadQualified,
        nombre: resolvedIdentity.nombre,
        email: resolvedIdentity.email,
        phone: resolvedIdentity.phone,
        quantity: resolvedIdentity.quantity,
        showProductField: settings.showProductField,
        currentStageId,
        quickActionId,
        responseOptionId,
        flowStages,
        quickActions,
      })

      const resolvedStage = matchedTrigger.matchedTrigger
        ? findChatbotFlowStage(flowStages, matchedTrigger.matchedTrigger.targetStageId) ?? assistantReply.stage
        : assistantReply.stage
      const resolvedPauseNode = resolveChatPauseNode({
        currentStageId,
        resolvedStage,
        pauseNodes,
      })
      const pauseUntil = resolvedPauseNode
        ? new Date(Date.now() + (resolvedPauseNode.durationMinutes * 60 * 1000)).toISOString()
        : null

      const assistantContext = {
        contact_name: resolvedIdentity.nombre,
        contact_email: resolvedIdentity.email,
        contact_phone: resolvedIdentity.phone,
        product_name: effectiveProduct,
        quantity: resolvedIdentity.quantity,
        company_name: empresaNombre,
        city: ciudad,
        channel_name: channel.name,
        assistant_name: settings.assistantName,
      }

      const assistantBodyTemplate = matchedTrigger.matchedTrigger?.assistantReply || assistantReply.body
      const assistantBody = applyChatbotMessageCoherence({
        body: interpolateChatbotVariables({
          template: resolvedPauseNode
            ? appendPauseCopy(assistantBodyTemplate, resolvedPauseNode)
            : decorateAssistantReply(assistantBodyTemplate, resolvedStage, currentStageId, quickActionId),
          variables: flowVariables,
          context: assistantContext,
        }),
        coherence: studioSettings.messageCoherence,
        variables: flowVariables,
        context: assistantContext,
      })

      const assignedToUserIdCandidate = resolveChatbotAssignmentUserId({
        rules: studioSettings.assignmentRules,
        requestHuman,
        leadQualified,
        channelOwnerUserId: channel.createdBy.id,
      })

      const assignedToUser = assignedToUserIdCandidate === channel.createdBy.id
        ? { id: channel.createdBy.id }
        : await tx.user.findFirst({ where: { id: assignedToUserIdCandidate, empresaId: channel.empresaId }, select: { id: true } })

      const assignedToUserId = assignedToUser?.id || channel.createdBy.id

      const stageQuickActions = getStageQuickActions(resolvedStage, quickActions)
      const stageResponseOptions = getStageResponseOptions(resolvedStage)

      await tx.crmMessage.create({
        data: {
          empresaId: channel.empresaId,
          sedeId: channel.sedeId,
          conversationId: artifacts.conversation.id,
          providerMessageId: `chatbot-assistant-${Date.now()}`,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          status: 'SENT',
          bodyText: assistantBody,
          payloadJson: {
            provider: 'WEB_CHATBOT',
            dispatch: 'guided-chatbot-autoreply',
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
            chatPauseDurationMinutes: resolvedPauseNode?.durationMinutes || null,
            chatPauseDescription: resolvedPauseNode?.description || null,
            chatPauseUntil: pauseUntil,
            quantity: resolvedIdentity.quantity,
            matchedTriggerId: matchedTrigger.matchedTrigger?.id || null,
          },
          attachmentsJson: [catalogInsight.primary, ...catalogInsight.alternatives]
            .filter((item): item is MaterialMatch => Boolean(item?.imagenUrl))
            .slice(0, 3)
            .map((item) => ({ type: 'image', url: item.imagenUrl, alt: item.nombre })),
          occurredAt: new Date(),
        },
      })

      await tx.crmConversation.update({
        where: { id: artifacts.conversation.id },
        data: {
          assignedToUserId,
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
          summary: catalogInsight.primary || catalogInsight.catalogIntent ? 'Respuesta automática del chatbot con catálogo e inventario' : 'Respuesta automática del chatbot',
          details: assistantBody,
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