"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  findChatbotFlowStage,
  findChatbotFlowResponseOption,
  getStageResponseOptions,
  getStageQuickActions,
  type ChatbotFlowStage,
  type ChatbotFlowResponseOption,
  type ChatbotQuickAction,
} from '@/lib/crm-chatbot-flow'

type PublicChatbotMessage = {
  id: string
  role: 'assistant' | 'user' | 'system'
  body: string
  at: string
  author?: string | null
  attachments?: Array<{ type?: string | null; url?: string | null; alt?: string | null }>
  meta?: {
    nextField?: string | null
    stageId?: string | null
    quickActionIds?: string[]
    responseOptionIds?: string[]
    pauseNodeId?: string | null
    pauseDurationMinutes?: number | null
    pauseDescription?: string | null
    pauseUntil?: string | null
  }
}

type PublicChatbotEmbedProps = {
  channelId: string
  title: string
  prompt: string
  assistantName: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  fontFamily: string
  customCss: string
  embedMode: 'iframe' | 'widget'
  floatingLauncherEnabled: boolean
  launcherLabel: string
  launcherIcon: string
  launcherPosition: 'right' | 'center' | 'left'
  launcherPlacement: 'fixed' | 'absolute'
  launcherSize: 'compact' | 'standard' | 'large'
  launcherOffsetX: string
  launcherOffsetY: string
  launcherZIndex: string
  panelZIndex: string
  backdropZIndex: string
  allowHumanHandoff: boolean
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  showProductField: boolean
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  accessIssue?: PublicChatbotAccessIssue
}

type PublicChatbotAccessIssue = {
  code: 'embed_disabled' | 'domain_not_allowed'
  detectedHost: string
  allowedDomains: string[]
}

type ChatIdentity = {
  nombre: string
  email: string
  telefono: string
  whatsapp: string
  producto: string
  empresaNombre: string
  documento: string
  ciudad: string
  direccion: string
}

type ConversationSyncResponse = {
  success?: boolean
  data?: {
    messages?: PublicChatbotMessage[]
  }
}

type ChatbotErrorResponse = {
  error?: string
}

const identityStorageSuffix = 'identity'
const sessionStorageSuffix = 'session'

function makeSessionId(channelId: string) {
  return `webchat-${channelId}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`
}

function nowIso() {
  return new Date().toISOString()
}

async function getResponseErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null) as ChatbotErrorResponse | null
    if (typeof json?.error === 'string' && json.error.trim()) return json.error.trim()
  }

  const text = await response.text().catch(() => '')
  return text.trim() || response.statusText || 'Sin detalle adicional'
}

function formatRemainingPause(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes} min ${seconds.toString().padStart(2, '0')} s`
  return `${seconds} s`
}

function buildWelcomeMessage(prompt: string, stage: ChatbotFlowStage | null, quickActions: ChatbotQuickAction[]): PublicChatbotMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    body: stage?.prompt || prompt,
    at: nowIso(),
    meta: {
      nextField: stage?.nextField === 'none' ? null : stage?.nextField || 'name',
      stageId: stage?.id || null,
      quickActionIds: getStageQuickActions(stage, quickActions).map((item) => item.id),
      responseOptionIds: getStageResponseOptions(stage).map((item) => item.id),
    },
  }
}

function getResponseOptionVisual() {
  return {
    className: 'border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100',
    badge: 'Paso guiado',
    icon: '↳',
  }
}

function getLauncherPreviewIcon(icon: string) {
  if (icon === 'sparkles') return '✦'
  if (icon === 'message-circle') return '◔'
  if (icon === 'bot') return '🤖'
  return '◔'
}

function getLauncherMetrics(size: PublicChatbotEmbedProps['launcherSize']) {
  if (size === 'compact') {
    return {
      buttonPadding: '0 16px',
      buttonHeight: '56px',
      buttonRadius: '999px',
      buttonGap: '0',
      iconSize: '20px',
      labelVisible: false,
      fontSize: '14px',
    }
  }

  if (size === 'large') {
    return {
      buttonPadding: '0 24px',
      buttonHeight: '66px',
      buttonRadius: '999px',
      buttonGap: '12px',
      iconSize: '22px',
      labelVisible: true,
      fontSize: '15px',
    }
  }

  return {
    buttonPadding: '0 20px',
    buttonHeight: '60px',
    buttonRadius: '999px',
    buttonGap: '10px',
    iconSize: '20px',
    labelVisible: true,
    fontSize: '14px',
  }
}

function normalizeEmbedPixel(rawValue: string, fallback: string) {
  const digits = rawValue.replace(/[^0-9]/g, '')
  return digits || fallback
}

function normalizeEmbedZIndex(rawValue: string, fallback: string) {
  const digits = rawValue.replace(/[^0-9-]/g, '')
  return digits || fallback
}

function getLauncherAnchor(position: PublicChatbotEmbedProps['launcherPosition'], offsetX: number, offsetY: number) {
  if (position === 'left') return { bottom: offsetY, left: offsetX }
  if (position === 'center') return { bottom: offsetY, left: '50%', transform: 'translateX(-50%)' }
  return { bottom: offsetY, right: offsetX }
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

function inferIdentityFromMessage(current: ChatIdentity, messageBody: string, nextField?: string | null) {
  const trimmedMessage = messageBody.trim()
  const extractedEmail = extractEmail(trimmedMessage)
  const extractedPhone = extractPhone(trimmedMessage)
  const extractedName = extractName(trimmedMessage)
  const canTreatAsProduct = !extractedEmail && !extractedPhone && !extractedName && trimmedMessage.length >= 3 && nextField !== 'email' && nextField !== 'name'

  return {
    nombre: current.nombre || (nextField === 'name' ? extractedName || trimmedMessage : extractedName),
    email: current.email || (nextField === 'email' ? extractedEmail : extractedEmail),
    telefono: current.telefono || (nextField === 'phone' ? extractedPhone : extractedPhone),
    whatsapp: current.whatsapp || (nextField === 'whatsapp' ? extractedPhone || trimmedMessage : current.whatsapp),
    producto: current.producto || ((nextField === 'product' || canTreatAsProduct) ? trimmedMessage : current.producto),
    empresaNombre: current.empresaNombre || (nextField === 'company' ? trimmedMessage : current.empresaNombre),
    documento: current.documento || (nextField === 'document' ? trimmedMessage : current.documento),
    ciudad: current.ciudad || (nextField === 'city' ? trimmedMessage : current.ciudad),
    direccion: current.direccion || (nextField === 'address' ? trimmedMessage : current.direccion),
  }
}

function getQuickActionVisual(kind: ChatbotQuickAction['kind']) {
  if (kind === 'catalog') {
    return {
      badge: 'Catalogo',
      icon: '▦',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100',
    }
  }
  if (kind === 'stock') {
    return {
      badge: 'Stock',
      icon: '◒',
      className: 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100',
    }
  }
  if (kind === 'human') {
    return {
      badge: 'Asesor',
      icon: '✦',
      className: 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100',
    }
  }
  if (kind === 'url') {
    return {
      badge: 'URL',
      icon: '↗',
      className: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100',
    }
  }
  if (kind === 'create_quote') {
    return {
      badge: 'Cotización',
      icon: '▣',
      className: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100',
    }
  }
  if (kind === 'create_invoice') {
    return {
      badge: 'Factura',
      icon: '◫',
      className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:border-fuchsia-300 hover:bg-fuchsia-100',
    }
  }
  if (kind === 'create_work_order') {
    return {
      badge: 'Orden',
      icon: '▤',
      className: 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100',
    }
  }
  if (kind === 'product_lookup') {
    return {
      badge: 'Producto',
      icon: '▣',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100',
    }
  }
  if (kind === 'service_lookup') {
    return {
      badge: 'Servicio',
      icon: '◇',
      className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:border-fuchsia-300 hover:bg-fuchsia-100',
    }
  }
  return {
    badge: 'Accion',
    icon: '•',
    className: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
  }
}

function getStageTheme(stageId: string | null | undefined, accentColor: string) {
  if (stageId === 'catalog') {
    return {
      chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      panel: 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.95),rgba(255,255,255,.98))]',
      halo: 'rgba(16,185,129,.18)',
      label: 'Catálogo y stock',
    }
  }
  if (stageId === 'qualification') {
    return {
      chip: 'border-sky-200 bg-sky-50 text-sky-800',
      panel: 'border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,.95),rgba(255,255,255,.98))]',
      halo: 'rgba(14,165,233,.18)',
      label: 'Calificación',
    }
  }
  if (stageId === 'handoff') {
    return {
      chip: 'border-amber-200 bg-amber-50 text-amber-900',
      panel: 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,.95),rgba(255,255,255,.98))]',
      halo: 'rgba(245,158,11,.18)',
      label: 'Escalamiento',
    }
  }
  return {
    chip: 'border-violet-200 bg-violet-50 text-violet-800',
    panel: 'border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,.95),rgba(255,255,255,.98))]',
    halo: `${accentColor}22`,
    label: 'Descubrimiento',
  }
}

export function CrmPublicChatbotEmbed(props: PublicChatbotEmbedProps) {
  if (props.accessIssue) {
    return <CrmPublicChatbotAccessIssue {...props} accessIssue={props.accessIssue} />
  }

  return <CrmPublicChatbotEmbedLive {...props} />
}

function CrmPublicChatbotAccessIssue(props: PublicChatbotEmbedProps & { accessIssue: PublicChatbotAccessIssue }) {
  const accentStyle = {
    ['--chat-accent' as string]: props.accentColor,
    ['--chat-background' as string]: props.backgroundColor,
    ['--chat-page-background' as string]: props.pageBackgroundColor,
    fontFamily: props.fontFamily,
  }
  const isDomainIssue = props.accessIssue.code === 'domain_not_allowed'
  const issueTitle = isDomainIssue
    ? 'Este chatbot no esta autorizado para este dominio.'
    : 'Este chatbot no tiene el embed publico habilitado.'
  const issueDescription = isDomainIssue
    ? 'Autoriza el dominio del sitio donde insertaste el iframe para permitir la carga y captura de mensajes.'
    : 'Activa el embed publico del canal antes de reutilizar este iframe en un sitio externo.'

  return (
    <div className="sgd-chatbot-page flex min-h-screen items-center justify-center p-4 text-slate-950" style={{ ...accentStyle, background: `radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 30%), linear-gradient(180deg, ${props.pageBackgroundColor} 0%, ${props.pageBackgroundColor} 45%, ${props.backgroundColor} 100%)` }}>
      {props.customCss.trim() ? <style>{props.customCss}</style> : null}
      <div className="w-full max-w-[460px] overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_-44px_rgba(15,23,42,0.42)]">
        <div className="border-b border-slate-100 px-6 py-5 text-white" style={{ background: `linear-gradient(135deg, #0f172a, ${props.accentColor})` }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Chatbot CRM</p>
          <h1 className="mt-1 text-xl font-semibold">{props.title}</h1>
          <p className="mt-2 text-sm text-white/80">{props.assistantName}</p>
        </div>
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
            <p className="text-sm font-semibold">{issueTitle}</p>
            <p className="mt-2 text-sm leading-6">{issueDescription}</p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-700">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Dominio detectado</p>
              <p className="mt-1 font-medium text-slate-900">{props.accessIssue.detectedHost || 'No disponible'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Dominios permitidos</p>
              <p className="mt-1 leading-6 text-slate-900">
                {props.accessIssue.allowedDomains.length ? props.accessIssue.allowedDomains.join(', ') : 'Sin restriccion configurada'}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Como corregirlo</p>
            <p className="mt-2 leading-6">
              Ajusta este canal en Chatbot Studio, panel General. Si quieres usar el iframe en cualquier sitio, deja Dominios permitidos vacio. Si quieres restringirlo, agrega un dominio por linea, sin protocolo ni rutas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CrmPublicChatbotEmbedLive(props: PublicChatbotEmbedProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const floatingLauncherActive = props.floatingLauncherEnabled && props.embedMode === 'widget'
  const initialStage = useMemo(() => props.flowStages[0] ?? findChatbotFlowStage(props.flowStages, 'welcome') ?? null, [props.flowStages])
  const [ready, setReady] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [identity, setIdentity] = useState<ChatIdentity>({ nombre: '', email: '', telefono: '', whatsapp: '', producto: '', empresaNombre: '', documento: '', ciudad: '', direccion: '' })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'error'>('connecting')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [messages, setMessages] = useState<PublicChatbotMessage[]>([buildWelcomeMessage(props.prompt, initialStage, props.quickActions)])
  const [isEmbedded, setIsEmbedded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(!floatingLauncherActive)
  const [clockTick, setClockTick] = useState(() => Date.now())

  const accentStyle = useMemo(() => ({ ['--chat-accent' as string]: props.accentColor, ['--chat-background' as string]: props.backgroundColor, ['--chat-page-background' as string]: props.pageBackgroundColor, fontFamily: props.fontFamily }), [props.accentColor, props.backgroundColor, props.pageBackgroundColor, props.fontFamily])
  const launcherMetrics = useMemo(() => getLauncherMetrics(props.launcherSize), [props.launcherSize])
  const launcherOffsetX = useMemo(() => Number.parseInt(normalizeEmbedPixel(props.launcherOffsetX, '60'), 10), [props.launcherOffsetX])
  const launcherOffsetY = useMemo(() => Number.parseInt(normalizeEmbedPixel(props.launcherOffsetY, '60'), 10), [props.launcherOffsetY])
  const launcherAnchorStyle = useMemo(() => getLauncherAnchor(props.launcherPosition, launcherOffsetX, launcherOffsetY), [launcherOffsetX, launcherOffsetY, props.launcherPosition])
  const launcherZIndex = useMemo(() => Number.parseInt(normalizeEmbedZIndex(props.launcherZIndex, '2147483647'), 10), [props.launcherZIndex])
  const latestMessage = messages[messages.length - 1] ?? null
  const latestAssistantPrompt = useMemo(() => {
    const assistantMessages = [...messages].reverse().find((item) => item.role === 'assistant' && item.meta?.nextField)
    return assistantMessages?.meta?.nextField || null
  }, [messages])
  const activeAssistantMessage = useMemo(() => [...messages].reverse().find((item) => item.role === 'assistant' && item.meta) ?? null, [messages])
  const activeAssistantMeta = activeAssistantMessage?.meta
  const activeStage = useMemo(() => findChatbotFlowStage(props.flowStages, activeAssistantMeta?.stageId || initialStage?.id || null) ?? initialStage, [activeAssistantMeta?.stageId, initialStage, props.flowStages])
  const activePause = useMemo(() => {
    if (!activeAssistantMessage?.meta?.pauseUntil) return null
    const pauseUntilMs = Date.parse(activeAssistantMessage.meta.pauseUntil)
    if (!Number.isFinite(pauseUntilMs)) return null
    const remainingMs = pauseUntilMs - clockTick
    if (remainingMs <= 0) return null
    return {
      pauseUntilMs,
      remainingMs,
      description: activeAssistantMessage.meta.pauseDescription || '',
      durationMinutes: activeAssistantMessage.meta.pauseDurationMinutes || null,
    }
  }, [activeAssistantMessage, clockTick])
  const interactionLocked = Boolean(activePause)
  const activeQuickActions = useMemo(() => {
    const ids = Array.isArray(activeAssistantMeta?.quickActionIds) ? activeAssistantMeta.quickActionIds : []
    if (ids.length) {
      return ids
        .map((actionId) => props.quickActions.find((item) => item.id === actionId && item.enabled))
        .filter((item): item is ChatbotQuickAction => Boolean(item))
    }
    return getStageQuickActions(activeStage, props.quickActions)
  }, [activeAssistantMeta?.quickActionIds, activeStage, props.quickActions])
  const activeResponseOptions = useMemo(() => {
    const ids = Array.isArray(activeAssistantMeta?.responseOptionIds) ? activeAssistantMeta.responseOptionIds : []
    if (ids.length) {
      return ids
        .map((optionId) => findChatbotFlowResponseOption(activeStage, optionId))
        .filter((item): item is ChatbotFlowResponseOption => Boolean(item))
    }
    return getStageResponseOptions(activeStage)
  }, [activeAssistantMeta?.responseOptionIds, activeStage])
  const shouldShowSelectableOptions = latestMessage?.role === 'assistant'
  const hasSelectableOptions = shouldShowSelectableOptions && (activeResponseOptions.length > 0 || activeQuickActions.length > 0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsEmbedded(window.self !== window.top)

    const sessionKey = `sgd-crm-chatbot:${props.channelId}:${sessionStorageSuffix}`
    const identityKey = `sgd-crm-chatbot:${props.channelId}:${identityStorageSuffix}`

    const existingSession = window.localStorage.getItem(sessionKey)
    const nextSession = existingSession || makeSessionId(props.channelId)
    if (!existingSession) window.localStorage.setItem(sessionKey, nextSession)
    setSessionId(nextSession)

    const storedIdentity = window.localStorage.getItem(identityKey)
    if (storedIdentity) {
      try {
        const parsed = JSON.parse(storedIdentity) as Partial<ChatIdentity>
        setIdentity({
          nombre: typeof parsed.nombre === 'string' ? parsed.nombre : '',
          email: typeof parsed.email === 'string' ? parsed.email : '',
          telefono: typeof parsed.telefono === 'string' ? parsed.telefono : '',
          whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : '',
          producto: typeof parsed.producto === 'string' ? parsed.producto : '',
          empresaNombre: typeof parsed.empresaNombre === 'string' ? parsed.empresaNombre : '',
          documento: typeof parsed.documento === 'string' ? parsed.documento : '',
          ciudad: typeof parsed.ciudad === 'string' ? parsed.ciudad : '',
          direccion: typeof parsed.direccion === 'string' ? parsed.direccion : '',
        })
      } catch {
        window.localStorage.removeItem(identityKey)
      }
    }

    setReady(true)
  }, [props.channelId])

  useEffect(() => {
    if (typeof window === 'undefined' || !ready) return
    const identityKey = `sgd-crm-chatbot:${props.channelId}:${identityStorageSuffix}`
    window.localStorage.setItem(identityKey, JSON.stringify(identity))
  }, [identity, props.channelId, ready])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const syncConversation = useCallback(async () => {
    if (!sessionId) return

    setSyncing(true)
    try {
      const params = new URLSearchParams({
        threadId: sessionId,
        parentReferrer: document.referrer || '',
      })
      const response = await fetch(`/api/public/chatbot/${props.channelId}/conversation?${params.toString()}`)
      if (!response.ok) {
        const detail = await getResponseErrorMessage(response)
        throw new Error(`No se pudo sincronizar la conversación (${response.status}). ${detail}`)
      }

      const json = await response.json().catch(() => ({})) as ConversationSyncResponse
      const serverMessages = Array.isArray(json.data?.messages)
        ? json.data?.messages.filter((item) => item.body)
        : []

      setMessages(serverMessages.length > 0 ? [buildWelcomeMessage(props.prompt, initialStage, props.quickActions), ...serverMessages] : [buildWelcomeMessage(props.prompt, initialStage, props.quickActions)])
      setConnectionState('online')
      setConnectionError(null)
    } catch (error) {
      console.error(error)
      setConnectionState('error')
      setConnectionError(error instanceof Error ? error.message : 'No se pudo sincronizar la conversación.')
    } finally {
      setSyncing(false)
    }
  }, [initialStage, props.channelId, props.prompt, props.quickActions, sessionId])

  useEffect(() => {
    if (!ready || !sessionId) return

    void syncConversation()
    const interval = window.setInterval(() => {
      void syncConversation()
    }, 3500)

    return () => window.clearInterval(interval)
  }, [ready, sessionId, syncConversation])

  async function sendMessage(messageBody: string, requestHuman = false, overrides?: { quickActionId?: string; responseOptionId?: string; currentStageId?: string }) {
    const trimmedMessage = messageBody.trim()
    if (!trimmedMessage || sending || !sessionId) return

    const nextIdentity = inferIdentityFromMessage(identity, trimmedMessage, latestAssistantPrompt)
    setIdentity(nextIdentity)

    const optimisticMessage: PublicChatbotMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      body: trimmedMessage,
      at: nowIso(),
    }
    setMessages((current) => [...current, optimisticMessage])
    setDraft('')
    setSending(true)

    try {
      const response = await fetch('/api/crm/captures/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: props.channelId,
          nombre: nextIdentity.nombre,
          email: nextIdentity.email,
          telefono: nextIdentity.telefono,
          whatsapp: nextIdentity.whatsapp,
          producto: nextIdentity.producto,
          empresaNombre: nextIdentity.empresaNombre,
          documento: nextIdentity.documento,
          ciudad: nextIdentity.ciudad,
          direccion: nextIdentity.direccion,
          message: trimmedMessage,
          requestHuman,
          externalThreadId: sessionId,
          providerMessageId: `${sessionId}-${Date.now()}`,
          landingPageUrl: window.location.href,
          referrerUrl: document.referrer || '',
          payload: {
            source: 'iframe-chatbot',
            userAgent: navigator.userAgent,
            chatFlowNextField: latestAssistantPrompt,
            quickActionId: overrides?.quickActionId || null,
            responseOptionId: overrides?.responseOptionId || null,
            currentStageId: overrides?.currentStageId || activeStage?.id || null,
          },
          quickActionId: overrides?.quickActionId || undefined,
          responseOptionId: overrides?.responseOptionId || undefined,
          currentStageId: overrides?.currentStageId || activeStage?.id || undefined,
        }),
      })

      if (!response.ok) {
        const detail = await getResponseErrorMessage(response)
        throw new Error(`No se pudo enviar el mensaje (${response.status}). ${detail}`)
      }

      setConnectionState('online')
      setConnectionError(null)
      await syncConversation()
    } catch (error) {
      console.error(error)
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'system',
          body: 'No pudimos enviar tu mensaje en este momento. Intenta de nuevo.',
          at: nowIso(),
        },
      ])
      setConnectionState('error')
      setConnectionError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  function submitDraft() {
    void sendMessage(draft)
  }

  function requestHumanSupport() {
    void sendMessage('Quiero hablar con un asesor humano.', true)
  }

  function triggerQuickAction(action: ChatbotQuickAction) {
    const currentStageId = activeStage?.id || initialStage?.id || ''
    if (action.kind === 'human') {
      void sendMessage(action.message, true, { quickActionId: action.id, currentStageId })
      return
    }
    void sendMessage(action.message, false, { quickActionId: action.id, currentStageId })
  }

  function triggerResponseOption(option: ChatbotFlowResponseOption) {
    const currentStageId = activeStage?.id || initialStage?.id || ''
    const targetStage = findChatbotFlowStage(props.flowStages, option.targetStageId)
    const shouldRequestHuman = option.targetStageId === 'handoff'
      || getStageQuickActions(targetStage, props.quickActions).some((action) => action.kind === 'human')
    void sendMessage(option.userMessage || option.label, shouldRequestHuman, {
      responseOptionId: option.id,
      currentStageId,
    })
  }

  function openPanel() {
    setPanelOpen(true)
  }

  function closePanel() {
    if (!floatingLauncherActive) return
    setPanelOpen(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const emitResize = () => {
      const measuredHeight = rootRef.current?.scrollHeight
      const fallbackHeight = floatingLauncherActive && !panelOpen
        ? Number.parseInt(launcherMetrics.buttonHeight, 10) + 28
        : 720
      const nextHeight = Math.max(88, Math.ceil(measuredHeight || fallbackHeight))

      window.parent?.postMessage({
        type: 'sgd-chatbot-embed-resize',
        channelId: props.channelId,
        height: nextHeight,
      }, '*')
    }

    const scheduleResize = () => {
      window.requestAnimationFrame(() => {
        emitResize()
      })
    }

    scheduleResize()
    const timeout = window.setTimeout(scheduleResize, 160)
    window.addEventListener('resize', scheduleResize)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('resize', scheduleResize)
    }
  }, [connectionState, floatingLauncherActive, launcherMetrics.buttonHeight, messages.length, panelOpen, props.channelId, sending, syncing])

  return (
    <div ref={rootRef} className="sgd-chatbot-page p-3 text-slate-950" style={{ ...accentStyle, minHeight: floatingLauncherActive && !panelOpen ? `${launcherOffsetY + 84}px` : '100vh', background: floatingLauncherActive && !panelOpen ? 'transparent' : `radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 30%), linear-gradient(180deg, ${props.pageBackgroundColor} 0%, ${props.pageBackgroundColor} 45%, ${props.backgroundColor} 100%)`, position: 'relative' }}>
      {props.customCss.trim() ? <style>{props.customCss}</style> : null}
      {floatingLauncherActive && !panelOpen ? (
        <div style={{ minHeight: `${launcherOffsetY + 84}px`, position: 'relative' }}>
          <button
            type="button"
            onClick={openPanel}
            style={{
              position: props.launcherPlacement,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: launcherMetrics.buttonGap,
              minWidth: props.launcherSize === 'compact' ? launcherMetrics.buttonHeight : undefined,
              height: launcherMetrics.buttonHeight,
              padding: launcherMetrics.buttonPadding,
              borderRadius: launcherMetrics.buttonRadius,
              border: 0,
              backgroundColor: props.accentColor,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: launcherMetrics.fontSize,
              boxShadow: '0 18px 40px rgba(15,23,42,.22)',
              cursor: 'pointer',
              zIndex: launcherZIndex,
              ...launcherAnchorStyle,
            }}
          >
            <span style={{ fontSize: launcherMetrics.iconSize, lineHeight: 1 }}>{getLauncherPreviewIcon(props.launcherIcon)}</span>
            {launcherMetrics.labelVisible ? <span>{props.launcherLabel}</span> : null}
          </button>
        </div>
      ) : null}

      <div className="sgd-chatbot-shell mx-auto flex h-[720px] max-h-[calc(100vh-24px)] max-w-[420px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_-44px_rgba(15,23,42,0.42)]" style={{ display: !panelOpen ? 'none' : 'flex' }}>
        <div className="sgd-chatbot-header border-b border-slate-100 px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, #0f172a, ${props.accentColor})` }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Chatbot CRM</p>
              <h1 className="mt-1 text-xl font-semibold">{props.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/90">
                {connectionState === 'online' ? 'En linea' : connectionState === 'error' ? 'Reconectando' : 'Conectando'}
              </div>
              {floatingLauncherActive ? (
                <button type="button" onClick={closePanel} className="rounded-full bg-white/14 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20">
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sgd-chatbot-messages flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4">
          {connectionError ? (
            <div className="mx-auto max-w-[92%] rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
              <p className="font-semibold">Conexion con el chatbot interrumpida</p>
              <p className="mt-1 whitespace-pre-wrap leading-6">{connectionError}</p>
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'sgd-chatbot-bubble-user ml-auto max-w-[88%] rounded-[22px] bg-slate-950 px-4 py-3 text-sm text-white shadow-sm' : message.role === 'system' ? 'sgd-chatbot-bubble-system mx-auto max-w-[92%] rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900' : 'sgd-chatbot-bubble-assistant mr-auto max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm'}>
              <p className="whitespace-pre-wrap leading-6">{message.body}</p>
              {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {message.attachments.filter((item) => item?.type === 'image' && item?.url).map((item, index) => (
                    <img key={`${message.id}-attachment-${index}`} src={item.url || ''} alt={item.alt || 'Imagen del producto'} className="w-full rounded-2xl border border-slate-200 object-cover" />
                  ))}
                  {message.attachments.filter((item) => item?.type === 'document' && item?.url).map((item, index) => (
                    <a
                      key={`${message.id}-document-${index}`}
                      href={item.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      <span>{item.alt || 'Abrir documento'}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-500">PDF</span>
                    </a>
                  ))}
                </div>
              ) : null}
              {message.author ? <p className="mt-2 text-[11px] text-slate-500">{message.author}</p> : null}
            </div>
          ))}
          {hasSelectableOptions ? (
            <div className="mr-auto max-w-[88%] rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente paso</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Elige una opcion para continuar</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Las opciones aparecen segun la conversacion actual.</p>
              <div className="mt-3 space-y-2">
                {activeResponseOptions.map((option, index) => {
                  const visual = getResponseOptionVisual()
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => triggerResponseOption(option)}
                      disabled={sending || !ready || interactionLocked}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${visual.className}`}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-xs font-semibold shadow-sm">{index + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="text-[11px] font-medium opacity-80">{visual.badge}</span>
                      </span>
                      <span className="text-sm font-semibold opacity-80">{visual.icon}</span>
                    </button>
                  )
                })}
                {activeQuickActions.map((action, index) => {
                  const visual = getQuickActionVisual(action.kind)
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => triggerQuickAction(action)}
                      disabled={sending || !ready || interactionLocked}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${visual.className}`}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-xs font-semibold shadow-sm">{activeResponseOptions.length + index + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{action.label}</span>
                        <span className="text-[11px] font-medium opacity-80">{visual.badge}</span>
                      </span>
                      <span className="text-sm font-semibold opacity-80">{visual.icon}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sgd-chatbot-composer border-t border-slate-100 bg-white px-4 py-4">
          <div className="grid gap-3">
            {activePause ? (
              <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Pausa en ejecución</p>
                    <p className="mt-1 font-semibold">El flujo continuará automáticamente cuando termine la espera.</p>
                  </div>
                  <div className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold text-sky-800">
                    {formatRemainingPause(activePause.remainingMs)}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-sky-800">{activePause.description || `Pausa automática configurada por ${activePause.durationMinutes || 0} min antes del siguiente bloque.`}</p>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{props.messageLabel}</p>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={interactionLocked ? 'Espera a que termine la pausa para continuar.' : hasSelectableOptions ? 'Selecciona una opcion de la lista o escribe tu respuesta.' : props.messagePlaceholder} className="rounded-2xl border-slate-200" disabled={interactionLocked} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 rounded-xl text-white" style={{ backgroundColor: props.accentColor }} onClick={submitDraft} disabled={sending || !ready || interactionLocked}>
                {interactionLocked ? 'Pausa activa...' : sending ? 'Enviando...' : 'Responder'}
              </Button>
              {props.allowHumanHandoff ? (
                <Button variant="outline" className="rounded-xl border-slate-200" onClick={requestHumanSupport} disabled={sending || !ready || interactionLocked}>
                  Pedir asesor
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}