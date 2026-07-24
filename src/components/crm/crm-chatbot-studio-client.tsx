'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Bot, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, GitBranch, GripVertical, History, Info, Plus, Redo2, Save, Smile, Trash2, Undo2, Users, Variable, Zap } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InfoHint } from '@/components/ui/info-hint'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  getDefaultChatbotFlowStages,
  getDefaultChatbotQuickActionAutomationConfig,
  getDefaultChatbotQuickActions,
  type ChatbotQuickActionAutomationConfig,
  type ChatbotFlowNextField,
  type ChatbotFlowResponseMatchMode,
  type ChatbotFlowResponseOption,
  type ChatbotFlowStage,
  type ChatbotFlowStageTemplateKey,
  type ChatbotQuickAction,
  type ChatbotQuickActionAttachmentType,
  type ChatbotQuickActionKind,
} from '@/lib/crm-chatbot-flow'
import {
  getDefaultChatbotAutomationFlow,
  getEmptyChatbotAutomationFlow,
  getDefaultChatbotAutomationFlowFromSettings,
  getDefaultChatbotAutomationProviders,
  getChatbotStudioSettings,
  getDefaultChatbotFlowTriggers,
  getDefaultChatbotFlowVariables,
  getDefaultChatbotMessageCoherence,
  getDefaultChatbotAssignmentRules,
  type ChatbotAutomationFlow,
  type ChatbotAutomationProvider,
  type ChatbotAssignmentMode,
  type ChatbotAssignmentRules,
  type ChatbotFlowTrigger,
  type ChatbotFlowTriggerCondition,
  type ChatbotFlowTriggerEvent,
  type ChatbotFlowTriggerMatchMode,
  type ChatbotFlowVariable,
  type ChatbotFlowVariableSource,
  type ChatbotMessageCoherence,
  type ChatbotMessageTone,
  type ChatbotStudioPauseNode,
} from '@/lib/crm-chatbot-studio'
import {
  getPublicChatbotPreChatFormPreset,
  getPublicChatbotPreChatFormPresets,
  getPublicChatbotSettings,
  type PublicChatbotResetConversationUnit,
} from '@/lib/crm-public-chatbot'
import {
  getDefaultChatbotInactivityRule,
  type ChatbotInactivityAction,
  type ChatbotInactivityRule,
  type ChatbotInactivityUnit,
} from '@/lib/crm-chatbot-inactivity'
import { normalizeRichTextHtml, plainTextToRichTextHtml, richTextToPlainText, summarizeRichText } from '@/lib/chatbot-rich-text'

type ChannelStatus = 'DRAFT' | 'TESTING' | 'ACTIVE' | 'DISABLED' | 'ERROR'

type ChannelConnection = {
  id: string
  name: string
  provider: 'WEB_CHATBOT'
  status: ChannelStatus
  settingsJson?: Record<string, unknown> | null
  _count?: { conversations: number; captures: number }
}

type Assignee = {
  id: string
  name: string | null
  email: string
  role: string
}

type ConversationRow = {
  id: string
  status: string
  contactDisplayName: string | null
  contactPhone: string | null
  contactEmail: string | null
  assignedToUserId: string | null
  assignedTo: { id: string; name: string | null; email: string } | null
  lastMessageAt: string | null
  unreadCount: number
  messages: Array<{
    id: string
    bodyText: string | null
    occurredAt: string
    direction: string
    sentByUser?: { id: string; name: string | null; email: string | null } | null
  }>
  lead?: { id: string; nombre: string; status: string } | null
  channelConnection: { id: string; name: string; provider: string; bridgeKind?: string | null }
}

type ConversationDetail = Omit<ConversationRow, 'messages'> & {
  cliente?: { id: string; nombre: string; documento: string | null; email: string | null; telefono: string | null; celular: string | null } | null
  opportunity?: { id: string; title: string; stage: string; expectedValue: number | null; probabilityPct: number | null } | null
  captures: Array<{ id: string; createdAt: string; payloadJson?: unknown }>
  messages: Array<{
    id: string
    direction: string
    bodyText: string | null
    occurredAt: string
    sentByUser?: { id: string; name: string | null; email: string | null } | null
    payloadJson?: Record<string, unknown> | null
  }>
}

type BuilderState = {
  channelName: string
  status: ChannelStatus
  rawSettingsJson: Record<string, unknown>
  chatbotTitle: string
  chatbotPrompt: string
  assistantName: string
  publicEmbedEnabled: boolean
  allowedDomains: string
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  resetConversationAfterValue: string
  resetConversationAfterUnit: PublicChatbotResetConversationUnit
  resetConversationAfterAction: ChatbotInactivityAction
  preChatFormEnabled: boolean
  preChatFormInactivityEnabled: boolean
  preChatFormInactivityValue: string
  preChatFormInactivityUnit: ChatbotInactivityUnit
  preChatFormInactivityAction: ChatbotInactivityAction
  preChatFormTemplate: string
  preChatFormTitle: string
  preChatFormDescription: string
  preChatFormSubmitLabel: string
  preChatFormShowNameField: boolean
  preChatFormShowEmailField: boolean
  preChatFormShowPhoneField: boolean
  preChatFormRequireName: boolean
  preChatFormRequireEmail: boolean
  preChatFormRequirePhone: boolean
  preChatFormRequireContactMethod: boolean
  preChatFormShowDepartmentField: boolean
  preChatFormDepartmentLabel: string
  preChatFormDepartmentPlaceholder: string
  preChatFormDepartmentOptions: string
  termsEnabled: boolean
  termsLabel: string
  termsLinkText: string
  termsLinkUrl: string
  automationFlows: ChatbotAutomationFlow[]
  selectedFlowId: string
  startStageId: string
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  flowTriggers: ChatbotFlowTrigger[]
  pauseNodes: ChatbotStudioPauseNode[]
  flowVariables: ChatbotFlowVariable[]
  assignmentRules: ChatbotAssignmentRules
  messageCoherence: ChatbotMessageCoherence
  studioNodeLayout: StudioNodeLayout
  studioViewport: StudioViewport
}

type StudioNodeLayout = Record<string, { x: number; y: number }>

type StudioViewport = {
  x: number
  y: number
  scale: number
}

type StudioFocusNode = {
  kind: 'stage' | 'trigger' | 'action' | 'pause' | 'start'
  id: string
}

type StudioEditingNode = StudioFocusNode | null
type StudioPrimaryPanel = 'map' | 'general' | 'summary' | 'library' | 'flow' | 'triggers' | 'variables' | 'assignments' | 'conversations'

const STUDIO_EMOJI_CHOICES = ['😀', '😁', '😂', '🙂', '😉', '😍', '🤩', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀', '🎉', '🛒', '💬', '📞', '📦', '⭐', '💡', '🎯', '❤️']
const RICH_TEXT_RENDER_CLASS = '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:mb-2 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_u]:underline [&_span]:whitespace-pre-wrap [&_div]:whitespace-pre-wrap'

const FILTER_VARIABLE_FALLBACK_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'productoCotizar', label: 'productoCotizar' },
  { key: 'contact_name', label: 'Nombre' },
  { key: 'lead_tags', label: 'Etiquetas' },
  { key: 'assigned_user', label: 'Asignado' },
  { key: 'contact_phone', label: 'Teléfono' },
  { key: 'country', label: 'País' },
  { key: 'was_in_flow', label: 'Estaba en flujo' },
  { key: 'ai_enabled', label: 'La integración de IA está activada.' },
  { key: 'was_in_campaign', label: 'Estaba en campaña' },
  { key: 'source', label: 'Fuente' },
  { key: 'last_activity', label: 'Última actividad' },
  { key: 'created_at', label: 'Fecha de registro' },
  { key: 'last_message_type', label: 'Tipo de último mensaje' },
  { key: 'ultimo_mensaje', label: 'Último mensaje' },
  { key: 'weekday', label: 'Días de la semana' },
  { key: 'execution_date', label: 'Fecha de ejecución' },
  { key: 'execution_time', label: 'Tiempo de ejecución' },
  { key: 'payment_complete', label: 'Pago completo' },
  { key: 'product_subscription', label: 'Suscripción al producto' },
  { key: 'chat_open', label: 'Chat está abierto' },
  { key: 'incoming_messages', label: 'Mensajes entrantes' },
  { key: 'unread_messages', label: 'Mensajes no leídos' },
]

type StudioDragState = {
  nodeId: string
  startPointerX: number
  startPointerY: number
  originX: number
  originY: number
}

type StudioPanState = {
  startPointerX: number
  startPointerY: number
  originX: number
  originY: number
}

type StudioGraphNode = {
  id: string
  domId: string
  kind: StudioFocusNode['kind'] | 'start'
  title: string
  subtitle: string
  description: string
  richContentHtml?: string
  x: number
  y: number
  width: number
  height: number
  accentClass: string
  headerClass: string
  headerBadgeClass: string
  toneClass: string
}

type StudioConnectionDraft = {
  fromId: string
  fromKind: StudioGraphNode['kind']
  sourceOptionId?: string
  sourceLabel?: string
  sourceOptionIndex?: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

type StudioCreateMenuTarget = {
  sourceNode?: StudioFocusNode
  sourceOptionId?: string
}

type StudioContextMenuState = {
  mode: 'node' | 'canvas' | 'create' | 'edge'
  node?: StudioFocusNode
  edge?: StudioGraphEdge
  createTarget?: StudioCreateMenuTarget
  x: number
  y: number
}

type StudioPaletteKind = 'stage' | 'action' | 'trigger' | 'pause'

type StudioTemplateItem = {
  id: string
  kind: StudioPaletteKind
  label: string
  description: string
  toneClass: string
}

type StudioGraphEdge = {
  id: string
  fromId: string
  toId: string
  sourceKind: StudioGraphNode['kind']
  targetKind: StudioGraphNode['kind']
  label: string
  sourceOptionId?: string
  sourceOptionIndex?: number
  toneClass: string
  showLabel?: boolean
  dashed?: boolean
}

const AUTOMATION_PROVIDER_OPTIONS: Array<{ value: ChatbotAutomationProvider; label: string }> = [
  { value: 'WEB_CHATBOT', label: 'Web chatbot' },
  { value: 'WHATSAPP_CLOUD', label: 'WhatsApp' },
  { value: 'INSTAGRAM_DM', label: 'Instagram' },
  { value: 'FACEBOOK_PAGE', label: 'Facebook' },
  { value: 'MESSENGER', label: 'Messenger' },
]

const STUDIO_PALETTE_ITEMS: Array<{ kind: StudioPaletteKind; label: string; description: string; className: string }> = [
  {
    kind: 'stage',
    label: 'Mensaje',
    description: 'Bloque principal del flujo conversacional.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300',
  },
  {
    kind: 'action',
    label: 'Accion',
    description: 'Ejecuta una respuesta rapida o una accion auxiliar.',
    className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950 hover:border-fuchsia-300',
  },
  {
    kind: 'trigger',
    label: 'Filtro',
    description: 'Evalua palabras, eventos o condiciones antes de enrutar.',
    className: 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300',
  },
  {
    kind: 'pause',
    label: 'Pausa',
    description: 'Inserta una espera visible entre dos mensajes del flujo.',
    className: 'border-sky-200 bg-sky-50 text-sky-950 hover:border-sky-300',
  },
]

const STUDIO_TEMPLATE_ITEMS: StudioTemplateItem[] = [
  {
    id: 'template-stage-form',
    kind: 'stage',
    label: 'Formulario',
    description: 'Mensaje base para pedir datos del cliente con una estructura guiada.',
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  {
    id: 'template-stage-list',
    kind: 'stage',
    label: 'Lista guiada',
    description: 'Bloque con opciones listas para enrutar servicios o estados.',
    toneClass: 'border-teal-200 bg-teal-50 text-teal-950',
  },
  {
    id: 'template-stage-variables',
    kind: 'stage',
    label: 'Variables',
    description: 'Mensaje listo para reutilizar placeholders del asistente.',
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-950',
  },
  {
    id: 'template-action-quote',
    kind: 'action',
    label: 'Acción cotizar',
    description: 'Acción rápida preconfigurada para crear una cotización.',
    toneClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950',
  },
  {
    id: 'template-action-human',
    kind: 'action',
    label: 'Escalar a humano',
    description: 'Atajo para derivar la conversación a un asesor.',
    toneClass: 'border-rose-200 bg-rose-50 text-rose-950',
  },
  {
    id: 'template-trigger-product',
    kind: 'trigger',
    label: 'Filtro producto',
    description: 'Filtro de ejemplo para enrutar según el producto cotizado.',
    toneClass: 'border-amber-200 bg-amber-50 text-amber-950',
  },
]

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function requestJson<T>(url: string, init?: RequestInit): Promise<{ success?: boolean; data?: T; error?: string }> {
  return fetch(url, init).then((res) => res.json().catch(() => ({}))) as Promise<{ success?: boolean; data?: T; error?: string }>
}

function normalizeStudioNodeLayout(value: unknown): StudioNodeLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const x = typeof (item as { x?: unknown }).x === 'number' ? (item as { x: number }).x : null
        const y = typeof (item as { y?: unknown }).y === 'number' ? (item as { y: number }).y : null
        if (x === null || y === null) return null
        return [key, { x, y }] as const
      })
      .filter((item): item is readonly [string, { x: number; y: number }] => Boolean(item)),
  )
}

function normalizeStudioViewport(value: unknown): StudioViewport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { x: 48, y: 36, scale: 0.88 }
  }

  const x = typeof (value as { x?: unknown }).x === 'number' ? (value as { x: number }).x : 48
  const y = typeof (value as { y?: unknown }).y === 'number' ? (value as { y: number }).y : 36
  const scale = typeof (value as { scale?: unknown }).scale === 'number' ? (value as { scale: number }).scale : 0.88
  return {
    x,
    y,
    scale: Math.min(1.6, Math.max(0.45, scale)),
  }
}

function clampStudioScale(value: number) {
  return Math.min(1.6, Math.max(0.45, value))
}

function toDomId(kind: StudioFocusNode['kind'], id: string) {
  if (kind === 'start') return 'studio-start'
  return `studio-${kind}-${id}`
}

function getNodeTypeLabel(kind: StudioGraphNode['kind']) {
  if (kind === 'stage') return 'Mensaje'
  if (kind === 'trigger') return 'Filtro'
  if (kind === 'action') return 'Accion'
  if (kind === 'pause') return 'Pausa'
  return 'Inicio'
}

function getNodeAnchorX(node: StudioGraphNode, side: 'left' | 'right') {
  return side === 'left' ? node.x : node.x + node.width
}

function getNodeAnchorY(node: StudioGraphNode) {
  return node.y + 52
}

function getGraphNodeHeight(args: { kind: StudioGraphNode['kind']; responseCount?: number; actionCount?: number; messageLength?: number }) {
  const baseHeight = 120

  if (args.kind === 'trigger') {
    const responseCount = Math.min(args.responseCount ?? 0, 6)
    return baseHeight + (responseCount > 0 ? 24 + (responseCount * 40) : 0)
  }

  if (args.kind !== 'stage') {
    return baseHeight
  }

  const responseCount = Math.min(args.responseCount ?? 0, 6)
  const actionCount = Math.min(args.actionCount ?? 0, 6)
  let height = baseHeight

  if (args.kind === 'stage' && typeof args.messageLength === 'number') {
    const estimatedLines = Math.min(10, Math.max(2, Math.ceil(args.messageLength / 34)))
    height += estimatedLines * 16
  }

  if (responseCount > 0) {
    height += 24 + (responseCount * 40)
  }

  if (actionCount > 0) {
    height += 24 + (actionCount * 40)
  }

  return height
}

function getStageOptionAnchorY(node: StudioGraphNode, optionIndex: number) {
  return node.y + 118 + (optionIndex * 42)
}

function getStageOptionAnchorX(node: StudioGraphNode) {
  return node.x + node.width - 16
}

function getTriggerConditionAnchorY(node: StudioGraphNode, optionIndex: number) {
  return node.y + 118 + (optionIndex * 42)
}

function getTriggerConditionSummary(condition: ChatbotFlowTriggerCondition) {
  const value = condition.matchValue.trim() || 'sin valor'
  return `${condition.variableKey} ${condition.matchMode} ${value}`
}

function getStageActionAnchorY(node: StudioGraphNode, responseCount: number, actionIndex: number) {
  return node.y + 134 + (responseCount * 42) + (actionIndex * 42)
}

function getNodeDropAnchorY(node: StudioGraphNode, pointerY?: number) {
  if (typeof pointerY !== 'number') return getNodeAnchorY(node)
  const top = node.y + 24
  const bottom = node.y + Math.max(40, node.height - 24)
  return Math.max(top, Math.min(bottom, pointerY))
}

function getBezierMidpoint(args: { startX: number; startY: number; control1X: number; control1Y: number; control2X: number; control2Y: number; endX: number; endY: number }) {
  const t = 0.5
  const x = ((1 - t) ** 3 * args.startX)
    + (3 * ((1 - t) ** 2) * t * args.control1X)
    + (3 * (1 - t) * (t ** 2) * args.control2X)
    + ((t ** 3) * args.endX)
  const y = ((1 - t) ** 3 * args.startY)
    + (3 * ((1 - t) ** 2) * t * args.control1Y)
    + (3 * (1 - t) * (t ** 2) * args.control2Y)
    + ((t ** 3) * args.endY)
  return { x, y }
}

function getEdgeCurveMetrics(source: StudioGraphNode, target: StudioGraphNode, anchors?: { startX?: number; startY?: number; endX?: number; endY?: number }) {
  const startX = anchors?.startX ?? getNodeAnchorX(source, 'right')
  const startY = anchors?.startY ?? getNodeAnchorY(source)
  const endX = anchors?.endX ?? getNodeAnchorX(target, 'left')
  const endY = anchors?.endY ?? getNodeAnchorY(target)
  const deltaX = Math.max((endX - startX) / 2, 56)
  const control1X = startX + deltaX
  const control2X = endX - deltaX
  const midpoint = getBezierMidpoint({
    startX,
    startY,
    control1X,
    control1Y: startY,
    control2X,
    control2Y: endY,
    endX,
    endY,
  })
  return {
    startX,
    startY,
    endX,
    endY,
    deltaX,
    midpoint,
    path: `M ${startX} ${startY} C ${control1X} ${startY}, ${control2X} ${endY}, ${endX} ${endY}`,
  }
}

function isPointInsideNode(node: StudioGraphNode, point: { x: number; y: number }, padding = 18) {
  return point.x >= (node.x - padding)
    && point.x <= (node.x + node.width + padding)
    && point.y >= (node.y - padding)
    && point.y <= (node.y + node.height + padding)
}

function duplicateResponseOption(option: ChatbotFlowResponseOption): ChatbotFlowResponseOption {
  return {
    ...option,
    id: makeId('option'),
    label: `${option.label} copia`,
    targetStageId: '',
    targetActionId: '',
    targetTriggerId: '',
  }
}

function createStageResponseOption(flowStages: ChatbotFlowStage[], currentStageId: string, patch?: Partial<ChatbotFlowResponseOption>): ChatbotFlowResponseOption {
  return {
    id: makeId('option'),
    label: 'Nueva opción',
    userMessage: 'Quiero continuar por esta ruta.',
    assistantReply: 'Perfecto. Te llevo al siguiente paso.',
    matchMode: 'contains',
    matchValue: '',
    targetStageId: '',
    targetActionId: '',
    targetTriggerId: '',
    ...patch,
  }
}

function createTriggerCondition(triggerId: string, patch?: Partial<ChatbotFlowTriggerCondition>): ChatbotFlowTriggerCondition {
  return {
    id: makeId(`${triggerId}-condition`),
    variableKey: 'productoCotizar',
    matchMode: 'equals',
    matchValue: '',
    targetStageId: '',
    targetActionId: '',
    targetTriggerId: '',
    ...patch,
  }
}

function reorderItems<T extends { id: string }>(items: T[], itemId: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return items
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const nextItems = [...items]
  const [item] = nextItems.splice(index, 1)
  nextItems.splice(nextIndex, 0, item)
  return nextItems
}

function removeNodeLayoutEntry(layout: StudioNodeLayout, nodeId: string) {
  const nextLayout = { ...layout }
  delete nextLayout[nodeId]
  return nextLayout
}

function moveStageToFirst<T extends { id: string }>(items: T[], stageId: string) {
  const stage = items.find((item) => item.id === stageId)
  if (!stage) return items
  return [stage, ...items.filter((item) => item.id !== stageId)]
}

function getNodeKindLabel(kind: StudioFocusNode['kind']) {
  if (kind === 'start') return 'Inicio'
  if (kind === 'stage') return 'Mensaje'
  if (kind === 'action') return 'Accion'
  if (kind === 'trigger') return 'Filtro'
  return 'Pausa'
}

function summarizeMatchValue(value: string, fallback: string) {
  const items = value
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (!items.length) return fallback
  if (items.length === 1) return items[0]
  return `${items[0]} +${items.length - 1}`
}

function summarizeTriggerConditions(trigger: ChatbotFlowTrigger) {
  if (!trigger.conditions.length) return 'Sin condiciones configuradas.'
  return trigger.conditions
    .slice(0, 3)
    .map((condition) => {
      const value = condition.matchValue.trim() || 'sin valor'
      return `${condition.variableKey} ${condition.matchMode} ${value}`
    })
    .join(' · ')
}

function getStageMessageContent(stage: ChatbotFlowStage) {
  return stage.prompt.trim() || stage.description.trim()
}

function escapePreviewHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getPreChatPreviewFields(builder: BuilderState) {
  const fields: Array<{ label: string; placeholder: string; required?: boolean }> = []

  if (builder.preChatFormShowNameField) {
    fields.push({ label: builder.nameLabel || 'Nombre', placeholder: builder.namePlaceholder || 'Tu nombre', required: builder.preChatFormRequireName })
  }
  if (builder.preChatFormShowEmailField) {
    fields.push({ label: builder.emailLabel || 'Correo', placeholder: builder.emailPlaceholder || 'tu@correo.com', required: builder.preChatFormRequireEmail })
  }
  if (builder.preChatFormShowPhoneField) {
    fields.push({ label: builder.phoneLabel || 'Teléfono', placeholder: builder.phonePlaceholder || 'Tu WhatsApp o teléfono', required: builder.preChatFormRequirePhone })
  }
  if (builder.preChatFormShowDepartmentField) {
    fields.push({ label: builder.preChatFormDepartmentLabel || 'Campo adicional', placeholder: builder.preChatFormDepartmentPlaceholder || 'Selecciona una opción' })
  }

  return fields
}

function getPreChatFormPreviewHtml(builder: BuilderState) {
  const fields = getPreChatPreviewFields(builder)
  const fieldsHtml = fields.length
    ? fields.map((field) => `<div><strong>${escapePreviewHtml(field.label)}${field.required ? ' *' : ''}</strong><br /><span>${escapePreviewHtml(field.placeholder)}</span></div>`).join('')
    : '<div><strong>Sin campos visibles</strong><br /><span>Activa al menos una entrada en el panel derecho.</span></div>'

  return `
    <div>
      <h3>${escapePreviewHtml(builder.preChatFormTitle || 'Formulario previo al chat')}</h3>
      <p>${escapePreviewHtml(builder.preChatFormDescription || 'Completa estos datos antes de iniciar la conversación.')}</p>
      ${fieldsHtml}
      <p><strong>Botón:</strong> ${escapePreviewHtml(builder.preChatFormSubmitLabel || 'Continuar')}</p>
    </div>
  `.trim()
}

function getStageMessageHtml(stage: ChatbotFlowStage) {
  return normalizeRichTextHtml(getStageMessageContent(stage))
}

function getStageMessageText(stage: ChatbotFlowStage) {
  return richTextToPlainText(getStageMessageHtml(stage))
}

function getStageCardPreview(stage: ChatbotFlowStage) {
  const lines = getStageMessageText(stage)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.slice(0, 4)
}

function getStageCardResponsePreview(stage: ChatbotFlowStage) {
  return stage.responseOptions
    .map((option) => option.label.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function getStageCardMeta(stage: ChatbotFlowStage) {
  const promptPreview = getStageCardPreview(stage)
  const hasCapture = stage.nextField !== 'none'

  if (stage.templateKey === 'prechat-form') {
    return {
      title: stage.title?.trim() || 'Formulario previo',
      subtitle: 'Vista previa del formulario',
      description: 'Muestra cómo verá el visitante este bloque antes de entrar al chat.',
    }
  }

  return {
    title: stage.title?.trim() || 'Mensaje',
    subtitle: hasCapture ? 'Espera respuesta del usuario' : 'Mensaje regular',
    description: promptPreview.join(' ') || 'Escribe el contenido principal del mensaje.',
  }
}

function buildStudioGraph(builder: BuilderState, measuredNodeHeights: Record<string, number> = {}) {
  const applyMeasuredHeight = <T extends StudioGraphNode>(node: T): T => ({
    ...node,
    height: measuredNodeHeights[node.id] ?? node.height,
  })

  const laneY = {
    triggers: 44,
    stages: 232,
    pauses: 402,
    actions: 534,
  }
  const startX = 36
  const stageStartX = 248
  const stageSpacing = 352
  const triggerStackGap = 108
  const actionStackGap = 122
  const pauseStackGap = 112

  const startNode: StudioGraphNode = applyMeasuredHeight({
    id: 'start',
    domId: 'studio-start',
    kind: 'start',
    title: 'Inicio',
    subtitle: 'Entrada del chatbot',
    description: builder.chatbotTitle || 'Nuevo visitante',
    x: startX,
    y: laneY.stages,
    width: 172,
    height: getGraphNodeHeight({ kind: 'start' }),
    accentClass: 'border-emerald-200 bg-white text-slate-900',
    headerClass: 'bg-emerald-50 text-emerald-900',
    headerBadgeClass: 'bg-white/90 text-emerald-700',
    toneClass: 'stroke-emerald-400',
  })

  const stageNodes: StudioGraphNode[] = builder.flowStages.map((stage, index) => {
    const id = `stage:${stage.id}`
    const layout = builder.studioNodeLayout[id]
    const meta = getStageCardMeta(stage)
    const messageHtml = stage.templateKey === 'prechat-form' ? getPreChatFormPreviewHtml(builder) : getStageMessageHtml(stage)
    const messageText = stage.templateKey === 'prechat-form' ? `${builder.preChatFormTitle}\n${builder.preChatFormDescription}\n${getPreChatPreviewFields(builder).map((field) => `${field.label}: ${field.placeholder}`).join('\n')}` : getStageMessageText(stage)
    return applyMeasuredHeight({
      id,
      domId: toDomId('stage', stage.id),
      kind: 'stage',
      title: meta.title,
      subtitle: meta.subtitle,
      description: meta.description,
      richContentHtml: messageHtml,
      x: layout?.x ?? stageStartX + (index * stageSpacing),
      y: layout?.y ?? laneY.stages,
      width: 232,
      height: getGraphNodeHeight({ kind: 'stage', responseCount: stage.responseOptions.length, actionCount: 0, messageLength: messageText.length }),
      accentClass: 'border-emerald-200 bg-white text-slate-900',
      headerClass: 'bg-emerald-50 text-emerald-900',
      headerBadgeClass: 'bg-white/90 text-emerald-700',
      toneClass: 'stroke-emerald-400',
    })
  })

  const stageIndexById = new Map(builder.flowStages.map((stage, index) => [stage.id, index]))
  const stageNodeByStageId = new Map(builder.flowStages.map((stage, index) => [stage.id, stageNodes[index]]))
  const triggerCountByStageId = new Map<string, number>()

  const triggerNodes: StudioGraphNode[] = builder.flowTriggers.map((trigger, index) => {
    const id = `trigger:${trigger.id}`
    const layout = builder.studioNodeLayout[id]
    const targetStageNode = stageNodeByStageId.get(trigger.targetStageId)
    const triggerCount = triggerCountByStageId.get(trigger.targetStageId) ?? 0
    triggerCountByStageId.set(trigger.targetStageId, triggerCount + 1)

    return applyMeasuredHeight({
      id,
      domId: toDomId('trigger', trigger.id),
      kind: 'trigger',
      title: trigger.label || `Disparador ${index + 1}`,
      subtitle: 'Filtro',
      description: summarizeTriggerConditions(trigger),
      x: layout?.x ?? (targetStageNode ? targetStageNode.x + 18 : stageStartX + ((stageIndexById.get(trigger.targetStageId) ?? index) * stageSpacing)),
      y: layout?.y ?? laneY.triggers + (triggerCount * triggerStackGap),
      width: 220,
      height: getGraphNodeHeight({ kind: 'trigger', responseCount: trigger.conditions.length }),
      accentClass: 'border-slate-200 bg-white text-slate-900',
      headerClass: trigger.enabled ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600',
      headerBadgeClass: trigger.enabled ? 'bg-white/90 text-amber-700' : 'bg-white/75 text-slate-500',
      toneClass: trigger.enabled ? 'stroke-amber-400' : 'stroke-slate-300',
    })
  })

  const actionStageIndex = new Map<string, number>()
  builder.flowStages.forEach((stage, index) => {
    stage.responseOptions.forEach((option) => {
      if (option.targetActionId && !actionStageIndex.has(option.targetActionId)) {
        actionStageIndex.set(option.targetActionId, index)
      }
    })
    stage.quickActionIds.forEach((actionId) => {
      if (!actionStageIndex.has(actionId)) {
        actionStageIndex.set(actionId, index)
      }
    })
  })
  const actionCountByStageIndex = new Map<number, number>()

  const actionNodes: StudioGraphNode[] = builder.quickActions.map((action, index) => {
    const id = `action:${action.id}`
    const layout = builder.studioNodeLayout[id]
    const sourceIndex = actionStageIndex.get(action.id) ?? index
    const actionCount = actionCountByStageIndex.get(sourceIndex) ?? 0
    actionCountByStageIndex.set(sourceIndex, actionCount + 1)

    return applyMeasuredHeight({
      id,
      domId: toDomId('action', action.id),
      kind: 'action',
      title: action.label || `Acción ${index + 1}`,
      subtitle: 'Acción rápida',
      description: action.message?.trim() || 'Configura el efecto o mensaje auxiliar de esta acción.',
      x: layout?.x ?? stageStartX + (sourceIndex * stageSpacing) + 20,
      y: layout?.y ?? laneY.actions + (actionCount * actionStackGap),
      width: 220,
      height: getGraphNodeHeight({ kind: 'action' }),
      accentClass: 'border-slate-200 bg-white text-slate-900',
      headerClass: action.enabled ? 'bg-fuchsia-500 text-white' : 'bg-slate-200 text-slate-600',
      headerBadgeClass: action.enabled ? 'bg-white/90 text-fuchsia-700' : 'bg-white/75 text-slate-500',
      toneClass: action.enabled ? 'stroke-fuchsia-400' : 'stroke-slate-300',
    })
  })

  const pauseCountBySourceIndex = new Map<number, number>()
  const pauseNodes: StudioGraphNode[] = builder.pauseNodes.map((pause, index) => {
    const id = `pause:${pause.id}`
    const layout = builder.studioNodeLayout[id]
    const sourceIndex = stageIndexById.get(pause.sourceStageId) ?? index
    const targetIndex = stageIndexById.get(pause.targetStageId) ?? sourceIndex + 1
    const pauseCount = pauseCountBySourceIndex.get(sourceIndex) ?? 0
    pauseCountBySourceIndex.set(sourceIndex, pauseCount + 1)
    const midpointIndex = sourceIndex + Math.max(0.45, (targetIndex - sourceIndex) * 0.5)

    return applyMeasuredHeight({
      id,
      domId: toDomId('pause', pause.id),
      kind: 'pause',
      title: pause.title || `Pausa ${index + 1}`,
      subtitle: 'Espera',
      description: pause.description || `Espera ${pause.durationMinutes} min antes del siguiente mensaje.`,
      x: layout?.x ?? stageStartX + (midpointIndex * stageSpacing) - 94,
      y: layout?.y ?? laneY.pauses + (pauseCount * pauseStackGap),
      width: 206,
      height: getGraphNodeHeight({ kind: 'pause' }),
      accentClass: 'border-slate-200 bg-white text-slate-900',
      headerClass: pause.enabled ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-600',
      headerBadgeClass: pause.enabled ? 'bg-white/90 text-sky-700' : 'bg-white/75 text-slate-500',
      toneClass: pause.enabled ? 'stroke-sky-400' : 'stroke-slate-300',
    })
  })

  const nodes = [startNode, ...triggerNodes, ...stageNodes, ...pauseNodes, ...actionNodes]
  const edges: StudioGraphEdge[] = []

  const startTargetStageId = builder.startStageId
  const startTargetNode = startTargetStageId ? stageNodes.find((node) => node.id === `stage:${startTargetStageId}`) : null

  if (startTargetNode) {
    edges.push({
      id: 'start-to-first-stage',
      fromId: startNode.id,
      toId: startTargetNode.id,
      sourceKind: 'start',
      targetKind: 'stage',
      label: 'inicio',
      toneClass: 'stroke-emerald-300',
      showLabel: false,
    })
  }

  builder.flowStages.forEach((stage) => {
    const sourceId = `stage:${stage.id}`
    stage.responseOptions.forEach((option, optionIndex) => {
      const actionTarget = option.targetActionId ? builder.quickActions.find((action) => action.id === option.targetActionId) : null
      const triggerTarget = option.targetTriggerId ? builder.flowTriggers.find((trigger) => trigger.id === option.targetTriggerId) : null
      if (!actionTarget && !triggerTarget && (!option.targetStageId || !stageIndexById.has(option.targetStageId))) return
      edges.push({
        id: `${sourceId}-option-${option.id}`,
        fromId: sourceId,
        toId: actionTarget ? `action:${actionTarget.id}` : triggerTarget ? `trigger:${triggerTarget.id}` : `stage:${option.targetStageId}`,
        sourceKind: 'stage',
        targetKind: actionTarget ? 'action' : triggerTarget ? 'trigger' : 'stage',
        label: option.label || 'ruta',
        sourceOptionId: option.id,
        sourceOptionIndex: optionIndex,
        toneClass: actionTarget ? 'stroke-fuchsia-300' : triggerTarget ? 'stroke-amber-300' : 'stroke-sky-300',
        showLabel: true,
      })
    })
  })

  builder.quickActions.forEach((action) => {
    const triggerTarget = action.targetTriggerId ? builder.flowTriggers.find((trigger) => trigger.id === action.targetTriggerId) : null
    if (!triggerTarget && (!action.targetStageId || !stageIndexById.has(action.targetStageId))) return
    edges.push({
      id: `action-${action.id}-to-${triggerTarget ? `trigger-${triggerTarget.id}` : `stage-${action.targetStageId}`}`,
      fromId: `action:${action.id}`,
      toId: triggerTarget ? `trigger:${triggerTarget.id}` : `stage:${action.targetStageId}`,
      sourceKind: 'action',
      targetKind: triggerTarget ? 'trigger' : 'stage',
      label: 'continua',
      toneClass: action.enabled ? 'stroke-fuchsia-300' : 'stroke-slate-300',
      showLabel: false,
      dashed: true,
    })
  })

  builder.flowTriggers.forEach((trigger) => {
    trigger.conditions.forEach((condition, conditionIndex) => {
      const actionTarget = condition.targetActionId ? builder.quickActions.find((action) => action.id === condition.targetActionId) : null
      if (!actionTarget && (!condition.targetStageId || !stageIndexById.has(condition.targetStageId))) return
      edges.push({
        id: `trigger-${trigger.id}-condition-${condition.id}`,
        fromId: `trigger:${trigger.id}`,
        toId: actionTarget ? `action:${actionTarget.id}` : `stage:${condition.targetStageId}`,
        sourceKind: 'trigger',
        targetKind: actionTarget ? 'action' : 'stage',
        label: getTriggerConditionSummary(condition),
        sourceOptionId: condition.id,
        sourceOptionIndex: conditionIndex,
        toneClass: actionTarget ? 'stroke-fuchsia-300' : 'stroke-amber-300',
        showLabel: true,
      })
    })

    if (trigger.conditions.length) return
    if (!stageIndexById.has(trigger.targetStageId)) return
    edges.push({
      id: `trigger-${trigger.id}-to-stage-${trigger.targetStageId}`,
      fromId: `trigger:${trigger.id}`,
      toId: `stage:${trigger.targetStageId}`,
      sourceKind: 'trigger',
      targetKind: 'stage',
      label: trigger.event === 'message' ? 'salto' : trigger.event.replaceAll('_', ' '),
      toneClass: trigger.enabled ? 'stroke-amber-300' : 'stroke-slate-300',
      showLabel: false,
    })
  })

  builder.pauseNodes.forEach((pause) => {
    const pauseNodeId = `pause:${pause.id}`
    if (stageIndexById.has(pause.sourceStageId)) {
      edges.push({
        id: `stage-${pause.sourceStageId}-to-pause-${pause.id}`,
        fromId: `stage:${pause.sourceStageId}`,
        toId: pauseNodeId,
        sourceKind: 'stage',
        targetKind: 'pause',
        label: `espera ${pause.durationMinutes} min`,
        toneClass: pause.enabled ? 'stroke-sky-300' : 'stroke-slate-300',
        showLabel: false,
      })
    }
    if (stageIndexById.has(pause.targetStageId)) {
      edges.push({
        id: `pause-${pause.id}-to-stage-${pause.targetStageId}`,
        fromId: pauseNodeId,
        toId: `stage:${pause.targetStageId}`,
        sourceKind: 'pause',
        targetKind: 'stage',
        label: 'continua',
        toneClass: pause.enabled ? 'stroke-sky-300' : 'stroke-slate-300',
        showLabel: false,
      })
    }
  })

  const contentWidth = Math.max(...nodes.map((node) => node.x + node.width), 1320) + 180
  const contentHeight = Math.max(...nodes.map((node) => node.y + node.height + 24), 820)

  return { nodes, edges, contentWidth, contentHeight }
}

function applySelectedFlowToBuilder(base: BuilderState, flowId?: string) {
  const selectedFlow = base.automationFlows.find((flow) => flow.id === (flowId || base.selectedFlowId))
    ?? base.automationFlows.find((flow) => flow.isDefault)
    ?? base.automationFlows[0]
    ?? getDefaultChatbotAutomationFlow()

  return {
    ...base,
    selectedFlowId: selectedFlow.id,
    startStageId: selectedFlow.startStageId,
    quickActions: selectedFlow.quickActions,
    flowStages: selectedFlow.flowStages,
    flowTriggers: selectedFlow.flowTriggers,
    pauseNodes: selectedFlow.pauseNodes,
    studioNodeLayout: selectedFlow.studioNodeLayout,
    studioViewport: selectedFlow.studioViewport,
  }
}

function updateSelectedFlowInBuilder(current: BuilderState, patch: Partial<ChatbotAutomationFlow>) {
  const nextFlows = current.automationFlows.map((flow) => flow.id === current.selectedFlowId ? { ...flow, ...patch } : flow)
  return applySelectedFlowToBuilder({
    ...current,
    automationFlows: nextFlows,
  })
}

function materializeSelectedFlow(current: BuilderState) {
  return {
    ...current,
    automationFlows: current.automationFlows.map((flow) => flow.id === current.selectedFlowId
      ? {
          ...flow,
          startStageId: current.startStageId,
          quickActions: current.quickActions,
          flowStages: current.flowStages,
          flowTriggers: current.flowTriggers,
          pauseNodes: current.pauseNodes,
          studioNodeLayout: current.studioNodeLayout,
          studioViewport: current.studioViewport,
        }
      : flow),
  }
}

function hydrateBuilder(channel?: ChannelConnection | null): BuilderState {
  const settingsJson = (channel?.settingsJson as Record<string, unknown> | null | undefined) ?? {}
  const publicSettings = getPublicChatbotSettings(settingsJson)
  const studioSettings = getChatbotStudioSettings(settingsJson)
  const defaultFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)

  return applySelectedFlowToBuilder({
    channelName: channel?.name ?? 'Chatbot web principal',
    status: channel?.status ?? 'TESTING',
    rawSettingsJson: settingsJson,
    chatbotTitle: publicSettings.chatbotTitle,
    chatbotPrompt: publicSettings.chatbotPrompt,
    assistantName: publicSettings.assistantName,
    publicEmbedEnabled: publicSettings.publicEmbedEnabled,
    allowedDomains: publicSettings.allowedDomains.join('\n'),
    nameLabel: publicSettings.nameLabel,
    namePlaceholder: publicSettings.namePlaceholder,
    emailLabel: publicSettings.emailLabel,
    emailPlaceholder: publicSettings.emailPlaceholder,
    phoneLabel: publicSettings.phoneLabel,
    phonePlaceholder: publicSettings.phonePlaceholder,
    resetConversationAfterValue: String(publicSettings.resetConversationAfterValue),
    resetConversationAfterUnit: publicSettings.resetConversationAfterUnit,
    resetConversationAfterAction: publicSettings.resetConversationAfterAction,
    preChatFormEnabled: publicSettings.preChatFormEnabled,
    preChatFormInactivityEnabled: publicSettings.preChatFormInactivityRule.enabled,
    preChatFormInactivityValue: String(publicSettings.preChatFormInactivityRule.timeoutValue),
    preChatFormInactivityUnit: publicSettings.preChatFormInactivityRule.timeoutUnit,
    preChatFormInactivityAction: publicSettings.preChatFormInactivityRule.action,
    preChatFormTemplate: publicSettings.preChatFormTemplate,
    preChatFormTitle: publicSettings.preChatFormTitle,
    preChatFormDescription: publicSettings.preChatFormDescription,
    preChatFormSubmitLabel: publicSettings.preChatFormSubmitLabel,
    preChatFormShowNameField: publicSettings.preChatFormShowNameField,
    preChatFormShowEmailField: publicSettings.preChatFormShowEmailField,
    preChatFormShowPhoneField: publicSettings.preChatFormShowPhoneField,
    preChatFormRequireName: publicSettings.preChatFormRequireName,
    preChatFormRequireEmail: publicSettings.preChatFormRequireEmail,
    preChatFormRequirePhone: publicSettings.preChatFormRequirePhone,
    preChatFormRequireContactMethod: publicSettings.preChatFormRequireContactMethod,
    preChatFormShowDepartmentField: publicSettings.preChatFormShowDepartmentField,
    preChatFormDepartmentLabel: publicSettings.preChatFormDepartmentLabel,
    preChatFormDepartmentPlaceholder: publicSettings.preChatFormDepartmentPlaceholder,
    preChatFormDepartmentOptions: publicSettings.preChatFormDepartmentOptions.map((item) => item.label).join('\n'),
    termsEnabled: publicSettings.termsEnabled,
    termsLabel: publicSettings.termsLabel,
    termsLinkText: publicSettings.termsLinkText,
    termsLinkUrl: publicSettings.termsLinkUrl,
    automationFlows: studioSettings.automationFlows,
    selectedFlowId: defaultFlow.id,
    startStageId: defaultFlow.startStageId,
    quickActions: defaultFlow.quickActions,
    flowStages: defaultFlow.flowStages,
    flowTriggers: defaultFlow.flowTriggers,
    pauseNodes: defaultFlow.pauseNodes,
    flowVariables: studioSettings.flowVariables,
    assignmentRules: studioSettings.assignmentRules,
    messageCoherence: studioSettings.messageCoherence,
    studioNodeLayout: defaultFlow.studioNodeLayout || normalizeStudioNodeLayout(settingsJson.studioNodeLayout),
    studioViewport: defaultFlow.studioViewport || normalizeStudioViewport(settingsJson.studioViewport),
  })
}

function createChannelBuilderPreset(mode: 'empty' | 'template'): BuilderState {
  if (mode === 'template') return hydrateBuilder(null)

  const emptyFlow = getEmptyChatbotAutomationFlow()
  return applySelectedFlowToBuilder({
    ...hydrateBuilder(null),
    automationFlows: [emptyFlow],
    selectedFlowId: emptyFlow.id,
    startStageId: emptyFlow.startStageId,
    quickActions: emptyFlow.quickActions,
    flowStages: emptyFlow.flowStages,
    flowTriggers: emptyFlow.flowTriggers,
    pauseNodes: emptyFlow.pauseNodes,
    studioNodeLayout: emptyFlow.studioNodeLayout,
    studioViewport: emptyFlow.studioViewport,
  }, emptyFlow.id)
}

function buildSettingsPayload(state: BuilderState) {
  const snapshot = materializeSelectedFlow(state)
  const selectedFlow = snapshot.automationFlows.find((flow) => flow.id === snapshot.selectedFlowId) ?? getDefaultChatbotAutomationFlow()
  const automationFlows = snapshot.automationFlows.map((flow) => flow.id === selectedFlow.id ? selectedFlow : flow)
  const defaultFlow = automationFlows.find((flow) => flow.isDefault) ?? selectedFlow

  return {
    ...snapshot.rawSettingsJson,
    chatbotTitle: snapshot.chatbotTitle,
    chatbotPrompt: snapshot.chatbotPrompt,
    assistantName: snapshot.assistantName,
    publicEmbedEnabled: snapshot.publicEmbedEnabled,
    allowedDomains: snapshot.allowedDomains,
    nameLabel: snapshot.nameLabel,
    namePlaceholder: snapshot.namePlaceholder,
    emailLabel: snapshot.emailLabel,
    emailPlaceholder: snapshot.emailPlaceholder,
    phoneLabel: snapshot.phoneLabel,
    phonePlaceholder: snapshot.phonePlaceholder,
    chatResetConversationAfterHours: undefined,
    chatResetConversationAfterValue: snapshot.resetConversationAfterValue,
    chatResetConversationAfterUnit: snapshot.resetConversationAfterUnit,
    chatResetConversationAfterAction: snapshot.resetConversationAfterAction,
    preChatFormEnabled: snapshot.preChatFormEnabled,
    preChatFormInactivityRule: {
      enabled: snapshot.preChatFormInactivityEnabled,
      timeoutValue: Math.max(1, Number(snapshot.preChatFormInactivityValue) || 1),
      timeoutUnit: snapshot.preChatFormInactivityUnit,
      action: snapshot.preChatFormInactivityAction,
    },
    preChatFormTemplate: snapshot.preChatFormTemplate,
    preChatFormTitle: snapshot.preChatFormTitle,
    preChatFormDescription: snapshot.preChatFormDescription,
    preChatFormSubmitLabel: snapshot.preChatFormSubmitLabel,
    preChatFormShowNameField: snapshot.preChatFormShowNameField,
    preChatFormShowEmailField: snapshot.preChatFormShowEmailField,
    preChatFormShowPhoneField: snapshot.preChatFormShowPhoneField,
    preChatFormRequireName: snapshot.preChatFormRequireName,
    preChatFormRequireEmail: snapshot.preChatFormRequireEmail,
    preChatFormRequirePhone: snapshot.preChatFormRequirePhone,
    preChatFormRequireContactMethod: snapshot.preChatFormRequireContactMethod,
    preChatFormShowDepartmentField: snapshot.preChatFormShowDepartmentField,
    preChatFormDepartmentLabel: snapshot.preChatFormDepartmentLabel,
    preChatFormDepartmentPlaceholder: snapshot.preChatFormDepartmentPlaceholder,
    preChatFormDepartmentOptions: snapshot.preChatFormDepartmentOptions,
    termsEnabled: snapshot.termsEnabled,
    termsLabel: snapshot.termsLabel,
    termsLinkText: snapshot.termsLinkText,
    termsLinkUrl: snapshot.termsLinkUrl,
    automationFlows,
    defaultFlowId: defaultFlow.id,
    quickActions: defaultFlow.quickActions,
    flowStages: defaultFlow.flowStages,
    flowTriggers: defaultFlow.flowTriggers,
    pauseNodes: defaultFlow.pauseNodes,
    flowVariables: snapshot.flowVariables,
    assignmentRules: snapshot.assignmentRules,
    messageCoherence: snapshot.messageCoherence,
    studioNodeLayout: defaultFlow.studioNodeLayout,
    studioViewport: defaultFlow.studioViewport,
    allowHumanHandoff: true,
  }
}

function serializeBuilderState(state: BuilderState) {
  return JSON.stringify(state)
}

function renderInactivityRuleFields(args: {
  title: string
  description: string
  rule: ChatbotInactivityRule
  onChange: (rule: ChatbotInactivityRule) => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">{args.title}</div>
          <div className="text-xs text-slate-500">{args.description}</div>
        </div>
        <Switch checked={args.rule.enabled} onCheckedChange={(checked) => args.onChange({ ...args.rule, enabled: checked })} />
      </div>
      {args.rule.enabled ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Tiempo</Label>
            <Input value={String(args.rule.timeoutValue)} onChange={(event) => args.onChange({ ...args.rule, timeoutValue: Math.max(1, Number(event.target.value.replace(/[^0-9]/g, '')) || 1) })} />
          </div>
          <div className="grid gap-2">
            <Label>Unidad</Label>
            <Select value={args.rule.timeoutUnit} onValueChange={(value) => args.onChange({ ...args.rule, timeoutUnit: value as ChatbotInactivityUnit })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Al vencer</Label>
            <Select value={args.rule.action} onValueChange={(value) => args.onChange({ ...args.rule, action: value as ChatbotInactivityAction })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restart">Volver al inicio</SelectItem>
                <SelectItem value="close">Cerrar conversación</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function renderQuickActionAttachmentFields(args: {
  action: ChatbotQuickAction
  update: (patch: Partial<ChatbotQuickAction>) => void
}) {
  const attachmentEnabled = Boolean(args.action.responseAttachmentType)

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Adjunto de respuesta</div>
          <div className="text-xs text-slate-500">Envía una imagen o PDF junto con la respuesta de esta acción.</div>
        </div>
        <Switch
          checked={attachmentEnabled}
          onCheckedChange={(checked) => args.update(checked
            ? { responseAttachmentType: 'image', responseAttachmentUrl: args.action.responseAttachmentUrl || '', responseAttachmentName: args.action.responseAttachmentName || '' }
            : { responseAttachmentType: null, responseAttachmentUrl: null, responseAttachmentName: null })}
        />
      </div>
      {attachmentEnabled ? (
        <>
          <div className="grid gap-2">
            <Label>Tipo de adjunto</Label>
            <Select value={args.action.responseAttachmentType || 'image'} onValueChange={(value) => args.update({ responseAttachmentType: value as ChatbotQuickActionAttachmentType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Imagen</SelectItem>
                <SelectItem value="document">PDF o documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>URL del adjunto</Label>
            <Input value={args.action.responseAttachmentUrl || ''} onChange={(event) => args.update({ responseAttachmentUrl: event.target.value })} placeholder="https://..." />
          </div>
          <div className="grid gap-2">
            <Label>Nombre visible</Label>
            <Input value={args.action.responseAttachmentName || ''} onChange={(event) => args.update({ responseAttachmentName: event.target.value })} placeholder="Catálogo julio 2026.pdf" />
          </div>
        </>
      ) : null}
    </div>
  )
}

export function CrmChatbotStudioClient({ initialChannelId }: { initialChannelId?: string } = {}) {
  const [channels, setChannels] = useState<ChannelConnection[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [builder, setBuilder] = useState<BuilderState>(() => hydrateBuilder(null))
  const [historyPast, setHistoryPast] = useState<BuilderState[]>([])
  const [historyFuture, setHistoryFuture] = useState<BuilderState[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null)
  const [conversationSearch, setConversationSearch] = useState('')
  const [conversationMessageDraft, setConversationMessageDraft] = useState('')
  const [conversationMessageTypeDraft, setConversationMessageTypeDraft] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'>('TEXT')
  const [conversationAttachmentUrlDraft, setConversationAttachmentUrlDraft] = useState('')
  const [conversationAttachmentNameDraft, setConversationAttachmentNameDraft] = useState('')
  const [sendingConversationMessage, setSendingConversationMessage] = useState(false)
  const [showConversationEmojiPicker, setShowConversationEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [assigningConversationId, setAssigningConversationId] = useState<string | null>(null)
  const [focusedNode, setFocusedNode] = useState<StudioFocusNode | null>(null)
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null)
  const [editingNode, setEditingNode] = useState<StudioEditingNode>(null)
  const [activeStudioPanel, setActiveStudioPanel] = useState<StudioPrimaryPanel>('map')
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null)
  const [coherenceModalOpen, setCoherenceModalOpen] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [dragState, setDragState] = useState<StudioDragState | null>(null)
  const [panState, setPanState] = useState<StudioPanState | null>(null)
  const [connectionDraft, setConnectionDraft] = useState<StudioConnectionDraft | null>(null)
  const [contextMenu, setContextMenu] = useState<StudioContextMenuState | null>(null)
  const [paletteDragKind, setPaletteDragKind] = useState<string | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [flowEditMode, setFlowEditMode] = useState(false)
  const [paletteRailOpen, setPaletteRailOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorAdvancedOpen, setInspectorAdvancedOpen] = useState(false)
  const [minimapOpen, setMinimapOpen] = useState(true)
  const [studioOverviewOpen, setStudioOverviewOpen] = useState(true)
  const [studioReferenceOpen, setStudioReferenceOpen] = useState(true)
  const [studioRulesOpen, setStudioRulesOpen] = useState(false)
  const [studioMounted, setStudioMounted] = useState(false)
  const [boardViewportSize, setBoardViewportSize] = useState({ width: 0, height: 0 })
  const [measuredNodeHeights, setMeasuredNodeHeights] = useState<Record<string, number>>({})
  const [measuredHandleAnchors, setMeasuredHandleAnchors] = useState<Record<string, { x: number; y: number }>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const dragMovedRef = useRef(false)
  const boardViewportRef = useRef<HTMLDivElement | null>(null)
  const nodeElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const handleElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map())
  const conversationThreadViewportRef = useRef<HTMLDivElement | null>(null)
  const conversationThreadBottomRef = useRef<HTMLDivElement | null>(null)
  const pinchStateRef = useRef<{ initialDistance: number; initialScale: number; centerX: number; centerY: number } | null>(null)
  const minimapDraggingRef = useRef(false)
  const historyTrackingSuspendedRef = useRef(true)
  const lastBuilderRef = useRef<BuilderState>(builder)
  const lastSavedSnapshotRef = useRef(serializeBuilderState(builder))
  const conversationRowsSnapshotRef = useRef<Map<string, { lastMessageAt: string | null; unreadCount: number; latestDirection: string | null }>>(new Map())
  const selectedConversationLastMessageRef = useRef<string | null>(null)
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) => {
      const searchableText = [
        conversation.contactDisplayName,
        conversation.contactPhone,
        conversation.contactEmail,
        conversation.assignedTo?.name,
        conversation.assignedTo?.email,
        conversation.messages[0]?.bodyText,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase()
      return searchableText.includes(query)
    })
  }, [conversationSearch, conversations])
  const unreadConversationCount = useMemo(() => conversations.filter((conversation) => conversation.unreadCount > 0).length, [conversations])
  const unreadMessageCount = useMemo(() => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0), [conversations])
  const studioMessagingWindowState = useMemo(() => {
    if (!selectedConversation) return null
    const provider = selectedConversation.channelConnection.provider
    const requiresPolicyWindow = provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX' || provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER' || provider === 'INSTAGRAM_DM'
    if (!requiresPolicyWindow) {
      return {
        open: true,
        label: 'Envío disponible',
        hint: 'Este canal permite responder desde el Studio sin restricción de ventana.',
      }
    }

    const lastInbound = [...selectedConversation.messages]
      .reverse()
      .find((message) => message.direction === 'INBOUND')

    if (!lastInbound?.occurredAt) {
      return {
        open: false,
        label: 'Ventana cerrada',
        hint: 'Todavía no hay un inbound reciente del contacto para abrir la ventana de respuesta.',
      }
    }

    const lastInboundTime = Date.parse(lastInbound.occurredAt)
    const open = Number.isFinite(lastInboundTime) && (Date.now() - lastInboundTime) <= 24 * 60 * 60 * 1000
    return open
      ? {
          open: true,
          label: 'Ventana abierta',
          hint: 'Puedes responder texto o multimedia desde este chat.',
        }
      : {
          open: false,
          label: 'Ventana cerrada',
          hint: 'Para Meta o WhatsApp debes esperar un nuevo inbound o usar una plantilla externa.',
        }
  }, [selectedConversation])

  const selectedChannel = useMemo(() => channels.find((item) => item.id === selectedChannelId) ?? null, [channels, selectedChannelId])
  const selectedFlow = useMemo(() => builder.automationFlows.find((flow) => flow.id === builder.selectedFlowId) ?? null, [builder.automationFlows, builder.selectedFlowId])
  const editingVariable = editingVariableId ? builder.flowVariables.find((variable) => variable.id === editingVariableId) ?? null : null
  const triggerVariableOptions = useMemo(() => {
    const merged = [
      ...builder.flowVariables.filter((variable) => variable.enabled).map((variable) => ({ key: variable.key, label: variable.label || variable.key })),
      ...FILTER_VARIABLE_FALLBACK_OPTIONS,
    ]
    return merged.filter((option, index) => merged.findIndex((candidate) => candidate.key === option.key) === index)
  }, [builder.flowVariables])
  const builderSnapshot = useMemo(() => serializeBuilderState(builder), [builder])
  const hasUnsavedChanges = builderSnapshot !== lastSavedSnapshotRef.current
  const canUndo = historyPast.length > 0
  const canRedo = historyFuture.length > 0

  function playConversationNotificationSound() {
    if (typeof window === 'undefined') return
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    try {
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startAt = context.currentTime

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, startAt)
      oscillator.frequency.exponentialRampToValueAtTime(660, startAt + 0.18)
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.22)
      window.setTimeout(() => {
        void context.close().catch(() => undefined)
      }, 300)
    } catch {
      return
    }
  }

  function scrollConversationThreadToBottom(behavior: ScrollBehavior = 'smooth') {
    if (typeof window === 'undefined') return
    window.requestAnimationFrame(() => {
      conversationThreadBottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  function replaceBuilder(nextBuilder: BuilderState, options?: { resetHistory?: boolean; markSaved?: boolean }) {
    historyTrackingSuspendedRef.current = true
    lastBuilderRef.current = nextBuilder

    if (options?.markSaved) {
      lastSavedSnapshotRef.current = serializeBuilderState(nextBuilder)
    }

    if (options?.resetHistory) {
      setHistoryPast([])
      setHistoryFuture([])
    }

    setBuilder(nextBuilder)
  }

  function handleUndo() {
    const previousBuilder = historyPast[historyPast.length - 1]
    if (!previousBuilder) return

    historyTrackingSuspendedRef.current = true
    lastBuilderRef.current = previousBuilder
    setHistoryPast((current) => current.slice(0, -1))
    setHistoryFuture((current) => [builder, ...current].slice(0, 40))
    setBuilder(previousBuilder)
    setError(null)
    setNotice('Se revirtió el último cambio del flujo.')
  }

  function handleRedo() {
    const nextBuilder = historyFuture[0]
    if (!nextBuilder) return

    historyTrackingSuspendedRef.current = true
    lastBuilderRef.current = nextBuilder
    setHistoryPast((current) => [...current.slice(-39), builder])
    setHistoryFuture((current) => current.slice(1))
    setBuilder(nextBuilder)
    setError(null)
    setNotice('Se rehizo el cambio del flujo.')
  }

  async function loadBase() {
    setLoading(true)
    setError(null)
    const [channelsJson, assigneesJson] = await Promise.all([
      requestJson<ChannelConnection[]>('/api/crm/channels?provider=WEB_CHATBOT'),
      requestJson<Assignee[]>('/api/crm/assignees'),
    ])

    if (!channelsJson.success || !channelsJson.data) {
      setError(channelsJson.error || 'No se pudieron cargar los canales de chatbot.')
      setLoading(false)
      return
    }

    setChannels(channelsJson.data)
    setAssignees(assigneesJson.data ?? [])
    const requestedChannelId = initialChannelId && channelsJson.data.some((item) => item.id === initialChannelId)
      ? initialChannelId
      : ''
    const nextChannelId = selectedChannelId && channelsJson.data.some((item) => item.id === selectedChannelId)
      ? selectedChannelId
      : (requestedChannelId || (channelsJson.data[0]?.id ?? ''))
    setSelectedChannelId(nextChannelId)
    replaceBuilder(hydrateBuilder(channelsJson.data.find((item) => item.id === nextChannelId) ?? channelsJson.data[0] ?? null), {
      resetHistory: true,
      markSaved: true,
    })
    setLoading(false)
  }

  async function loadConversations(channelId: string) {
    if (!channelId) {
      setConversations([])
      setSelectedConversationId('')
      setSelectedConversation(null)
      conversationRowsSnapshotRef.current = new Map()
      return
    }

    const json = await requestJson<ConversationRow[]>(`/api/crm/conversations?provider=WEB_CHATBOT&channelConnectionId=${encodeURIComponent(channelId)}`)
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo cargar el historial del chatbot.')
      return
    }
    const nextSnapshot = new Map<string, { lastMessageAt: string | null; unreadCount: number; latestDirection: string | null }>()
    let shouldPlayNotification = false

    json.data.forEach((conversation) => {
      const latestDirection = conversation.messages[0]?.direction ?? null
      nextSnapshot.set(conversation.id, {
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
        latestDirection,
      })

      const previous = conversationRowsSnapshotRef.current.get(conversation.id)
      if (!previous) return
      const hasNewInbound = latestDirection === 'INBOUND' && conversation.lastMessageAt && conversation.lastMessageAt !== previous.lastMessageAt
      if (hasNewInbound && conversation.id !== selectedConversationId) {
        shouldPlayNotification = true
      }
    })

    conversationRowsSnapshotRef.current = nextSnapshot
    setConversations(json.data)
    const nextConversationId = selectedConversationId && json.data.some((item) => item.id === selectedConversationId)
      ? selectedConversationId
      : (json.data[0]?.id ?? '')
    setSelectedConversationId(nextConversationId)
    if (shouldPlayNotification) {
      playConversationNotificationSound()
    }
  }

  async function loadConversationDetail(conversationId: string) {
    if (!conversationId) {
      setSelectedConversation(null)
      selectedConversationLastMessageRef.current = null
      return
    }
    const json = await requestJson<ConversationDetail>(`/api/crm/conversations/${conversationId}`)
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo cargar el detalle de la conversación.')
      return
    }
    const lastMessage = json.data.messages[json.data.messages.length - 1] ?? null
    const hasNewInbound = Boolean(
      selectedConversationLastMessageRef.current
      && lastMessage
      && lastMessage.id !== selectedConversationLastMessageRef.current
      && lastMessage.direction === 'INBOUND'
    )
    setSelectedConversation(json.data)
    selectedConversationLastMessageRef.current = lastMessage?.id ?? null
    if (hasNewInbound) {
      playConversationNotificationSound()
    }
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    if (!selectedChannelId) return
    const channel = channels.find((item) => item.id === selectedChannelId) ?? null
    replaceBuilder(hydrateBuilder(channel), { resetHistory: true, markSaved: true })
    void loadConversations(selectedChannelId)
  }, [selectedChannelId, channels])

  useEffect(() => {
    if (historyTrackingSuspendedRef.current) {
      historyTrackingSuspendedRef.current = false
      lastBuilderRef.current = builder
      return
    }

    if (builderSnapshot === serializeBuilderState(lastBuilderRef.current)) return

    setHistoryPast((current) => [...current.slice(-39), lastBuilderRef.current])
    setHistoryFuture([])
    lastBuilderRef.current = builder
  }, [builder, builderSnapshot])

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null)
      selectedConversationLastMessageRef.current = null
      return
    }
    void loadConversationDetail(selectedConversationId)
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedChannelId || activeStudioPanel !== 'conversations') return

    const intervalId = window.setInterval(() => {
      void loadConversations(selectedChannelId)
      if (selectedConversationId) {
        void loadConversationDetail(selectedConversationId)
      }
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [activeStudioPanel, selectedChannelId, selectedConversationId])

  useEffect(() => {
    const lastMessageId = selectedConversation?.messages[selectedConversation.messages.length - 1]?.id
    if (!lastMessageId) return
    scrollConversationThreadToBottom(selectedConversationId === selectedConversation?.id ? 'smooth' : 'auto')
  }, [selectedConversation, selectedConversationId])

  async function handleCreateChannel(mode: 'empty' | 'template') {
    setCreating(true)
    setError(null)
    const nextBuilder = createChannelBuilderPreset(mode)
    const json = await requestJson<ChannelConnection>('/api/crm/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'WEB_CHATBOT',
        name: nextBuilder.channelName,
        status: nextBuilder.status,
        settingsJson: buildSettingsPayload(nextBuilder),
      }),
    })
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo crear el canal del chatbot.')
      setCreating(false)
      return
    }
    setNotice(mode === 'empty' ? 'Canal de chatbot vacío creado.' : 'Canal de chatbot creado con plantilla base.')
    await loadBase()
    setSelectedChannelId(json.data.id)
    setCreating(false)
  }

  async function handleSaveChannel() {
    if (!selectedChannelId) return
    setSaving(true)
    setError(null)
    setNotice(null)
    const json = await requestJson<ChannelConnection>(`/api/crm/channels/${selectedChannelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: builder.channelName,
        status: builder.status,
        settingsJson: buildSettingsPayload(builder),
      }),
    })
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo guardar la configuración del chatbot.')
      setSaving(false)
      return
    }
    lastSavedSnapshotRef.current = serializeBuilderState(builder)
    setHistoryPast([])
    setHistoryFuture([])
    setNotice('Studio del chatbot actualizado.')
    await loadBase()
    setSelectedChannelId(json.data.id)
    setSaving(false)
  }

  async function handleAssignConversation(conversationId: string, assignedToUserId: string) {
    setAssigningConversationId(conversationId)
    setError(null)
    const json = await requestJson(`/api/crm/conversations/${conversationId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToUserId: assignedToUserId || null }),
    })
    if (!json.success) {
      setError(json.error || 'No se pudo actualizar la asignación.')
      setAssigningConversationId(null)
      return
    }
    await loadConversations(selectedChannelId)
    await loadConversationDetail(conversationId)
    setAssigningConversationId(null)
  }

  async function submitStudioConversationMessage() {
    if (!selectedConversation) return
    const requiresAttachment = conversationMessageTypeDraft === 'IMAGE' || conversationMessageTypeDraft === 'AUDIO' || conversationMessageTypeDraft === 'DOCUMENT'
    if (conversationMessageTypeDraft === 'TEXT' && !conversationMessageDraft.trim()) {
      setError('Escribe un mensaje antes de enviarlo.')
      return
    }
    if (requiresAttachment && !conversationAttachmentUrlDraft.trim()) {
      setError('Debes indicar la URL del archivo multimedia.')
      return
    }

    setSendingConversationMessage(true)
    setError(null)
    try {
      const json = await requestJson<ConversationDetail['messages'][number]>(`/api/crm/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyText: conversationMessageDraft,
          messageType: conversationMessageTypeDraft,
          attachments: requiresAttachment
            ? [{ type: conversationMessageTypeDraft, url: conversationAttachmentUrlDraft, filename: conversationAttachmentNameDraft || null }]
            : [],
        }),
      })

      if (!json.success) {
        await Promise.all([loadConversations(selectedChannelId), loadConversationDetail(selectedConversation.id)])
        setError(json.error || 'No se pudo enviar el mensaje desde el Studio.')
        return
      }

      setConversationMessageDraft('')
      setConversationMessageTypeDraft('TEXT')
      setConversationAttachmentUrlDraft('')
      setConversationAttachmentNameDraft('')
      setShowConversationEmojiPicker(false)
      await Promise.all([loadConversations(selectedChannelId), loadConversationDetail(selectedConversation.id)])
      setNotice('Mensaje enviado desde el Studio.')
    } finally {
      setSendingConversationMessage(false)
    }
  }

  function updateStage(stageId: string, patch: Partial<ChatbotFlowStage>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage),
    }))
  }

  function updateStageMessageContent(stageId: string, value: string) {
    updateStage(stageId, {
      prompt: value,
      description: value,
    })
  }

  function appendStageMessageSnippet(stageId: string, snippet: string) {
    const stage = builder.flowStages.find((item) => item.id === stageId)
    if (!stage) return
    const currentValue = getStageMessageContent(stage)
    const separator = currentValue && !currentValue.endsWith('\n') ? '\n' : ''
    updateStageMessageContent(stageId, `${currentValue}${separator}${snippet}`)
  }

  function updateResponseOption(stageId: string, optionId: string, patch: Partial<ChatbotFlowResponseOption>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: stage.responseOptions.map((option) => option.id === optionId ? { ...option, ...patch } : option),
        }
      }),
    }))
  }

  function removeResponseOption(stageId: string, optionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: stage.responseOptions.filter((option) => option.id !== optionId),
        }
      }),
    }))
  }

  function duplicateStageResponseOption(stageId: string, optionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        const option = stage.responseOptions.find((item) => item.id === optionId)
        if (!option) return stage
        return {
          ...stage,
          responseOptions: [...stage.responseOptions, duplicateResponseOption(option)],
        }
      }),
    }))
  }

  function addResponseOptionToStage(stageId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => stage.id === stageId
        ? { ...stage, responseOptions: [...stage.responseOptions, createStageResponseOption(current.flowStages, stageId)] }
        : stage),
    }))
  }

  function addExistingQuickActionToStage(stageId: string) {
    const fallbackActionId = builder.quickActions[0]?.id
    if (!fallbackActionId) {
      createAction({ sourceNode: { kind: 'stage', id: stageId } })
      return
    }

    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: [...stage.responseOptions, createStageResponseOption(current.flowStages, stageId, {
            label: builder.quickActions[0]?.label || 'Nueva opción',
            userMessage: builder.quickActions[0]?.label || 'Quiero continuar por esta ruta.',
            targetStageId: '',
            targetActionId: fallbackActionId,
          })],
        }
      }),
    }))
  }

  function replaceStageQuickAction(stageId: string, currentActionId: string, nextActionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        const quickActionIds = stage.quickActionIds.map((actionId) => actionId === currentActionId ? nextActionId : actionId)
        return {
          ...stage,
          quickActionIds: Array.from(new Set(quickActionIds)),
        }
      }),
    }))
  }

  function removeStageQuickAction(stageId: string, actionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => stage.id === stageId
        ? { ...stage, quickActionIds: stage.quickActionIds.filter((id) => id !== actionId) }
        : stage),
    }))
  }

  function updateQuickAction(actionId: string, patch: Partial<ChatbotQuickAction>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      quickActions: current.quickActions.map((item) => item.id === actionId ? { ...item, ...patch } : item),
    }))
  }

  function updateQuickActionAutomation(actionId: string, patch: Partial<ChatbotQuickActionAutomationConfig>) {
    const action = builder.quickActions.find((item) => item.id === actionId)
    const defaults = getDefaultChatbotQuickActionAutomationConfig()
    const currentAutomation = action?.automation ?? defaults
    updateQuickAction(actionId, {
      automation: {
        ...defaults,
        ...currentAutomation,
        ...patch,
        chat: { ...defaults.chat, ...currentAutomation.chat, ...patch.chat },
        variables: { ...defaults.variables, ...currentAutomation.variables, ...patch.variables },
        googleSheets: { ...defaults.googleSheets, ...currentAutomation.googleSheets, ...patch.googleSheets },
        crm: { ...defaults.crm, ...currentAutomation.crm, ...patch.crm },
        notifications: { ...defaults.notifications, ...currentAutomation.notifications, ...patch.notifications },
      },
    })
  }

  function updateTrigger(triggerId: string, patch: Partial<ChatbotFlowTrigger>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: current.flowTriggers.map((item) => item.id === triggerId ? { ...item, ...patch } : item),
    }))
  }

  function updateTriggerCondition(triggerId: string, conditionId: string, patch: Partial<ChatbotFlowTriggerCondition>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: current.flowTriggers.map((trigger) => {
        if (trigger.id !== triggerId) return trigger
        return {
          ...trigger,
          conditions: trigger.conditions.map((condition) => condition.id === conditionId ? { ...condition, ...patch } : condition),
        }
      }),
    }))
  }

  function addTriggerCondition(triggerId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: current.flowTriggers.map((trigger) => trigger.id === triggerId
        ? { ...trigger, conditions: [...trigger.conditions, createTriggerCondition(triggerId)] }
        : trigger),
    }))
  }

  function removeTriggerCondition(triggerId: string, conditionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: current.flowTriggers.map((trigger) => {
        if (trigger.id !== triggerId) return trigger
        const nextConditions = trigger.conditions.filter((condition) => condition.id !== conditionId)
        return {
          ...trigger,
          conditions: nextConditions,
        }
      }),
    }))
  }

  function updateVariable(variableId: string, patch: Partial<ChatbotFlowVariable>) {
    setBuilder((current) => ({
      ...current,
      flowVariables: current.flowVariables.map((item) => item.id === variableId ? { ...item, ...patch } : item),
    }))
  }

  function handleSelectFlow(flowId: string) {
    setBuilder((current) => applySelectedFlowToBuilder(materializeSelectedFlow(current), flowId))
    setFocusedNode(null)
    setActiveStudioPanel('map')
  }

  function handleCreateFlow() {
    const nextFlowId = makeId('flow')
    const nextFlow: ChatbotAutomationFlow = {
      ...getDefaultChatbotAutomationFlow(),
      id: nextFlowId,
      name: `Flujo ${builder.automationFlows.length + 1}`,
      isDefault: builder.automationFlows.length === 0,
      providers: getDefaultChatbotAutomationProviders(),
    }
    setBuilder((current) => applySelectedFlowToBuilder({
      ...materializeSelectedFlow(current),
      automationFlows: [...materializeSelectedFlow(current).automationFlows, nextFlow],
      selectedFlowId: nextFlowId,
    }, nextFlowId))
    setNotice('Flujo creado. Usa Editar flujo para configurarlo.')
  }

  function handleFlowMetaPatch(flowId: string, patch: Partial<ChatbotAutomationFlow>) {
    setBuilder((current) => {
      const base = materializeSelectedFlow(current)
      const nextFlows = base.automationFlows.map((flow) => {
        if (flow.id !== flowId) return patch.isDefault ? { ...flow, isDefault: false } : flow
        return { ...flow, ...patch }
      })
      return applySelectedFlowToBuilder({
        ...base,
        automationFlows: nextFlows,
      }, base.selectedFlowId)
    })
  }

  function handleDeleteFlow(flowId: string) {
    setBuilder((current) => {
      const base = materializeSelectedFlow(current)
      if (base.automationFlows.length <= 1) return base
      const remaining = base.automationFlows.filter((flow) => flow.id !== flowId)
      const nextDefaultId = remaining.find((flow) => flow.isDefault)?.id ?? remaining[0].id
      const nextFlows = remaining.map((flow) => ({ ...flow, isDefault: flow.id === nextDefaultId }))
      const nextSelectedId = base.selectedFlowId === flowId ? nextFlows[0].id : base.selectedFlowId
      return applySelectedFlowToBuilder({
        ...base,
        automationFlows: nextFlows,
        selectedFlowId: nextSelectedId,
      }, nextSelectedId)
    })
  }

  const stageMap = useMemo(() => Object.fromEntries(builder.flowStages.map((stage) => [stage.id, stage])), [builder.flowStages])
  const studioGraph = useMemo(() => buildStudioGraph(builder, measuredNodeHeights), [builder, measuredNodeHeights])

  function getHandleAnchorKey(nodeId: string, sourceOptionId?: string) {
    return `${nodeId}::${sourceOptionId || '__node__'}`
  }

  function measureHandleAnchor(element: HTMLButtonElement | null) {
    const viewport = boardViewportRef.current
    if (!viewport || !element) return null
    const viewportRect = viewport.getBoundingClientRect()
    const handleRect = element.getBoundingClientRect()
    return {
      x: ((handleRect.left + (handleRect.width / 2)) - viewportRect.left - builder.studioViewport.x) / builder.studioViewport.scale,
      y: ((handleRect.top + (handleRect.height / 2)) - viewportRect.top - builder.studioViewport.y) / builder.studioViewport.scale,
    }
  }

  function registerHandleElement(key: string, element: HTMLButtonElement | null) {
    if (element) {
      handleElementsRef.current.set(key, element)
      return
    }
    handleElementsRef.current.delete(key)
  }

  function registerNodeElement(key: string, element: HTMLDivElement | null) {
    if (element) {
      nodeElementsRef.current.set(key, element)
      return
    }
    nodeElementsRef.current.delete(key)
  }

  function getMeasuredHandleAnchor(nodeId: string, sourceOptionId?: string) {
    return measuredHandleAnchors[getHandleAnchorKey(nodeId, sourceOptionId)] ?? null
  }

  useEffect(() => {
    const nextAnchors: Record<string, { x: number; y: number }> = {}
    handleElementsRef.current.forEach((element, key) => {
      const anchor = measureHandleAnchor(element)
      if (anchor) {
        nextAnchors[key] = anchor
      }
    })
    setMeasuredHandleAnchors(nextAnchors)
  }, [builder.studioViewport.scale, builder.studioViewport.x, builder.studioViewport.y, studioGraph.nodes, studioGraph.edges])

  useEffect(() => {
    const elements = nodeElementsRef.current

    const updateHeights = () => {
      const nextHeights: Record<string, number> = {}
      elements.forEach((element, key) => {
        nextHeights[key] = Math.ceil(element.clientHeight)
      })

      setMeasuredNodeHeights((current) => {
        const currentKeys = Object.keys(current)
        const nextKeys = Object.keys(nextHeights)
        if (currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === nextHeights[key])) {
          return current
        }
        return nextHeights
      })
    }

    updateHeights()

    const resizeObserver = new ResizeObserver(() => {
      updateHeights()
    })

    elements.forEach((element) => {
      resizeObserver.observe(element)
    })

    return () => {
      resizeObserver.disconnect()
    }
  }, [studioGraph.nodes])
  const editingStage = editingNode?.kind === 'stage' ? builder.flowStages.find((stage) => stage.id === editingNode.id) ?? null : null
  const editingTrigger = editingNode?.kind === 'trigger' ? builder.flowTriggers.find((trigger) => trigger.id === editingNode.id) ?? null : null
  const editingAction = editingNode?.kind === 'action' ? builder.quickActions.find((action) => action.id === editingNode.id) ?? null : null
  const editingPause = editingNode?.kind === 'pause' ? builder.pauseNodes.find((pause) => pause.id === editingNode.id) ?? null : null
  const selectedStartStage = builder.flowStages.find((stage) => stage.id === builder.startStageId) ?? null
  const selectedStage = focusedNode?.kind === 'stage' ? builder.flowStages.find((stage) => stage.id === focusedNode.id) ?? null : null
  const selectedTrigger = focusedNode?.kind === 'trigger' ? builder.flowTriggers.find((trigger) => trigger.id === focusedNode.id) ?? null : null
  const selectedAction = focusedNode?.kind === 'action' ? builder.quickActions.find((action) => action.id === focusedNode.id) ?? null : null
  const selectedPause = focusedNode?.kind === 'pause' ? builder.pauseNodes.find((pause) => pause.id === focusedNode.id) ?? null : null

  function renderQuickActionAutomationFields(action: ChatbotQuickAction) {
    const automation = action.automation ?? getDefaultChatbotQuickActionAutomationConfig()

    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gestion de chat</div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Abrir el chat</div>
                  <div className="text-xs text-slate-500">Escalar el chat a un administrador.</div>
                </div>
                <Switch checked={automation.chat.openChat} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, openChat: checked } })} />
              </div>
              {automation.chat.openChat ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                    <span className="text-xs text-slate-600">Cambiar el asignado del chat</span>
                    <Switch checked={automation.chat.changeAssignee} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, changeAssignee: checked } })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                    <span className="text-xs text-slate-600">Pausar la automatizacion</span>
                    <Switch checked={automation.chat.pauseAutomation} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, pauseAutomation: checked } })} />
                  </div>
                  {automation.chat.changeAssignee ? (
                    <div className="grid gap-2">
                      <Label>Asignar a</Label>
                      <Select value={automation.chat.assigneeUserId || '__none__'} onValueChange={(value) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, assigneeUserId: value === '__none__' ? '' : value } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin asignacion</SelectItem>
                          {assignees.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {automation.chat.pauseAutomation ? (
                    <div className="grid gap-2">
                      <Label>Duracion</Label>
                      <Select value={automation.chat.pauseDuration} onValueChange={(value) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, pauseDuration: value } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1 hora">1 hora</SelectItem>
                          <SelectItem value="8 horas">8 horas</SelectItem>
                          <SelectItem value="1 dia">1 dia</SelectItem>
                          <SelectItem value="3 dias">3 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Cerrar el chat</div>
                  <div className="text-xs text-slate-500">Marcar el chat como completado y bajar la prioridad.</div>
                </div>
                <Switch checked={automation.chat.closeChat} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, closeChat: checked } })} />
              </div>
              {automation.chat.closeChat ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-xs text-slate-600">Desasignar el chat del operador responsable</span>
                  <Switch checked={automation.chat.unassignOperator} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, unassignOperator: checked } })} />
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Cancelar suscripcion del bot</div>
                  <div className="text-xs text-slate-500">Cancelar la suscripcion a correos masivos y campañas automatizadas.</div>
                </div>
                <Switch checked={automation.chat.cancelBotSubscription} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { chat: { ...automation.chat, cancelBotSubscription: checked } })} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gestionar variables</div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Añadir etiqueta</div>
                  <div className="text-xs text-slate-500">Asignar etiquetas al suscriptor.</div>
                </div>
                <Switch checked={automation.variables.addTagEnabled} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, addTagEnabled: checked } })} />
              </div>
              {automation.variables.addTagEnabled ? <Input className="mt-3" value={joinConfigValues(automation.variables.addTags)} onChange={(event) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, addTags: event.target.value.split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean) } })} placeholder="vip, seguimiento, prioridad" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Eliminar etiquetas</div>
                  <div className="text-xs text-slate-500">Remover etiquetas existentes.</div>
                </div>
                <Switch checked={automation.variables.removeTagEnabled} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, removeTagEnabled: checked } })} />
              </div>
              {automation.variables.removeTagEnabled ? <Input className="mt-3" value={joinConfigValues(automation.variables.removeTags)} onChange={(event) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, removeTags: event.target.value.split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean) } })} placeholder="prospecto-frio, spam" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Establecer variable</div>
                  <div className="text-xs text-slate-500">Actualizar el valor de una variable.</div>
                </div>
                <Switch checked={automation.variables.setVariableEnabled} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, setVariableEnabled: checked } })} />
              </div>
              {automation.variables.setVariableEnabled ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input value={automation.variables.variableKey} onChange={(event) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, variableKey: event.target.value } })} placeholder="estado_lead" />
                  <Input value={automation.variables.variableValue} onChange={(event) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, variableValue: event.target.value } })} placeholder="calificado" />
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Eliminar variable</div>
                  <div className="text-xs text-slate-500">Eliminar una variable del contexto.</div>
                </div>
                <Switch checked={automation.variables.deleteVariableEnabled} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, deleteVariableEnabled: checked } })} />
              </div>
              {automation.variables.deleteVariableEnabled ? <Input className="mt-3" value={automation.variables.deleteVariableKey} onChange={(event) => updateQuickActionAutomation(action.id, { variables: { ...automation.variables, deleteVariableKey: event.target.value } })} placeholder="variable_a_borrar" /> : null}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Google Sheets acciones</div>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"><span className="text-xs text-slate-700">Insertar fila</span><Switch checked={automation.googleSheets.insertRow} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, insertRow: checked } })} /></div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"><span className="text-xs text-slate-700">Buscar y actualizar fila</span><Switch checked={automation.googleSheets.upsertRow} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, upsertRow: checked } })} /></div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"><span className="text-xs text-slate-700">Recuperar datos</span><Switch checked={automation.googleSheets.fetchRow} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, fetchRow: checked } })} /></div>
            </div>
            {(automation.googleSheets.insertRow || automation.googleSheets.upsertRow || automation.googleSheets.fetchRow) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={automation.googleSheets.spreadsheetId} onChange={(event) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, spreadsheetId: event.target.value } })} placeholder="Spreadsheet ID" />
                <Input value={automation.googleSheets.sheetName} onChange={(event) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, sheetName: event.target.value } })} placeholder="Hoja / pestaña" />
                <Input value={automation.googleSheets.lookupColumn} onChange={(event) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, lookupColumn: event.target.value } })} placeholder="Columna de busqueda" />
                <Input value={automation.googleSheets.lookupValue} onChange={(event) => updateQuickActionAutomation(action.id, { googleSheets: { ...automation.googleSheets, lookupValue: event.target.value } })} placeholder="Valor de busqueda" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">CRM y cursos</div>
          <div className="mt-3 grid gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"><span className="text-sm text-slate-800">Crear trato</span><Switch checked={automation.crm.createDeal} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { crm: { ...automation.crm, createDeal: checked } })} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"><span className="text-sm text-slate-800">Editar trato CRM</span><Switch checked={automation.crm.editDeal} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { crm: { ...automation.crm, editDeal: checked } })} /></div>
            {(automation.crm.createDeal || automation.crm.editDeal) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={automation.crm.pipelineName} onChange={(event) => updateQuickActionAutomation(action.id, { crm: { ...automation.crm, pipelineName: event.target.value } })} placeholder="Pipeline o curso" />
                <Input value={automation.crm.dealStage} onChange={(event) => updateQuickActionAutomation(action.id, { crm: { ...automation.crm, dealStage: event.target.value } })} placeholder="Paso del trato" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notificaciones o actualizaciones</div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-900">Enviar un mensaje a otro contacto del bot</span><Switch checked={automation.notifications.notifyOtherContact} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, notifyOtherContact: checked } })} /></div>
              {automation.notifications.notifyOtherContact ? <Input className="mt-3" value={automation.notifications.targetContact} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, targetContact: event.target.value } })} placeholder="Telefono, email o ID del contacto" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-900">Iniciar flujo A360 por evento</span><Switch checked={automation.notifications.startA360Event} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, startA360Event: checked } })} /></div>
              {automation.notifications.startA360Event ? <Input className="mt-3" value={automation.notifications.a360EventName} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, a360EventName: event.target.value } })} placeholder="Nombre del evento" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-900">Notificarme</span><Switch checked={automation.notifications.notifyMe} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, notifyMe: checked } })} /></div>
              {automation.notifications.notifyMe ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input value={joinConfigValues(automation.notifications.notifyChannels)} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, notifyChannels: event.target.value.split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean) } })} placeholder="telegram, whatsapp, correo" />
                  <Input value={automation.notifications.notifyRecipients} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, notifyRecipients: event.target.value } })} placeholder="Destinatarios" />
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-900">Añadir nota</span><Switch checked={automation.notifications.addNote} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, addNote: checked } })} /></div>
              {automation.notifications.addNote ? <Textarea className="mt-3" rows={3} value={automation.notifications.noteText} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, noteText: event.target.value } })} placeholder="Nota privada para el dialogo" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-900">Enviar webhook</span><Switch checked={automation.notifications.sendWebhook} onCheckedChange={(checked) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, sendWebhook: checked } })} /></div>
              {automation.notifications.sendWebhook ? <Input className="mt-3" value={automation.notifications.webhookUrl} onChange={(event) => updateQuickActionAutomation(action.id, { notifications: { ...automation.notifications, webhookUrl: event.target.value } })} placeholder="https://tu-endpoint.com/hook" /> : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function getNodeDeletionBlocker(node: StudioFocusNode) {
    if (node.kind === 'stage' && builder.flowStages.length <= 1) {
      return 'No puedes eliminar este mensaje porque el flujo debe conservar al menos un bloque principal.'
    }
    return null
  }

  function deleteNodeWithFeedback(node: StudioFocusNode) {
    const blocker = getNodeDeletionBlocker(node)
    if (blocker) {
      setError(blocker)
      setNotice(null)
      return
    }
    deleteNode(node)
  }

  function getVisibleInsertPosition() {
    const rect = boardViewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return { x: 320, y: 240 }
    }

    const visibleX = ((rect.width * 0.38) - builder.studioViewport.x) / builder.studioViewport.scale
    const visibleY = ((rect.height * 0.32) - builder.studioViewport.y) / builder.studioViewport.scale
    return {
      x: Math.max(32, Math.round(visibleX)),
      y: Math.max(32, Math.round(visibleY)),
    }
  }

  function queueNodeFocus(node: StudioFocusNode) {
    setFocusedNode(node)
    if (node.kind !== 'start') {
      setEditingNode(node)
    }
    setContextMenu(null)
  }

  function createStage(args?: { sourceNode?: StudioFocusNode | null; sourceOptionId?: string; position?: { x: number; y: number }; preset?: Partial<ChatbotFlowStage>; notice?: string }) {
    const nextStageId = makeId('stage')
    const position = args?.position ?? getVisibleInsertPosition()
    setBuilder((current) => {
      const nextStage: ChatbotFlowStage = {
        title: 'Nuevo mensaje',
        description: 'Describe el objetivo de este bloque.',
        prompt: 'Mensaje del asistente.',
        templateKey: null,
        nextField: 'none',
        quickActionIds: [],
        responseOptions: [],
        inactivityRule: getDefaultChatbotInactivityRule(),
        ...args?.preset,
        id: nextStageId,
      }

      const nextFlowStages = [...current.flowStages, nextStage].map((stage) => {
        if (args?.sourceNode?.kind === 'stage' && stage.id === args.sourceNode.id) {
          if (args.sourceOptionId) {
            return {
              ...stage,
              responseOptions: stage.responseOptions.map((option) => option.id === args.sourceOptionId ? { ...option, targetStageId: nextStageId, targetActionId: '', targetTriggerId: '' } : option),
            }
          }
          return {
            ...stage,
            responseOptions: [...stage.responseOptions, { id: makeId('option'), label: 'Nueva rama', userMessage: 'Continuar', assistantReply: '', matchMode: 'contains' as const, matchValue: '', targetStageId: nextStageId, targetActionId: '', targetTriggerId: '' }],
          }
        }
        return stage
      })

      return updateSelectedFlowInBuilder(current, {
        startStageId: current.startStageId,
        flowStages: nextFlowStages,
        flowTriggers: args?.sourceNode?.kind === 'trigger'
          ? current.flowTriggers.map((trigger) => {
              if (trigger.id !== args.sourceNode?.id) return trigger
              if (!args.sourceOptionId) return { ...trigger, targetStageId: nextStageId }
              return {
                ...trigger,
                conditions: trigger.conditions.map((condition) => condition.id === args.sourceOptionId ? { ...condition, targetStageId: nextStageId, targetActionId: '', targetTriggerId: '' } : condition),
              }
            })
          : current.flowTriggers,
        pauseNodes: args?.sourceNode?.kind === 'pause'
          ? current.pauseNodes.map((pause) => pause.id === args.sourceNode?.id ? { ...pause, targetStageId: nextStageId } : pause)
          : current.pauseNodes,
        studioNodeLayout: {
          ...current.studioNodeLayout,
          [`stage:${nextStageId}`]: position,
        },
      })
    })
    queueNodeFocus({ kind: 'stage', id: nextStageId })
    setNotice(args?.notice || 'Nuevo bloque de mensaje creado.')
  }

  function createAction(args?: { sourceNode?: StudioFocusNode | null; sourceOptionId?: string; position?: { x: number; y: number }; preset?: Partial<ChatbotQuickAction>; notice?: string }) {
    const nextActionId = makeId('action')
    const position = args?.position ?? getVisibleInsertPosition()
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      quickActions: [...current.quickActions, {
        label: 'Nueva accion',
        kind: 'message',
        message: 'Mensaje de accion rapida.',
        targetStageId: '',
        targetTriggerId: '',
        actionUrl: null,
        responseAttachmentType: null,
        responseAttachmentUrl: null,
        responseAttachmentName: null,
        enabled: true,
        inactivityRule: getDefaultChatbotInactivityRule(),
        automation: getDefaultChatbotQuickActionAutomationConfig(),
        ...args?.preset,
        id: nextActionId,
      }],
      flowStages: args?.sourceNode?.kind === 'stage'
        ? current.flowStages.map((stage) => {
            if (stage.id !== args.sourceNode?.id) return stage
            if (args.sourceOptionId) {
              return {
                ...stage,
                responseOptions: stage.responseOptions.map((option) => option.id === args.sourceOptionId ? { ...option, targetActionId: nextActionId, targetStageId: '', targetTriggerId: '' } : option)
              }
            }
            return {
              ...stage,
              responseOptions: [...stage.responseOptions, createStageResponseOption(current.flowStages, stage.id, {
                label: 'Nueva opción',
                userMessage: 'Quiero continuar por esta ruta.',
                targetStageId: '',
                targetActionId: nextActionId,
                targetTriggerId: '',
              })],
            }
          })
        : current.flowStages,
      flowTriggers: args?.sourceNode?.kind === 'trigger'
        ? current.flowTriggers.map((trigger) => {
            if (trigger.id !== args.sourceNode?.id || !args.sourceOptionId) return trigger
            return {
              ...trigger,
              conditions: trigger.conditions.map((condition) => condition.id === args.sourceOptionId ? { ...condition, targetActionId: nextActionId, targetStageId: '', targetTriggerId: '' } : condition),
            }
          })
        : current.flowTriggers,
      studioNodeLayout: {
        ...current.studioNodeLayout,
        [`action:${nextActionId}`]: position,
      },
    }))
    queueNodeFocus({ kind: 'action', id: nextActionId })
    setNotice(args?.notice || 'Nueva accion creada.')
  }

  function createTrigger(args?: { position?: { x: number; y: number }; preset?: Partial<ChatbotFlowTrigger>; notice?: string }) {
    const nextTriggerId = makeId('trigger')
    const position = args?.position ?? getVisibleInsertPosition()
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: [...current.flowTriggers, {
        label: 'Nuevo filtro',
        event: 'message',
        matchMode: 'contains',
        matchValue: '',
        targetStageId: '',
        targetActionId: '',
        targetTriggerId: '',
        assistantReply: '',
        enabled: true,
        inactivityRule: getDefaultChatbotInactivityRule(),
        ...args?.preset,
        id: nextTriggerId,
        conditions: args?.preset?.conditions?.length
          ? args.preset.conditions.map((condition) => ({ ...condition, id: makeId(`${nextTriggerId}-condition`) }))
          : [createTriggerCondition(nextTriggerId)],
      }],
      studioNodeLayout: {
        ...current.studioNodeLayout,
        [`trigger:${nextTriggerId}`]: position,
      },
    }))
    queueNodeFocus({ kind: 'trigger', id: nextTriggerId })
    setNotice(args?.notice || 'Nuevo filtro creado.')
  }

  function createPause(args?: { sourceNode?: StudioFocusNode | null; position?: { x: number; y: number }; preset?: Partial<ChatbotStudioPauseNode>; notice?: string }) {
    const nextPauseId = makeId('pause')
    const position = args?.position ?? getVisibleInsertPosition()
    const defaultSourceStageId = builder.flowStages[0]?.id || ''
    const defaultTargetStageId = builder.flowStages[1]?.id || builder.flowStages[0]?.id || ''
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      pauseNodes: [...current.pauseNodes, {
        title: 'Nueva pausa',
        description: 'Espera antes del siguiente mensaje.',
        durationMinutes: 60,
        sourceStageId: args?.sourceNode?.kind === 'stage' ? args.sourceNode.id : (current.flowStages[0]?.id || defaultSourceStageId),
        targetStageId: current.flowStages[1]?.id || current.flowStages[0]?.id || defaultTargetStageId,
        enabled: true,
        ...args?.preset,
        id: nextPauseId,
      }],
      studioNodeLayout: {
        ...current.studioNodeLayout,
        [`pause:${nextPauseId}`]: position,
      },
    }))
    queueNodeFocus({ kind: 'pause', id: nextPauseId })
    setNotice(args?.notice || 'Nueva pausa creada.')
  }

  function setInitialStage(stageId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      startStageId: stageId,
    }))
    setFocusedNode({ kind: 'start', id: 'start' })
    setActiveEdgeId(null)
    setContextMenu(null)
    setNotice(stageId ? 'La caja de inicio ahora apunta al mensaje seleccionado.' : 'La caja de inicio quedó sin mensaje principal.')
  }

  function applyTemplate(templateId: string, position?: { x: number; y: number }) {
    const sourceNode = focusedNode

    if (templateId === 'template-stage-form') {
      const preset = getPublicChatbotPreChatFormPreset('quote-request')
      setBuilder((current) => ({
        ...current,
        preChatFormEnabled: true,
        preChatFormTemplate: preset.value,
        preChatFormTitle: preset.title,
        preChatFormDescription: preset.description,
        preChatFormSubmitLabel: preset.submitLabel,
        preChatFormShowNameField: preset.showNameField,
        preChatFormShowEmailField: preset.showEmailField,
        preChatFormShowPhoneField: preset.showPhoneField,
        preChatFormRequireName: preset.requireName,
        preChatFormRequireEmail: true,
        preChatFormRequirePhone: preset.requirePhone,
        preChatFormRequireContactMethod: preset.requireContactMethod,
        preChatFormShowDepartmentField: preset.showDepartmentField,
        preChatFormDepartmentLabel: preset.departmentLabel,
        preChatFormDepartmentPlaceholder: preset.departmentPlaceholder,
        preChatFormDepartmentOptions: preset.departmentOptions.map((item) => item.label).join('\n'),
      }))
      createStage({
        position,
        sourceNode,
        preset: {
          title: 'Formulario de contacto',
          description: 'Configura aquí qué datos pedir antes de abrir el chat.',
          prompt: plainTextToRichTextHtml('Gracias por completar el formulario. Continúo con la conversación desde este mensaje.'),
          templateKey: 'prechat-form' satisfies ChatbotFlowStageTemplateKey,
          nextField: 'none',
        },
        notice: 'Plantilla de formulario agregada al flujo. Puedes editar título, mensaje y campos desde este bloque.',
      })
      return
    }

    if (templateId === 'template-stage-list') {
      createStage({
        position,
        sourceNode,
        preset: {
          title: 'Servicios disponibles',
          description: 'Lista base de opciones para el cliente.',
          prompt: plainTextToRichTextHtml('Selecciona uno de estos servicios para continuar.'),
          responseOptions: [
            createStageResponseOption(builder.flowStages, '', { label: 'Páginas web', userMessage: 'Quiero una página web' }),
            createStageResponseOption(builder.flowStages, '', { label: 'Marketing digital', userMessage: 'Quiero marketing digital' }),
            createStageResponseOption(builder.flowStages, '', { label: 'Desarrollo de software', userMessage: 'Quiero desarrollo de software' }),
          ],
        },
        notice: 'Plantilla de lista guiada agregada al flujo.',
      })
      return
    }

    if (templateId === 'template-stage-variables') {
      createStage({
        position,
        sourceNode,
        preset: {
          title: 'Mensaje con variables',
          description: 'Usa placeholders listos para personalizar el mensaje.',
          prompt: plainTextToRichTextHtml('Hola {{contact_name}}. Ya vi tu interés en {{product_name}} y te acompaño como {{assistant_name}} para el siguiente paso.'),
        },
        notice: 'Plantilla con variables agregada al flujo.',
      })
      return
    }

    if (templateId === 'template-action-quote') {
      createAction({
        position,
        sourceNode,
        preset: {
          label: 'Generar cotización',
          kind: 'create_quote',
          message: 'Voy a generar la cotización con los datos capturados.',
        },
        notice: 'Plantilla de cotización agregada al flujo.',
      })
      return
    }

    if (templateId === 'template-action-human') {
      createAction({
        position,
        sourceNode,
        preset: {
          label: 'Pasar a asesor',
          kind: 'human',
          message: 'Voy a pasarte con un asesor humano para continuar.',
        },
        notice: 'Plantilla de escalamiento agregada al flujo.',
      })
      return
    }

    if (templateId === 'template-trigger-product') {
      createTrigger({
        position,
        preset: {
          label: 'Filtrar por producto',
          event: 'message',
          conditions: [
            createTriggerCondition('template-trigger-product', { variableKey: 'productoCotizar', matchMode: 'contains', matchValue: 'mug' }),
          ],
        },
        notice: 'Plantilla de filtro agregada al flujo.',
      })
    }
  }

  function parsePaletteDragValue(value: string): { kind: StudioPaletteKind } | { templateId: string } | null {
    if (value.startsWith('block:')) {
      const kind = value.slice('block:'.length) as StudioPaletteKind
      if (kind === 'stage' || kind === 'action' || kind === 'trigger' || kind === 'pause') {
        return { kind }
      }
    }

    if (value.startsWith('template:')) {
      const templateId = value.slice('template:'.length)
      if (STUDIO_TEMPLATE_ITEMS.some((item) => item.id === templateId)) {
        return { templateId }
      }
    }

    return null
  }

  function addStageFromPalette() {
    createStage()
  }

  function addActionFromPalette() {
    createAction()
  }

  function addTriggerFromPalette() {
    createTrigger()
  }

  function addPauseFromPalette() {
    createPause()
  }

  function updatePauseNode(pauseId: string, patch: Partial<ChatbotStudioPauseNode>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      pauseNodes: current.pauseNodes.map((item) => item.id === pauseId ? { ...item, ...patch } : item),
    }))
  }

  function offsetNodeLayout(nodeId: string) {
    const currentLayout = builder.studioNodeLayout[nodeId]
    return currentLayout ? { x: currentLayout.x + 36, y: currentLayout.y + 28 } : undefined
  }

  function duplicateNode(node: StudioFocusNode) {
    if (node.kind === 'stage') {
      const stage = builder.flowStages.find((item) => item.id === node.id)
      if (!stage) return
      const nextStageId = makeId('stage')
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowStages: [...current.flowStages, {
          ...stage,
          id: nextStageId,
          title: `${stage.title} copia`,
          responseOptions: stage.responseOptions.map(duplicateResponseOption),
        }],
        studioNodeLayout: {
          ...current.studioNodeLayout,
          [`stage:${nextStageId}`]: offsetNodeLayout(`stage:${stage.id}`) ?? { x: 360, y: 280 },
        },
      }))
      setNotice('Bloque de mensaje duplicado.')
      return
    }

    if (node.kind === 'action') {
      const action = builder.quickActions.find((item) => item.id === node.id)
      if (!action) return
      const nextActionId = makeId('action')
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: [...current.quickActions, { ...action, id: nextActionId, label: `${action.label} copia` }],
        studioNodeLayout: {
          ...current.studioNodeLayout,
          [`action:${nextActionId}`]: offsetNodeLayout(`action:${action.id}`) ?? { x: 360, y: 520 },
        },
      }))
      setNotice('Accion duplicada.')
      return
    }

    if (node.kind === 'trigger') {
      const trigger = builder.flowTriggers.find((item) => item.id === node.id)
      if (!trigger) return
      const nextTriggerId = makeId('trigger')
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowTriggers: [...current.flowTriggers, {
          ...trigger,
          id: nextTriggerId,
          label: `${trigger.label} copia`,
          conditions: trigger.conditions.map((condition) => ({ ...condition, id: makeId(`${nextTriggerId}-condition`) })),
        }],
        studioNodeLayout: {
          ...current.studioNodeLayout,
          [`trigger:${nextTriggerId}`]: offsetNodeLayout(`trigger:${trigger.id}`) ?? { x: 360, y: 60 },
        },
      }))
      setNotice('Filtro duplicado.')
      return
    }

    const pause = builder.pauseNodes.find((item) => item.id === node.id)
    if (!pause) return
    const nextPauseId = makeId('pause')
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      pauseNodes: [...current.pauseNodes, { ...pause, id: nextPauseId, title: `${pause.title} copia` }],
      studioNodeLayout: {
        ...current.studioNodeLayout,
        [`pause:${nextPauseId}`]: offsetNodeLayout(`pause:${pause.id}`) ?? { x: 380, y: 392 },
      },
    }))
    setNotice('Pausa duplicada.')
  }

  function deleteNode(node: StudioFocusNode) {
    if (node.kind === 'stage') {
      if (builder.flowStages.length <= 1) {
        setError('Debe existir al menos un bloque de mensaje en el flujo.')
        return
      }
      const remainingStages = builder.flowStages.filter((item) => item.id !== node.id)
      const fallbackStageId = remainingStages[0]?.id || ''
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        startStageId: current.startStageId === node.id ? fallbackStageId : current.startStageId,
        flowStages: current.flowStages
          .filter((item) => item.id !== node.id)
          .map((stage) => ({
            ...stage,
            responseOptions: stage.responseOptions
              .filter((option) => option.targetStageId !== node.id)
              .map((option) => ({ ...option, targetStageId: option.targetStageId || fallbackStageId })),
          })),
        flowTriggers: current.flowTriggers.map((trigger) => ({
          ...trigger,
          targetStageId: trigger.targetStageId === node.id ? '' : trigger.targetStageId,
          conditions: trigger.conditions.map((condition) => condition.targetStageId === node.id ? { ...condition, targetStageId: '' } : condition),
        })),
        pauseNodes: current.pauseNodes.filter((pause) => pause.sourceStageId !== node.id && pause.targetStageId !== node.id),
          studioNodeLayout: removeNodeLayoutEntry(current.studioNodeLayout, `stage:${node.id}`),
      }))
      setFocusedNode(null)
      setEditingNode(null)
      setNotice('Bloque de mensaje eliminado.')
      return
    }

    if (node.kind === 'action') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.filter((item) => item.id !== node.id),
        flowStages: current.flowStages.map((stage) => ({
          ...stage,
          quickActionIds: stage.quickActionIds.filter((actionId) => actionId !== node.id),
        })),
        flowTriggers: current.flowTriggers.map((trigger) => ({
          ...trigger,
          conditions: trigger.conditions.map((condition) => condition.targetActionId === node.id ? { ...condition, targetActionId: '' } : condition),
        })),
        studioNodeLayout: removeNodeLayoutEntry(current.studioNodeLayout, `action:${node.id}`),
      }))
      setFocusedNode(null)
      setEditingNode(null)
      setNotice('Accion eliminada.')
      return
    }

    if (node.kind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowTriggers: current.flowTriggers.filter((item) => item.id !== node.id),
        flowStages: current.flowStages.map((stage) => ({
          ...stage,
          responseOptions: stage.responseOptions.map((option) => option.targetTriggerId === node.id ? { ...option, targetTriggerId: '' } : option),
        })),
        quickActions: current.quickActions.map((action) => action.targetTriggerId === node.id ? { ...action, targetTriggerId: '' } : action),
        studioNodeLayout: removeNodeLayoutEntry(current.studioNodeLayout, `trigger:${node.id}`),
      }))
      setFocusedNode(null)
      setEditingNode(null)
      setNotice('Filtro eliminado.')
      return
    }

    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      pauseNodes: current.pauseNodes.filter((item) => item.id !== node.id),
      studioNodeLayout: removeNodeLayoutEntry(current.studioNodeLayout, `pause:${node.id}`),
    }))
    setFocusedNode(null)
    setEditingNode(null)
    setNotice('Pausa eliminada.')
  }

  function reorderNode(node: StudioFocusNode, direction: -1 | 1) {
    if (node.kind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowStages: reorderItems(current.flowStages, node.id, direction),
      }))
      return
    }
    if (node.kind === 'action') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: reorderItems(current.quickActions, node.id, direction),
      }))
      return
    }
    if (node.kind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowTriggers: reorderItems(current.flowTriggers, node.id, direction),
      }))
      return
    }
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      pauseNodes: reorderItems(current.pauseNodes, node.id, direction),
    }))
  }

  function replaceStageQuickActionLink(stageId: string, currentActionId: string, nextActionId: string) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        const quickActionIds = stage.quickActionIds.map((actionId) => actionId === currentActionId ? nextActionId : actionId)
        return {
          ...stage,
          quickActionIds: Array.from(new Set(quickActionIds)),
        }
      }),
    }))
  }

  function updateInlineEdgeTarget(edge: StudioGraphEdge, value: string) {
    const sourceId = edge.fromId.split(':')[1] || ''
    const targetId = edge.toId.split(':')[1] || ''
    const nextValue = value === '__none__' ? '' : value

    if (edge.sourceKind === 'start' && edge.targetKind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        startStageId: nextValue,
      }))
      setNotice(nextValue ? 'Se actualizó el mensaje inicial del flujo.' : 'La caja Inicio quedó sin mensaje principal.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'stage' && edge.sourceOptionId) {
      updateResponseOption(sourceId, edge.sourceOptionId, { targetStageId: nextValue, targetActionId: '', targetTriggerId: '' })
      setNotice('La rama quedó reconectada desde el canvas.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'trigger' && edge.sourceOptionId) {
      updateResponseOption(sourceId, edge.sourceOptionId, { targetTriggerId: nextValue, targetStageId: '', targetActionId: '' })
      setNotice('La rama ahora apunta al filtro elegido.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'action') {
      replaceStageQuickActionLink(sourceId, targetId, nextValue)
      setNotice('La acción rápida enlazada fue actualizada.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'pause') {
      updatePauseNode(targetId, { sourceStageId: nextValue })
      setNotice('Se actualizó el origen de la pausa.')
      return
    }

    if (edge.sourceKind === 'action' && edge.targetKind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetStageId: nextValue, targetTriggerId: '' } : action),
      }))
      setNotice('Se actualizó el destino de la acción.')
      return
    }

    if (edge.sourceKind === 'action' && edge.targetKind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetTriggerId: nextValue, targetStageId: '' } : action),
      }))
      setNotice('Se actualizó el filtro destino de la acción.')
      return
    }

    if (edge.sourceKind === 'trigger' && edge.targetKind === 'stage') {
      if (edge.sourceOptionId) {
        updateTriggerCondition(sourceId, edge.sourceOptionId, { targetStageId: nextValue, targetActionId: '' })
        setNotice('La condición del filtro quedó reconectada desde el canvas.')
        return
      }
      updateTrigger(sourceId, { targetStageId: nextValue })
      setNotice('El filtro quedó reconectado desde el canvas.')
      return
    }

    if (edge.sourceKind === 'trigger' && edge.targetKind === 'action' && edge.sourceOptionId) {
      updateTriggerCondition(sourceId, edge.sourceOptionId, { targetActionId: nextValue, targetStageId: '' })
      setNotice('La condición del filtro ahora apunta a la acción elegida.')
      return
    }

    if (edge.sourceKind === 'pause' && edge.targetKind === 'stage') {
      updatePauseNode(sourceId, { targetStageId: nextValue })
      setNotice('Se actualizó el destino de la pausa.')
    }
  }

  function disconnectEdge(edge: StudioGraphEdge) {
    const sourceId = edge.fromId.split(':')[1] || ''
    const targetId = edge.toId.split(':')[1] || ''

    if (edge.sourceKind === 'start' && edge.targetKind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        startStageId: '',
      }))
      setActiveEdgeId(null)
      setNotice('La caja Inicio quedó sin conexión. Ahora puedes definir otra caja principal.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'stage' && edge.sourceOptionId) {
      updateResponseOption(sourceId, edge.sourceOptionId, { targetStageId: '' })
      setActiveEdgeId(null)
      setNotice('La rama quedó sin mensaje destino.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'trigger' && edge.sourceOptionId) {
      updateResponseOption(sourceId, edge.sourceOptionId, { targetTriggerId: '' })
      setActiveEdgeId(null)
      setNotice('La rama quedó sin filtro destino.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'action') {
      if (edge.sourceOptionId) {
        updateResponseOption(sourceId, edge.sourceOptionId, { targetActionId: '' })
      } else {
        setBuilder((current) => updateSelectedFlowInBuilder(current, {
          flowStages: current.flowStages.map((stage) => stage.id === sourceId ? {
            ...stage,
            quickActionIds: stage.quickActionIds.filter((actionId) => actionId !== targetId),
          } : stage),
        }))
      }
      setActiveEdgeId(null)
      setNotice('La acción quedó desconectada del mensaje.')
      return
    }

    if (edge.sourceKind === 'stage' && edge.targetKind === 'pause') {
      updatePauseNode(targetId, { sourceStageId: '' })
      setActiveEdgeId(null)
      setNotice('La pausa quedó sin mensaje origen.')
      return
    }

    if (edge.sourceKind === 'action' && edge.targetKind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetStageId: '', targetTriggerId: '' } : action),
      }))
      setActiveEdgeId(null)
      setNotice('La acción quedó huérfana nuevamente.')
      return
    }

    if (edge.sourceKind === 'action' && edge.targetKind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetTriggerId: '', targetStageId: '' } : action),
      }))
      setActiveEdgeId(null)
      setNotice('La acción quedó sin filtro destino.')
      return
    }

    if (edge.sourceKind === 'trigger' && edge.targetKind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowTriggers: current.flowTriggers.map((trigger) => {
          if (trigger.id !== sourceId) return trigger
          if (!edge.sourceOptionId) return { ...trigger, targetStageId: '' }
          return {
            ...trigger,
            conditions: trigger.conditions.map((condition) => condition.id === edge.sourceOptionId ? { ...condition, targetStageId: '' } : condition),
          }
        }),
      }))
      setActiveEdgeId(null)
      setNotice(edge.sourceOptionId ? 'La condición del filtro quedó huérfana nuevamente.' : 'El filtro quedó huérfano nuevamente.')
      return
    }

    if (edge.sourceKind === 'trigger' && edge.targetKind === 'action' && edge.sourceOptionId) {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowTriggers: current.flowTriggers.map((trigger) => trigger.id === sourceId ? {
          ...trigger,
          conditions: trigger.conditions.map((condition) => condition.id === edge.sourceOptionId ? { ...condition, targetActionId: '' } : condition),
        } : trigger),
      }))
      setActiveEdgeId(null)
      setNotice('La condición del filtro quedó sin acción destino.')
      return
    }

    if (edge.sourceKind === 'pause' && edge.targetKind === 'stage') {
      updatePauseNode(sourceId, { targetStageId: '' })
      setActiveEdgeId(null)
      setNotice('La pausa quedó sin mensaje destino.')
    }
  }

  function focusStudioNode(node: StudioFocusNode) {
    setActiveEdgeId(null)
    setFocusedNode(node)
    setInspectorOpen(true)
    if (typeof document === 'undefined') return
    document.getElementById(toDomId(node.kind, node.id))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function openEditor(node: StudioFocusNode) {
    focusStudioNode(node)
    setEditingNode(node)
  }

  function startFlowEditing() {
    setFlowEditMode(true)
    setMapFullscreen(true)
    setInspectorOpen(true)
    setActiveStudioPanel('map')
  }

  function stopFlowEditing() {
    setFlowEditMode(false)
    setMapFullscreen(false)
    setActiveEdgeId(null)
    setContextMenu(null)
    setPaletteDragKind(null)
    setConnectionDraft(null)
    setDragState(null)
    setPanState(null)
  }

  function canConnectNodes(sourceKind: StudioGraphNode['kind'], targetKind: StudioGraphNode['kind']) {
    if (sourceKind === 'start') return targetKind === 'stage'
    if (sourceKind === 'stage') return targetKind === 'stage' || targetKind === 'action' || targetKind === 'pause' || targetKind === 'trigger'
    if (sourceKind === 'action') return targetKind === 'stage' || targetKind === 'trigger'
    if (sourceKind === 'trigger') return targetKind === 'stage'
    if (sourceKind === 'pause') return targetKind === 'stage'
    return false
  }

  function canConnectFromSource(args: { sourceKind: StudioGraphNode['kind']; targetKind: StudioGraphNode['kind']; sourceOptionId?: string }) {
    if (args.sourceOptionId) {
      return (args.sourceKind === 'stage' || args.sourceKind === 'trigger')
        && (args.targetKind === 'stage' || args.targetKind === 'action' || (args.sourceKind === 'stage' && args.targetKind === 'trigger'))
    }
    return canConnectNodes(args.sourceKind, args.targetKind)
  }

  function getStudioGraphNodeFromFocusNode(node: StudioFocusNode | undefined) {
    if (!node) return null
    return studioGraph.nodes.find((item) => item.id === `${node.kind}:${node.id}`) ?? null
  }

  function getConnectableExistingNodes(target?: StudioCreateMenuTarget) {
    const sourceNode = getStudioGraphNodeFromFocusNode(target?.sourceNode)
    if (!sourceNode) return []

    return studioGraph.nodes.filter((node) => {
      if (node.id === sourceNode.id || node.kind === 'start') return false
      return canConnectFromSource({
        sourceKind: sourceNode.kind,
        targetKind: node.kind,
        sourceOptionId: target?.sourceOptionId,
      })
    })
  }

  function connectExistingNodeFromMenu(targetNodeId: string) {
    const sourceNode = getStudioGraphNodeFromFocusNode(contextMenu?.createTarget?.sourceNode)
    const targetNode = studioGraph.nodes.find((node) => node.id === targetNodeId) ?? null
    if (!sourceNode || !targetNode) return
    applyConnection(sourceNode, targetNode, contextMenu?.createTarget?.sourceOptionId)
    setContextMenu(null)
  }

  function getConnectionHandleAnchor(args: { node: StudioGraphNode; sourceOptionId?: string; sourceOptionIndex?: number; targetKind?: StudioGraphNode['kind'] }) {
    const measuredAnchor = getMeasuredHandleAnchor(args.node.id, args.sourceOptionId)
    if (measuredAnchor) {
      return measuredAnchor
    }

    if (args.node.kind === 'stage' && typeof args.sourceOptionIndex === 'number') {
      const stageId = args.node.id.split(':')[1] || ''
      const stage = builder.flowStages.find((item) => item.id === stageId)
      const isStageQuickActionHandle = Boolean(args.sourceOptionId && stage?.quickActionIds.includes(args.sourceOptionId))

      if (isStageQuickActionHandle) {
        const responseCount = stage?.responseOptions.length ?? 0
        return {
          x: getStageOptionAnchorX(args.node),
          y: getStageActionAnchorY(args.node, responseCount, args.sourceOptionIndex),
        }
      }
      return {
        x: getStageOptionAnchorX(args.node),
        y: getStageOptionAnchorY(args.node, args.sourceOptionIndex),
      }
    }

    if (args.node.kind === 'trigger' && typeof args.sourceOptionIndex === 'number') {
      return {
        x: getStageOptionAnchorX(args.node),
        y: getTriggerConditionAnchorY(args.node, args.sourceOptionIndex),
      }
    }

    return {
      x: getNodeAnchorX(args.node, 'right'),
      y: getNodeAnchorY(args.node),
    }
  }

  function findConnectionTargetNode(point: { x: number; y: number }, draft: StudioConnectionDraft) {
    const candidates = [...studioGraph.nodes].reverse()
    return candidates.find((node) => {
      if (node.id === draft.fromId) return false
      const canConnect = canConnectFromSource({ sourceKind: draft.fromKind, targetKind: node.kind, sourceOptionId: draft.sourceOptionId })
      if (!canConnect) return false
      return isPointInsideNode(node, point)
    }) ?? null
  }

  function applyConnection(sourceNode: StudioGraphNode, targetNode: StudioGraphNode, sourceOptionId?: string) {
    const stage = sourceNode.kind === 'stage'
      ? builder.flowStages.find((item) => item.id === (sourceNode.id.split(':')[1] || ''))
      : null
    const trigger = sourceNode.kind === 'trigger'
      ? builder.flowTriggers.find((item) => item.id === (sourceNode.id.split(':')[1] || ''))
      : null
    const isActionLink = Boolean(sourceOptionId && stage?.quickActionIds.includes(sourceOptionId))
    const canConnect = canConnectFromSource({ sourceKind: sourceNode.kind, targetKind: targetNode.kind, sourceOptionId })
    if (!canConnect) return

    const sourceId = sourceNode.id.split(':')[1] || ''
    const targetId = targetNode.id.split(':')[1] || ''

    if (sourceNode.kind === 'start' && targetNode.kind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        startStageId: targetId,
      }))
      setNotice('Nodo inicial conectado al mensaje principal.')
      return
    }

    if (sourceNode.kind === 'stage' && targetNode.kind === 'stage' && !isActionLink) {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowStages: current.flowStages.map((stage) => {
          if (stage.id !== sourceId) return stage
          const existingOption = sourceOptionId
            ? stage.responseOptions.find((option) => option.id === sourceOptionId)
            : stage.responseOptions[0]
          if (existingOption) {
            return {
              ...stage,
              responseOptions: stage.responseOptions.map((option) => option.id === existingOption.id ? { ...option, targetStageId: targetId, targetActionId: '', targetTriggerId: '' } : option),
            }
          }
          return {
            ...stage,
            responseOptions: [...stage.responseOptions, { id: makeId('option'), label: 'Siguiente mensaje', userMessage: 'Continuar', assistantReply: '', matchMode: 'contains', matchValue: '', targetStageId: targetId, targetActionId: '', targetTriggerId: '' }],
          }
        }),
      }))
      setNotice(sourceOptionId ? 'Rama del mensaje reconectada.' : 'Ruta entre mensajes actualizada.')
      return
    }

    if (sourceNode.kind === 'stage' && targetNode.kind === 'action') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowStages: current.flowStages.map((stage) => stage.id === sourceId
          ? {
              ...stage,
              quickActionIds: sourceOptionId && stage.quickActionIds.includes(sourceOptionId)
                ? stage.quickActionIds.map((actionId) => actionId === sourceOptionId ? targetId : actionId)
                : (!sourceOptionId && !stage.quickActionIds.includes(targetId) ? [...stage.quickActionIds, targetId] : stage.quickActionIds),
              responseOptions: sourceOptionId && !stage.quickActionIds.includes(sourceOptionId)
                ? stage.responseOptions.map((option) => option.id === sourceOptionId ? { ...option, targetActionId: targetId, targetStageId: '', targetTriggerId: '' } : option)
                : stage.responseOptions,
            }
          : stage),
      }))
      setNotice('Accion enlazada al mensaje.')
      return
    }

    if (sourceNode.kind === 'stage' && targetNode.kind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        flowStages: current.flowStages.map((stage) => {
          if (stage.id !== sourceId) return stage
          const existingOption = sourceOptionId
            ? stage.responseOptions.find((option) => option.id === sourceOptionId)
            : stage.responseOptions[0]
          if (existingOption) {
            return {
              ...stage,
              responseOptions: stage.responseOptions.map((option) => option.id === existingOption.id ? { ...option, targetTriggerId: targetId, targetActionId: '', targetStageId: '' } : option),
            }
          }
          return {
            ...stage,
            responseOptions: [...stage.responseOptions, { id: makeId('option'), label: 'Evaluar filtro', userMessage: 'Continuar', assistantReply: '', matchMode: 'contains', matchValue: '', targetStageId: '', targetActionId: '', targetTriggerId: targetId }],
          }
        }),
      }))
      setNotice('Mensaje conectado al filtro.')
      return
    }

    if (sourceNode.kind === 'stage' && targetNode.kind === 'pause') {
      updatePauseNode(targetId, { sourceStageId: sourceId })
      setNotice('Pausa conectada desde el mensaje origen.')
      return
    }

    if (sourceNode.kind === 'action' && targetNode.kind === 'stage') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetStageId: targetId, targetTriggerId: '' } : action),
      }))
      setNotice('Accion conectada al siguiente mensaje.')
      return
    }

    if (sourceNode.kind === 'action' && targetNode.kind === 'trigger') {
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        quickActions: current.quickActions.map((action) => action.id === sourceId ? { ...action, targetTriggerId: targetId, targetStageId: '' } : action),
      }))
      setNotice('Accion conectada al filtro.')
      return
    }

    if (sourceNode.kind === 'trigger' && targetNode.kind === 'stage') {
      if (sourceOptionId) {
        updateTriggerCondition(sourceId, sourceOptionId, { targetStageId: targetId, targetActionId: '' })
        setNotice('Condición del filtro conectada al mensaje destino.')
        return
      }
      updateTrigger(sourceId, { targetStageId: targetId })
      setNotice('Filtro conectado al mensaje destino.')
      return
    }

    if (sourceNode.kind === 'trigger' && targetNode.kind === 'action' && sourceOptionId && trigger) {
      updateTriggerCondition(sourceId, sourceOptionId, { targetActionId: targetId, targetStageId: '' })
      setNotice('Condición del filtro conectada a la acción destino.')
      return
    }

    if (sourceNode.kind === 'pause' && targetNode.kind === 'stage') {
      updatePauseNode(sourceId, { targetStageId: targetId })
      setNotice('Pausa conectada al siguiente mensaje.')
    }
  }

  function handleConnectionStart(event: React.PointerEvent<HTMLButtonElement>, node: StudioGraphNode, sourceOptionId?: string, sourceLabel?: string, sourceOptionIndex?: number) {
    if (event.button !== 0) return
    event.stopPropagation()
    const measuredAnchor = measureHandleAnchor(event.currentTarget)
    const fallbackAnchor = getConnectionHandleAnchor({
      node,
      sourceOptionId,
      sourceOptionIndex,
    })
    const startX = measuredAnchor?.x ?? fallbackAnchor.x
    const startY = measuredAnchor?.y ?? fallbackAnchor.y
    setConnectionDraft({
      fromId: node.id,
      fromKind: node.kind,
      sourceOptionId,
      sourceLabel,
      sourceOptionIndex,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    })
  }

  function openContextMenu(node: StudioFocusNode, x: number, y: number) {
    setContextMenu({ mode: 'node', node, x, y })
  }

  function openEdgeContextMenu(edge: StudioGraphEdge, x: number, y: number) {
    setActiveEdgeId(null)
    setContextMenu({ mode: 'edge', edge, x, y })
  }

  function openCanvasMenu(x: number, y: number) {
    setContextMenu({ mode: 'canvas', x, y })
  }

  function openCreateMenu(args: { x: number; y: number; target?: StudioCreateMenuTarget }) {
    setContextMenu({ mode: 'create', x: args.x, y: args.y, createTarget: args.target })
  }

  function handleCreateFromMenu(kind: StudioPaletteKind) {
    const position = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : getVisibleInsertPosition()
    const target = contextMenu?.createTarget
    if (kind === 'stage') {
      createStage({ sourceNode: target?.sourceNode, sourceOptionId: target?.sourceOptionId, position })
      return
    }
    if (kind === 'action') {
      createAction({ sourceNode: target?.sourceNode, sourceOptionId: target?.sourceOptionId, position })
      return
    }
    if (kind === 'trigger') {
      createTrigger({ position })
      return
    }
    createPause({ sourceNode: target?.sourceNode, position })
  }

  function createNodeFromPalette(kind: StudioPaletteKind, position: { x: number; y: number }) {
    if (kind === 'stage') {
      createStage({ position })
      return
    }
    if (kind === 'action') {
      createAction({ position })
      return
    }
    if (kind === 'trigger') {
      createTrigger({ position })
      return
    }
    createPause({ position })
  }

  function handleBoardNodePointerDown(event: React.PointerEvent<HTMLDivElement>, node: StudioGraphNode) {
    if (event.button !== 0) return
    event.stopPropagation()
    setContextMenu(null)

    if (event.pointerType === 'touch') {
      const target = event.target instanceof HTMLElement ? event.target : null
      const touchDragHandle = target?.closest('[data-node-drag-handle="true"]')
      if (!touchDragHandle) {
        if (node.kind !== 'start') {
          focusStudioNode({ kind: node.kind, id: node.id.split(':')[1] || '' })
        }
        return
      }
    }

    dragMovedRef.current = false
    setDragState({
      nodeId: node.id,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      originX: node.x,
      originY: node.y,
    })
  }

  function handleBoardBackgroundPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    setContextMenu(null)
    setActiveEdgeId(null)
    dragMovedRef.current = false
    setPanState({
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      originX: builder.studioViewport.x,
      originY: builder.studioViewport.y,
    })
  }

  function handleBoardBackgroundContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = boardViewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(32, Math.round((event.clientX - rect.left - builder.studioViewport.x) / builder.studioViewport.scale))
    const y = Math.max(32, Math.round((event.clientY - rect.top - builder.studioViewport.y) / builder.studioViewport.scale))
    openCanvasMenu(x, y)
  }

  function getCanvasPointFromClient(clientX: number, clientY: number) {
    const rect = boardViewportRef.current?.getBoundingClientRect()
    if (!rect) return getVisibleInsertPosition()
    return {
      x: Math.max(32, Math.round((clientX - rect.left - builder.studioViewport.x) / builder.studioViewport.scale)),
      y: Math.max(32, Math.round((clientY - rect.top - builder.studioViewport.y) / builder.studioViewport.scale)),
    }
  }

  function handlePaletteDragStart(event: React.DragEvent<HTMLButtonElement>, value: string) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', value)
    setPaletteDragKind(value)
  }

  function handlePaletteDragEnd() {
    setPaletteDragKind(null)
  }

  function handleBoardDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!paletteDragKind) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleBoardDrop(event: React.DragEvent<HTMLDivElement>) {
    const payload = parsePaletteDragValue(event.dataTransfer.getData('text/plain') || paletteDragKind || '')
    if (!payload) return
    event.preventDefault()
    const position = getCanvasPointFromClient(event.clientX, event.clientY)
    if ('kind' in payload) {
      createNodeFromPalette(payload.kind, position)
    } else {
      applyTemplate(payload.templateId, position)
    }
    setPaletteDragKind(null)
  }

  function setStudioScale(nextScale: number, origin?: { clientX: number; clientY: number }) {
    const clampedScale = clampStudioScale(nextScale)
    setBuilder((current) => {
      if (!origin || !boardViewportRef.current) {
        return updateSelectedFlowInBuilder(current, {
          studioViewport: {
            ...current.studioViewport,
            scale: clampedScale,
          },
        })
      }

      const rect = boardViewportRef.current.getBoundingClientRect()
      const pointerX = origin.clientX - rect.left
      const pointerY = origin.clientY - rect.top
      const contentX = (pointerX - current.studioViewport.x) / current.studioViewport.scale
      const contentY = (pointerY - current.studioViewport.y) / current.studioViewport.scale

      return updateSelectedFlowInBuilder(current, {
        studioViewport: {
          x: pointerX - (contentX * clampedScale),
          y: pointerY - (contentY * clampedScale),
          scale: clampedScale,
        },
      })
    })
  }

  function resetStudioViewport() {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      studioViewport: { x: 48, y: 36, scale: 0.88 },
    }))
  }

  function clearStudioLayout() {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      studioNodeLayout: {},
      studioViewport: { x: 48, y: 36, scale: 0.88 },
    }))
  }

  function centerStudioOnPoint(contentX: number, contentY: number) {
    const rect = boardViewportRef.current?.getBoundingClientRect()
    if (!rect) return
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      studioViewport: {
        ...current.studioViewport,
        x: (rect.width / 2) - (contentX * current.studioViewport.scale),
        y: (rect.height / 2) - (contentY * current.studioViewport.scale),
      },
    }))
  }

  function centerStudioFromMinimapClient(clientX: number, clientY: number, rect: DOMRect, minimapScale: number) {
    const localX = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const localY = Math.max(0, Math.min(rect.height, clientY - rect.top))
    centerStudioOnPoint(localX / minimapScale, localY / minimapScale)
  }

  function getTouchMetrics(touches: React.TouchList) {
    if (touches.length < 2) return null
    const firstTouch = touches[0]
    const secondTouch = touches[1]
    const deltaX = secondTouch.clientX - firstTouch.clientX
    const deltaY = secondTouch.clientY - firstTouch.clientY
    return {
      distance: Math.hypot(deltaX, deltaY),
      centerX: (firstTouch.clientX + secondTouch.clientX) / 2,
      centerY: (firstTouch.clientY + secondTouch.clientY) / 2,
    }
  }

  function isTypingElement(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    const tagName = target.tagName.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
  }

  function renderInspectorDrawer(overlay = false) {
    if (overlay) return null
    if (!focusedNode) return null

    const deletionBlocker = getNodeDeletionBlocker(focusedNode)

    return (
      <>
        <button
          type="button"
          aria-label="Cerrar inspector"
          onClick={() => setInspectorOpen(false)}
          className={`absolute inset-0 z-20 bg-slate-950/8 transition duration-300 ${inspectorOpen ? 'opacity-100' : 'pointer-events-none opacity-0'} ${overlay ? '' : 'lg:bg-slate-950/6'}`}
        />
        <aside className={`absolute inset-y-3 left-3 z-30 w-[min(292px,calc(100%-24px))] transition-all duration-300 ease-out ${inspectorOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+16px)] opacity-0'}`}>
          <div className="flex h-full flex-col rounded-[22px] border border-slate-200/90 bg-white p-3 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.42)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bloque activo</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{getNodeKindLabel(focusedNode.kind)}</div>
                <div className="text-xs text-slate-500">Panel fijo para editar sin mover la vista.</div>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setInspectorOpen(false)}>Cerrar</Button>
            </div>

            <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {focusedNode.kind === 'start' ? (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Inicio</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">Nodo inicial del flujo</div>
                    <div className="mt-1 text-xs text-slate-600">Define aquí cuál es la caja que abre el recorrido del chatbot.</div>
                  </div>
                  <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <Label>Mensaje inicial</Label>
                    <Select value={selectedStartStage?.id || '__none__'} onValueChange={(value) => setInitialStage(value === '__none__' ? '' : value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin caja principal</SelectItem>
                        {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Resumen</div>
                    <div className="mt-1.5 leading-5 text-slate-500">Mensaje actual: {selectedStartStage?.title || 'Sin mensaje inicial configurado.'}</div>
                  </div>
                </>
              ) : null}

              {selectedStage ? (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Mensaje</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedStage.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">{selectedStage.nextField === 'none' ? 'Mensaje regular' : 'Espera respuesta del usuario'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Contenido</div>
                    {getStageMessageContent(selectedStage) ? <RichTextContent html={getStageMessageContent(selectedStage)} className="mt-1.5 text-xs leading-5" /> : <div className="mt-1.5 text-xs leading-5 text-slate-500">Sin contenido definido.</div>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">Rutas</div>
                      <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{selectedStage.responseOptions.length}</div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {selectedStage.responseOptions.length ? selectedStage.responseOptions.map((option) => (
                        <div key={option.id} className="rounded-xl bg-slate-50 px-2.5 py-2">
                          <div className="truncate font-medium text-slate-900">{option.label}</div>
                          <div className="truncate text-[11px] text-slate-500">Va a {stageMap[option.targetStageId]?.title || option.targetStageId}</div>
                        </div>
                      )) : <div className="text-[11px] text-slate-500">Este mensaje no tiene rutas configuradas.</div>}
                    </div>
                  </div>
                </>
              ) : null}

              {selectedAction ? (
                <>
                  <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-700">Accion</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedAction.label}</div>
                    <div className="mt-1 text-xs text-slate-600">Tipo: {selectedAction.kind}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Mensaje</div>
                    <div className="mt-1.5 line-clamp-5 whitespace-pre-wrap leading-5">{selectedAction.message || 'Sin mensaje definido.'}</div>
                  </div>
                </>
              ) : null}

              {selectedTrigger ? (
                <>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Filtro</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedTrigger.label}</div>
                    <div className="mt-1 text-xs text-slate-600">{selectedTrigger.event} · {selectedTrigger.conditions.length} rama(s)</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Condiciones</div>
                    <div className="mt-1.5 leading-5">{summarizeTriggerConditions(selectedTrigger)}</div>
                  </div>
                </>
              ) : null}

              {selectedPause ? (
                <>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Pausa</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedPause.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">Espera configurada dentro del flujo</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Recorrido</div>
                    <div className="mt-1.5 text-xs leading-5">{stageMap[selectedPause.sourceStageId]?.title || 'Sin origen'} → {stageMap[selectedPause.targetStageId]?.title || 'Sin destino'}</div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setInspectorAdvancedOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                <span>Mas opciones</span>
                {inspectorAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {inspectorAdvancedOpen && focusedNode.kind !== 'start' ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditor(focusedNode)}>Editar</Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => duplicateNode(focusedNode)}>Duplicar</Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => reorderNode(focusedNode, -1)}>Subir</Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => reorderNode(focusedNode, 1)}>Bajar</Button>
                  <Button type="button" variant="outline" size="sm" className="col-span-2 h-8 border-rose-200 text-xs text-rose-700" onClick={() => deleteNodeWithFeedback(focusedNode)}>Eliminar bloque</Button>
                </div>
              ) : null}
            </div>

            {deletionBlocker ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                {deletionBlocker}
              </div>
            ) : null}
          </div>
        </aside>
      </>
    )
  }

  function renderFullscreenShortcutHint() {
    if (!mapFullscreen) return null

    return (
      <div className="absolute right-4 top-4 z-20 hidden rounded-[18px] border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)] lg:block">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atajos</div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-1">I Inspector</span>
          <span className="rounded-full bg-slate-100 px-2 py-1">0 Centrar</span>
          <span className="rounded-full bg-slate-100 px-2 py-1">Esc Salir</span>
          {!minimapOpen ? (
            <button
              type="button"
              onClick={() => setMinimapOpen(true)}
              className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-medium text-white"
            >
              Mostrar minimapa
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  function renderFullscreenPropertiesInspector() {
    if (!focusedNode || !inspectorOpen) return null

    const deletionBlocker = getNodeDeletionBlocker(focusedNode)

    return (
      <div className="flex max-h-[calc(100vh-130px)] min-h-0 flex-col rounded-[20px] border border-slate-200/80 bg-white/95 p-3 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Inspector</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{getNodeKindLabel(focusedNode.kind)}</div>
            <div className="mt-1 text-xs text-slate-500">Propiedades del bloque seleccionado.</div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={focusedNode.kind === 'stage' ? true : focusedNode.kind === 'action' ? Boolean(selectedAction?.enabled) : focusedNode.kind === 'trigger' ? Boolean(selectedTrigger?.enabled) : Boolean(selectedPause?.enabled)} onCheckedChange={(checked) => {
              if (focusedNode.kind === 'action' && selectedAction) updateQuickAction(selectedAction.id, { enabled: checked })
              if (focusedNode.kind === 'trigger' && selectedTrigger) updateTrigger(selectedTrigger.id, { enabled: checked })
              if (focusedNode.kind === 'pause' && selectedPause) updatePauseNode(selectedPause.id, { enabled: checked })
            }} disabled={focusedNode.kind === 'stage' || focusedNode.kind === 'start'} />
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setInspectorOpen(false)}>Cerrar</Button>
          </div>
        </div>

        {focusedNode.kind === 'start' ? (
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-24">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-xs text-emerald-900">
              <div className="font-semibold">Nodo inicial</div>
              <div className="mt-1 leading-5">Selecciona aquí la caja que debe iniciar el flujo. El Studio la moverá al primer lugar sin borrar el resto de conexiones.</div>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje inicial</Label>
              <Select value={selectedStartStage?.id || '__none__'} onValueChange={(value) => setInitialStage(value === '__none__' ? '' : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin caja principal</SelectItem>
                  {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">Resumen</div>
              <div className="mt-2">Mensaje actual: {selectedStartStage?.title || 'Sin mensaje inicial'}</div>
              <div className="mt-1">Canal público: {builder.chatbotTitle || 'Sin título público'}</div>
            </div>
          </div>
        ) : null}

        {selectedStage ? (
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-24">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={selectedStage.title} onChange={(event) => updateStage(selectedStage.id, { title: event.target.value })} />
            </div>
            {selectedStage.templateKey === 'prechat-form' ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-950">Formulario previo al chat</div>
                  <div className="mt-1 text-xs leading-5 text-emerald-900">Controla aquí el título, el mensaje y la cantidad de entradas visibles antes de abrir la conversación.</div>
                </div>
                <div className="rounded-[24px] border border-emerald-200 bg-white px-4 py-4 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Preview para el usuario</div>
                  <div className="mt-3 rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-base font-semibold text-slate-950">{builder.preChatFormTitle || 'Formulario previo al chat'}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{builder.preChatFormDescription || 'Completa estos datos antes de iniciar la conversación.'}</div>
                    <div className="mt-4 space-y-3">
                      {getPreChatPreviewFields(builder).length ? getPreChatPreviewFields(builder).map((field) => (
                        <div key={`${field.label}-${field.placeholder}`} className="space-y-1.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{field.label}{field.required ? ' *' : ''}</div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400">{field.placeholder}</div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">Activa al menos un campo para ver la estructura del formulario.</div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <div className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">{builder.preChatFormSubmitLabel || 'Continuar'}</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Título del formulario</Label>
                  <Input value={builder.preChatFormTitle} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormTitle: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Mensaje del formulario</Label>
                  <Textarea value={builder.preChatFormDescription} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDescription: event.target.value }))} rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Texto del botón</Label>
                  <Input value={builder.preChatFormSubmitLabel} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormSubmitLabel: event.target.value }))} />
                </div>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar nombre</span><Switch checked={builder.preChatFormShowNameField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowNameField: checked }))} /></div>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir nombre</span><Switch checked={builder.preChatFormRequireName} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireName: checked }))} disabled={!builder.preChatFormShowNameField} /></div>
                  {builder.preChatFormShowNameField ? (
                    <>
                      <div className="grid gap-2">
                        <Label>Nombre del campo nombre</Label>
                        <Input value={builder.nameLabel} onChange={(event) => setBuilder((current) => ({ ...current, nameLabel: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder nombre</Label>
                        <Input value={builder.namePlaceholder} onChange={(event) => setBuilder((current) => ({ ...current, namePlaceholder: event.target.value }))} />
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar correo</span><Switch checked={builder.preChatFormShowEmailField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowEmailField: checked }))} /></div>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir correo</span><Switch checked={builder.preChatFormRequireEmail} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireEmail: checked }))} disabled={!builder.preChatFormShowEmailField} /></div>
                  {builder.preChatFormShowEmailField ? (
                    <>
                      <div className="grid gap-2">
                        <Label>Nombre del campo correo</Label>
                        <Input value={builder.emailLabel} onChange={(event) => setBuilder((current) => ({ ...current, emailLabel: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder correo</Label>
                        <Input value={builder.emailPlaceholder} onChange={(event) => setBuilder((current) => ({ ...current, emailPlaceholder: event.target.value }))} />
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar teléfono</span><Switch checked={builder.preChatFormShowPhoneField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowPhoneField: checked }))} /></div>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir teléfono</span><Switch checked={builder.preChatFormRequirePhone} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequirePhone: checked }))} disabled={!builder.preChatFormShowPhoneField} /></div>
                  {builder.preChatFormShowPhoneField ? (
                    <>
                      <div className="grid gap-2">
                        <Label>Nombre del campo teléfono</Label>
                        <Input value={builder.phoneLabel} onChange={(event) => setBuilder((current) => ({ ...current, phoneLabel: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder teléfono</Label>
                        <Input value={builder.phonePlaceholder} onChange={(event) => setBuilder((current) => ({ ...current, phonePlaceholder: event.target.value }))} />
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Exigir al menos correo o teléfono</span><Switch checked={builder.preChatFormRequireContactMethod} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireContactMethod: checked }))} disabled={!builder.preChatFormShowEmailField && !builder.preChatFormShowPhoneField} /></div>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar campo adicional</span><Switch checked={builder.preChatFormShowDepartmentField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowDepartmentField: checked }))} /></div>
                  {builder.preChatFormShowDepartmentField ? (
                    <>
                      <div className="grid gap-2">
                        <Label>Nombre del campo adicional</Label>
                        <Input value={builder.preChatFormDepartmentLabel} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentLabel: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder del campo adicional</Label>
                        <Input value={builder.preChatFormDepartmentPlaceholder} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentPlaceholder: event.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Opciones del campo adicional</Label>
                        <Textarea value={builder.preChatFormDepartmentOptions} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentOptions: event.target.value }))} rows={4} placeholder="Ventas&#10;Soporte técnico&#10;Facturación" />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Editor del mensaje</Label>
              <RichTextComposer value={getStageMessageContent(selectedStage)} onChange={(nextValue) => updateStageMessageContent(selectedStage.id, nextValue)} placeholder="Escribe aqui el mensaje exactamente como lo verá el usuario en el chat." variableOptions={triggerVariableOptions} />
              <div className="text-[11px] leading-5 text-slate-500">{selectedStage.templateKey === 'prechat-form' ? 'Este mensaje se envía después de que el visitante completa el formulario.' : 'Este es el único campo de contenido del mensaje. El Studio mostrará esta misma pieza en la caja del canvas y en el chatbot.'}</div>
            </div>
            <div className="grid gap-2">
              <Label>Dato esperado</Label>
              <Select value={selectedStage.nextField} onValueChange={(value) => updateStage(selectedStage.id, { nextField: value as ChatbotFlowNextField })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="email">Correo</SelectItem>
                  <SelectItem value="phone">Teléfono</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="product">Producto</SelectItem>
                  <SelectItem value="quantity">Cantidad</SelectItem>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="document">Documento / NIT</SelectItem>
                    <SelectItem value="city">Ciudad</SelectItem>
                    <SelectItem value="address">Dirección</SelectItem>
                    <SelectItem value="confirmation">Resumen y confirmación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">Resumen</div>
              <div className="mt-2">{selectedStage.responseOptions.length} rutas configuradas</div>
              <div className="mt-1">{selectedStage.responseOptions.filter((option) => option.targetActionId).length} opciones enlazadas a acciones</div>
            </div>
            {renderInactivityRuleFields({
              title: 'Expiración de esta caja',
              description: 'Aplica si el visitante se queda detenido en este mensaje sin responder.',
              rule: selectedStage.inactivityRule || getDefaultChatbotInactivityRule(),
              onChange: (rule) => updateStage(selectedStage.id, { inactivityRule: rule }),
            })}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Opciones del cliente</div>
                  <div className="text-xs text-slate-500">Crea la opción y enlázala después cuando quieras.</div>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => addResponseOptionToStage(selectedStage.id)}>Agregar opción</Button>
              </div>
              <div className="space-y-2">
                {selectedStage.responseOptions.length ? selectedStage.responseOptions.map((option) => (
                  <div key={option.id} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="grid gap-2">
                      <Label>Texto de la opción</Label>
                      <Input value={option.label} onChange={(event) => updateResponseOption(selectedStage.id, option.id, { label: event.target.value, userMessage: event.target.value })} placeholder="Ej: Quiero cotizar" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ir a mensaje</Label>
                      <Select value={option.targetStageId || '__none__'} onValueChange={(value) => updateResponseOption(selectedStage.id, option.id, { targetStageId: value === '__none__' ? '' : value, targetActionId: value === '__none__' ? option.targetActionId : '', targetTriggerId: value === '__none__' ? option.targetTriggerId : '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin enlazar</SelectItem>
                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Ir a acción</Label>
                      <Select value={option.targetActionId || '__none__'} onValueChange={(value) => updateResponseOption(selectedStage.id, option.id, { targetActionId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? option.targetStageId : '', targetTriggerId: value === '__none__' ? option.targetTriggerId : '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin enlazar</SelectItem>
                          {builder.quickActions.map((action) => <SelectItem key={action.id} value={action.id}>{action.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Ir a filtro</Label>
                      <Select value={option.targetTriggerId || '__none__'} onValueChange={(value) => updateResponseOption(selectedStage.id, option.id, { targetTriggerId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? option.targetStageId : '', targetActionId: value === '__none__' ? option.targetActionId : '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin enlazar</SelectItem>
                          {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => createAction({ sourceNode: { kind: 'stage', id: selectedStage.id }, sourceOptionId: option.id })}>Nueva acción</Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => duplicateStageResponseOption(selectedStage.id, option.id)}>Duplicar</Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-rose-200 text-xs text-rose-700" onClick={() => removeResponseOption(selectedStage.id, option.id)}>Eliminar</Button>
                    </div>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">Todavía no hay opciones visibles para este mensaje.</div>}
              </div>
            </div>
          </div>
        ) : null}

        {selectedAction ? (
          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-24">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={selectedAction.label} onChange={(event) => updateQuickAction(selectedAction.id, { label: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={selectedAction.kind} onValueChange={(value) => updateQuickAction(selectedAction.id, { kind: value as ChatbotQuickActionKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalog">Catálogo</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="product_lookup">Lookup producto</SelectItem>
                  <SelectItem value="service_lookup">Lookup servicio</SelectItem>
                    <SelectItem value="create_quote">Crear cotización</SelectItem>
                    <SelectItem value="create_invoice">Crear factura</SelectItem>
                    <SelectItem value="create_work_order">Crear orden</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="human">Humano</SelectItem>
                  <SelectItem value="message">Mensaje</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje</Label>
              <Textarea value={selectedAction.message} onChange={(event) => updateQuickAction(selectedAction.id, { message: event.target.value })} rows={5} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Ir a mensaje</Label>
                <Select value={selectedAction.targetStageId || '__none__'} onValueChange={(value) => updateQuickAction(selectedAction.id, { targetStageId: value === '__none__' ? '' : value, targetTriggerId: value === '__none__' ? selectedAction.targetTriggerId : '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin enlazar</SelectItem>
                    {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ir a filtro</Label>
                <Select value={selectedAction.targetTriggerId || '__none__'} onValueChange={(value) => updateQuickAction(selectedAction.id, { targetTriggerId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? selectedAction.targetStageId : '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin enlazar</SelectItem>
                    {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedAction.kind === 'url' ? (
              <div className="grid gap-2">
                <Label>URL destino</Label>
                <Input value={selectedAction.actionUrl || ''} onChange={(event) => updateQuickAction(selectedAction.id, { actionUrl: event.target.value })} placeholder="https://... o /ruta-interna" />
              </div>
            ) : null}
            {renderInactivityRuleFields({
              title: 'Expiración de esta acción',
              description: 'Si el visitante queda parado después de ejecutar esta acción, puedes devolverlo al inicio o cerrar el hilo.',
              rule: selectedAction.inactivityRule || getDefaultChatbotInactivityRule(),
              onChange: (rule) => updateQuickAction(selectedAction.id, { inactivityRule: rule }),
            })}
            {renderQuickActionAttachmentFields({
              action: selectedAction,
              update: (patch) => updateQuickAction(selectedAction.id, patch),
            })}
            {renderQuickActionAutomationFields(selectedAction)}
          </div>
        ) : null}

        {selectedTrigger ? (
          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-24">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={selectedTrigger.label} onChange={(event) => updateTrigger(selectedTrigger.id, { label: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Evento</Label>
              <Select value={selectedTrigger.event} onValueChange={(value) => updateTrigger(selectedTrigger.id, { event: value as ChatbotFlowTriggerEvent })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Mensaje recibido</SelectItem>
                  <SelectItem value="conversation_started">Conversación iniciada</SelectItem>
                  <SelectItem value="lead_created">Lead creado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderInactivityRuleFields({
              title: 'Expiración de este filtro',
              description: 'Úsalo cuando esta evaluación deje al usuario esperando y quieras reiniciar o cerrar por inactividad.',
              rule: selectedTrigger.inactivityRule || getDefaultChatbotInactivityRule(),
              onChange: (rule) => updateTrigger(selectedTrigger.id, { inactivityRule: rule }),
            })}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">Condiciones del filtro</div>
                  <InfoHint content="Cada condición puede evaluar una variable y enviar al usuario a un mensaje o a una acción concreta." label="Ver ayuda de condiciones del filtro" />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => addTriggerCondition(selectedTrigger.id)}>Agregar condición</Button>
              </div>
              <div className="space-y-3">
                {selectedTrigger.conditions.length ? selectedTrigger.conditions.map((condition) => (
                  <div key={condition.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2">
                      <Label>Variable</Label>
                      <Select value={condition.variableKey} onValueChange={(value) => updateTriggerCondition(selectedTrigger.id, condition.id, { variableKey: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {triggerVariableOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div className="grid gap-2">
                        <Label>Operador</Label>
                        <Select value={condition.matchMode} onValueChange={(value) => updateTriggerCondition(selectedTrigger.id, condition.id, { matchMode: value as ChatbotFlowTriggerMatchMode })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contiene</SelectItem>
                            <SelectItem value="equals">Es igual a</SelectItem>
                            <SelectItem value="starts_with">Empieza por</SelectItem>
                            <SelectItem value="regex">Regex</SelectItem>
                            <SelectItem value="exact">Exacto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Valor</Label>
                        <Input value={condition.matchValue} onChange={(event) => updateTriggerCondition(selectedTrigger.id, condition.id, { matchValue: event.target.value })} placeholder="Ej: 5" />
                      </div>
                    </div>
                    <div className="grid gap-2 xl:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Ir a acción</Label>
                        <Select value={condition.targetActionId || '__none__'} onValueChange={(value) => updateTriggerCondition(selectedTrigger.id, condition.id, { targetActionId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? condition.targetStageId : '' })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin acción</SelectItem>
                            {builder.quickActions.map((action) => <SelectItem key={action.id} value={action.id}>{action.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Ir a mensaje</Label>
                        <Select value={condition.targetStageId || '__none__'} onValueChange={(value) => updateTriggerCondition(selectedTrigger.id, condition.id, { targetStageId: value === '__none__' ? '' : value, targetActionId: value === '__none__' ? condition.targetActionId : '' })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin mensaje</SelectItem>
                            {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-8 border-rose-200 text-xs text-rose-700" onClick={() => removeTriggerCondition(selectedTrigger.id, condition.id)}>Eliminar condición</Button>
                    </div>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">Este filtro todavía no tiene condiciones.</div>}
              </div>
            </div>
          </div>
        ) : null}

        {selectedPause ? (
          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-24">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={selectedPause.title} onChange={(event) => updatePauseNode(selectedPause.id, { title: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={selectedPause.description} onChange={(event) => updatePauseNode(selectedPause.id, { description: event.target.value })} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Duración en minutos</Label>
              <Input type="number" min={1} value={String(selectedPause.durationMinutes)} onChange={(event) => updatePauseNode(selectedPause.id, { durationMinutes: Math.max(1, Number(event.target.value) || 1) })} />
            </div>
            <div className="grid gap-2">
              <Label>Mensaje origen</Label>
              <Select value={selectedPause.sourceStageId} onValueChange={(value) => updatePauseNode(selectedPause.id, { sourceStageId: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje destino</Label>
              <Select value={selectedPause.targetStageId} onValueChange={(value) => updatePauseNode(selectedPause.id, { targetStageId: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {focusedNode.kind !== 'start' ? (
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => openEditor(focusedNode)}>Edición avanzada</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => duplicateNode(focusedNode)}>Duplicar</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => reorderNode(focusedNode, -1)}>Subir</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => reorderNode(focusedNode, 1)}>Bajar</Button>
            <Button type="button" variant="outline" size="sm" className="col-span-2 border-rose-200 text-rose-700" onClick={() => deleteNodeWithFeedback(focusedNode)}>Eliminar bloque</Button>
          </div>
        ) : null}

        {deletionBlocker ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
            {deletionBlocker}
          </div>
        ) : null}
      </div>
    )
  }

  function renderFullscreenPaletteRail() {
    const selectedTemplate = paletteDragKind ? parsePaletteDragValue(paletteDragKind) : null

    return (
      <div className="hidden h-full min-h-0 rounded-[26px] border border-slate-200 bg-white/96 p-3 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.25)] xl:flex xl:flex-col xl:gap-4">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <GitBranch className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">Bloques y plantillas</div>
            </div>
            <InfoHint content="Arrastra al canvas o haz clic para insertar. Si tienes una caja activa, la plantilla se conectará desde ella cuando aplique." label="Ver ayuda de bloques y plantillas" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bloques base</div>
          <div className="grid gap-2">
            {STUDIO_PALETTE_ITEMS.map((item) => {
              const Icon = item.kind === 'stage' ? Bot : item.kind === 'action' ? Zap : item.kind === 'trigger' ? GitBranch : History
              const dragValue = `block:${item.kind}`
              return (
                <button
                  key={`rail-${item.kind}`}
                  type="button"
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, dragValue)}
                  onDragEnd={handlePaletteDragEnd}
                  onClick={() => handleCreateFromMenu(item.kind)}
                  className={`flex w-full items-center gap-2 rounded-[18px] border px-2.5 py-2.5 text-left transition ${item.className} ${paletteDragKind === dragValue ? 'scale-[1.01] shadow-sm ring-2 ring-slate-900/10' : ''}`}
                  title={item.description}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-white/85">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-xs font-semibold">{item.label}</div>
                      <InfoHint content={item.description} label={`Ver ayuda de ${item.label}`} className="h-4.5 w-4.5 shrink-0" iconClassName="h-3 w-3" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Plantillas</div>
            {selectedTemplate && 'templateId' in selectedTemplate ? <div className="text-[10px] text-slate-400">Lista para soltar</div> : null}
          </div>
          <div className="grid gap-2">
            {STUDIO_TEMPLATE_ITEMS.map((template) => {
              const Icon = template.kind === 'stage' ? Bot : template.kind === 'action' ? Zap : template.kind === 'trigger' ? GitBranch : History
              const dragValue = `template:${template.id}`
              return (
                <button
                  key={template.id}
                  type="button"
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, dragValue)}
                  onDragEnd={handlePaletteDragEnd}
                  onClick={() => applyTemplate(template.id)}
                  className={`w-full rounded-[18px] border px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${template.toneClass} ${paletteDragKind === dragValue ? 'scale-[1.01] shadow-sm ring-2 ring-slate-900/10' : ''}`}
                  title={template.description}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-white/85">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold">{template.label}</div>
                        <InfoHint content={template.description} label={`Ver ayuda de ${template.label}`} className="h-4.5 w-4.5 shrink-0" iconClassName="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderFullscreenMinimap() {
    if (!mapFullscreen || !minimapOpen || !boardViewportSize.width || !boardViewportSize.height) return null

    const minimapWidth = 196
    const minimapHeight = 132
    const minimapScale = Math.min(minimapWidth / studioGraph.contentWidth, minimapHeight / studioGraph.contentHeight)
    const viewportStartX = Math.max(0, -builder.studioViewport.x / builder.studioViewport.scale)
    const viewportStartY = Math.max(0, -builder.studioViewport.y / builder.studioViewport.scale)
    const viewportEndX = Math.min(studioGraph.contentWidth, (boardViewportSize.width - builder.studioViewport.x) / builder.studioViewport.scale)
    const viewportEndY = Math.min(studioGraph.contentHeight, (boardViewportSize.height - builder.studioViewport.y) / builder.studioViewport.scale)
    const viewportWidth = Math.max(24, (viewportEndX - viewportStartX) * minimapScale)
    const viewportHeight = Math.max(18, (viewportEndY - viewportStartY) * minimapScale)

    return (
      <div
        aria-label="Minimapa del flujo"
        onPointerDown={(event) => {
          const element = event.currentTarget
          const rect = element.getBoundingClientRect()
          minimapDraggingRef.current = true
          centerStudioFromMinimapClient(event.clientX, event.clientY, rect, minimapScale)

          const handlePointerMove = (moveEvent: PointerEvent) => {
            if (!minimapDraggingRef.current) return
            centerStudioFromMinimapClient(moveEvent.clientX, moveEvent.clientY, rect, minimapScale)
          }

          const stopDragging = () => {
            minimapDraggingRef.current = false
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', stopDragging)
          }

          window.addEventListener('pointermove', handlePointerMove)
          window.addEventListener('pointerup', stopDragging)
        }}
        className="absolute bottom-4 right-4 z-20 hidden w-[196px] rounded-[20px] border border-slate-200/90 bg-white/96 p-2 text-left shadow-[0_18px_42px_-24px_rgba(15,23,42,0.38)] xl:block"
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Minimapa</div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-slate-400">Arrastra para navegar</div>
            <button
              type="button"
              aria-label="Cerrar minimapa"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                setMinimapOpen(false)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              ×
            </button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#eef2f7)]" style={{ width: `${minimapWidth}px`, height: `${minimapHeight}px` }}>
          {studioGraph.edges.map((edge) => {
            const source = studioGraph.nodes.find((node) => node.id === edge.fromId)
            const target = studioGraph.nodes.find((node) => node.id === edge.toId)
            if (!source || !target) return null
            return (
              <svg key={edge.id} className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${minimapWidth} ${minimapHeight}`} fill="none">
                <path
                  d={`M ${getNodeAnchorX(source, 'right') * minimapScale} ${getNodeAnchorY(source) * minimapScale} C ${(getNodeAnchorX(source, 'right') + 34) * minimapScale} ${getNodeAnchorY(source) * minimapScale}, ${(getNodeAnchorX(target, 'left') - 34) * minimapScale} ${getNodeAnchorY(target) * minimapScale}, ${getNodeAnchorX(target, 'left') * minimapScale} ${getNodeAnchorY(target) * minimapScale}`}
                  className="fill-none stroke-slate-300 stroke-[1.4]"
                />
              </svg>
            )
          })}
          {studioGraph.nodes.map((node) => {
            const nodeKey = node.id.split(':')[1]
            const active = focusedNode?.id === nodeKey && focusedNode?.kind === node.kind
            return (
              <div
                key={`minimap-${node.id}`}
                className={`absolute rounded-md border ${active ? 'border-slate-900 bg-slate-900/80' : 'border-slate-300 bg-white/90'}`}
                style={{
                  left: `${node.x * minimapScale}px`,
                  top: `${node.y * minimapScale}px`,
                  width: `${Math.max(10, node.width * minimapScale)}px`,
                  height: `${Math.max(8, 60 * minimapScale)}px`,
                }}
              />
            )
          })}
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-emerald-400 bg-emerald-300/10"
            style={{
              left: `${viewportStartX * minimapScale}px`,
              top: `${viewportStartY * minimapScale}px`,
              width: `${viewportWidth}px`,
              height: `${viewportHeight}px`,
            }}
          />
        </div>
      </div>
    )
  }

  function renderConversationsWorkspace() {
    return (
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70">
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Chats del canal</CardTitle>
            <CardDescription>Bandeja operativa para seguir conversaciones del chatbot en un solo lugar.</CardDescription>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-800">
                <Bell className="h-3.5 w-3.5" />
                {unreadConversationCount} chats con nuevos mensajes
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {unreadMessageCount} mensajes pendientes
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Buscar por nombre, teléfono o mensaje" />
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void loadConversations(selectedChannelId)} disabled={!selectedChannelId}>Actualizar</Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
            {!filteredConversations.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay conversaciones que coincidan con la búsqueda o este canal aún no tiene chats.</div> : null}
            {filteredConversations.map((conversation) => {
              const preview = conversation.messages[0]?.bodyText || 'Sin mensajes visibles'
              const active = selectedConversationId === conversation.id
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-emerald-300 bg-emerald-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{conversation.contactDisplayName || conversation.contactPhone || conversation.contactEmail || 'Visitante web'}</div>
                      <div className="mt-1 text-xs text-slate-500">{conversation.assignedTo?.name || conversation.assignedTo?.email || 'Sin asignar'} · {conversation.status}</div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-slate-500">
                      <div className="flex items-center justify-end gap-2">
                        <div>{formatDate(conversation.lastMessageAt)}</div>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${conversation.unreadCount > 0 ? 'animate-pulse border-amber-300 bg-amber-50 text-amber-600 shadow-[0_0_0_4px_rgba(251,191,36,0.16)]' : 'border-slate-200 bg-slate-50 text-slate-300'}`}>
                          <Bell className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      {conversation.unreadCount > 0 ? <div className="mt-1 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">{conversation.unreadCount}</div> : null}
                    </div>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{preview}</div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="flex h-[72vh] flex-col overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-white">
            {!selectedConversation ? (
              <>
                <CardTitle>Conversación</CardTitle>
                <CardDescription>Selecciona un chat en la bandeja izquierda para abrir su historial.</CardDescription>
              </>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Visitante web'}</CardTitle>
                  <CardDescription>{selectedConversation.contactPhone || selectedConversation.contactEmail || 'Sin dato principal'} · {selectedConversation.status}</CardDescription>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {selectedConversation.assignedTo?.name || selectedConversation.assignedTo?.email || 'Sin asignar'}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            {!selectedConversation ? <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">Selecciona una conversación para ver el chat.</div> : (
              <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff,#f8fbff)]">
                <div ref={conversationThreadViewportRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                  {selectedConversation.messages.map((message) => {
                    const isOutbound = message.direction === 'OUTBOUND'
                    return (
                      <div key={message.id} className={isOutbound ? 'ml-auto max-w-[88%] rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700' : 'mr-auto max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm'}>
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                          <span>{isOutbound ? (message.sentByUser?.name || 'Bot / asesor') : 'Visitante'}</span>
                          <span>{formatDate(message.occurredAt)}</span>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap break-words leading-6">{message.bodyText || 'Sin texto'}</div>
                        {Array.isArray(message.payloadJson?.attachmentsJson) ? null : null}
                        {Array.isArray((message as { attachmentsJson?: Array<{ type?: string | null; url?: string | null; name?: string | null }> }).attachmentsJson) && (message as { attachmentsJson?: Array<{ type?: string | null; url?: string | null; name?: string | null }> }).attachmentsJson?.length ? (
                          <div className="mt-3 space-y-2">
                            {(message as { attachmentsJson?: Array<{ type?: string | null; url?: string | null; name?: string | null }> }).attachmentsJson?.map((attachment, index) => (
                              <a
                                key={`${message.id}-attachment-${index}`}
                                href={attachment.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-sky-700 hover:underline"
                              >
                                {(attachment.type || 'archivo').toUpperCase()} · {attachment.name || attachment.url || 'Adjunto'}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {message.payloadJson?.chatFlowStageId ? <div className="mt-2 text-[11px] text-slate-500">Etapa: {String(message.payloadJson.chatFlowStageId)}</div> : null}
                      </div>
                    )
                  })}
                    <div ref={conversationThreadBottomRef} />
                  </div>
                </div>
                <div className="border-t border-slate-200 bg-white px-4 py-4">
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Responder desde el Studio</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => setShowConversationEmojiPicker((current) => !current)}>
                          <Smile className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {studioMessagingWindowState ? (
                      <div className={studioMessagingWindowState.open ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800'}>
                        <span className="font-semibold">{studioMessagingWindowState.label}:</span> {studioMessagingWindowState.hint}
                      </div>
                    ) : null}
                    {showConversationEmojiPicker ? (
                      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                        {STUDIO_EMOJI_CHOICES.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => setConversationMessageDraft((current) => `${current}${emoji}`)} className="rounded-xl border border-slate-200 px-2.5 py-2 text-lg hover:bg-slate-50">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="grid gap-2">
                        <Label>Tipo</Label>
                        <Select value={conversationMessageTypeDraft} onValueChange={(value) => setConversationMessageTypeDraft(value as 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEXT">Texto</SelectItem>
                            <SelectItem value="IMAGE">Imagen</SelectItem>
                            <SelectItem value="AUDIO">Audio</SelectItem>
                            <SelectItem value="DOCUMENT">Documento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{conversationMessageTypeDraft === 'TEXT' ? 'Mensaje' : 'Texto o caption opcional'}</Label>
                        <Textarea value={conversationMessageDraft} onChange={(event) => setConversationMessageDraft(event.target.value)} rows={4} placeholder={conversationMessageTypeDraft === 'TEXT' ? 'Escribe una respuesta...' : 'Opcional para multimedia.'} />
                      </div>
                    </div>
                    {conversationMessageTypeDraft !== 'TEXT' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2 sm:col-span-2">
                          <Label>URL del archivo</Label>
                          <Input value={conversationAttachmentUrlDraft} onChange={(event) => setConversationAttachmentUrlDraft(event.target.value)} placeholder="https://..." />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                          <Label>Nombre visible</Label>
                          <Input value={conversationAttachmentNameDraft} onChange={(event) => setConversationAttachmentNameDraft(event.target.value)} placeholder="catalogo.pdf o imagen-promocion.jpg" />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Puedes enviar texto, emojis y multimedia por URL desde esta bandeja del Studio.</p>
                      <Button className="rounded-xl" onClick={() => void submitStudioConversationMessage()} disabled={sendingConversationMessage}>
                        {sendingConversationMessage ? 'Enviando...' : 'Enviar mensaje'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/70">
            <CardTitle>Ficha operativa</CardTitle>
            <CardDescription>Asignación, lead, oportunidad y capturas ligadas al chat.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[72vh] space-y-4 overflow-y-auto p-4">
            {!selectedConversation ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Selecciona una conversación para ver su ficha operativa.</div> : (
              <>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Contacto</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Visitante web'}</div>
                  <div className="mt-2 text-xs text-slate-500">Correo: {selectedConversation.contactEmail || '—'}</div>
                  <div className="text-xs text-slate-500">Teléfono: {selectedConversation.contactPhone || '—'}</div>
                  {selectedConversation.cliente ? <div className="mt-2 text-xs text-slate-500">Cliente CRM: {selectedConversation.cliente.nombre}</div> : null}
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Asignación</div>
                  <div className="mt-3 grid gap-2">
                    <Label>Responsable del hilo</Label>
                    <Select value={selectedConversation.assignedTo?.id || '__none__'} onValueChange={(value) => void handleAssignConversation(selectedConversation.id, value === '__none__' ? '' : value)}>
                      <SelectTrigger disabled={assigningConversationId === selectedConversation.id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin asignar</SelectItem>
                        {assignees.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Contexto comercial</div>
                  <div className="mt-3">Lead: {selectedConversation.lead?.nombre || 'Sin lead asociado'} {selectedConversation.lead ? `· ${selectedConversation.lead.status}` : ''}</div>
                  <div className="mt-1">Oportunidad: {selectedConversation.opportunity?.title || 'Sin oportunidad'}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Historial de capturas</div>
                  <div className="mt-3 space-y-2">
                    {selectedConversation.captures.length ? selectedConversation.captures.map((capture) => (
                      <div key={capture.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <div className="font-medium text-slate-900">Captura {capture.id.slice(0, 8)}</div>
                        <div className="mt-1">{formatDate(capture.createdAt)}</div>
                      </div>
                    )) : <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Sin capturas asociadas.</div>}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  function renderWorkspaceSwitcher(compact = false) {
    return (
      <div className="space-y-3">
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{notice}</div> : null}

        <Card className="border-slate-200">
          <CardContent className={`p-3 ${compact ? 'space-y-3' : 'flex flex-wrap items-center justify-between gap-2'}`}>
            <div className="flex items-center gap-2 rounded-xl">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>Canal de trabajo</span>
                <InfoHint content="Selecciona el chatbot web que vas a diseñar u operar." label="Ver ayuda del canal de trabajo" />
              </div>
            </div>

            <div className={`flex flex-wrap items-center gap-2 ${compact ? 'w-full' : ''}`}>
              <Select value={selectedChannelId || '__none__'} onValueChange={(value) => setSelectedChannelId(value === '__none__' ? '' : value)}>
                <SelectTrigger className={compact ? 'w-full' : 'min-w-[260px]'}>
                  <SelectValue placeholder="Selecciona un canal chatbot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin canal seleccionado</SelectItem>
                  {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedChannelId ? (
                <div className={`rounded-full border px-3 py-1 text-xs font-medium ${hasUnsavedChanges ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {hasUnsavedChanges ? 'Cambios pendientes' : 'Sin cambios pendientes'}
                </div>
              ) : null}
              <Button variant="outline" onClick={() => void handleCreateChannel('empty')} disabled={creating} className={compact ? 'flex-1' : ''}>{creating ? 'Creando...' : 'Crear vacío'}</Button>
              <Button variant="outline" onClick={() => void handleCreateChannel('template')} disabled={creating} className={compact ? 'flex-1' : ''}>{creating ? 'Creando...' : 'Crear con plantilla'}</Button>
              <Button
                variant="outline"
                className={`border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 ${compact ? 'flex-1' : ''}`}
                onClick={() => {
                  if (!selectedChannelId) return
                  window.location.assign(`/dashboard/crm/integraciones?channelId=${encodeURIComponent(selectedChannelId)}&open=wizard`)
                }}
                disabled={!selectedChannelId}
              >
                Configurar canal
              </Button>
              <Button onClick={() => void handleSaveChannel()} disabled={!selectedChannelId || saving || !hasUnsavedChanges} className={compact ? 'flex-1' : ''}>{saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar studio' : 'Studio guardado'}</Button>
            </div>
          </CardContent>
        </Card>

        <TabsList className={compact ? 'grid w-full grid-cols-2' : undefined}>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
      </div>
    )
  }

  function renderMapWorkspace(overlay = false) {
    const canEditFlow = overlay && flowEditMode
    const showFullscreenInspector = canEditFlow && inspectorOpen && Boolean(focusedNode)
    const showPaletteRail = canEditFlow && paletteRailOpen
    const startNode = studioGraph.nodes.find((node) => node.kind === 'start')
    const firstStageNode = studioGraph.nodes.find((node) => node.kind === 'stage')
    const startZoneWidth = firstStageNode ? firstStageNode.x + firstStageNode.width + 72 : 360

    return (
      <Card className={overlay ? 'flex h-full flex-col border-0 bg-transparent shadow-none' : ''}>
        <CardContent className={overlay ? 'flex-1 overflow-hidden px-0 pb-0 pt-0' : 'overflow-hidden pt-0'}>
          <div className={`grid rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(241,245,249,0.96))] ${overlay ? `h-full min-h-0 gap-2 p-1.5 ${showPaletteRail ? (showFullscreenInspector ? 'xl:grid-cols-[220px_minmax(0,1fr)_344px]' : 'xl:grid-cols-[220px_minmax(0,1fr)]') : (showFullscreenInspector ? 'xl:grid-cols-[minmax(0,1fr)_344px]' : 'xl:grid-cols-[minmax(0,1fr)]')}` : 'gap-4 p-3 md:p-4 lg:grid-cols-[minmax(0,1fr)_260px]'}`}>
            {showPaletteRail ? renderFullscreenPaletteRail() : null}
            <div className="relative min-w-0 space-y-2 overflow-hidden">
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/80 text-xs text-slate-500 ${overlay ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Zoom {(builder.studioViewport.scale * 100).toFixed(0)}%</span>
                  <span>Pan X {Math.round(builder.studioViewport.x)} · Y {Math.round(builder.studioViewport.y)}</span>
                  {canEditFlow ? (
                    <span className={`rounded-full px-2.5 py-1 font-medium ${hasUnsavedChanges ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      {hasUnsavedChanges ? 'Cambios sin guardar' : 'Todo guardado'}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEditFlow ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPaletteRailOpen((current) => !current)}>
                      {paletteRailOpen ? <ChevronLeft className="mr-1.5 h-3.5 w-3.5" /> : <ChevronRight className="mr-1.5 h-3.5 w-3.5" />}
                      {paletteRailOpen ? 'Ocultar bloques' : 'Mostrar bloques'}
                    </Button>
                  ) : null}
                  {canEditFlow && focusedNode ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setInspectorOpen((current) => !current)}>
                      {inspectorOpen ? 'Inspector' : 'Mostrar inspector'}
                    </Button>
                  ) : null}
                  {canEditFlow ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Deshacer
                    </Button>
                  ) : null}
                  {canEditFlow ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
                      <Redo2 className="mr-1.5 h-3.5 w-3.5" /> Rehacer
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => setStudioScale(builder.studioViewport.scale - 0.1)}>Zoom -</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStudioScale(builder.studioViewport.scale + 0.1)}>Zoom +</Button>
                  <Button type="button" variant="outline" size="sm" onClick={resetStudioViewport}>Centrar vista</Button>
                  {canEditFlow ? <Button type="button" variant="outline" size="sm" onClick={clearStudioLayout}>Auto ordenar</Button> : null}
                  {canEditFlow ? (
                    <Button type="button" size="sm" onClick={() => void handleSaveChannel()} disabled={!selectedChannelId || saving || !hasUnsavedChanges}>
                      <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={canEditFlow ? stopFlowEditing : startFlowEditing}>
                    {canEditFlow ? 'Salir edición' : 'Editar flujo'}
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div
                  ref={boardViewportRef}
                  onPointerDown={canEditFlow ? handleBoardBackgroundPointerDown : undefined}
                  onTouchStart={(event) => {
                    if (!canEditFlow) return
                    const metrics = getTouchMetrics(event.touches)
                    if (!metrics) return
                    event.preventDefault()
                    setPanState(null)
                    setDragState(null)
                    pinchStateRef.current = {
                      initialDistance: metrics.distance,
                      initialScale: builder.studioViewport.scale,
                      centerX: metrics.centerX,
                      centerY: metrics.centerY,
                    }
                  }}
                  onTouchMove={(event) => {
                    if (!canEditFlow) return
                    if (!pinchStateRef.current || event.touches.length < 2) return
                    const metrics = getTouchMetrics(event.touches)
                    if (!metrics) return
                    event.preventDefault()
                    setStudioScale(pinchStateRef.current.initialScale * (metrics.distance / pinchStateRef.current.initialDistance), {
                      clientX: metrics.centerX,
                      clientY: metrics.centerY,
                    })
                  }}
                  onTouchEnd={(event) => {
                    if (!canEditFlow) return
                    if (event.touches.length < 2) {
                      pinchStateRef.current = null
                    }
                  }}
                  onDragOver={canEditFlow ? handleBoardDragOver : undefined}
                  onDrop={canEditFlow ? handleBoardDrop : undefined}
                  onContextMenu={canEditFlow ? handleBoardBackgroundContextMenu : undefined}
                  className={`relative ${overlay ? 'h-[calc(100vh-120px)] min-h-[620px]' : 'h-[calc(100vh-320px)] min-h-[480px] md:h-[calc(100vh-280px)] md:min-h-[760px]'} touch-none overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:32px_32px] ${panState ? 'cursor-grabbing' : 'cursor-grab'} ${paletteDragKind ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}
                >
                  {canEditFlow ? renderFullscreenShortcutHint() : null}
                  {canEditFlow && paletteDragKind ? (
                    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 rounded-2xl border border-dashed border-emerald-300 bg-white/90 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
                      {'kind' in (parsePaletteDragValue(paletteDragKind) || {})
                        ? `Suelta aqui para crear un bloque de ${STUDIO_PALETTE_ITEMS.find((item) => item.kind === (parsePaletteDragValue(paletteDragKind) as { kind: StudioPaletteKind }).kind)?.label.toLowerCase() || 'flujo'}.`
                        : `Suelta aqui para insertar la plantilla ${STUDIO_TEMPLATE_ITEMS.find((item) => item.id === (parsePaletteDragValue(paletteDragKind) as { templateId: string } | null)?.templateId)?.label.toLowerCase() || 'seleccionada'}.`}
                    </div>
                  ) : null}
                  {!canEditFlow ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white/96 px-6 py-6 text-center shadow-[0_28px_80px_-40px_rgba(15,23,42,0.35)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Vista protegida</div>
                        <div className="mt-3 text-2xl font-semibold text-slate-900">Editar flujo</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">Primero entra en modo edición para reorganizar bloques, abrir el menú de arrastre y trabajar el flujo en pantalla completa sin ruido visual.</div>
                        <div className="mt-5 flex items-center justify-center gap-3">
                          <Button type="button" className="rounded-2xl px-5" onClick={startFlowEditing}>Editar flujo</Button>
                          <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={resetStudioViewport}>Solo centrar vista</Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div
                    className="absolute left-0 top-0 will-change-transform"
                    style={{
                      width: `${studioGraph.contentWidth}px`,
                      height: `${studioGraph.contentHeight}px`,
                      transform: `translate(${builder.studioViewport.x}px, ${builder.studioViewport.y}px) scale(${builder.studioViewport.scale})`,
                      transformOrigin: '0 0',
                    }}
                  >
                    <div className="relative" style={{ width: `${studioGraph.contentWidth}px`, height: `${studioGraph.contentHeight}px` }}>
                      {startNode ? (
                        <>
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0 rounded-[24px] bg-[linear-gradient(90deg,rgba(16,185,129,0.09)_0%,rgba(52,211,153,0.06)_62%,rgba(255,255,255,0)_100%)]"
                            style={{ width: `${Math.min(startZoneWidth, studioGraph.contentWidth)}px` }}
                          />
                          <div
                            className="pointer-events-none absolute inset-y-8 border-r border-dashed border-emerald-300/80"
                            style={{ left: `${Math.min(startZoneWidth, studioGraph.contentWidth)}px` }}
                          />
                          <div
                            className="pointer-events-none absolute left-5 top-5 rounded-full border border-emerald-200 bg-white/92 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm"
                          >
                            Inicio del flujo
                          </div>
                        </>
                      ) : null}
                      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${studioGraph.contentWidth} ${studioGraph.contentHeight}`} fill="none">
                        {studioGraph.edges.map((edge) => {
                          const source = studioGraph.nodes.find((node) => node.id === edge.fromId)
                          const target = studioGraph.nodes.find((node) => node.id === edge.toId)
                          if (!source || !target) return null
                          const sourceAnchor = getConnectionHandleAnchor({
                            node: source,
                            sourceOptionId: edge.sourceOptionId,
                            sourceOptionIndex: edge.sourceOptionIndex,
                            targetKind: edge.targetKind,
                          })
                          const metrics = getEdgeCurveMetrics(source, target, {
                            startX: sourceAnchor.x,
                            startY: sourceAnchor.y,
                          })
                          return (
                            <g key={edge.id}>
                              <path d={metrics.path} className={`${edge.toneClass} fill-none stroke-[2.5]`} strokeDasharray={edge.dashed ? '6 6' : undefined} />
                            </g>
                          )
                        })}
                        {connectionDraft ? (() => {
                          const source = studioGraph.nodes.find((node) => node.id === connectionDraft.fromId)
                          if (!source) return null
                          const draftTarget = {
                            ...source,
                            x: connectionDraft.currentX,
                            y: connectionDraft.currentY - 52,
                            width: 0,
                          } satisfies StudioGraphNode
                          const metrics = getEdgeCurveMetrics(source, draftTarget, {
                            startX: connectionDraft.startX,
                            startY: connectionDraft.startY,
                            endX: connectionDraft.currentX,
                            endY: connectionDraft.currentY,
                          })
                          return <path d={metrics.path} className="fill-none stroke-slate-400 stroke-[2.5]" strokeDasharray="8 6" />
                        })() : null}
                      </svg>

                      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${studioGraph.contentWidth} ${studioGraph.contentHeight}`} fill="none">
                        {studioGraph.edges.map((edge) => {
                          const source = studioGraph.nodes.find((node) => node.id === edge.fromId)
                          const target = studioGraph.nodes.find((node) => node.id === edge.toId)
                          if (!source || !target) return null
                          const sourceAnchor = getConnectionHandleAnchor({
                            node: source,
                            sourceOptionId: edge.sourceOptionId,
                            sourceOptionIndex: edge.sourceOptionIndex,
                            targetKind: edge.targetKind,
                          })
                          const metrics = getEdgeCurveMetrics(source, target, {
                            startX: sourceAnchor.x,
                            startY: sourceAnchor.y,
                          })
                          const edgeMenuX = Math.max(24, Math.min(studioGraph.contentWidth - 232, metrics.midpoint.x - 108))
                          const edgeMenuY = Math.max(24, metrics.midpoint.y - 16)

                          return (
                            <path
                              key={`edge-hit-${edge.id}`}
                              d={metrics.path}
                              fill="none"
                              stroke="transparent"
                              strokeWidth="18"
                              style={{ pointerEvents: 'stroke' }}
                              onClick={(event) => {
                                event.stopPropagation()
                                setContextMenu(null)
                                setActiveEdgeId((current) => current === edge.id ? null : edge.id)
                              }}
                              onContextMenu={(event) => {
                                if (!canEditFlow) return
                                event.preventDefault()
                                event.stopPropagation()
                                openEdgeContextMenu(edge, edgeMenuX, edgeMenuY)
                              }}
                            />
                          )
                        })}
                      </svg>

                      {studioGraph.edges.map((edge) => {
                        const source = studioGraph.nodes.find((node) => node.id === edge.fromId)
                        const target = studioGraph.nodes.find((node) => node.id === edge.toId)
                        if (!source || !target) return null
                        const sourceAnchor = getConnectionHandleAnchor({
                          node: source,
                          sourceOptionId: edge.sourceOptionId,
                          sourceOptionIndex: edge.sourceOptionIndex,
                          targetKind: edge.targetKind,
                        })
                        const metrics = getEdgeCurveMetrics(source, target, {
                          startX: sourceAnchor.x,
                          startY: sourceAnchor.y,
                        })
                        const isActiveEdge = activeEdgeId === edge.id
                        const panelLeft = Math.max(24, Math.min(studioGraph.contentWidth - 232, metrics.midpoint.x - 108))
                        const panelTop = Math.max(24, metrics.midpoint.y - (isActiveEdge ? 86 : 16))
                        const edgeTargetId = edge.toId.split(':')[1] || ''
                        const edgeSourceId = edge.fromId.split(':')[1] || ''
                        const targetValue = edge.sourceKind === 'stage' && edge.targetKind === 'pause'
                          ? builder.pauseNodes.find((pause) => pause.id === edgeTargetId)?.sourceStageId || '__none__'
                          : edge.toId === 'start'
                            ? '__none__'
                            : (edge.targetKind === 'action' || edge.targetKind === 'stage' || edge.targetKind === 'trigger' ? edgeTargetId : builder.pauseNodes.find((pause) => pause.id === edgeSourceId)?.targetStageId || '__none__')

                        return (
                          <div key={`edge-editor-${edge.id}`} className={`absolute ${isActiveEdge ? 'z-[90]' : 'z-40'}`} style={{ left: `${panelLeft}px`, top: `${panelTop}px` }}>
                            <button
                              type="button"
                              aria-label={`Editar conexión ${edge.label || 'del flujo'}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onContextMenu={(event) => {
                                if (!canEditFlow) return
                                event.preventDefault()
                                event.stopPropagation()
                                openEdgeContextMenu(edge, panelLeft, Math.max(24, panelTop + 20))
                              }}
                              onClick={(event) => {
                                event.stopPropagation()
                                setContextMenu(null)
                                setActiveEdgeId((current) => current === edge.id ? null : edge.id)
                              }}
                              className={`flex h-6 w-6 items-center justify-center rounded-full border bg-white/96 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.4)] transition hover:border-slate-300 ${isActiveEdge ? 'border-slate-400 ring-2 ring-slate-900/10' : 'border-slate-200'}`}
                            >
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${edge.sourceKind === 'trigger' ? 'bg-amber-400' : edge.targetKind === 'action' ? 'bg-fuchsia-400' : edge.targetKind === 'pause' || edge.sourceKind === 'pause' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                            </button>

                            {isActiveEdge ? (
                              <div
                                className="mt-2 w-[220px] rounded-2xl border border-slate-200 bg-white/98 p-3 text-xs text-slate-600 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.48)]"
                                onPointerDown={(event) => event.stopPropagation()}
                              >
                                <div className="font-semibold text-slate-900">Editar conexión</div>
                                <div className="mt-1 leading-5 text-slate-500">{source.title} → {target.title}</div>
                                {edge.sourceOptionId ? <div className="mt-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">Rama: {edge.label}</div> : null}
                                <div className="mt-3 grid gap-2">
                                  {edge.sourceKind === 'start' && edge.targetKind === 'stage' ? (
                                    <>
                                      <Label className="text-[11px]">Mensaje inicial</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">Sin caja principal</SelectItem>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'stage' && edge.targetKind === 'stage' ? (
                                    <>
                                      <Label className="text-[11px]">Siguiente mensaje</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'stage' && edge.targetKind === 'trigger' ? (
                                    <>
                                      <Label className="text-[11px]">Filtro destino</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'stage' && edge.targetKind === 'action' ? (
                                    <>
                                      <Label className="text-[11px]">Acción rápida enlazada</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.quickActions.map((action) => <SelectItem key={action.id} value={action.id}>{action.label}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'stage' && edge.targetKind === 'pause' ? (
                                    <>
                                      <Label className="text-[11px]">Origen de la pausa</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'action' && edge.targetKind === 'stage' ? (
                                    <>
                                      <Label className="text-[11px]">Siguiente mensaje de la acción</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'action' && edge.targetKind === 'trigger' ? (
                                    <>
                                      <Label className="text-[11px]">Filtro destino de la acción</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'trigger' && edge.targetKind === 'stage' ? (
                                    <>
                                      <Label className="text-[11px]">Mensaje destino del filtro</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                  {edge.sourceKind === 'pause' && edge.targetKind === 'stage' ? (
                                    <>
                                      <Label className="text-[11px]">Siguiente mensaje después de la pausa</Label>
                                      <Select value={targetValue} onValueChange={(value) => updateInlineEdgeTarget(edge, value)}>
                                        <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  ) : null}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {edge.sourceKind !== 'start' ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => openEditor({ kind: edge.sourceKind as StudioFocusNode['kind'], id: edgeSourceId })}
                                    >
                                      Editar origen
                                    </Button>
                                  ) : null}
                                  {edge.targetKind !== 'start' ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => edge.targetKind === 'action' || edge.targetKind === 'pause' || edge.targetKind === 'stage' || edge.targetKind === 'trigger' ? openEditor({ kind: edge.targetKind, id: edgeTargetId }) : null}
                                    >
                                      Editar destino
                                    </Button>
                                  ) : null}
                                  {edge.sourceKind !== 'start' ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                                      onClick={() => disconnectEdge(edge)}
                                    >
                                      Eliminar conexión
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}

                      {studioGraph.nodes.map((node) => {
                        const nodeKey = node.id.split(':')[1] || node.id
                        const active = focusedNode?.kind === node.kind && focusedNode.id === nodeKey
                        const canStartConnection = node.kind !== 'start'
                        const validTarget = connectionDraft
                          ? node.id !== connectionDraft.fromId && (
                              canConnectFromSource({ sourceKind: connectionDraft.fromKind, targetKind: node.kind, sourceOptionId: connectionDraft.sourceOptionId })
                            )
                          : false
                        const responseHandles = node.kind === 'stage'
                          ? (stageMap[nodeKey]?.responseOptions ?? []).slice(0, 6)
                          : []
                        const triggerConditionHandles = node.kind === 'trigger'
                          ? (builder.flowTriggers.find((trigger) => trigger.id === nodeKey)?.conditions ?? []).slice(0, 6)
                          : []
                        return (
                          <div
                            key={node.id}
                            id={node.domId}
                            ref={(element) => registerNodeElement(node.id, element)}
                            onPointerDown={(event) => {
                              if (!canEditFlow) return
                              handleBoardNodePointerDown(event, node)
                            }}
                            onContextMenu={(event) => {
                              if (!canEditFlow) return
                              event.preventDefault()
                              event.stopPropagation()
                              setActiveEdgeId(null)
                              const position = getCanvasPointFromClient(event.clientX, event.clientY)
                              openContextMenu({ kind: node.kind, id: nodeKey }, position.x, position.y)
                            }}
                            onClick={(event) => {
                              event.stopPropagation()
                              setActiveEdgeId(null)
                              focusStudioNode({ kind: node.kind, id: nodeKey })
                            }}
                            className={`group absolute cursor-grab overflow-hidden rounded-[20px] border text-left shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)] transition active:cursor-grabbing ${node.accentClass} ${active ? 'ring-2 ring-slate-900/15 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.32)]' : 'hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-22px_rgba(15,23,42,0.3)]'} ${validTarget ? 'ring-2 ring-sky-300 ring-offset-2' : ''}`}
                            style={{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px` }}
                          >
                            {node.kind !== 'start' ? (
                              <button
                                type="button"
                                aria-label={`Agregar bloque desde ${node.title}`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  if (!canEditFlow) return
                                  event.stopPropagation()
                                  if (node.kind !== 'start') {
                                    openCreateMenu({ x: node.x + node.width + 24, y: node.y + 20, target: { sourceNode: { kind: node.kind, id: nodeKey } } })
                                  }
                                }}
                                className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow transition hover:border-emerald-300 hover:text-emerald-700 ${active ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label="Editar inicio del flujo"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  if (!canEditFlow) return
                                  event.stopPropagation()
                                  focusStudioNode({ kind: 'start', id: 'start' })
                                }}
                                className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow transition hover:border-emerald-300 hover:text-emerald-700 ${active ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Conectar hacia ${node.title}`}
                              onPointerDown={(event) => {
                                if (!canEditFlow) return
                                event.stopPropagation()
                              }}
                              className={`absolute -left-2.5 top-[40px] h-5 w-5 rounded-full border bg-white shadow ${validTarget ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-300'}`}
                            />
                            {canStartConnection ? (
                              <button
                                type="button"
                                aria-label={`Crear conexion desde ${node.title}`}
                                ref={(element) => registerHandleElement(getHandleAnchorKey(node.id), element)}
                                onPointerDown={(event) => {
                                  if (!canEditFlow) return
                                  handleConnectionStart(event, node)
                                }}
                                className="absolute -right-2.5 top-[40px] h-5 w-5 rounded-full border border-slate-300 bg-white shadow"
                              />
                            ) : null}
                            <div className={`px-4 py-3 ${node.headerClass}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${node.headerBadgeClass}`}>{getNodeTypeLabel(node.kind)}</div>
                                    {active ? <div className="rounded-full border border-white/70 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700">Activo</div> : null}
                                  </div>
                                  <div className="mt-2 truncate text-[15px] font-semibold">{node.title}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div data-node-drag-handle="true" className="rounded-full border border-current/15 bg-white/80 p-1 opacity-70 lg:opacity-0 lg:group-hover:opacity-100"><GripVertical className="h-3.5 w-3.5" /></div>
                                </div>
                              </div>
                            </div>
                            <div className="px-4 py-3">
                              <div className="line-clamp-1 text-xs font-medium text-slate-600">{node.subtitle}</div>
                              {node.kind === 'stage' && node.richContentHtml ? (
                                <RichTextContent html={node.richContentHtml} className="mt-2 text-[11px] leading-5 text-slate-500" />
                              ) : (
                                <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{node.description}</div>
                              )}
                            {node.kind === 'trigger' && triggerConditionHandles.length ? (
                              <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
                                {triggerConditionHandles.map((condition, index) => (
                                  <div key={condition.id} className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-2.5 py-2 pr-14 text-[11px] font-medium text-slate-700 shadow-sm">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                                    <span className="min-w-0 flex-1 truncate">{getTriggerConditionSummary(condition)}</span>
                                    <button
                                      type="button"
                                      aria-label={`Crear o vincular desde condición ${index + 1}`}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        if (!canEditFlow) return
                                        event.stopPropagation()
                                        openCreateMenu({ x: node.x + node.width + 24, y: node.y + 88 + (index * 34), target: { sourceNode: { kind: node.kind, id: nodeKey }, sourceOptionId: condition.id } })
                                      }}
                                      className="absolute right-5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Reconectar condición ${index + 1}`}
                                      ref={(element) => registerHandleElement(getHandleAnchorKey(node.id, condition.id), element)}
                                      onPointerDown={(event) => {
                                        if (!canEditFlow) return
                                        event.stopPropagation()
                                        handleConnectionStart(event, node, condition.id, condition.variableKey, index)
                                      }}
                                      className={`absolute -right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow ${connectionDraft?.sourceOptionId === condition.id ? 'border-sky-400' : 'border-slate-300'}`}
                                    >
                                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {node.kind === 'stage' && responseHandles.length ? (
                              <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
                                {responseHandles.map((option, index) => (
                                  <div key={option.id} className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white/88 px-2.5 py-2 pr-14 text-[11px] font-medium text-slate-700 shadow-sm">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                    <button
                                      type="button"
                                      aria-label={`Crear o vincular desde ${option.label}`}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        if (!canEditFlow) return
                                        event.stopPropagation()
                                        openCreateMenu({ x: node.x + node.width + 24, y: node.y + 88 + (index * 34), target: { sourceNode: { kind: node.kind, id: nodeKey }, sourceOptionId: option.id } })
                                      }}
                                      className="absolute right-5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Reconectar rama ${option.label}`}
                                      ref={(element) => registerHandleElement(getHandleAnchorKey(node.id, option.id), element)}
                                      onPointerDown={(event) => {
                                        if (!canEditFlow) return
                                        event.stopPropagation()
                                        handleConnectionStart(event, node, option.id, option.label, index)
                                      }}
                                      className={`absolute -right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow ${connectionDraft?.sourceOptionId === option.id ? 'border-sky-400' : 'border-slate-300'}`}
                                    >
                                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            </div>
                            {node.kind !== 'start' ? (
                              <div className={`absolute left-1/2 top-full z-10 mt-3 -translate-x-1/2 transition ${active ? 'opacity-100 translate-y-0' : 'translate-y-1 opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100'}`}>
                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/96 p-1.5 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.4)]">
                                  <button type="button" aria-label="Duplicar bloque" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); duplicateNode({ kind: node.kind as StudioFocusNode['kind'], id: nodeKey }) }} className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                                    <Copy className="h-4 w-4" />
                                  </button>
                                  <button type="button" aria-label="Eliminar bloque" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); deleteNodeWithFeedback({ kind: node.kind as StudioFocusNode['kind'], id: nodeKey }) }} className="rounded-xl border border-rose-200 p-2 text-rose-700 transition hover:bg-rose-50">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}

                      {canEditFlow && contextMenu ? (
                        <div
                          className="absolute z-[120] min-w-[200px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.3)]"
                          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                          onPointerDown={(event) => {
                            event.stopPropagation()
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                          }}
                        >
                          {contextMenu.mode === 'node' && contextMenu.node ? (
                            <>
                              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Menu del bloque</div>
                              {contextMenu.node.kind === 'start' ? (
                                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { focusStudioNode({ kind: 'start', id: 'start' }); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                  <span>Editar inicio</span>
                                  <Info className="h-4 w-4" />
                                </button>
                              ) : (
                                <>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { openEditor(contextMenu.node!); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                    <span>Editar bloque</span>
                                    <span>✎</span>
                                  </button>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => openCreateMenu({ x: contextMenu.x + 18, y: contextMenu.y + 12, target: { sourceNode: contextMenu.node } })} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                    <span>Crear desde aqui</span>
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { duplicateNode(contextMenu.node!); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                    <span>Duplicar bloque</span>
                                    <span>+</span>
                                  </button>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { reorderNode(contextMenu.node!, -1); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                    <span>Mover antes</span>
                                    <span>↑</span>
                                  </button>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { reorderNode(contextMenu.node!, 1); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                    <span>Mover despues</span>
                                    <span>↓</span>
                                  </button>
                                  <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { deleteNodeWithFeedback(contextMenu.node!); setContextMenu(null) }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50">
                                    <span>Eliminar caja</span>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </>
                          ) : null}
                          {contextMenu.mode === 'edge' && contextMenu.edge ? (
                            <>
                              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Menu de conexión</div>
                              <div className="px-3 pb-2 text-xs leading-5 text-slate-500">{contextMenu.edge.label || 'Ruta del flujo'}</div>
                              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => {
                                if (contextMenu.edge?.sourceKind === 'start') {
                                  focusStudioNode({ kind: 'start', id: 'start' })
                                } else if (contextMenu.edge) {
                                  disconnectEdge(contextMenu.edge)
                                }
                                setContextMenu(null)
                              }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50">
                                <span>{contextMenu.edge.sourceKind === 'start' ? 'Editar inicio' : 'Eliminar conexión'}</span>
                                {contextMenu.edge.sourceKind === 'start' ? <Info className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                              {contextMenu.edge.sourceKind === 'start' ? (
                                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { focusStudioNode({ kind: 'start', id: 'start' }); setContextMenu(null) }} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                  <span>Seleccionar caja inicial</span>
                                  <Plus className="h-4 w-4" />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {contextMenu.mode === 'canvas' ? (
                            <>
                              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Crear bloque</div>
                              {[
                                { kind: 'stage', label: 'Nuevo mensaje' },
                                { kind: 'action', label: 'Nueva accion' },
                                { kind: 'trigger', label: 'Nuevo filtro' },
                                { kind: 'pause', label: 'Nueva pausa' },
                              ].map((item) => (
                                <button key={item.kind} type="button" onClick={() => handleCreateFromMenu(item.kind as 'stage' | 'action' | 'trigger' | 'pause')} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                  <span>{item.label}</span>
                                  <Plus className="h-4 w-4" />
                                </button>
                              ))}
                            </>
                          ) : null}
                          {contextMenu.mode === 'create' ? (
                            <>
                              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Crear o vincular</div>
                              {[
                                { kind: 'stage', label: 'Mensaje' },
                                { kind: 'action', label: 'Accion' },
                                { kind: 'trigger', label: 'Filtro' },
                                { kind: 'pause', label: 'Pausa' },
                              ].map((item) => (
                                <button key={item.kind} type="button" onClick={() => handleCreateFromMenu(item.kind as 'stage' | 'action' | 'trigger' | 'pause')} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                                  <span>{item.label}</span>
                                  <Plus className="h-4 w-4" />
                                </button>
                              ))}
                              {contextMenu.createTarget?.sourceNode ? (
                                <>
                                  <div className="mx-2 my-2 border-t border-slate-200" />
                                  <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vincular bloque existente</div>
                                  <div className="max-h-56 space-y-1 overflow-y-auto px-1 pb-1">
                                    {getConnectableExistingNodes(contextMenu.createTarget).length ? getConnectableExistingNodes(contextMenu.createTarget).map((node) => (
                                      <button key={node.id} type="button" onClick={() => connectExistingNodeFromMenu(node.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">
                                        <span className="truncate">{node.title}</span>
                                        <span className="ml-3 shrink-0 text-[11px] uppercase tracking-[0.14em] text-slate-400">{getNodeTypeLabel(node.kind)}</span>
                                      </button>
                                    )) : (
                                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs leading-5 text-slate-500">No hay bloques existentes compatibles para esta rama.</div>
                                    )}
                                  </div>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canEditFlow ? renderInspectorDrawer(overlay) : null}
                  {canEditFlow ? renderFullscreenMinimap() : null}
                </div>
              </div>
            </div>

            {showFullscreenInspector ? (
              <div className="space-y-4">
                {renderFullscreenPropertiesInspector()}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">Gestos táctiles</div>
                  <div className="mt-2">Un dedo sobre fondo → desplaza el canvas</div>
                  <div className="mt-1">Dos dedos → zoom con pinch</div>
                  <div className="mt-1">Para mover una caja en tablet usa el asa de puntos</div>
                </div>
              </div>
            ) : !overlay ? (
              <div className="space-y-3 rounded-[24px] border border-slate-200/80 bg-white/95 p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-140px)] lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
                {renderWorkspaceSwitcher(true)}
                <div className="rounded-2xl border border-slate-200 bg-white/90">
                  <button
                    type="button"
                    onClick={() => setStudioOverviewOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vista del flujo</div>
                      <div className="mt-1 text-sm text-slate-600">Activa editar flujo para mostrar el panel de bloques, el arrastre y las acciones avanzadas.</div>
                    </div>
                    {studioOverviewOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>
                  {studioOverviewOpen ? (
                    <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                      {!overlay ? (
                        <Button type="button" className="w-full rounded-2xl" onClick={startFlowEditing}>Editar flujo en pantalla completa</Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#ffffff)] p-3">
                  <button
                    type="button"
                    onClick={() => setStudioReferenceOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Referencia visual</div>
                    {studioReferenceOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>
                  {studioReferenceOpen ? (
                    <>
                      <svg viewBox="0 0 240 170" className="mt-3 h-auto w-full">
                        <rect x="10" y="58" width="62" height="42" rx="14" className="fill-emerald-50 stroke-emerald-300" />
                        <text x="22" y="77" className="fill-emerald-950 text-[10px] font-semibold">Mensaje</text>
                        <text x="22" y="90" className="fill-slate-500 text-[8px]">Recibe y guía</text>

                        <rect x="90" y="16" width="62" height="42" rx="14" className="fill-amber-50 stroke-amber-300" />
                        <text x="107" y="35" className="fill-amber-950 text-[10px] font-semibold">Filtro</text>
                        <text x="100" y="48" className="fill-slate-500 text-[8px]">Decide la ruta</text>

                        <rect x="168" y="58" width="62" height="42" rx="14" className="fill-fuchsia-50 stroke-fuchsia-300" />
                        <text x="183" y="77" className="fill-fuchsia-950 text-[10px] font-semibold">Accion</text>
                        <text x="176" y="90" className="fill-slate-500 text-[8px]">Responde o escala</text>

                        <rect x="90" y="112" width="62" height="42" rx="14" className="fill-sky-50 stroke-sky-300" />
                        <text x="106" y="131" className="fill-sky-950 text-[10px] font-semibold">Pausa</text>
                        <text x="101" y="144" className="fill-slate-500 text-[8px]">Espera y sigue</text>

                        <path d="M 72 79 C 86 79, 84 40, 90 37" className="fill-none stroke-amber-300 stroke-[2]" />
                        <path d="M 152 37 C 166 37, 160 79, 168 79" className="fill-none stroke-fuchsia-300 stroke-[2]" />
                        <path d="M 72 79 C 92 79, 76 132, 90 132" className="fill-none stroke-sky-300 stroke-[2]" />
                        <circle cx="72" cy="79" r="3" className="fill-emerald-400" />
                        <circle cx="90" cy="37" r="3" className="fill-amber-400" />
                        <circle cx="168" cy="79" r="3" className="fill-fuchsia-400" />
                        <circle cx="90" cy="132" r="3" className="fill-sky-400" />
                      </svg>
                      <div className="mt-2 text-[11px] leading-5 text-slate-500">Mensaje inicia la conversación, Filtro decide, Accion ejecuta algo y Pausa espera antes de continuar.</div>
                    </>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => setStudioRulesOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="font-semibold text-slate-900">Reglas de conexion</div>
                    {studioRulesOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>
                  {studioRulesOpen ? (
                    <>
                      <div className="mt-2">Mensaje → Mensaje, Accion o Pausa</div>
                      <div className="mt-1">Filtro → Mensaje</div>
                      <div className="mt-1">Pausa → Mensaje</div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  useEffect(() => {
    if (!dragState) return
    const activeDragState = dragState

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - activeDragState.startPointerX
      const deltaY = event.clientY - activeDragState.startPointerY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragMovedRef.current = true
      }
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        studioNodeLayout: {
          ...current.studioNodeLayout,
          [activeDragState.nodeId]: {
            x: Math.max(16, activeDragState.originX + deltaX),
            y: Math.max(16, activeDragState.originY + deltaY),
          },
        },
      }))
    }

    function handlePointerUp() {
      setDragState(null)
      window.setTimeout(() => {
        dragMovedRef.current = false
      }, 0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.userSelect = ''
    }
  }, [dragState])

  useEffect(() => {
    if (!panState) return
    const activePanState = panState

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - activePanState.startPointerX
      const deltaY = event.clientY - activePanState.startPointerY
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragMovedRef.current = true
      }
      setBuilder((current) => updateSelectedFlowInBuilder(current, {
        studioViewport: {
          ...current.studioViewport,
          x: activePanState.originX + deltaX,
          y: activePanState.originY + deltaY,
        },
      }))
    }

    function handlePointerUp() {
      setPanState(null)
      window.setTimeout(() => {
        dragMovedRef.current = false
      }, 0)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.userSelect = ''
    }
  }, [panState])

  useEffect(() => {
    if (!connectionDraft) return
    const activeDraft = connectionDraft

    function handlePointerMove(event: PointerEvent) {
      const rect = boardViewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const pointerX = (event.clientX - rect.left - builder.studioViewport.x) / builder.studioViewport.scale
      const pointerY = (event.clientY - rect.top - builder.studioViewport.y) / builder.studioViewport.scale
      const hoveredTarget = findConnectionTargetNode({ x: pointerX, y: pointerY }, activeDraft)
      setConnectionDraft({
        ...activeDraft,
        currentX: hoveredTarget ? getNodeAnchorX(hoveredTarget, 'left') : pointerX,
        currentY: hoveredTarget ? getNodeDropAnchorY(hoveredTarget, pointerY) : pointerY,
      })
    }

    function handlePointerUp(event: PointerEvent) {
      const rect = boardViewportRef.current?.getBoundingClientRect()
      if (rect) {
        const sourceNode = studioGraph.nodes.find((node) => node.id === activeDraft.fromId)
        const pointer = {
          x: (event.clientX - rect.left - builder.studioViewport.x) / builder.studioViewport.scale,
          y: (event.clientY - rect.top - builder.studioViewport.y) / builder.studioViewport.scale,
        }
        const targetNode = sourceNode ? findConnectionTargetNode(pointer, activeDraft) : null
        if (sourceNode && targetNode) {
          applyConnection(sourceNode, targetNode, activeDraft.sourceOptionId)
        }
      }
      setConnectionDraft(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.userSelect = ''
    }
  }, [builder.studioViewport.scale, builder.studioViewport.x, builder.studioViewport.y, connectionDraft])

  useEffect(() => {
    setStudioMounted(true)
  }, [])

  useEffect(() => {
    const element = boardViewportRef.current
    if (!element) return

    const updateSize = () => {
      setBoardViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [activeStudioPanel, mapFullscreen])

  useEffect(() => {
    const element = boardViewportRef.current
    if (!element) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      event.stopPropagation()
      const direction = event.deltaY > 0 ? -0.08 : 0.08
      setStudioScale(builder.studioViewport.scale + direction, { clientX: event.clientX, clientY: event.clientY })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [builder.studioViewport.scale])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (activeStudioPanel !== 'map') return
      if (isTypingElement(event.target)) return

      const key = event.key.toLowerCase()
      const hasModifier = event.ctrlKey || event.metaKey

      if (hasModifier && key === 's') {
        event.preventDefault()
        if (selectedChannelId && hasUnsavedChanges && !saving) {
          void handleSaveChannel()
        }
        return
      }

      if (hasModifier && !event.shiftKey && key === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }

      if ((hasModifier && key === 'y') || (hasModifier && event.shiftKey && key === 'z')) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (key === 'i' && focusedNode) {
        event.preventDefault()
        setInspectorOpen((current) => !current)
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        resetStudioViewport()
        return
      }

      if (event.key === 'Escape' && mapFullscreen) {
        event.preventDefault()
        setMapFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeStudioPanel, focusedNode, hasUnsavedChanges, mapFullscreen, saving, selectedChannelId, historyPast, historyFuture, builder])

  return (
    <div className="space-y-4.5">
      <ErpPageHero
        eyebrow="CRM"
        title="Chatbot studio"
        description="Consola dedicada para diseñar el flujo conversacional, definir disparadores, variables, responsables y revisar el historial real del chatbot web."
        stats={[
          { label: 'Canales chatbot', value: channels.length, hint: 'Canales web activos o en pruebas', tone: 'teal' },
          { label: 'Etapas', value: builder.flowStages.length, hint: 'Bloques del flujo actual', tone: 'sky' },
          { label: 'Conversaciones', value: conversations.length, hint: 'Historial del canal seleccionado', tone: 'amber' },
        ]}
      />

      {!loading && !channels.length ? (
        <Card className="border-sky-200 bg-white/95 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)]">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Preconfiguración requerida</div>
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl font-semibold text-slate-950">No hay un canal de chatbot web listo para este Studio</h2>
              <p className="text-sm leading-6 text-slate-600">
                Primero debes crear y configurar un canal WEB_CHATBOT en Integraciones CRM. Solo después de eso se habilita el acceso al Studio para esta empresa.
              </p>
            </div>
            <Button type="button" onClick={() => window.location.assign('/dashboard/crm/integraciones')}>Ir a Integraciones CRM</Button>
          </CardContent>
        </Card>
      ) : (

      <Tabs defaultValue="studio" className="space-y-3">
        <TabsContent value="studio" className="space-y-3">
          {!studioMounted ? (
            <Card>
              <CardContent className="flex min-h-[420px] items-center justify-center pt-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
                  Cargando studio del flujo...
                </div>
              </CardContent>
            </Card>
          ) : (
          <div className={`grid gap-3 ${activeStudioPanel === 'map' ? 'xl:grid-cols-[minmax(0,1fr)]' : 'xl:grid-cols-[268px_minmax(0,1fr)]'}`}>
            {activeStudioPanel !== 'map' ? (
            <div className="space-y-3 xl:sticky xl:top-3 xl:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Panel de control</CardTitle>
                  <CardDescription>La vista principal arranca en el mapa visual para entrar directo al flujo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { id: 'map', label: 'Mapa visual del flujo', detail: `${builder.flowStages.length} etapas y ${builder.quickActions.length} acciones`, icon: GitBranch },
                    { id: 'general', label: 'Configuración general', detail: builder.status, icon: Bot },
                    { id: 'summary', label: 'Resumen operativo', detail: `${builder.flowTriggers.filter((item) => item.enabled).length} triggers activos`, icon: Save },
                    { id: 'library', label: 'Biblioteca de flujos', detail: `${builder.automationFlows.length} flujos`, icon: Bot },
                    { id: 'flow', label: 'Flujo y mensajes', detail: `${builder.flowStages.length} etapas`, icon: GitBranch },
                    { id: 'triggers', label: 'Disparadores', detail: `${builder.flowTriggers.filter((item) => item.enabled).length} activos`, icon: Zap },
                    { id: 'variables', label: 'Variables y coherencia', detail: `${builder.flowVariables.length} variables`, icon: Variable },
                    { id: 'assignments', label: 'Asignaciones automáticas', detail: builder.assignmentRules.assignmentMode, icon: Users },
                    { id: 'conversations', label: 'Conversaciones', detail: `${conversations.length} chats del canal`, icon: History },
                  ].map((section) => {
                    const Icon = section.icon
                    const active = activeStudioPanel === section.id
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveStudioPanel(section.id as StudioPrimaryPanel)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className={`mt-0.5 rounded-xl p-2 ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{section.label}</div>
                          <div className="mt-1 text-xs opacity-75">{section.detail}</div>
                        </div>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-sm text-slate-600">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Flujo activo</div>
                    <div className="mt-2 text-base font-semibold text-emerald-950">{selectedFlow?.name || 'Flujo principal'}</div>
                    <div className="mt-1 text-xs text-emerald-800">{selectedFlow?.description || 'Journey operativo listo para edición visual.'}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
            ) : null}

            <div className="min-w-0 space-y-3">
              {activeStudioPanel === 'library' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> Biblioteca de flujos</CardTitle>
                    <CardDescription>Activa, desactiva y asigna flujos por canal. Editar flujo abre el mapa como vista principal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">Flujos configurados: {builder.automationFlows.length}</div>
                      <Button variant="outline" size="sm" onClick={handleCreateFlow}>Crear flujo</Button>
                    </div>
                    <div className="space-y-3">
                      {builder.automationFlows.map((flow) => {
                        const isSelected = flow.id === builder.selectedFlowId
                        const renderedFlow = isSelected && selectedFlow
                          ? { ...flow, quickActions: builder.quickActions, flowStages: builder.flowStages, flowTriggers: builder.flowTriggers }
                          : flow
                        return (
                          <div key={flow.id} className={`rounded-2xl border p-4 ${isSelected ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input value={renderedFlow.name} onChange={(event) => handleFlowMetaPatch(flow.id, { name: event.target.value })} className="h-9 min-w-[220px]" />
                                  {renderedFlow.isDefault ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">Predeterminado</span> : null}
                                  {!renderedFlow.enabled ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Inactivo</span> : null}
                                </div>
                                <Textarea value={renderedFlow.description} onChange={(event) => handleFlowMetaPatch(flow.id, { description: event.target.value })} rows={2} placeholder="Qué resuelve este flujo y cuándo debería dispararse." />
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant={isSelected ? 'default' : 'outline'} size="sm" onClick={() => handleSelectFlow(flow.id)}>Editar flujo</Button>
                                <Button variant="outline" size="sm" onClick={() => handleFlowMetaPatch(flow.id, { isDefault: true })}>Usar por defecto</Button>
                                <Button variant="outline" size="sm" onClick={() => handleDeleteFlow(flow.id)} disabled={builder.automationFlows.length <= 1}>Eliminar</Button>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                                <div>
                                  <div className="text-sm font-medium text-slate-900">Flujo activo</div>
                                  <div className="text-xs text-slate-500">Solo los flujos activos entran en evaluación automática.</div>
                                </div>
                                <Switch checked={renderedFlow.enabled} onCheckedChange={(checked) => handleFlowMetaPatch(flow.id, { enabled: checked })} />
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canales vinculables</div>
                                <div className="flex flex-wrap gap-2">
                                  {AUTOMATION_PROVIDER_OPTIONS.map((provider) => {
                                    const active = renderedFlow.providers.includes(provider.value)
                                    return (
                                      <button
                                        key={provider.value}
                                        type="button"
                                        onClick={() => {
                                          const nextProviders = active
                                            ? renderedFlow.providers.filter((item) => item !== provider.value)
                                            : [...renderedFlow.providers, provider.value]
                                          handleFlowMetaPatch(flow.id, { providers: nextProviders.length ? nextProviders : ['WEB_CHATBOT'] })
                                        }}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
                                      >
                                        {provider.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">{renderedFlow.flowStages.length} etapas</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">{renderedFlow.flowTriggers.filter((item) => item.enabled).length} triggers</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1">{renderedFlow.quickActions.filter((item) => item.enabled).length} acciones</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'general' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Configuración general</CardTitle>
                    <CardDescription>Base del canal, identidad del asistente y disponibilidad pública.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Nombre del canal</Label>
                      <Input value={builder.channelName} onChange={(event) => setBuilder((current) => ({ ...current, channelName: event.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      <Select value={builder.status} onValueChange={(value) => setBuilder((current) => ({ ...current, status: value as ChannelStatus }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">Borrador</SelectItem>
                          <SelectItem value="TESTING">Pruebas</SelectItem>
                          <SelectItem value="ACTIVE">Activo</SelectItem>
                          <SelectItem value="DISABLED">Deshabilitado</SelectItem>
                          <SelectItem value="ERROR">Error</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Título del chatbot</Label>
                      <Input value={builder.chatbotTitle} onChange={(event) => setBuilder((current) => ({ ...current, chatbotTitle: event.target.value }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Prompt principal</Label>
                      <Textarea value={builder.chatbotPrompt} onChange={(event) => setBuilder((current) => ({ ...current, chatbotPrompt: event.target.value }))} rows={3} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Nombre del asistente</Label>
                      <Input value={builder.assistantName} onChange={(event) => setBuilder((current) => ({ ...current, assistantName: event.target.value }))} />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">Embed público habilitado</div>
                        <div className="text-xs text-slate-500">Permite exponer el chatbot por iframe en dominios autorizados.</div>
                      </div>
                      <Switch checked={builder.publicEmbedEnabled} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, publicEmbedEnabled: checked }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Dominios permitidos</Label>
                      <Textarea value={builder.allowedDomains} onChange={(event) => setBuilder((current) => ({ ...current, allowedDomains: event.target.value }))} rows={3} placeholder="midominio.com&#10;app.midominio.com" />
                      <p className="text-xs text-slate-500">Deja este campo vacio para permitir el iframe en cualquier dominio. Si quieres restringirlo, agrega un dominio por linea, sin protocolo ni rutas.</p>
                    </div>
                    <div className="grid gap-3 md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">Formulario previo al chat</div>
                          <div className="text-xs text-slate-500">Activa una plantilla para pedir datos antes de mostrar la conversación del visitante.</div>
                        </div>
                        <Switch checked={builder.preChatFormEnabled} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormEnabled: checked }))} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Reiniciar conversación después de</Label>
                          <Input value={builder.resetConversationAfterValue} onChange={(event) => setBuilder((current) => ({ ...current, resetConversationAfterValue: event.target.value.replace(/[^0-9]/g, '') || '1' }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Unidad</Label>
                          <Select value={builder.resetConversationAfterUnit} onValueChange={(value) => setBuilder((current) => ({ ...current, resetConversationAfterUnit: value as PublicChatbotResetConversationUnit }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">Minutos</SelectItem>
                              <SelectItem value="hours">Horas</SelectItem>
                              <SelectItem value="days">Días</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Acción al vencer</Label>
                          <Select value={builder.resetConversationAfterAction} onValueChange={(value) => setBuilder((current) => ({ ...current, resetConversationAfterAction: value as ChatbotInactivityAction }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="restart">Volver al inicio</SelectItem>
                              <SelectItem value="close">Cerrar conversación</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Plantilla</Label>
                          <Select value={builder.preChatFormTemplate} onValueChange={(value) => {
                            const preset = getPublicChatbotPreChatFormPreset(value)
                            setBuilder((current) => ({
                              ...current,
                              preChatFormTemplate: preset.value,
                              preChatFormTitle: preset.title,
                              preChatFormDescription: preset.description,
                              preChatFormSubmitLabel: preset.submitLabel,
                              preChatFormShowNameField: preset.showNameField,
                              preChatFormShowEmailField: preset.showEmailField,
                              preChatFormShowPhoneField: preset.showPhoneField,
                              preChatFormRequireName: preset.requireName,
                              preChatFormRequireEmail: preset.requireEmail,
                              preChatFormRequirePhone: preset.requirePhone,
                              preChatFormRequireContactMethod: preset.requireContactMethod,
                              preChatFormShowDepartmentField: preset.showDepartmentField,
                              preChatFormDepartmentLabel: preset.departmentLabel,
                              preChatFormDepartmentPlaceholder: preset.departmentPlaceholder,
                              preChatFormDepartmentOptions: preset.departmentOptions.map((item) => item.label).join('\n'),
                            }))
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {getPublicChatbotPreChatFormPresets().map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">Ejemplos: 5 minutos, 1 hora o 12 horas. Cuando expire, el prospecto ve un chat nuevo, pero el administrador puede seguir unificando por correo o teléfono.</p>
                      {builder.preChatFormEnabled ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2">
                            {renderInactivityRuleFields({
                              title: 'Inactividad del formulario previo',
                              description: 'Si el prospecto deja el formulario abierto sin avanzar, puedes reiniciarlo o cerrar la conversación.',
                              rule: {
                                enabled: builder.preChatFormInactivityEnabled,
                                timeoutValue: Math.max(1, Number(builder.preChatFormInactivityValue) || 1),
                                timeoutUnit: builder.preChatFormInactivityUnit,
                                timeoutMinutes: 0,
                                action: builder.preChatFormInactivityAction,
                              },
                              onChange: (rule) => setBuilder((current) => ({
                                ...current,
                                preChatFormInactivityEnabled: rule.enabled,
                                preChatFormInactivityValue: String(rule.timeoutValue),
                                preChatFormInactivityUnit: rule.timeoutUnit,
                                preChatFormInactivityAction: rule.action,
                              })),
                            })}
                          </div>
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Título</Label>
                            <Input value={builder.preChatFormTitle} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormTitle: event.target.value }))} />
                          </div>
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Descripción</Label>
                            <Textarea value={builder.preChatFormDescription} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDescription: event.target.value }))} rows={3} />
                          </div>
                          <div className="grid gap-2 md:col-span-2">
                            <Label>Botón principal</Label>
                            <Input value={builder.preChatFormSubmitLabel} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormSubmitLabel: event.target.value }))} />
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar nombre</span><Switch checked={builder.preChatFormShowNameField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowNameField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir nombre</span><Switch checked={builder.preChatFormRequireName} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireName: checked }))} disabled={!builder.preChatFormShowNameField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar correo</span><Switch checked={builder.preChatFormShowEmailField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowEmailField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir correo</span><Switch checked={builder.preChatFormRequireEmail} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireEmail: checked }))} disabled={!builder.preChatFormShowEmailField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar teléfono</span><Switch checked={builder.preChatFormShowPhoneField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowPhoneField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir teléfono</span><Switch checked={builder.preChatFormRequirePhone} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequirePhone: checked }))} disabled={!builder.preChatFormShowPhoneField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Exigir al menos correo o teléfono</span><Switch checked={builder.preChatFormRequireContactMethod} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormRequireContactMethod: checked }))} disabled={!builder.preChatFormShowEmailField && !builder.preChatFormShowPhoneField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar selector de departamento</span><Switch checked={builder.preChatFormShowDepartmentField} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, preChatFormShowDepartmentField: checked }))} /></div>
                          {builder.preChatFormShowDepartmentField ? (
                            <>
                              <div className="grid gap-2">
                                <Label>Label departamento</Label>
                                <Input value={builder.preChatFormDepartmentLabel} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentLabel: event.target.value }))} />
                              </div>
                              <div className="grid gap-2">
                                <Label>Placeholder departamento</Label>
                                <Input value={builder.preChatFormDepartmentPlaceholder} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentPlaceholder: event.target.value }))} />
                              </div>
                              <div className="grid gap-2 md:col-span-2">
                                <Label>Opciones del departamento</Label>
                                <Textarea value={builder.preChatFormDepartmentOptions} onChange={(event) => setBuilder((current) => ({ ...current, preChatFormDepartmentOptions: event.target.value }))} rows={4} placeholder="Ventas&#10;Soporte técnico&#10;Facturación" />
                              </div>
                            </>
                          ) : null}
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar nota legal</span><Switch checked={builder.termsEnabled} onCheckedChange={(checked) => setBuilder((current) => ({ ...current, termsEnabled: checked }))} /></div>
                          {builder.termsEnabled ? (
                            <>
                              <div className="grid gap-2 md:col-span-2">
                                <Label>Texto legal</Label>
                                <Textarea value={builder.termsLabel} onChange={(event) => setBuilder((current) => ({ ...current, termsLabel: event.target.value }))} rows={2} />
                              </div>
                              <div className="grid gap-2">
                                <Label>Texto del enlace</Label>
                                <Input value={builder.termsLinkText} onChange={(event) => setBuilder((current) => ({ ...current, termsLinkText: event.target.value }))} />
                              </div>
                              <div className="grid gap-2">
                                <Label>URL política</Label>
                                <Input value={builder.termsLinkUrl} onChange={(event) => setBuilder((current) => ({ ...current, termsLinkUrl: event.target.value }))} placeholder="https://..." />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'map' && !mapFullscreen ? renderMapWorkspace() : null}

              {activeStudioPanel === 'flow' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Flujo y mensajes</CardTitle>
                    <CardDescription>Cada bloque de Mensaje, Accion o Pausa se abre en su propio modal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">{builder.flowStages.length} mensajes · {builder.quickActions.length} acciones · {builder.pauseNodes.length} pausas</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={addStageFromPalette}>Agregar mensaje</Button>
                        <Button variant="outline" size="sm" onClick={addActionFromPalette}>Agregar accion</Button>
                        <Button variant="outline" size="sm" onClick={addPauseFromPalette}>Agregar pausa</Button>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mensajes del flujo</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          {builder.flowStages.map((stage) => (
                            <button key={stage.id} type="button" onClick={() => openEditor({ kind: 'stage', id: stage.id })} className={`rounded-2xl border px-4 py-3 text-left ${focusedNode?.kind === 'stage' && focusedNode.id === stage.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                              <div className="text-sm font-semibold text-slate-900">{stage.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{stage.nextField === 'none' ? 'Mensaje libre' : `Captura ${stage.nextField}`}</div>
                              <div className="mt-2 text-xs text-slate-500">{stage.responseOptions.length} rutas · {stage.quickActionIds.length} acciones</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pausas del flujo</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {builder.pauseNodes.map((pause) => (
                            <button key={pause.id} type="button" onClick={() => openEditor({ kind: 'pause', id: pause.id })} className={`rounded-2xl border px-4 py-3 text-left ${focusedNode?.kind === 'pause' && focusedNode.id === pause.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                              <div className="text-sm font-semibold text-slate-900">{pause.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{pause.durationMinutes} min de espera</div>
                              <div className="mt-2 text-xs text-slate-500">{stageMap[pause.sourceStageId]?.title || 'Sin origen'} → {stageMap[pause.targetStageId]?.title || 'Sin destino'}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Acciones rápidas</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {builder.quickActions.map((action) => (
                            <button key={action.id} type="button" onClick={() => openEditor({ kind: 'action', id: action.id })} className={`rounded-2xl border px-4 py-3 text-left ${focusedNode?.kind === 'action' && focusedNode.id === action.id ? 'border-fuchsia-300 bg-fuchsia-50' : 'border-slate-200 bg-white'}`}>
                              <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                              <div className="mt-1 text-xs text-slate-500">{action.kind}</div>
                              <div className="mt-2 text-xs text-slate-500">{action.message || 'Sin mensaje configurado'}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'triggers' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Disparadores</CardTitle>
                    <CardDescription>Cada disparador abre su modal de edición.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">{builder.flowTriggers.filter((item) => item.enabled).length} activos</div>
                      <Button variant="outline" size="sm" onClick={() => setBuilder((current) => {
                        const nextTriggerId = makeId('trigger')
                        return updateSelectedFlowInBuilder(current, { flowTriggers: [...current.flowTriggers, { id: nextTriggerId, label: 'Nuevo disparador', event: 'message', matchMode: 'contains', matchValue: '', targetStageId: '', targetActionId: '', targetTriggerId: '', assistantReply: '', enabled: true, conditions: [createTriggerCondition(nextTriggerId)], inactivityRule: getDefaultChatbotInactivityRule() }] })
                      })}>Agregar disparador</Button>
                    </div>
                    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      {builder.flowTriggers.map((trigger) => (
                        <button key={trigger.id} type="button" onClick={() => openEditor({ kind: 'trigger', id: trigger.id })} className={`rounded-2xl border px-4 py-3 text-left ${focusedNode?.kind === 'trigger' && focusedNode.id === trigger.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{trigger.label}</div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${trigger.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{trigger.enabled ? 'Activo' : 'Inactivo'}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{trigger.event} · {trigger.conditions.length} rama(s)</div>
                          <div className="mt-2 text-xs leading-5 text-slate-500">{summarizeTriggerConditions(trigger)}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'variables' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Variable className="h-4 w-4" /> Variables y coherencia</CardTitle>
                    <CardDescription>Cada variable abre modal y la coherencia se edita en ventana aparte.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">{builder.flowVariables.length} variables</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextVariable = { id: makeId('var'), key: `custom_${builder.flowVariables.length + 1}`, label: 'Variable nueva', source: 'static' as const, fallback: '', staticValue: '', description: '', enabled: true }
                            setBuilder((current) => ({ ...current, flowVariables: [...current.flowVariables, nextVariable] }))
                            setEditingVariableId(nextVariable.id)
                          }}
                        >
                          Agregar variable
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCoherenceModalOpen(true)}>Editar coherencia</Button>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="grid gap-2 md:grid-cols-2">
                        {builder.flowVariables.map((variable) => (
                          <button key={variable.id} type="button" onClick={() => setEditingVariableId(variable.id)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{variable.label}</div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${variable.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{variable.enabled ? 'Activa' : 'Inactiva'}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{variable.key} · {variable.source}</div>
                          </button>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Coherencia actual</div>
                        <div className="mt-2">Tono: {builder.messageCoherence.tone}</div>
                        <div className="mt-1 text-xs">Saludo: {builder.messageCoherence.greetingTemplate}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'assignments' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Asignaciones automáticas</CardTitle>
                    <CardDescription>La configuración completa se abre en modal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">Modo actual: {builder.assignmentRules.assignmentMode}</div>
                      <Button variant="outline" size="sm" onClick={() => setAssignmentModalOpen(true)}>Editar asignaciones</Button>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700">
                      <div>Responsable por defecto: {assignees.find((item) => item.id === builder.assignmentRules.defaultAssignedUserId)?.name || assignees.find((item) => item.id === builder.assignmentRules.defaultAssignedUserId)?.email || 'Sin responsable'}</div>
                      <div className="mt-2 text-xs text-slate-500">Responsable handoff: {assignees.find((item) => item.id === builder.assignmentRules.handoffAssignedUserId)?.name || assignees.find((item) => item.id === builder.assignmentRules.handoffAssignedUserId)?.email || 'Sin responsable'}</div>
                      <div className="mt-1 text-xs text-slate-500">Lead calificado: {assignees.find((item) => item.id === builder.assignmentRules.qualifiedAssignedUserId)?.name || assignees.find((item) => item.id === builder.assignmentRules.qualifiedAssignedUserId)?.email || 'Sin responsable'}</div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'summary' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen operativo</CardTitle>
                    <CardDescription>Chequeo rápido del flujo antes de publicar o probar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canal</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{builder.channelName || 'Sin nombre'}</div>
                      <div className="mt-1">{builder.chatbotTitle}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Disparadores</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{builder.flowTriggers.filter((item) => item.enabled).length}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Variables</div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{builder.flowVariables.filter((item) => item.enabled).length}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Etapas del journey</div>
                      <div className="mt-3 space-y-2">
                        {builder.flowStages.map((stage) => (
                          <div key={stage.id} className="rounded-xl bg-slate-50 px-3 py-2">
                            <div className="font-medium text-slate-900">{stage.title}</div>
                            <div className="text-xs text-slate-500">{stage.responseOptions.length} rutas · siguiente dato: {stage.nextField}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pausas visibles</div>
                      <div className="mt-3 space-y-2">
                        {builder.pauseNodes.length ? builder.pauseNodes.map((pause) => (
                          <div key={pause.id} className="rounded-xl bg-slate-50 px-3 py-2">
                            <div className="font-medium text-slate-900">{pause.title}</div>
                            <div className="text-xs text-slate-500">{pause.durationMinutes} min · {stageMap[pause.sourceStageId]?.title || 'Sin origen'} → {stageMap[pause.targetStageId]?.title || 'Sin destino'}</div>
                          </div>
                        )) : <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">No hay pausas definidas en este flujo.</div>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-emerald-700">Vista de coherencia</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{builder.messageCoherence.greetingTemplate}\n\n{builder.chatbotPrompt}\n\n{builder.messageCoherence.closingTemplate}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Asignación</div>
                      <div className="mt-2 text-sm text-slate-700">Modo actual: {builder.assignmentRules.assignmentMode}</div>
                      <div className="mt-1 text-xs text-slate-500">Handoff: {assignees.find((item) => item.id === builder.assignmentRules.handoffAssignedUserId)?.name || assignees.find((item) => item.id === builder.assignmentRules.handoffAssignedUserId)?.email || 'Sin responsable específico'}</div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'conversations' ? renderConversationsWorkspace() : null}
            </div>
          </div>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          {renderWorkspaceSwitcher(false)}
          {renderConversationsWorkspace()}
        </TabsContent>
      </Tabs>
      )}

      <Dialog open={mapFullscreen} onOpenChange={(open) => { if (open) { setMapFullscreen(true); return } stopFlowEditing() }}>
        <DialogContent className="h-[calc(100vh-8px)] w-[calc(100vw-8px)] max-w-none overflow-hidden border-none bg-white/98 p-1 shadow-[0_30px_90px_-32px_rgba(15,23,42,0.5)]">
          <DialogHeader className="sr-only">
            <DialogTitle>Mapa completo del flujo chatbot</DialogTitle>
            <DialogDescription>Vista ampliada para editar y revisar el mapa de etapas, conexiones y rutas del flujo.</DialogDescription>
          </DialogHeader>
          <div className="h-full overflow-hidden rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-1">
            {activeStudioPanel === 'map' ? renderMapWorkspace(true) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingNode)} onOpenChange={(open) => { if (!open) setEditingNode(null) }}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[880px]">
          {editingStage ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar mensaje del flujo</DialogTitle>
                <DialogDescription>Define qué dice el bot, qué respuesta debe entender y a qué mensaje o acción debe pasar después.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-1.5">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="font-medium">Cómo interpreta el chatbot esta etapa</div>
                      <div>1. Primero muestra este mensaje al visitante.</div>
                      <div>2. Luego compara la respuesta libre o el botón elegido contra las opciones configuradas abajo.</div>
                      <div>3. Si encuentra match, envía la respuesta del asistente y avanza al destino que definas.</div>
                      <div>4. Puedes crear tantas rutas como necesites para servicios, tamaños, acabados o escalamiento humano.</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Título</Label>
                    <Input value={editingStage.title} onChange={(event) => updateStage(editingStage.id, { title: event.target.value })} placeholder="Ej: Inicio, Calificación, Impresión digital" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Siguiente dato esperado</Label>
                    <Select value={editingStage.nextField} onValueChange={(value) => updateStage(editingStage.id, { nextField: value as ChatbotFlowNextField })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno</SelectItem>
                        <SelectItem value="name">Nombre</SelectItem>
                        <SelectItem value="email">Correo</SelectItem>
                        <SelectItem value="phone">Teléfono</SelectItem>
                        <SelectItem value="product">Producto</SelectItem>
                        <SelectItem value="quantity">Cantidad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Editor completo del mensaje</Label>
                  <RichTextComposer value={getStageMessageContent(editingStage)} onChange={(nextValue) => updateStageMessageContent(editingStage.id, nextValue)} placeholder="Escribe aqui el texto completo del mensaje, con títulos, tamaños, variables, emojis y listas." variableOptions={triggerVariableOptions} />
                  <div className="text-xs text-slate-500">Todo el contenido del mensaje se administra desde esta sola casilla.</div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label>Opciones de respuesta y ramas</Label>
                      <div className="mt-1 text-xs text-slate-500">Cada opción representa una intención posible del prospecto. Puedes dejarla sin destino y enlazarla después.</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => updateStage(editingStage.id, { responseOptions: [...editingStage.responseOptions, createStageResponseOption(builder.flowStages, editingStage.id)] })}>Agregar opción</Button>
                  </div>
                  {!editingStage.responseOptions.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Esta etapa todavía no tiene ramas. Agrega una opción para decirle al bot qué debe entender y a dónde debe continuar.
                    </div>
                  ) : null}
                  {editingStage.responseOptions.map((option) => (
                    <div key={option.id} className="rounded-xl border border-dashed border-slate-200 p-2.5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Ruta {editingStage.responseOptions.findIndex((item) => item.id === option.id) + 1}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => duplicateStageResponseOption(editingStage.id, option.id)}>Duplicar</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 border-rose-200 px-3 text-xs text-rose-700" onClick={() => removeResponseOption(editingStage.id, option.id)}>Eliminar</Button>
                        </div>
                      </div>
                      <div className="grid gap-2.5 md:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label>Etiqueta visible</Label>
                          <Input value={option.label} onChange={(event) => updateResponseOption(editingStage.id, option.id, { label: event.target.value })} placeholder="Ej: Quiero cotizar impresión digital" />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Siguiente mensaje</Label>
                          <Select value={option.targetStageId || '__none__'} onValueChange={(value) => updateResponseOption(editingStage.id, option.id, { targetStageId: value === '__none__' ? '' : value, targetActionId: value === '__none__' ? option.targetActionId : '', targetTriggerId: value === '__none__' ? option.targetTriggerId : '' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin enlazar</SelectItem>
                              {builder.flowStages.map((targetStage) => <SelectItem key={targetStage.id} value={targetStage.id}>{targetStage.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Siguiente filtro</Label>
                          <Select value={option.targetTriggerId || '__none__'} onValueChange={(value) => updateResponseOption(editingStage.id, option.id, { targetTriggerId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? option.targetStageId : '', targetActionId: value === '__none__' ? option.targetActionId : '' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin enlazar</SelectItem>
                              {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Cómo interpreta la respuesta</Label>
                          <Select value={option.matchMode} onValueChange={(value) => updateResponseOption(editingStage.id, option.id, { matchMode: value as ChatbotFlowResponseMatchMode })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">Contiene palabras</SelectItem>
                              <SelectItem value="exact">Coincidencia exacta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Palabras o frases que activan esta rama</Label>
                          <Input value={option.matchValue} onChange={(event) => updateResponseOption(editingStage.id, option.id, { matchValue: event.target.value })} placeholder="Ej: cotizar, impresión digital, volantes" />
                        </div>
                        <div className="grid gap-1.5 md:col-span-2">
                          <Label>Texto que representa la intención del visitante</Label>
                          <Textarea value={option.userMessage} onChange={(event) => updateResponseOption(editingStage.id, option.id, { userMessage: event.target.value })} rows={2} placeholder="Ej: Necesito cotizar impresión digital en tamaño carta." />
                        </div>
                        <div className="grid gap-1.5 md:col-span-2">
                          <Label>Respuesta del bot cuando toma esta rama</Label>
                          <Textarea value={option.assistantReply} onChange={(event) => updateResponseOption(editingStage.id, option.id, { assistantReply: event.target.value })} rows={2} placeholder="Ej: Claro, te ayudo con impresión digital. ¿Qué tamaño necesitas?" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingNode(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}

          {editingTrigger ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar disparador</DialogTitle>
                <DialogDescription>Define cuándo se activa cada condición del filtro y a qué acción o mensaje debe enviar la conversación.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Etiqueta</Label>
                    <Input value={editingTrigger.label} onChange={(event) => updateTrigger(editingTrigger.id, { label: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                    <div className="text-sm text-slate-700">Activo</div>
                    <Switch checked={editingTrigger.enabled} onCheckedChange={(checked) => updateTrigger(editingTrigger.id, { enabled: checked })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Evento</Label>
                    <Select value={editingTrigger.event} onValueChange={(value) => updateTrigger(editingTrigger.id, { event: value as ChatbotFlowTriggerEvent })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="message">Mensaje libre</SelectItem>
                        <SelectItem value="quick_action">Acción rápida</SelectItem>
                        <SelectItem value="response_option">Opción guiada</SelectItem>
                        <SelectItem value="human_request">Solicitud humana</SelectItem>
                        <SelectItem value="lead_qualified">Lead calificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Respuesta opcional</Label>
                    <Textarea value={editingTrigger.assistantReply} onChange={(event) => updateTrigger(editingTrigger.id, { assistantReply: event.target.value })} rows={3} />
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label>Condiciones del filtro</Label>
                      <div className="mt-1 text-xs text-slate-500">Cada condición puede leer una variable distinta y mandar a una acción o mensaje concreto.</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addTriggerCondition(editingTrigger.id)}>Agregar condición</Button>
                  </div>
                  <div className="space-y-3">
                    {editingTrigger.conditions.map((condition) => (
                      <div key={condition.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="grid gap-2">
                          <Label>Variable</Label>
                          <Select value={condition.variableKey} onValueChange={(value) => updateTriggerCondition(editingTrigger.id, condition.id, { variableKey: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {triggerVariableOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Operador</Label>
                            <Select value={condition.matchMode} onValueChange={(value) => updateTriggerCondition(editingTrigger.id, condition.id, { matchMode: value as ChatbotFlowTriggerMatchMode })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contiene</SelectItem>
                                <SelectItem value="equals">Es igual a</SelectItem>
                                <SelectItem value="starts_with">Empieza por</SelectItem>
                                <SelectItem value="regex">Regex</SelectItem>
                                <SelectItem value="exact">Exacto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Valor</Label>
                            <Input value={condition.matchValue} onChange={(event) => updateTriggerCondition(editingTrigger.id, condition.id, { matchValue: event.target.value })} placeholder="Ej: 5" />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Acción destino</Label>
                            <Select value={condition.targetActionId || '__none__'} onValueChange={(value) => updateTriggerCondition(editingTrigger.id, condition.id, { targetActionId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? condition.targetStageId : '' })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin acción</SelectItem>
                                {builder.quickActions.map((action) => <SelectItem key={action.id} value={action.id}>{action.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Mensaje destino</Label>
                            <Select value={condition.targetStageId || '__none__'} onValueChange={(value) => updateTriggerCondition(editingTrigger.id, condition.id, { targetStageId: value === '__none__' ? '' : value, targetActionId: value === '__none__' ? condition.targetActionId : '' })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin mensaje</SelectItem>
                                {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="border-rose-200 text-rose-700" onClick={() => removeTriggerCondition(editingTrigger.id, condition.id)}>Eliminar condición</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingNode(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}

          {editingAction ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar acción rápida</DialogTitle>
                <DialogDescription>Configura el comportamiento y el mensaje que dispara esta acción.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Etiqueta</Label>
                    <Input value={editingAction.label} onChange={(event) => updateQuickAction(editingAction.id, { label: event.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={editingAction.kind} onValueChange={(value) => updateQuickAction(editingAction.id, { kind: value as ChatbotQuickActionKind })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="catalog">Catálogo</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="product_lookup">Lookup producto</SelectItem>
                        <SelectItem value="service_lookup">Lookup servicio</SelectItem>
                        <SelectItem value="create_quote">Crear cotización</SelectItem>
                        <SelectItem value="create_invoice">Crear factura</SelectItem>
                        <SelectItem value="create_work_order">Crear orden</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="human">Humano</SelectItem>
                        <SelectItem value="message">Mensaje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Mensaje que dispara</Label>
                  <Input value={editingAction.message} onChange={(event) => updateQuickAction(editingAction.id, { message: event.target.value })} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Mensaje destino</Label>
                    <Select value={editingAction.targetStageId || '__none__'} onValueChange={(value) => updateQuickAction(editingAction.id, { targetStageId: value === '__none__' ? '' : value, targetTriggerId: value === '__none__' ? editingAction.targetTriggerId : '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin enlazar</SelectItem>
                        {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Filtro destino</Label>
                    <Select value={editingAction.targetTriggerId || '__none__'} onValueChange={(value) => updateQuickAction(editingAction.id, { targetTriggerId: value === '__none__' ? '' : value, targetStageId: value === '__none__' ? editingAction.targetStageId : '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin enlazar</SelectItem>
                        {builder.flowTriggers.map((trigger) => <SelectItem key={trigger.id} value={trigger.id}>{trigger.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editingAction.kind === 'url' ? (
                  <div className="grid gap-2">
                    <Label>URL destino</Label>
                    <Input value={editingAction.actionUrl || ''} onChange={(event) => updateQuickAction(editingAction.id, { actionUrl: event.target.value })} placeholder="https://... o /ruta-interna" />
                  </div>
                ) : null}
                {renderQuickActionAttachmentFields({
                  action: editingAction,
                  update: (patch) => updateQuickAction(editingAction.id, patch),
                })}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Acción habilitada</div>
                    <div className="text-xs text-slate-500">Si la desactivas, deja de aparecer como opción operativa.</div>
                  </div>
                  <Switch checked={editingAction.enabled} onCheckedChange={(checked) => updateQuickAction(editingAction.id, { enabled: checked })} />
                </div>
                {renderQuickActionAutomationFields(editingAction)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingNode(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}

          {editingPause ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar pausa</DialogTitle>
                <DialogDescription>Define la espera visible entre el mensaje origen y el siguiente mensaje del flujo.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Titulo</Label>
                    <Input value={editingPause.title} onChange={(event) => updatePauseNode(editingPause.id, { title: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Pausa habilitada</div>
                      <div className="text-xs text-slate-500">Si la desactivas, queda visible pero sin aplicacion operativa.</div>
                    </div>
                    <Switch checked={editingPause.enabled} onCheckedChange={(checked) => updatePauseNode(editingPause.id, { enabled: checked })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Mensaje origen</Label>
                    <Select value={editingPause.sourceStageId || '__none__'} onValueChange={(value) => updatePauseNode(editingPause.id, { sourceStageId: value === '__none__' ? '' : value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin origen</SelectItem>
                        {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Mensaje destino</Label>
                    <Select value={editingPause.targetStageId || '__none__'} onValueChange={(value) => updatePauseNode(editingPause.id, { targetStageId: value === '__none__' ? '' : value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin destino</SelectItem>
                        {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Duracion en minutos</Label>
                  <Input type="number" min={1} value={editingPause.durationMinutes} onChange={(event) => updatePauseNode(editingPause.id, { durationMinutes: Math.max(1, Number(event.target.value) || 1) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Descripcion operativa</Label>
                  <Textarea value={editingPause.description} onChange={(event) => updatePauseNode(editingPause.id, { description: event.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingNode(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingVariable)} onOpenChange={(open) => { if (!open) setEditingVariableId(null) }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {editingVariable ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar variable</DialogTitle>
                <DialogDescription>Define cómo se rellena esta variable dentro de los mensajes del flujo.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Etiqueta</Label>
                    <Input value={editingVariable.label} onChange={(event) => updateVariable(editingVariable.id, { label: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Variable habilitada</div>
                      <div className="text-xs text-slate-500">Si la desactivas, deja de interpolarse en respuestas automáticas.</div>
                    </div>
                    <Switch checked={editingVariable.enabled} onCheckedChange={(checked) => updateVariable(editingVariable.id, { enabled: checked })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Clave</Label>
                    <Input value={editingVariable.key} onChange={(event) => updateVariable(editingVariable.id, { key: event.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Origen</Label>
                    <Select value={editingVariable.source} onValueChange={(value) => updateVariable(editingVariable.id, { source: value as ChatbotFlowVariableSource })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact_name">Nombre del contacto</SelectItem>
                        <SelectItem value="contact_email">Email del contacto</SelectItem>
                        <SelectItem value="contact_phone">Teléfono del contacto</SelectItem>
                        <SelectItem value="contact_whatsapp">WhatsApp del contacto</SelectItem>
                        <SelectItem value="product">Producto</SelectItem>
                        <SelectItem value="quantity">Cantidad</SelectItem>
                        <SelectItem value="company">Empresa</SelectItem>
                        <SelectItem value="document">Documento / NIT</SelectItem>
                        <SelectItem value="city">Ciudad</SelectItem>
                        <SelectItem value="address">Dirección</SelectItem>
                        <SelectItem value="channel_name">Canal</SelectItem>
                        <SelectItem value="assistant_name">Asistente</SelectItem>
                        <SelectItem value="static">Valor fijo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Fallback</Label>
                  <Input value={editingVariable.fallback} onChange={(event) => updateVariable(editingVariable.id, { fallback: event.target.value })} />
                </div>
                {editingVariable.source === 'static' ? (
                  <div className="grid gap-2">
                    <Label>Valor fijo</Label>
                    <Input value={editingVariable.staticValue} onChange={(event) => updateVariable(editingVariable.id, { staticValue: event.target.value })} />
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label>Descripción operativa</Label>
                  <Textarea value={editingVariable.description} onChange={(event) => updateVariable(editingVariable.id, { description: event.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingVariableId(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={coherenceModalOpen} onOpenChange={setCoherenceModalOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar coherencia</DialogTitle>
            <DialogDescription>Controla el tono, saludo y restricciones globales de redacción del asistente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tono</Label>
                <Select value={builder.messageCoherence.tone} onValueChange={(value) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, tone: value as ChatbotMessageTone } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultivo">Consultivo</SelectItem>
                    <SelectItem value="directo">Directo</SelectItem>
                    <SelectItem value="amable">Amable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Notas de estilo</Label>
                <Input value={builder.messageCoherence.styleNotes} onChange={(event) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, styleNotes: event.target.value } }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Saludo inicial</Label>
              <Textarea value={builder.messageCoherence.greetingTemplate} onChange={(event) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, greetingTemplate: event.target.value } }))} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Cierre sugerido</Label>
              <Textarea value={builder.messageCoherence.closingTemplate} onChange={(event) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, closingTemplate: event.target.value } }))} rows={3} />
            </div>
            <div className="grid gap-2">
              <Label>Términos requeridos</Label>
              <Input value={builder.messageCoherence.requiredTerms} onChange={(event) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, requiredTerms: event.target.value } }))} />
            </div>
            <div className="grid gap-2">
              <Label>Términos prohibidos</Label>
              <Input value={builder.messageCoherence.forbiddenTerms} onChange={(event) => setBuilder((current) => ({ ...current, messageCoherence: { ...current.messageCoherence, forbiddenTerms: event.target.value } }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoherenceModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar asignaciones automáticas</DialogTitle>
            <DialogDescription>Define el responsable por defecto y los desvíos al pedir humano o al calificar un lead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Modo de asignación</Label>
              <Select value={builder.assignmentRules.assignmentMode} onValueChange={(value) => setBuilder((current) => ({ ...current, assignmentRules: { ...current.assignmentRules, assignmentMode: value as ChatbotAssignmentMode } }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel-owner">Dueño del canal</SelectItem>
                  <SelectItem value="default-user">Usuario por defecto</SelectItem>
                  <SelectItem value="handoff-user">Usuario de handoff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Responsable por defecto</Label>
                <Select value={builder.assignmentRules.defaultAssignedUserId || '__none__'} onValueChange={(value) => setBuilder((current) => ({ ...current, assignmentRules: { ...current.assignmentRules, defaultAssignedUserId: value === '__none__' ? '' : value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin responsable</SelectItem>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Responsable handoff</Label>
                <Select value={builder.assignmentRules.handoffAssignedUserId || '__none__'} onValueChange={(value) => setBuilder((current) => ({ ...current, assignmentRules: { ...current.assignmentRules, handoffAssignedUserId: value === '__none__' ? '' : value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin responsable</SelectItem>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Lead calificado</Label>
                <Select value={builder.assignmentRules.qualifiedAssignedUserId || '__none__'} onValueChange={(value) => setBuilder((current) => ({ ...current, assignmentRules: { ...current.assignmentRules, qualifiedAssignedUserId: value === '__none__' ? '' : value } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin responsable</SelectItem>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function joinConfigValues(values: string[]) {
  return values.join(', ')
}

type RichTextComposerProps = {
  value: string
  placeholder: string
  variableOptions: Array<{ key: string; label: string }>
  onChange: (value: string) => void
}

function RichTextContent({ html, className }: { html: string; className?: string }) {
  const normalized = normalizeRichTextHtml(html)
  if (!normalized) return null
  return <div className={`${RICH_TEXT_RENDER_CLASS} ${className || ''}`.trim()} dangerouslySetInnerHTML={{ __html: normalized }} />
}

function RichTextComposer({ value, placeholder, variableOptions, onChange }: RichTextComposerProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<Range | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const normalizedValue = normalizeRichTextHtml(value)
  const isEmpty = !richTextToPlainText(normalizedValue)

  useEffect(() => {
    const element = editorRef.current
    if (!element) return
    if (element.innerHTML !== normalizedValue) {
      element.innerHTML = normalizedValue
    }
  }, [normalizedValue])

  function saveSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) return
    selectionRef.current = range.cloneRange()
  }

  function restoreSelection() {
    if (!selectionRef.current) {
      editorRef.current?.focus()
      return
    }
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
    editorRef.current?.focus()
  }

  function emitChange() {
    const nextValue = normalizeRichTextHtml(editorRef.current?.innerHTML || '')
    onChange(nextValue)
  }

  function runCommand(command: string, commandValue?: string) {
    restoreSelection()
    document.execCommand(command, false, commandValue)
    emitChange()
    saveSelection()
  }

  function insertHtml(html: string) {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    emitChange()
    saveSelection()
  }

  function insertVariable(key: string) {
    insertHtml(`<span>{{${key}}}</span>`)
  }

  function insertEmoji(emoji: string) {
    insertHtml(`<span>${emoji}</span>`)
    setEmojiOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'p')}>Párrafo</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h1')}>Título</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h2')}>Subtítulo</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')}>Negrilla</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')}>Itálica</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('underline')}>Subrayado</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('fontSize', '2')}>Chico</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('fontSize', '3')}>Normal</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('fontSize', '5')}>Grande</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')}>Lista</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')}>Numerada</Button>
        <Select onValueChange={(selectedValue) => selectedValue !== '__none__' ? insertVariable(selectedValue) : undefined}>
          <SelectTrigger className="h-8 w-[140px] bg-white text-xs"><SelectValue placeholder="Variable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Variable</SelectItem>
            {variableOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => setEmojiOpen((current) => !current)}>Emojis</Button>
      </div>
      {emojiOpen ? (
        <div className="grid grid-cols-8 gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {STUDIO_EMOJI_CHOICES.map((emoji) => (
            <button key={emoji} type="button" className="rounded-xl border border-slate-200 px-2 py-2 text-lg hover:bg-slate-50" onMouseDown={(event) => event.preventDefault()} onClick={() => insertEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative rounded-2xl border border-slate-200 bg-white">
        {isEmpty ? <div className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400">{placeholder}</div> : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={`min-h-[260px] w-full overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-800 outline-none ${RICH_TEXT_RENDER_CLASS}`}
          onFocus={saveSelection}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onInput={() => {
            emitChange()
            saveSelection()
          }}
          onBlur={saveSelection}
          onPaste={(event) => {
            event.preventDefault()
            const plainText = event.clipboardData.getData('text/plain')
            insertHtml(plainTextToRichTextHtml(plainText) || plainText)
          }}
        />
      </div>
    </div>
  )
}