'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, GitBranch, GripVertical, History, Plus, Save, Trash2, Users, Variable, Zap } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  getDefaultChatbotFlowStages,
  getDefaultChatbotQuickActions,
  type ChatbotFlowNextField,
  type ChatbotFlowResponseMatchMode,
  type ChatbotFlowResponseOption,
  type ChatbotFlowStage,
  type ChatbotQuickAction,
  type ChatbotQuickActionKind,
} from '@/lib/crm-chatbot-flow'
import {
  getDefaultChatbotAutomationFlow,
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
  type ChatbotFlowTriggerEvent,
  type ChatbotFlowTriggerMatchMode,
  type ChatbotFlowVariable,
  type ChatbotFlowVariableSource,
  type ChatbotMessageCoherence,
  type ChatbotMessageTone,
} from '@/lib/crm-chatbot-studio'
import { getPublicChatbotSettings } from '@/lib/crm-public-chatbot'

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
  automationFlows: ChatbotAutomationFlow[]
  selectedFlowId: string
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  flowTriggers: ChatbotFlowTrigger[]
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
  kind: 'stage' | 'trigger' | 'action'
  id: string
}

type StudioEditingNode = StudioFocusNode | null
type StudioPrimaryPanel = 'map' | 'general' | 'summary' | 'library' | 'flow' | 'triggers' | 'variables' | 'assignments'

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
  x: number
  y: number
  width: number
  accentClass: string
  toneClass: string
}

type StudioGraphEdge = {
  id: string
  fromId: string
  toId: string
  label: string
  toneClass: string
}

const AUTOMATION_PROVIDER_OPTIONS: Array<{ value: ChatbotAutomationProvider; label: string }> = [
  { value: 'WEB_CHATBOT', label: 'Web chatbot' },
  { value: 'WHATSAPP_CLOUD', label: 'WhatsApp' },
  { value: 'INSTAGRAM_DM', label: 'Instagram' },
  { value: 'FACEBOOK_PAGE', label: 'Facebook' },
  { value: 'MESSENGER', label: 'Messenger' },
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
  return `studio-${kind}-${id}`
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

function buildStudioGraph(builder: BuilderState) {
  const laneY = {
    triggers: 28,
    stages: 250,
    actions: 520,
  }
  const startNode: StudioGraphNode = {
    id: 'start',
    domId: 'studio-start',
    kind: 'start',
    title: 'Inicio',
    subtitle: 'Entrada del chatbot',
    description: builder.chatbotTitle || 'Nuevo visitante',
    x: 40,
    y: laneY.stages,
    width: 180,
    accentClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    toneClass: 'stroke-emerald-400',
  }

  const stageSpacing = 300
  const stageNodes: StudioGraphNode[] = builder.flowStages.map((stage, index) => {
    const id = `stage:${stage.id}`
    const layout = builder.studioNodeLayout[id]
    return {
      id,
      domId: toDomId('stage', stage.id),
      kind: 'stage',
      title: stage.title || `Etapa ${index + 1}`,
      subtitle: stage.nextField === 'none' ? 'Mensaje' : `Captura ${stage.nextField}`,
      description: `${stage.responseOptions.length} rutas · ${stage.quickActionIds.length} acciones`,
      x: layout?.x ?? 280 + (index * stageSpacing),
      y: layout?.y ?? laneY.stages,
      width: 220,
      accentClass: 'border-emerald-200 bg-white text-slate-900',
      toneClass: 'stroke-emerald-400',
    }
  })

  const stageIndexById = new Map(builder.flowStages.map((stage, index) => [stage.id, index]))

  const triggerNodes: StudioGraphNode[] = builder.flowTriggers.map((trigger, index) => {
    const id = `trigger:${trigger.id}`
    const layout = builder.studioNodeLayout[id]
    return {
      id,
      domId: toDomId('trigger', trigger.id),
      kind: 'trigger',
      title: trigger.label || `Disparador ${index + 1}`,
      subtitle: trigger.event.replaceAll('_', ' '),
      description: summarizeMatchValue(trigger.matchValue, 'Evento automático'),
      x: layout?.x ?? 280 + ((stageIndexById.get(trigger.targetStageId) ?? index) * stageSpacing),
      y: layout?.y ?? laneY.triggers + ((index % 2) * 96),
      width: 210,
      accentClass: trigger.enabled ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-100 text-slate-500',
      toneClass: trigger.enabled ? 'stroke-amber-400' : 'stroke-slate-300',
    }
  })

  const actionUsage = new Map<string, string[]>()
  builder.flowStages.forEach((stage) => {
    stage.quickActionIds.forEach((actionId) => {
      const list = actionUsage.get(actionId) ?? []
      list.push(stage.title || stage.id)
      actionUsage.set(actionId, list)
    })
  })

  const actionNodes: StudioGraphNode[] = builder.quickActions.map((action, index) => {
    const id = `action:${action.id}`
    const layout = builder.studioNodeLayout[id]
    return {
      id,
      domId: toDomId('action', action.id),
      kind: 'action',
      title: action.label || `Acción ${index + 1}`,
      subtitle: action.kind,
      description: actionUsage.get(action.id)?.length ? `${actionUsage.get(action.id)?.length} etapas la usan` : 'Acción disponible',
      x: layout?.x ?? 280 + (index * 240),
      y: layout?.y ?? laneY.actions + ((index % 2) * 92),
      width: 200,
      accentClass: action.enabled ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950' : 'border-slate-200 bg-slate-100 text-slate-500',
      toneClass: action.enabled ? 'stroke-fuchsia-400' : 'stroke-slate-300',
    }
  })

  const nodes = [startNode, ...triggerNodes, ...stageNodes, ...actionNodes]
  const edges: StudioGraphEdge[] = []

  if (stageNodes[0]) {
    edges.push({
      id: 'start-to-first-stage',
      fromId: startNode.id,
      toId: stageNodes[0].id,
      label: 'inicio',
      toneClass: 'stroke-emerald-300',
    })
  }

  builder.flowStages.forEach((stage) => {
    const sourceId = `stage:${stage.id}`
    stage.responseOptions.forEach((option) => {
      if (!option.targetStageId || !stageIndexById.has(option.targetStageId)) return
      edges.push({
        id: `${sourceId}-option-${option.id}`,
        fromId: sourceId,
        toId: `stage:${option.targetStageId}`,
        label: option.label || 'ruta',
        toneClass: 'stroke-sky-300',
      })
    })

    stage.quickActionIds.forEach((actionId) => {
      if (!builder.quickActions.some((action) => action.id === actionId)) return
      edges.push({
        id: `${sourceId}-action-${actionId}`,
        fromId: sourceId,
        toId: `action:${actionId}`,
        label: 'acción',
        toneClass: 'stroke-fuchsia-300',
      })
    })
  })

  builder.flowTriggers.forEach((trigger) => {
    if (!stageIndexById.has(trigger.targetStageId)) return
    edges.push({
      id: `trigger-${trigger.id}-to-stage-${trigger.targetStageId}`,
      fromId: `trigger:${trigger.id}`,
      toId: `stage:${trigger.targetStageId}`,
      label: trigger.event === 'message' ? 'salto' : trigger.event.replaceAll('_', ' '),
      toneClass: trigger.enabled ? 'stroke-amber-300' : 'stroke-slate-300',
    })
  })

  const contentWidth = Math.max(...nodes.map((node) => node.x + node.width), 1200) + 120
  const contentHeight = Math.max(...nodes.map((node) => node.y + 120), 760)

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
    quickActions: selectedFlow.quickActions,
    flowStages: selectedFlow.flowStages,
    flowTriggers: selectedFlow.flowTriggers,
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
          quickActions: current.quickActions,
          flowStages: current.flowStages,
          flowTriggers: current.flowTriggers,
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
    automationFlows: studioSettings.automationFlows,
    selectedFlowId: defaultFlow.id,
    quickActions: defaultFlow.quickActions,
    flowStages: defaultFlow.flowStages,
    flowTriggers: defaultFlow.flowTriggers,
    flowVariables: studioSettings.flowVariables,
    assignmentRules: studioSettings.assignmentRules,
    messageCoherence: studioSettings.messageCoherence,
    studioNodeLayout: defaultFlow.studioNodeLayout || normalizeStudioNodeLayout(settingsJson.studioNodeLayout),
    studioViewport: defaultFlow.studioViewport || normalizeStudioViewport(settingsJson.studioViewport),
  })
}

function buildSettingsPayload(state: BuilderState) {
  const selectedFlow = {
    ...(state.automationFlows.find((flow) => flow.id === state.selectedFlowId) ?? getDefaultChatbotAutomationFlow()),
    quickActions: state.quickActions,
    flowStages: state.flowStages,
    flowTriggers: state.flowTriggers,
    studioNodeLayout: state.studioNodeLayout,
    studioViewport: state.studioViewport,
  }
  const automationFlows = state.automationFlows.map((flow) => flow.id === selectedFlow.id ? selectedFlow : flow)
  const defaultFlow = automationFlows.find((flow) => flow.isDefault) ?? selectedFlow

  return {
    ...state.rawSettingsJson,
    chatbotTitle: state.chatbotTitle,
    chatbotPrompt: state.chatbotPrompt,
    assistantName: state.assistantName,
    publicEmbedEnabled: state.publicEmbedEnabled,
    allowedDomains: state.allowedDomains,
    automationFlows,
    defaultFlowId: defaultFlow.id,
    quickActions: defaultFlow.quickActions,
    flowStages: defaultFlow.flowStages,
    flowTriggers: defaultFlow.flowTriggers,
    flowVariables: state.flowVariables,
    assignmentRules: state.assignmentRules,
    messageCoherence: state.messageCoherence,
    studioNodeLayout: defaultFlow.studioNodeLayout,
    studioViewport: defaultFlow.studioViewport,
    allowHumanHandoff: true,
  }
}

export function CrmChatbotStudioClient() {
  const [channels, setChannels] = useState<ChannelConnection[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [builder, setBuilder] = useState<BuilderState>(() => hydrateBuilder(null))
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string>('')
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [assigningConversationId, setAssigningConversationId] = useState<string | null>(null)
  const [focusedNode, setFocusedNode] = useState<StudioFocusNode | null>(null)
  const [editingNode, setEditingNode] = useState<StudioEditingNode>(null)
  const [activeStudioPanel, setActiveStudioPanel] = useState<StudioPrimaryPanel>('map')
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null)
  const [coherenceModalOpen, setCoherenceModalOpen] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [dragState, setDragState] = useState<StudioDragState | null>(null)
  const [panState, setPanState] = useState<StudioPanState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const dragMovedRef = useRef(false)
  const boardViewportRef = useRef<HTMLDivElement | null>(null)

  const selectedChannel = useMemo(() => channels.find((item) => item.id === selectedChannelId) ?? null, [channels, selectedChannelId])
  const selectedFlow = useMemo(() => builder.automationFlows.find((flow) => flow.id === builder.selectedFlowId) ?? null, [builder.automationFlows, builder.selectedFlowId])
  const editingVariable = editingVariableId ? builder.flowVariables.find((variable) => variable.id === editingVariableId) ?? null : null

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
    const nextChannelId = selectedChannelId && channelsJson.data.some((item) => item.id === selectedChannelId)
      ? selectedChannelId
      : (channelsJson.data[0]?.id ?? '')
    setSelectedChannelId(nextChannelId)
    setBuilder(hydrateBuilder(channelsJson.data.find((item) => item.id === nextChannelId) ?? channelsJson.data[0] ?? null))
    setLoading(false)
  }

  async function loadConversations(channelId: string) {
    if (!channelId) {
      setConversations([])
      setSelectedConversationId('')
      setSelectedConversation(null)
      return
    }

    const json = await requestJson<ConversationRow[]>(`/api/crm/conversations?provider=WEB_CHATBOT&channelConnectionId=${encodeURIComponent(channelId)}`)
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo cargar el historial del chatbot.')
      return
    }
    setConversations(json.data)
    const nextConversationId = selectedConversationId && json.data.some((item) => item.id === selectedConversationId)
      ? selectedConversationId
      : (json.data[0]?.id ?? '')
    setSelectedConversationId(nextConversationId)
  }

  async function loadConversationDetail(conversationId: string) {
    if (!conversationId) {
      setSelectedConversation(null)
      return
    }
    const json = await requestJson<ConversationDetail>(`/api/crm/conversations/${conversationId}`)
    if (!json.success || !json.data) {
      setError(json.error || 'No se pudo cargar el detalle de la conversación.')
      return
    }
    setSelectedConversation(json.data)
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    if (!selectedChannelId) return
    const channel = channels.find((item) => item.id === selectedChannelId) ?? null
    setBuilder(hydrateBuilder(channel))
    void loadConversations(selectedChannelId)
  }, [selectedChannelId, channels])

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null)
      return
    }
    void loadConversationDetail(selectedConversationId)
  }, [selectedConversationId])

  async function handleCreateChannel() {
    setCreating(true)
    setError(null)
    const nextBuilder = hydrateBuilder(null)
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
    setNotice('Canal de chatbot creado.')
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

  function updateStage(stageId: string, patch: Partial<ChatbotFlowStage>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowStages: current.flowStages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage),
    }))
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

  function updateQuickAction(actionId: string, patch: Partial<ChatbotQuickAction>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      quickActions: current.quickActions.map((item) => item.id === actionId ? { ...item, ...patch } : item),
    }))
  }

  function updateTrigger(triggerId: string, patch: Partial<ChatbotFlowTrigger>) {
    setBuilder((current) => updateSelectedFlowInBuilder(current, {
      flowTriggers: current.flowTriggers.map((item) => item.id === triggerId ? { ...item, ...patch } : item),
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
  const studioGraph = useMemo(() => buildStudioGraph(builder), [builder])
  const editingStage = editingNode?.kind === 'stage' ? builder.flowStages.find((stage) => stage.id === editingNode.id) ?? null : null
  const editingTrigger = editingNode?.kind === 'trigger' ? builder.flowTriggers.find((trigger) => trigger.id === editingNode.id) ?? null : null
  const editingAction = editingNode?.kind === 'action' ? builder.quickActions.find((action) => action.id === editingNode.id) ?? null : null

  function focusStudioNode(node: StudioFocusNode) {
    setFocusedNode(node)
    if (typeof document === 'undefined') return
    document.getElementById(toDomId(node.kind, node.id))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function openEditor(node: StudioFocusNode) {
    focusStudioNode(node)
    setEditingNode(node)
  }

  function handleBoardNodePointerDown(event: React.PointerEvent<HTMLDivElement>, node: StudioGraphNode) {
    if (event.button !== 0) return
    event.stopPropagation()
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
    dragMovedRef.current = false
    setPanState({
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      originX: builder.studioViewport.x,
      originY: builder.studioViewport.y,
    })
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

  return (
    <div className="space-y-6">
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

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <Card className="border-slate-200">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Canal de trabajo</div>
              <div className="text-xs text-slate-500">Selecciona el chatbot web que vas a diseñar u operar.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedChannelId || '__none__'} onValueChange={(value) => setSelectedChannelId(value === '__none__' ? '' : value)}>
              <SelectTrigger className="min-w-[260px]">
                <SelectValue placeholder="Selecciona un canal chatbot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin canal seleccionado</SelectItem>
                {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void handleCreateChannel()} disabled={creating}>{creating ? 'Creando...' : 'Crear canal chatbot'}</Button>
            <Button onClick={() => void handleSaveChannel()} disabled={!selectedChannelId || saving}>{saving ? 'Guardando...' : 'Guardar studio'}</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="studio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="studio" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
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

            <div className="min-w-0 space-y-4">
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
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'map' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Mapa visual del flujo</CardTitle>
                    <CardDescription>Vista tipo constructor con conectores entre disparadores, etapas y acciones rápidas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Etapas</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">Disparadores</span>
                      <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-fuchsia-700">Acciones</span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">Conectores de ruta</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Arrastra libremente cada nodo</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">Arrastra el fondo para mover el lienzo</span>
                    </div>
                    <div className="space-y-3 rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(241,245,249,0.96))] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-500">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Zoom {(builder.studioViewport.scale * 100).toFixed(0)}%</span>
                          <span>Pan X {Math.round(builder.studioViewport.x)} · Y {Math.round(builder.studioViewport.y)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setStudioScale(builder.studioViewport.scale - 0.1)}>Zoom -</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setStudioScale(builder.studioViewport.scale + 0.1)}>Zoom +</Button>
                          <Button type="button" variant="outline" size="sm" onClick={resetStudioViewport}>Centrar vista</Button>
                          <Button type="button" variant="outline" size="sm" onClick={clearStudioLayout}>Auto ordenar</Button>
                        </div>
                      </div>
                      <div
                        ref={boardViewportRef}
                        onPointerDown={handleBoardBackgroundPointerDown}
                        onWheel={(event) => {
                          event.preventDefault()
                          const direction = event.deltaY > 0 ? -0.08 : 0.08
                          setStudioScale(builder.studioViewport.scale + direction, { clientX: event.clientX, clientY: event.clientY })
                        }}
                        className={`relative h-[760px] overflow-hidden rounded-[24px] border border-slate-200/80 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:32px_32px] ${panState ? 'cursor-grabbing' : 'cursor-grab'}`}
                      >
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
                            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${studioGraph.contentWidth} ${studioGraph.contentHeight}`} fill="none">
                              {studioGraph.edges.map((edge) => {
                                const source = studioGraph.nodes.find((node) => node.id === edge.fromId)
                                const target = studioGraph.nodes.find((node) => node.id === edge.toId)
                                if (!source || !target) return null
                                const startX = source.x + source.width
                                const startY = source.y + 48
                                const endX = target.x
                                const endY = target.y + 48
                                const deltaX = Math.max((endX - startX) / 2, 56)
                                const path = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`
                                const labelX = startX + ((endX - startX) / 2)
                                const labelY = startY + ((endY - startY) / 2) - 12
                                return (
                                  <g key={edge.id}>
                                    <path d={path} className={`${edge.toneClass} fill-none stroke-[2.5]`} strokeDasharray={edge.label === 'acción' ? '6 6' : undefined} />
                                    <text x={labelX} y={labelY} textAnchor="middle" className="fill-slate-500 text-[11px] font-medium">{edge.label}</text>
                                  </g>
                                )
                              })}
                            </svg>

                            {studioGraph.nodes.map((node) => {
                              const nodeKey = node.id.split(':')[1]
                              const active = node.kind !== 'start' && focusedNode?.kind === node.kind && focusedNode.id === nodeKey
                              return (
                                <div
                                  key={node.id}
                                  onPointerDown={(event) => handleBoardNodePointerDown(event, node)}
                                  className={`absolute cursor-grab rounded-[24px] border px-4 py-3 text-left shadow-sm transition active:cursor-grabbing ${node.accentClass} ${active ? 'ring-2 ring-slate-900/15 shadow-lg' : 'hover:-translate-y-0.5'}`}
                                  style={{ left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px` }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{node.kind === 'start' ? 'Inicio' : node.kind}</div>
                                      <div className="mt-1 text-sm font-semibold">{node.title}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="rounded-full border border-current/15 bg-white/70 p-1 opacity-60"><GripVertical className="h-3.5 w-3.5" /></div>
                                      {node.kind !== 'start' ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 rounded-full px-2"
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            if (node.kind !== 'start') {
                                              openEditor({ kind: node.kind, id: nodeKey })
                                            }
                                          }}
                                        >
                                          Editar
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="mt-1 text-xs opacity-80">{node.subtitle}</div>
                                  <div className="mt-3 text-xs opacity-70">{node.description}</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activeStudioPanel === 'flow' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Flujo y mensajes</CardTitle>
                    <CardDescription>Cada etapa o acción se abre en su propio modal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-slate-500">{builder.flowStages.length} etapas · {builder.quickActions.length} acciones</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setBuilder((current) => updateSelectedFlowInBuilder(current, { flowStages: [...current.flowStages, { id: makeId('stage'), title: 'Nueva etapa', description: 'Describe el objetivo de esta etapa.', prompt: 'Mensaje inicial de la etapa.', nextField: 'none', quickActionIds: [], responseOptions: [] }] }))}>Agregar etapa</Button>
                        <Button variant="outline" size="sm" onClick={() => setBuilder((current) => updateSelectedFlowInBuilder(current, { quickActions: [...current.quickActions, { id: makeId('action'), label: 'Nueva acción', kind: 'message', message: 'Mensaje de acción rápida.', enabled: true }] }))}>Agregar acción</Button>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Etapas del flujo</div>
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
                      <Button variant="outline" size="sm" onClick={() => setBuilder((current) => updateSelectedFlowInBuilder(current, { flowTriggers: [...current.flowTriggers, { id: makeId('trigger'), label: 'Nuevo disparador', event: 'message', matchMode: 'contains', matchValue: '', targetStageId: current.flowStages[0]?.id || 'welcome', assistantReply: '', enabled: true }] }))}>Agregar disparador</Button>
                    </div>
                    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                      {builder.flowTriggers.map((trigger) => (
                        <button key={trigger.id} type="button" onClick={() => openEditor({ kind: 'trigger', id: trigger.id })} className={`rounded-2xl border px-4 py-3 text-left ${focusedNode?.kind === 'trigger' && focusedNode.id === trigger.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{trigger.label}</div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${trigger.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{trigger.enabled ? 'Activo' : 'Inactivo'}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{trigger.event} · {trigger.matchMode}</div>
                          <div className="mt-2 text-xs text-slate-500">Destino: {stageMap[trigger.targetStageId]?.title || trigger.targetStageId}</div>
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Conversaciones del chatbot</CardTitle>
                <CardDescription>Historial real del canal seleccionado, con responsable y estado comercial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!conversations.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Aún no hay conversaciones para este canal.</div> : null}
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedConversationId === conversation.id ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{conversation.contactDisplayName || conversation.contactPhone || conversation.contactEmail || 'Visitante web'}</div>
                        <div className="mt-1 text-xs text-slate-500">{conversation.assignedTo?.name || conversation.assignedTo?.email || 'Sin asignar'} · {conversation.status}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{formatDate(conversation.lastMessageAt)}</div>
                        {conversation.unreadCount > 0 ? <div className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{conversation.unreadCount} sin leer</div> : null}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-600">{conversation.messages[0]?.bodyText || 'Sin mensajes visibles'}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle operativo</CardTitle>
                <CardDescription>Mensajes, lead asociado y asignación del responsable del hilo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedConversation ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Selecciona una conversación para ver su historial.</div> : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Contacto</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Visitante web'}</div>
                        <div className="mt-2 text-xs text-slate-500">Correo: {selectedConversation.contactEmail || '—'}</div>
                        <div className="text-xs text-slate-500">Teléfono: {selectedConversation.contactPhone || '—'}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Asignación</div>
                        <div className="mt-2 grid gap-2">
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
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Lead y oportunidad</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-slate-700">
                        <div>Lead: {selectedConversation.lead?.nombre || 'Sin lead asociado'} {selectedConversation.lead ? `· ${selectedConversation.lead.status}` : ''}</div>
                        <div>Oportunidad: {selectedConversation.opportunity?.title || 'Sin oportunidad'}</div>
                      </div>
                    </div>

                    <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      {selectedConversation.messages.map((message) => {
                        const isOutbound = message.direction === 'OUTBOUND'
                        return (
                          <div key={message.id} className={isOutbound ? 'ml-auto max-w-[88%] rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700' : 'mr-auto max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                            <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                              <span>{isOutbound ? (message.sentByUser?.name || 'Bot / asesor') : 'Visitante'}</span>
                              <span>{formatDate(message.occurredAt)}</span>
                            </div>
                            <div className="mt-2 whitespace-pre-wrap break-words">{message.bodyText || 'Sin texto'}</div>
                            {message.payloadJson?.chatFlowStageId ? <div className="mt-2 text-[11px] text-slate-500">Etapa: {String(message.payloadJson.chatFlowStageId)}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingNode)} onOpenChange={(open) => { if (!open) setEditingNode(null) }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          {editingStage ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar etapa</DialogTitle>
                <DialogDescription>Configura el mensaje principal, el dato esperado y las rutas de esta etapa.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input value={editingStage.title} onChange={(event) => updateStage(editingStage.id, { title: event.target.value })} />
                  </div>
                  <div className="grid gap-2">
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
                <div className="grid gap-2">
                  <Label>Descripción</Label>
                  <Textarea value={editingStage.description} onChange={(event) => updateStage(editingStage.id, { description: event.target.value })} rows={2} />
                </div>
                <div className="grid gap-2">
                  <Label>Prompt de etapa</Label>
                  <Textarea value={editingStage.prompt} onChange={(event) => updateStage(editingStage.id, { prompt: event.target.value })} rows={3} />
                </div>
                <div className="grid gap-2">
                  <Label>Acciones rápidas</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {builder.quickActions.map((action) => {
                      const active = editingStage.quickActionIds.includes(action.id)
                      return (
                        <label key={action.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                          <span>{action.label}</span>
                          <Switch checked={active} onCheckedChange={(checked) => updateStage(editingStage.id, { quickActionIds: checked ? [...editingStage.quickActionIds, action.id] : editingStage.quickActionIds.filter((id) => id !== action.id) })} />
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Opciones de respuesta</Label>
                    <Button variant="outline" size="sm" onClick={() => updateStage(editingStage.id, { responseOptions: [...editingStage.responseOptions, { id: makeId('option'), label: 'Nueva opción', userMessage: 'Mensaje esperado del visitante.', assistantReply: 'Respuesta del asistente.', matchMode: 'contains', matchValue: '', targetStageId: editingStage.id }] })}>Agregar opción</Button>
                  </div>
                  {editingStage.responseOptions.map((option) => (
                    <div key={option.id} className="rounded-2xl border border-dashed border-slate-200 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Etiqueta</Label>
                          <Input value={option.label} onChange={(event) => updateResponseOption(editingStage.id, option.id, { label: event.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Destino</Label>
                          <Select value={option.targetStageId} onValueChange={(value) => updateResponseOption(editingStage.id, option.id, { targetStageId: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {builder.flowStages.map((targetStage) => <SelectItem key={targetStage.id} value={targetStage.id}>{targetStage.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Modo de match</Label>
                          <Select value={option.matchMode} onValueChange={(value) => updateResponseOption(editingStage.id, option.id, { matchMode: value as ChatbotFlowResponseMatchMode })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">Contiene</SelectItem>
                              <SelectItem value="exact">Exacto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Términos</Label>
                          <Input value={option.matchValue} onChange={(event) => updateResponseOption(editingStage.id, option.id, { matchValue: event.target.value })} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Mensaje del usuario</Label>
                          <Textarea value={option.userMessage} onChange={(event) => updateResponseOption(editingStage.id, option.id, { userMessage: event.target.value })} rows={2} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Respuesta del asistente</Label>
                          <Textarea value={option.assistantReply} onChange={(event) => updateResponseOption(editingStage.id, option.id, { assistantReply: event.target.value })} rows={2} />
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
                <DialogDescription>Define cuándo se activa y hacia qué etapa enruta la conversación.</DialogDescription>
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
                    <Label>Modo</Label>
                    <Select value={editingTrigger.matchMode} onValueChange={(value) => updateTrigger(editingTrigger.id, { matchMode: value as ChatbotFlowTriggerMatchMode })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contiene</SelectItem>
                        <SelectItem value="exact">Exacto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Valor a detectar</Label>
                  <Input value={editingTrigger.matchValue} onChange={(event) => updateTrigger(editingTrigger.id, { matchValue: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Etapa destino</Label>
                  <Select value={editingTrigger.targetStageId} onValueChange={(value) => updateTrigger(editingTrigger.id, { targetStageId: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {builder.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Respuesta opcional</Label>
                  <Textarea value={editingTrigger.assistantReply} onChange={(event) => updateTrigger(editingTrigger.id, { assistantReply: event.target.value })} rows={3} />
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
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Acción habilitada</div>
                    <div className="text-xs text-slate-500">Si la desactivas, deja de aparecer como opción operativa.</div>
                  </div>
                  <Switch checked={editingAction.enabled} onCheckedChange={(checked) => updateQuickAction(editingAction.id, { enabled: checked })} />
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
                        <SelectItem value="product">Producto</SelectItem>
                        <SelectItem value="quantity">Cantidad</SelectItem>
                        <SelectItem value="company">Empresa</SelectItem>
                        <SelectItem value="city">Ciudad</SelectItem>
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