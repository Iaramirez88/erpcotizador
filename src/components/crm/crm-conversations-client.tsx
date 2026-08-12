"use client"

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BellOff, Bot, Check, CheckCheck, Clock3, Facebook, FileAudio, FileText, Image as ImageIcon, Instagram, Mail, MessageCircle, MoreVertical, Pencil, PhoneCall, Plus, RefreshCcw, SendHorizontal, Smile, Video, X } from 'lucide-react'
import { CrmDailyCallEmbed } from '@/components/crm/crm-daily-call-embed'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmFileItem } from '@/components/crm/crm-files-types'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatImagePreview } from '@/components/ui/chat-image-preview'
import { IdentityAvatar } from '@/components/ui/identity-avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/components/providers/i18n-provider'
import { useChatMutePreferences } from '@/hooks/use-chat-mute-preferences'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'
import { uploadFileWithProgress } from '@/lib/upload-file-with-progress'

type ConversationStatus = 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'DISABLED' | 'RESOLVED' | 'SPAM'
type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM'
type MessageOrigin = 'CUSTOMER' | 'PHONE_APP' | 'CRM_AGENT' | 'BOT' | 'SYSTEM'
type ChannelProvider = 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'
type BridgeKind = 'GENERIC' | 'GMAIL' | 'OUTLOOK' | 'TIKTOK' | 'YOUTUBE'
type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
type OriginFilter = 'ALL' | 'EMAIL' | 'FORM' | 'CHATBOT' | 'WHATSAPP' | 'SOCIAL' | 'PHONE' | 'REFERRAL' | 'IMPORT'
type QueueScope = 'TEAM' | 'MINE' | 'UNASSIGNED'
type QueueFocus = 'ALL' | 'IMMEDIATE' | 'WAITING_CUSTOMER' | 'NEW_UNASSIGNED' | 'BOT_HANDOFF' | 'HYBRID_PHONE_ACTIVITY' | 'HYBRID_COLLISION'
type InboxStatusTab = 'PENDING' | 'RESOLVED' | 'ALL'
type InboxDatePreset = '7D' | '30D' | 'ALL'

type Assignee = {
  id: string
  name?: string | null
  email?: string | null
  activeCount?: number
  immediateCount?: number
  waitingCustomerCount?: number
  unreadCount?: number
  lastLoginAt?: string | null
}

type Channel = {
  id: string
  name: string
  provider: ChannelProvider
  status: string
  bridgeKind?: BridgeKind | null
}

type ConversationMessage = {
  id: string
  direction: MessageDirection
  messageType?: string
  status?: string
  bodyText?: string | null
  payloadJson?: Record<string, unknown> | null
  attachmentsJson?: Array<{
    type?: string | null
    url?: string | null
    name?: string | null
    alt?: string | null
    mimeType?: string | null
  }> | null
  occurredAt: string
  sentByUser?: Assignee | null
}

type CallInvitePreview = {
  inviteUrl: string
  callType: 'video' | 'audio'
}

type LeadOption = {
  id: string
  nombre: string
  empresaNombre?: string | null
  email?: string | null
  telefono?: string | null
  celular?: string | null
}

type ClienteOption = {
  id: string
  nombre: string
  documento: string
  email?: string | null
  telefono?: string | null
  celular?: string | null
}

type NewConversationMode = 'CLIENTE' | 'LEAD' | 'MANUAL'

type ConversationListItem = {
  id: string
  status: ConversationStatus
  contactAvatarUrl?: string | null
  contactDisplayName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  unreadCount: number
  lastMessageAt: string
  source?: string | null
  sourceCampaign?: string | null
  assignedTo?: Assignee | null
  lead?: { id: string; nombre: string; status: string } | null
  cliente?: { id: string; nombre: string; documento: string } | null
  opportunity?: { id: string; title: string; stage: OpportunityStage } | null
  channelConnection: Channel
  messages?: ConversationMessage[]
  _count?: { messages: number; captures: number }
}

type ConversationDetail = ConversationListItem & {
  messages: ConversationMessage[]
  captures: Array<{
    id: string
    captureType: string
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    normalizedDataJson?: Record<string, unknown> | null
    createdAt: string
  }>
}

type ConversationAiSuggestion = {
  summary: string
  suggestedReply: string
  nextActions: string[]
  taskSuggestion: {
    title: string
    description: string
    priority: 'LOW' | 'NORMAL' | 'HIGH'
    dueAt: string | null
    assignedToUserId: string | null
    assignedToLabel: string | null
    reason: string
  }
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  confidence: 'ALTA' | 'MEDIA' | 'BAJA'
  engine: {
    mode: 'RULES' | 'LLM'
    provider: string
    model: string | null
  }
  connection: {
    enabled: boolean
    provider: string
    model: string | null
  }
  auditEntryId?: string | null
}

type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'

type AiTaskDraft = {
  title: string
  description: string
  priority: TaskPriority
  dueAt: string
  assignedToUserId: string
}

type MaterialLookupItem = {
  id: string
  nombre: string
  categoria?: string | null
  proveedor?: string | null
  unidadMedida?: string | null
  stockActual?: number | null
  precioUnidad?: number | null
  precioMetro?: number | null
  precioM2?: number | null
  stocks?: Array<{
    quantity?: number | null
    warehouse?: { id: string; nombre: string; codigo?: string | null } | null
  }>
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type DailyCallsAddonState = {
  code: 'DAILY_CALLS'
  enabled: boolean
  ready: boolean
  status: 'INACTIVE' | 'CONFIGURING' | 'ACTIVE'
  validation: {
    checkedAt: string | null
    ok: boolean
    message: string
    domainName: string | null
  }
  settings: {
    connectionMode: 'SGDIGITAL_MANAGED' | 'CUSTOMER_DAILY'
    dailyDomain: string
    roomPrefix: string
    enableRecording: boolean
    defaultCallType: 'video' | 'audio'
    hasApiKey: boolean
  }
}

type PreparedCallSession = {
  conversationId: string
  roomName: string
  callType: 'video' | 'audio'
  launchMode: 'EMBED_MODAL'
  connectionMode: 'SGDIGITAL_MANAGED' | 'CUSTOMER_DAILY'
  domainHost: string | null
  joinUrl: string
  ownerToken: string
  ownerDisplayName: string
  ownerUserId: string
  expiresAt: string
  sessionKey: string
  enableRecording: boolean
  contactLabel: string
  provider: ChannelProvider
  readinessMessage: string
  guestInviteUrl: string | null
  inviteDispatch: {
    attempted: boolean
    sent: boolean
    channel: 'WHATSAPP' | 'NONE'
    recipient: string | null
    inviteUrl: string | null
    error: string | null
  }
}

type CallSetupItem = {
  tone: 'ready' | 'attention' | 'blocked'
  title: string
  detail: string
}

type UploadedConversationAttachment = {
  name: string
  url: string
  type: 'image' | 'audio' | 'document'
  mimeType?: string | null
  sizeBytes?: number | null
}

type SendMessageResponse = JsonResponse<ConversationMessage> & {
  code?: string
  recentPhoneActivity?: {
    id?: string
    occurredAt?: string
    bodyText?: string | null
  }
}

type CrmConversationsClientProps = {
  initialProviderFilter?: ChannelProvider | null
  title?: string
  description?: string
  hideHero?: boolean
  sidebarHeader?: ReactNode
}

const STATUS_OPTIONS: Array<'ALL' | ConversationStatus> = ['ALL', 'OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'DISABLED', 'RESOLVED', 'SPAM']
const ATTENTION_STATUS_OPTIONS: ConversationStatus[] = ['OPEN', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'PENDING', 'DISABLED', 'RESOLVED', 'SPAM']
const EMOJI_CHOICES = ['😀', '😂', '😉', '😍', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀']
const CONVERSATION_WALLPAPER_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(rgba(255,255,255,0.76), rgba(255,255,255,0.76)), url('/fondo-conversaciones.jpg')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'repeat',
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const res = await fetch(url, init)
  return (await res.json().catch(() => ({}))) as JsonResponse<T>
}

function mapDraftMessageTypeToAttachmentAccept(messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT') {
  if (messageType === 'IMAGE') return 'image/png,image/jpeg,image/webp,image/gif'
  if (messageType === 'AUDIO') return 'audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/mp4,.m4a'
  if (messageType === 'DOCUMENT') return 'application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'
  return '*/*'
}

function mapUploadedAttachmentTypeToMessageType(type: UploadedConversationAttachment['type']): 'IMAGE' | 'AUDIO' | 'DOCUMENT' {
  if (type === 'image') return 'IMAGE'
  if (type === 'audio') return 'AUDIO'
  return 'DOCUMENT'
}

function inferAudioExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return '.ogg'
  if (mimeType.includes('wav')) return '.wav'
  if (mimeType.includes('mp4')) return '.m4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3'
  return '.webm'
}

function getBrowserPermissionPolicy() {
  if (typeof document === 'undefined') return null

  const browserDocument = document as Document & {
    permissionsPolicy?: { allowsFeature?: (feature: string) => boolean }
    featurePolicy?: { allowsFeature?: (feature: string) => boolean }
  }

  return browserDocument.permissionsPolicy ?? browserDocument.featurePolicy ?? null
}

async function getAudioRecordingBlocker() {
  if (typeof window === 'undefined') {
    return 'La grabación de audio solo está disponible en el navegador.'
  }

  if (!window.isSecureContext) {
    return 'El navegador bloqueó el micrófono porque esta vista no corre en un contexto seguro. Abre la plataforma por HTTPS o desde localhost.'
  }

  if (!window.navigator.mediaDevices?.getUserMedia) {
    return 'Este navegador no expone la API de micrófono requerida para grabar desde el CRM.'
  }

  if (typeof MediaRecorder === 'undefined') {
    return 'Este navegador permite micrófono, pero no soporta MediaRecorder para grabar notas de voz.'
  }

  const permissionPolicy = getBrowserPermissionPolicy()
  if (permissionPolicy?.allowsFeature && !permissionPolicy.allowsFeature('microphone')) {
    return 'La página actual o el iframe host no autoriza el micrófono. Si está embebido, agrega allow="microphone; camera" al iframe.'
  }

  try {
    const permissionStatus = await window.navigator.permissions?.query?.({ name: 'microphone' as PermissionName })
    if (permissionStatus?.state === 'denied') {
      return 'El permiso del micrófono está denegado para este sitio. Restablécelo en permisos del navegador para este dominio.'
    }
  } catch {
    // Algunos navegadores no exponen navigator.permissions para micrófono.
  }

  return null
}

function formatAudioRecordingError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'El navegador negó el acceso al micrófono. Verifica HTTPS, permisos del sitio y si el iframe permite microphone.'
    }
    if (error.name === 'NotFoundError') {
      return 'No se encontró ningún micrófono disponible en este equipo para el navegador actual.'
    }
    if (error.name === 'NotReadableError') {
      return 'El micrófono existe, pero otra aplicación o el sistema no permiten leerlo en este momento.'
    }
    if (error.name === 'AbortError') {
      return 'La apertura del micrófono fue cancelada antes de iniciar la grabación.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'No se pudo iniciar la grabación de audio.'
}

function mapLibraryItemToConversationAttachment(item: CrmFileItem) {
  if (!item.url) {
    throw new Error('Solo puedes vincular archivos existentes de la carpeta interna, no carpetas.')
  }

  return {
    name: item.name,
    url: item.url,
    messageType: item.type === 'image' ? 'IMAGE' : item.type === 'audio' ? 'AUDIO' : 'DOCUMENT',
  } as const
}

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatAssigneeName(assignee: Assignee) {
  return assignee.name || assignee.email || assignee.id
}

function formatRelativeChannel(provider: ChannelProvider) {
  switch (provider) {
    case 'WHATSAPP_CLOUD':
    case 'WHATSAPP_SANDBOX':
      return 'WhatsApp'
    case 'MESSENGER':
    case 'FACEBOOK_PAGE':
      return 'Messenger/Facebook'
    case 'WEB_FORM':
      return 'Formulario web'
    case 'WEB_CHATBOT':
      return 'Chatbot web'
    case 'INSTAGRAM_DM':
      return 'Instagram DM'
    default:
      return provider
  }
}

function formatProviderDisplayName(provider: ChannelProvider) {
  switch (provider) {
    case 'WHATSAPP_CLOUD':
    case 'WHATSAPP_SANDBOX':
      return 'WhatsApp'
    case 'MESSENGER':
      return 'Messenger'
    case 'FACEBOOK_PAGE':
      return 'Facebook'
    case 'INSTAGRAM_DM':
      return 'Instagram'
    case 'WEB_CHATBOT':
      return 'Chatbot'
    case 'WEB_FORM':
      return 'Formulario'
    default:
      return provider
  }
}

function formatConversationListTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  const isSameDay = date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear()

  return new Intl.DateTimeFormat(locale, isSameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short' }).format(date)
}

function isConversationWithinDatePreset(lastMessageAt: string, preset: InboxDatePreset) {
  if (preset === 'ALL') return true

  const date = new Date(lastMessageAt)
  if (Number.isNaN(date.getTime())) return false

  const days = preset === '30D' ? 30 : 7
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000
  return date.getTime() >= threshold
}

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="16" fill="#25D366" />
      <path d="M14.7 36.1 16.9 30a12.5 12.5 0 1 1 4.5 4.4l-6.7 1.7Z" fill="#25D366" />
      <path d="M20.9 17.8c-.4-.9-.8-1-1.3-1h-1.1c-.4 0-.9.1-1.3.6-.4.5-1.7 1.6-1.7 3.9 0 2.3 1.7 4.6 1.9 4.9.3.3 3.2 5 8 6.8 1.2.4 2.1.7 2.8.8 1.2.2 2.3.2 3.1-.1.9-.3 2.6-1.1 2.9-2.2.4-1 .4-1.9.3-2-.1-.2-.5-.3-1-.6-.5-.2-2.9-1.4-3.4-1.6-.4-.2-.7-.2-1 .2-.3.5-1.2 1.6-1.4 1.9-.3.3-.5.4-1 .1-.5-.2-2-.8-3.8-2.4-1.4-1.2-2.3-2.7-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.5-.8.2-.3.1-.6 0-.8-.1-.2-1-2.4-1.4-3.3Z" fill="#fff" />
    </svg>
  )
}

function ChannelProviderBadge({ provider, size = 'sm' }: { provider: ChannelProvider; size?: 'sm' | 'md' }) {
  const shellClassName = size === 'md' ? 'h-9 w-9 rounded-2xl' : 'h-7 w-7 rounded-xl'
  const iconClassName = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') {
    return (
      <span className={`inline-flex items-center justify-center border border-emerald-200 bg-white shadow-sm ${shellClassName}`}>
        <WhatsAppLogo className={iconClassName} />
      </span>
    )
  }

  if (provider === 'INSTAGRAM_DM') {
    return (
      <span className={`inline-flex items-center justify-center border border-fuchsia-200 bg-[linear-gradient(135deg,_#fdf2f8,_#eef2ff)] text-fuchsia-700 shadow-sm ${shellClassName}`}>
        <Instagram className={iconClassName} />
      </span>
    )
  }

  if (provider === 'FACEBOOK_PAGE') {
    return (
      <span className={`inline-flex items-center justify-center border border-blue-200 bg-blue-50 text-blue-700 shadow-sm ${shellClassName}`}>
        <Facebook className={iconClassName} />
      </span>
    )
  }

  if (provider === 'MESSENGER') {
    return (
      <span className={`inline-flex items-center justify-center border border-sky-200 bg-sky-50 text-sky-700 shadow-sm ${shellClassName}`}>
        <MessageCircle className={iconClassName} />
      </span>
    )
  }

  if (provider === 'WEB_CHATBOT') {
    return (
      <span className={`inline-flex items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm ${shellClassName}`}>
        <Bot className={iconClassName} />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-600 shadow-sm ${shellClassName}`}>
      <FileText className={iconClassName} />
    </span>
  )
}

function getConversationOrigin(channel: Channel) {
  return getCrmOriginMeta({ provider: channel.provider, bridgeKind: channel.bridgeKind })
}

function getMessageOrigin(message: ConversationMessage): MessageOrigin {
  const origin = typeof message.payloadJson?.messageOrigin === 'string' ? message.payloadJson.messageOrigin : ''
  if (origin === 'CUSTOMER' || origin === 'PHONE_APP' || origin === 'CRM_AGENT' || origin === 'BOT' || origin === 'SYSTEM') {
    return origin
  }

  if (message.direction === 'OUTBOUND') return 'CRM_AGENT'
  if (message.direction === 'SYSTEM') return 'SYSTEM'
  return 'CUSTOMER'
}

function getConversationContactLabel(conversation: ConversationListItem | ConversationDetail) {
  return conversation.contactDisplayName || conversation.lead?.nombre || conversation.cliente?.nombre || conversation.contactPhone || conversation.contactEmail || 'Contacto'
}

function getMessageDisplayName(message: ConversationMessage, conversation: ConversationListItem | ConversationDetail) {
  if (message.direction === 'SYSTEM') return 'Sistema'

  const origin = getMessageOrigin(message)
  if (origin === 'BOT') return 'Bot'
  if (origin === 'PHONE_APP') return message.sentByUser ? formatAssigneeName(message.sentByUser) : 'Celular'
  if (message.direction === 'OUTBOUND') return message.sentByUser ? formatAssigneeName(message.sentByUser) : 'Asesor'

  return getConversationContactLabel(conversation)
}

function getCallInviteMeta(message: ConversationMessage) {
  const dispatch = typeof message.payloadJson?.dispatch === 'string' ? message.payloadJson.dispatch : ''
  if (dispatch !== 'whatsapp-call-invite') return null

  const inviteUrl = typeof message.payloadJson?.inviteUrl === 'string' ? message.payloadJson.inviteUrl.trim() : ''
  if (!inviteUrl) return null

  const callType: CallInvitePreview['callType'] = message.payloadJson?.callType === 'audio' ? 'audio' : 'video'

  return {
    inviteUrl,
    callType,
  }
}

function buildCallSetupItems(args: {
  conversation: ConversationDetail | null
  addon: DailyCallsAddonState | null
  messagingWindowState: { open: boolean; label: string; hint: string } | null
  callType: 'video' | 'audio'
}): CallSetupItem[] {
  if (!args.conversation) {
    return [{
      tone: 'blocked',
      title: 'Sin conversación seleccionada',
      detail: 'Selecciona primero el prospecto, cliente o contacto antes de abrir la llamada.',
    }]
  }

  const provider = args.conversation.channelConnection.provider
  const providerLabel = formatProviderDisplayName(provider)
  const isWhatsApp = provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX'
  const hasPhone = Boolean(args.conversation.contactPhone?.trim())
  const items: CallSetupItem[] = []

  if (!args.addon?.enabled) {
    items.push({
      tone: 'blocked',
      title: 'Addon Daily desactivado',
      detail: 'Activa Videollamadas Daily en Integraciones CRM para que el modal pueda levantar una sala real.',
    })
  } else if (!args.addon.ready) {
    items.push({
      tone: 'blocked',
      title: 'Daily todavía no está listo',
      detail: args.addon.validation.message || 'Falta validar dominio y credenciales de Daily antes de iniciar llamadas desde el CRM.',
    })
  } else {
    items.push({
      tone: 'ready',
      title: 'Sala CRM disponible',
      detail: `Daily ya está listo para abrir una ${args.callType === 'audio' ? 'llamada' : 'videollamada'} embebida para el asesor dentro del CRM.`,
    })
  }

  if (args.callType === 'audio') {
    items.push({
      tone: 'attention',
      title: 'Invitación automática al prospecto',
      detail: isWhatsApp
        ? 'La llamada de audio abre la sala para el asesor, pero hoy la invitación automática al prospecto está implementada solo para videollamadas por WhatsApp.'
        : `El canal ${providerLabel} todavía no envía invitaciones automáticas de llamada. Usa videollamada por WhatsApp o comparte el enlace manualmente con el prospecto.`,
    })
    return items
  }

  if (isWhatsApp) {
    if (!hasPhone) {
      items.push({
        tone: 'blocked',
        title: 'Falta número del prospecto',
        detail: 'La conversación necesita un teléfono válido para poder enviar el enlace de videollamada por WhatsApp.',
      })
    } else if (!args.messagingWindowState?.open) {
      items.push({
        tone: 'attention',
        title: 'Ventana de WhatsApp cerrada',
        detail: 'La sala sí puede prepararse, pero WhatsApp no podrá enviar el enlace automáticamente hasta que el prospecto vuelva a escribir o se implementen plantillas aprobadas.',
      })
    } else {
      items.push({
        tone: 'ready',
        title: 'Canal listo para invitar',
        detail: 'WhatsApp tiene número de contacto y ventana abierta, así que el CRM puede intentar enviar el enlace automático al prospecto.',
      })
    }
    return items
  }

  if (provider === 'WEB_FORM' || provider === 'WEB_CHATBOT') {
    items.push({
      tone: 'attention',
      title: 'Canal sin mensajería nativa',
      detail: 'Este contacto llegó por formulario o chatbot web. El CRM puede preparar la sala, pero no puede entregar el enlace automáticamente por este canal; debes compartirlo manualmente o continuar por WhatsApp.',
    })
    return items
  }

  items.push({
    tone: 'attention',
    title: `Invitación por ${providerLabel}`,
    detail: `El CRM aún no envía enlaces de videollamada automáticamente por ${providerLabel}. El modal te confirma la preparación de la sala, pero el enlace al prospecto debe compartirse manualmente o por un hilo de WhatsApp.`,
  })

  return items
}

function getPrimaryAttachment(message: ConversationMessage) {
  if (!Array.isArray(message.attachmentsJson) || message.attachmentsJson.length === 0) return null
  return message.attachmentsJson.find((attachment) => typeof attachment?.url === 'string' && attachment.url.trim().length > 0) || null
}

function isRenderableAttachmentUrl(value: string | null | undefined) {
  const url = String(value || '').trim()
  if (!url) return false

  if (/^(https?:|blob:|data:)/i.test(url)) return true
  if (url.startsWith('/uploads/') || url.startsWith('/scans/') || url.startsWith('/docs/')) return true

  return false
}

function inferAttachmentKind(attachment: NonNullable<ConversationMessage['attachmentsJson']>[number]) {
  const declaredType = String(attachment.type || '').trim().toLowerCase()
  const mimeType = String(attachment.mimeType || '').trim().toLowerCase()
  const attachmentUrl = String(attachment.url || '').trim().toLowerCase()

  if (declaredType === 'image' || declaredType === 'audio' || declaredType === 'document') return declaredType
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i.test(attachmentUrl) || attachmentUrl.includes('ig_messaging_cdn')) return 'image'
  if (/\.(mp3|m4a|wav|ogg|aac|webm)(?:$|[?#])/i.test(attachmentUrl)) return 'audio'
  return 'document'
}

function getAttachmentDisplayName(attachment: NonNullable<ConversationMessage['attachmentsJson']>[number]) {
  const rawName = String(attachment.name || attachment.alt || '').trim()
  if (rawName && !/^https?:\/\//i.test(rawName)) return rawName

  const inferredKind = inferAttachmentKind(attachment)
  if (inferredKind === 'image') return 'Imagen recibida'
  if (inferredKind === 'audio') return 'Audio recibido'
  return 'Archivo adjunto'
}

function getUniqueAttachments(attachments: ConversationMessage['attachmentsJson']) {
  if (!Array.isArray(attachments) || attachments.length === 0) return []

  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    const attachmentUrl = String(attachment?.url || '').trim()
    if (!attachmentUrl || seen.has(attachmentUrl)) return false
    seen.add(attachmentUrl)
    return true
  })
}

function shouldHideMessageBodyText(message: ConversationMessage) {
  const bodyText = message.bodyText?.trim() || ''
  if (!bodyText) return false

  const attachment = getPrimaryAttachment(message)
  if (!attachment?.url) return false
  if (!isRenderableAttachmentUrl(attachment.url)) return false

  const attachmentUrl = attachment.url.trim()
  const bodyLooksLikeUrl = /^https?:\/\/\S+$/i.test(bodyText)
  if (!bodyLooksLikeUrl) return false

  if (bodyText === attachmentUrl) return true

  const bodyWithoutQuery = bodyText.split('?')[0]
  const attachmentWithoutQuery = attachmentUrl.split('?')[0]
  return bodyWithoutQuery === attachmentWithoutQuery
}

function getAttachmentPreviewLabel(message: ConversationMessage) {
  const attachment = getPrimaryAttachment(message)
  if (!attachment) return null

  return getAttachmentDisplayName(attachment)
}

function getConversationPreviewText(message: ConversationMessage | undefined, fallback: string) {
  if (!message) return fallback
  if (shouldHideMessageBodyText(message)) {
    return getAttachmentPreviewLabel(message) || fallback
  }

  return message.bodyText || fallback
}

function renderConversationMessageBody(args: {
  message: ConversationMessage
  search: string
  onOpenInvitePreview: (preview: CallInvitePreview) => void
}) {
  const inviteMeta = getCallInviteMeta(args.message)

  if (inviteMeta) {
    const isVideo = inviteMeta.callType === 'video'
    return (
      <div className="mt-2 rounded-[20px] border border-sky-200 bg-[linear-gradient(180deg,#f7fbff,#eef6ff)] p-3 text-slate-800 shadow-[0_12px_28px_-20px_rgba(14,116,204,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-700">
              {isVideo ? <Video className="h-5 w-5" /> : <PhoneCall className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">{isVideo ? 'Invitacion a videollamada' : 'Invitacion a llamada de audio'}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">La URL completa queda oculta para no romper el chat. Abre la invitacion en un modal del CRM.</p>
            </div>
          </div>
          <Button type="button" variant="outline" className="shrink-0 rounded-xl border-sky-200 bg-white text-sky-700 hover:bg-sky-50" onClick={() => args.onOpenInvitePreview(inviteMeta)}>
            {isVideo ? <Video className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}
            Abrir
          </Button>
        </div>
      </div>
    )
  }

  if (shouldHideMessageBodyText(args.message)) {
    return null
  }

  return <p className="mt-1.5 whitespace-pre-wrap leading-5">{renderHighlightedText(args.message.bodyText || 'Sin contenido textual', args.search)}</p>
}

function renderConversationAttachments(attachments: ConversationMessage['attachmentsJson']) {
  const uniqueAttachments = getUniqueAttachments(attachments)
  if (uniqueAttachments.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {uniqueAttachments.map((attachment, index) => {
        const attachmentType = inferAttachmentKind(attachment)
        const attachmentUrl = String(attachment.url || '').trim()
        if (!isRenderableAttachmentUrl(attachmentUrl)) return null

        const attachmentLabel = getAttachmentDisplayName(attachment)

        if (attachmentType === 'image') {
          return (
            <ChatImagePreview
              key={`${attachmentUrl}-${index}`}
              src={attachmentUrl}
              alt={attachment.alt || attachmentLabel}
              title={attachmentLabel}
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90">
                <img src={attachmentUrl} alt={attachment.alt || attachmentLabel} loading="lazy" decoding="async" className="max-h-80 w-full object-cover" />
                <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="truncate">{attachmentLabel}</span>
                </div>
              </div>
            </ChatImagePreview>
          )
        }

        if (attachmentType === 'audio') {
          return (
            <div key={`${attachmentUrl}-${index}`} className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                <FileAudio className="h-3.5 w-3.5" />
                <span className="truncate">{attachmentLabel}</span>
              </div>
              <audio controls preload="none" className="w-full" src={attachmentUrl}>
                Tu navegador no soporta audio embebido.
              </audio>
            </div>
          )
        }

        return (
          <a
            key={`${attachmentUrl}-${index}`}
            href={attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-sky-700 hover:underline"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{attachmentLabel}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-500">{attachment.mimeType || 'Archivo'}</span>
          </a>
        )
      })}
    </div>
  )
}

function hasMessageCollision(message: ConversationMessage) {
  return message.payloadJson?.collisionDetected === true
}

function getConversationListSignal(item: ConversationListItem) {
  const latestMessage = item.messages?.[0]
  if (!latestMessage) {
    return { hasCollision: false, hasPhoneActivity: false }
  }

  return {
    hasCollision: hasMessageCollision(latestMessage),
    hasPhoneActivity: getMessageOrigin(latestMessage) === 'PHONE_APP',
  }
}

function formatRecentPhoneActivityHint(activity: NonNullable<SendMessageResponse['recentPhoneActivity']>, locale: string, fallback: string) {
  const timestamp = formatDate(activity.occurredAt, locale, fallback)
  const bodyText = activity.bodyText?.trim()
  return bodyText ? `Último mensaje desde celular: ${timestamp}. Texto: ${bodyText}` : `Último mensaje desde celular: ${timestamp}.`
}

function getOriginTone(originKey: CrmOriginKey) {
  if (originKey === 'EMAIL_GMAIL' || originKey === 'EMAIL_OUTLOOK') return 'bg-amber-100 text-amber-800'
  if (originKey === 'CHATBOT_WEB') return 'bg-emerald-100 text-emerald-800'
  if (originKey === 'FORM_WEB') return 'bg-sky-100 text-sky-800'
  if (originKey === 'WHATSAPP') return 'bg-green-100 text-green-800'
  if (originKey === 'LEAD_TIKTOK' || originKey === 'LEAD_YOUTUBE' || originKey === 'MESSENGER_FACEBOOK' || originKey === 'INSTAGRAM_DM') return 'bg-fuchsia-100 text-fuchsia-800'
  if (originKey === 'PHONE_CALL') return 'bg-orange-100 text-orange-800'
  if (originKey === 'REFERRAL') return 'bg-violet-100 text-violet-800'
  if (originKey === 'IMPORT') return 'bg-slate-200 text-slate-800'
  return 'bg-slate-100 text-slate-700'
}

function getOriginFilterGroup(originKey: CrmOriginKey): OriginFilter {
  if (originKey === 'EMAIL_GMAIL' || originKey === 'EMAIL_OUTLOOK') return 'EMAIL'
  if (originKey === 'FORM_WEB') return 'FORM'
  if (originKey === 'CHATBOT_WEB') return 'CHATBOT'
  if (originKey === 'WHATSAPP') return 'WHATSAPP'
  if (originKey === 'LEAD_TIKTOK' || originKey === 'LEAD_YOUTUBE' || originKey === 'MESSENGER_FACEBOOK' || originKey === 'INSTAGRAM_DM') return 'SOCIAL'
  if (originKey === 'PHONE_CALL') return 'PHONE'
  if (originKey === 'REFERRAL') return 'REFERRAL'
  if (originKey === 'IMPORT') return 'IMPORT'
  return 'ALL'
}

function getConversationSlaMeta(conversation: ConversationListItem | ConversationDetail, locale: string) {
  if (conversation.status === 'RESOLVED' || conversation.status === 'DISABLED' || conversation.status === 'SPAM') {
    return {
      state: 'paused' as const,
      label: 'SLA pausado',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
      elapsedLabel: 'Sin seguimiento activo',
    }
  }

  const lastMessageTime = new Date(conversation.lastMessageAt).getTime()
  const elapsedMinutes = Number.isNaN(lastMessageTime) ? 0 : Math.max(0, Math.floor((Date.now() - lastMessageTime) / 60000))
  const warningThreshold = conversation.unreadCount > 0 || !conversation.assignedTo ? 5 : 20
  const breachThreshold = conversation.unreadCount > 0 || !conversation.assignedTo ? 15 : 60

  let state: 'healthy' | 'warning' | 'breached' = 'healthy'
  if (elapsedMinutes >= breachThreshold) state = 'breached'
  else if (elapsedMinutes >= warningThreshold) state = 'warning'

  const elapsedLabel = elapsedMinutes < 1
    ? 'Actualizado ahora'
    : elapsedMinutes < 60
      ? `${elapsedMinutes} min sin respuesta`
      : new Intl.RelativeTimeFormat(locale.startsWith('es') ? 'es' : 'en', { numeric: 'auto' }).format(-Math.floor(elapsedMinutes / 60), 'hour')

  if (state === 'breached') {
    return { state, label: 'SLA vencido', className: 'border-rose-200 bg-rose-50 text-rose-700', elapsedLabel }
  }
  if (state === 'warning') {
    return { state, label: 'SLA en riesgo', className: 'border-amber-200 bg-amber-50 text-amber-700', elapsedLabel }
  }
  return { state, label: 'Dentro de SLA', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', elapsedLabel }
}

function getConversationPriorityMeta(conversation: ConversationListItem | ConversationDetail, locale: string) {
  const sla = getConversationSlaMeta(conversation, locale)
  if (sla.state === 'breached' || conversation.unreadCount >= 3 || (!conversation.assignedTo && conversation.status !== 'RESOLVED' && conversation.status !== 'DISABLED' && conversation.status !== 'SPAM')) {
    return { label: 'Prioridad alta', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  if (sla.state === 'warning' || conversation.unreadCount > 0 || conversation.status === 'PENDING' || conversation.status === 'BOT_ACTIVE') {
    return { label: 'Prioridad media', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  return { label: 'Prioridad baja', className: 'border-slate-200 bg-slate-50 text-slate-700' }
}

function getConversationStatusMeta(status: ConversationStatus) {
  switch (status) {
    case 'OPEN':
      return { label: 'Nuevo', className: 'border-sky-200 bg-sky-50 text-sky-700' }
    case 'BOT_ACTIVE':
      return { label: 'Bot atendiendo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    case 'HUMAN_ACTIVE':
      return { label: 'En gestión', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' }
    case 'PENDING':
      return { label: 'Esperando cliente', className: 'border-amber-200 bg-amber-50 text-amber-700' }
    case 'DISABLED':
      return { label: 'Pausada', className: 'border-slate-300 bg-slate-50 text-slate-600' }
    case 'RESOLVED':
      return { label: 'Resuelto', className: 'border-slate-200 bg-slate-100 text-slate-700' }
    case 'SPAM':
      return { label: 'Spam', className: 'border-rose-200 bg-rose-50 text-rose-700' }
    default:
      return { label: status, className: 'border-slate-200 bg-slate-50 text-slate-700' }
  }
}

function getConversationOperationalRank(conversation: ConversationListItem | ConversationDetail, locale: string) {
  const sla = getConversationSlaMeta(conversation, locale)
  const priority = getConversationPriorityMeta(conversation, locale)

  let score = 0
  if (sla.state === 'breached') score += 100
  else if (sla.state === 'warning') score += 50

  if (priority.label === 'Prioridad alta') score += 40
  else if (priority.label === 'Prioridad media') score += 20

  if (!conversation.assignedTo && conversation.status !== 'RESOLVED' && conversation.status !== 'DISABLED' && conversation.status !== 'SPAM') score += 35
  if (conversation.unreadCount > 0) score += Math.min(conversation.unreadCount, 5) * 5
  if (conversation.status === 'BOT_ACTIVE') score += 18
  if (conversation.status === 'OPEN') score += 12
  if (conversation.status === 'PENDING') score -= 8

  const lastMessageAt = new Date(conversation.lastMessageAt).getTime()
  const timestamp = Number.isNaN(lastMessageAt) ? 0 : lastMessageAt

  return { score, timestamp, slaState: sla.state, priorityLabel: priority.label }
}

function getRecentPhoneOutboundGuard(messages: ConversationMessage[]) {
  const recentOutboundMessages = [...messages]
    .filter((message) => message.direction === 'OUTBOUND')
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())

  const latestOutbound = recentOutboundMessages[0] ?? null
  if (!latestOutbound || getMessageOrigin(latestOutbound) !== 'PHONE_APP') return null
  if (!hasMessageCollision(latestOutbound)) return null

  const elapsedMs = Date.now() - new Date(latestOutbound.occurredAt).getTime()
  if (Number.isNaN(elapsedMs) || elapsedMs > 5 * 60 * 1000) return null

  return {
    messageId: latestOutbound.id,
    occurredAt: latestOutbound.occurredAt,
    bodyText: latestOutbound.bodyText,
    hasCollision: hasMessageCollision(latestOutbound),
  }
}

function OriginChip({ originKey, label }: { originKey: CrmOriginKey; label: string }) {
  const Icon = originKey === 'EMAIL_GMAIL' || originKey === 'EMAIL_OUTLOOK'
    ? Mail
    : originKey === 'FORM_WEB'
      ? FileText
      : originKey === 'CHATBOT_WEB'
        ? Bot
        : originKey === 'PHONE_CALL'
          ? PhoneCall
          : MessageCircle

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getOriginTone(originKey)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function formatConversationEntrySource(channel: Channel) {
  if (channel.provider === 'WEB_FORM') {
    if (channel.bridgeKind === 'GMAIL') return 'Correo Gmail'
    if (channel.bridgeKind === 'OUTLOOK') return 'Correo Outlook'
    if (channel.bridgeKind === 'TIKTOK') return 'Lead TikTok'
    if (channel.bridgeKind === 'YOUTUBE') return 'Lead YouTube'
    return 'Formulario web'
  }

  if (channel.provider === 'WEB_CHATBOT') return 'Chatbot web'
  return formatRelativeChannel(channel.provider)
}

function formatConversationEntryTone(channel: Channel) {
  if (channel.provider === 'WEB_FORM' && (channel.bridgeKind === 'GMAIL' || channel.bridgeKind === 'OUTLOOK')) {
    return 'bg-amber-100 text-amber-800'
  }
  if (channel.provider === 'WEB_CHATBOT') {
    return 'bg-emerald-100 text-emerald-800'
  }
  if (channel.provider === 'WEB_FORM') {
    return 'bg-sky-100 text-sky-800'
  }
  return 'bg-slate-100 text-slate-700'
}

function getConversationSentimentMeta(sentiment: ConversationAiSuggestion['sentiment']) {
  if (sentiment === 'POSITIVE') return { label: 'Interés alto', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  if (sentiment === 'NEGATIVE') return { label: 'Riesgo', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  return { label: 'Neutral', className: 'border-slate-200 bg-slate-50 text-slate-700' }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function pickStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function formatMoney(value: number | null | undefined, locale: string) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value))
}

function getMaterialPrice(material: MaterialLookupItem) {
  return material.precioUnidad ?? material.precioMetro ?? material.precioM2 ?? null
}

function getVisibleStock(material: MaterialLookupItem) {
  const warehouseStock = material.stocks?.[0]?.quantity
  if (Number.isFinite(warehouseStock)) return Number(warehouseStock)
  if (Number.isFinite(material.stockActual)) return Number(material.stockActual)
  return 0
}

function renderHighlightedText(text: string | null | undefined, query: string, className = 'bg-amber-100 text-amber-950') {
  const source = text ?? ''
  const term = query.trim()
  if (!term) return source

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(`(${escapedTerm})`, 'ig')
  const lowerTerm = term.toLowerCase()
  const parts = source.split(matcher)

  return parts.map((part, index) => (
    part.toLowerCase() === lowerTerm
      ? <mark key={`${part}-${index}`} className={className}>{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ))
}

export function CrmConversationsClient(props: CrmConversationsClientProps) {
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = '—'
  const searchParams = useSearchParams()
  const requestedConversationId = (searchParams?.get('conversationId') || '').trim() || null
  const selectedConversationIdRef = useRef<string | null>(null)
  const conversationThreadViewportRef = useRef<HTMLDivElement | null>(null)
  const lastConversationMessageRef = useRef<HTMLDivElement | null>(null)
  const liveRefreshInFlightRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ConversationStatus>('ALL')
  const [inboxStatusTab, setInboxStatusTab] = useState<InboxStatusTab>('PENDING')
  const [datePreset, setDatePreset] = useState<InboxDatePreset>('7D')
  const [assignedFilter, setAssignedFilter] = useState<'ALL' | string>('ALL')
  const [channelFilter, setChannelFilter] = useState<'ALL' | string>('ALL')
  const [providerFilter, setProviderFilter] = useState<'ALL' | ChannelProvider>(props.initialProviderFilter ?? 'ALL')
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL')
  const [queueScope, setQueueScope] = useState<QueueScope>('TEAM')
  const [queueFocus, setQueueFocus] = useState<QueueFocus>('ALL')
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null)
  const { mutedCrmConversationIds, setMutedCrmConversationIds } = useChatMutePreferences()
  const [conversationAi, setConversationAi] = useState<ConversationAiSuggestion | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  const [assigning, setAssigning] = useState(false)
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [creatingAiTask, setCreatingAiTask] = useState(false)
  const [creatingAiOpportunity, setCreatingAiOpportunity] = useState(false)
  const [aiTaskDialogOpen, setAiTaskDialogOpen] = useState(false)
  const [aiTaskDraft, setAiTaskDraft] = useState<AiTaskDraft>({
    title: '',
    description: '',
    priority: 'NORMAL',
    dueAt: '',
    assignedToUserId: '__none__',
  })
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const [newConversationMode, setNewConversationMode] = useState<NewConversationMode>('CLIENTE')
  const [openingConversation, setOpeningConversation] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClienteOption[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [manualConversationName, setManualConversationName] = useState('')
  const [manualConversationPhone, setManualConversationPhone] = useState('')
  const [liveMode, setLiveMode] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialResults, setMaterialResults] = useState<MaterialLookupItem[]>([])
  const [materialLoading, setMaterialLoading] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialLookupItem | null>(null)
  const [interestNotes, setInterestNotes] = useState('')
  const [savingInterest, setSavingInterest] = useState(false)
  const [dailyCallsAddon, setDailyCallsAddon] = useState<DailyCallsAddonState | null>(null)
  const [callDialogOpen, setCallDialogOpen] = useState(false)
  const [preparingCall, setPreparingCall] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)
  const [preparedCallSession, setPreparedCallSession] = useState<PreparedCallSession | null>(null)
  const [callState, setCallState] = useState<'BOOTING' | 'JOINING' | 'JOINED' | 'LEFT' | 'ERROR'>('BOOTING')
  const [callInvitePreview, setCallInvitePreview] = useState<CallInvitePreview | null>(null)
  const [callDialogType, setCallDialogType] = useState<'video' | 'audio'>('audio')

  const [assigneeDraft, setAssigneeDraft] = useState('__none__')
  const [statusDraft, setStatusDraft] = useState<ConversationStatus>('OPEN')
  const [messageDraft, setMessageDraft] = useState('')
  const [messageTypeDraft, setMessageTypeDraft] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'>('TEXT')
  const [attachmentUrlDraft, setAttachmentUrlDraft] = useState('')
  const [attachmentNameDraft, setAttachmentNameDraft] = useState('')
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null)
  const [audioRecordingIssue, setAudioRecordingIssue] = useState<string | null>(null)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [hybridOverrideConfirmed, setHybridOverrideConfirmed] = useState(false)
  const [editingConversationName, setEditingConversationName] = useState(false)
  const [conversationNameDraft, setConversationNameDraft] = useState('')
  const [savingConversationName, setSavingConversationName] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const [simulateForm, setSimulateForm] = useState({
    channelConnectionId: '',
    nombre: '',
    email: '',
    telefono: '',
    empresaNombre: '',
    ciudad: '',
    documento: '',
    message: '',
    sourceCampaign: '',
    sourceMedium: '',
    sourceContent: '',
  })

  async function loadConversationStarterOptions() {
    const [leadRes, clientRes] = await Promise.all([
      requestJson<LeadOption[]>(`/api/crm/leads${leadSearch.trim() ? `?search=${encodeURIComponent(leadSearch.trim())}` : ''}`),
      requestJson<ClienteOption[]>(`/api/clientes${clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : ''}`),
    ])

    setLeadOptions(Array.isArray(leadRes.data) ? leadRes.data.slice(0, 12) : [])
    setClientOptions(Array.isArray(clientRes.data) ? clientRes.data.slice(0, 12) : [])
  }

  function resetNewConversationForm() {
    setNewConversationMode('CLIENTE')
    setLeadSearch('')
    setClientSearch('')
    setSelectedLeadId('')
    setSelectedClientId('')
    setManualConversationName('')
    setManualConversationPhone('')
  }

  const resetAttachmentComposer = useCallback(() => {
    if (recordingAudio) {
      stopAudioRecording()
    }

    setMessageTypeDraft('TEXT')
    setAttachmentUrlDraft('')
    setAttachmentNameDraft('')
    setAudioRecordingIssue(null)
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
  }, [recordingAudio])

  async function startNewConversation() {
    const payload = newConversationMode === 'CLIENTE'
      ? selectedClientId ? { clienteId: selectedClientId } : null
      : newConversationMode === 'LEAD'
        ? selectedLeadId ? { leadId: selectedLeadId } : null
        : manualConversationPhone.trim()
          ? { contactDisplayName: manualConversationName.trim() || null, contactPhone: manualConversationPhone.trim() }
          : null

    if (!payload) {
      alert(newConversationMode === 'CLIENTE'
        ? 'Selecciona un cliente para iniciar la conversación.'
        : newConversationMode === 'LEAD'
          ? 'Selecciona un prospecto para iniciar la conversación.'
          : 'Debes ingresar un número de WhatsApp válido.')
      return
    }

    setOpeningConversation(true)
    try {
      const json = await requestJson<{ conversationId: string; created: boolean }>('/api/crm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!json.success || !json.data?.conversationId) {
        alert(json.error || 'No se pudo iniciar la conversación.')
        return
      }

      setInboxStatusTab('PENDING')
      setSelectedConversationId(json.data.conversationId)
      setNewConversationOpen(false)
      resetNewConversationForm()
      await loadConversations()
    } finally {
      setOpeningConversation(false)
    }
  }

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (assignedFilter !== 'ALL') params.set('assignedToUserId', assignedFilter)
      if (channelFilter !== 'ALL') params.set('channelConnectionId', channelFilter)
      if (providerFilter !== 'ALL') params.set('provider', providerFilter)

      const suffix = params.toString() ? `?${params.toString()}` : ''
      const json = await requestJson<ConversationListItem[]>(`/api/crm/conversations${suffix}`)
      const rows = Array.isArray(json.data) ? json.data : []
      setConversations(rows)
      setSelectedConversationId((current) => {
        if (requestedConversationId && rows.some((row) => row.id === requestedConversationId)) {
          return requestedConversationId
        }
        return current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null
      })
      setLastRefreshAt(new Date().toISOString())
    } finally {
      setLoading(false)
    }
  }, [assignedFilter, channelFilter, providerFilter, requestedConversationId, search, statusFilter])

  const loadMeta = useCallback(async () => {
    const [meRes, assigneeRes, channelRes] = await Promise.all([
      requestJson<{ id: string }>('/api/me'),
      requestJson<Assignee[]>('/api/crm/assignees'),
      requestJson<Channel[]>('/api/crm/channels'),
    ])
    setCurrentUserId(meRes.data?.id ?? null)
    setAssignees(Array.isArray(assigneeRes.data) ? assigneeRes.data : [])
    setChannels(Array.isArray(channelRes.data) ? channelRes.data : [])
    setSimulateForm((prev) => ({
      ...prev,
      channelConnectionId: prev.channelConnectionId || (Array.isArray(channelRes.data) ? channelRes.data[0]?.id || '' : ''),
    }))
  }, [])

  const loadDailyCallsAddon = useCallback(async () => {
    const json = await requestJson<DailyCallsAddonState>('/api/crm/addons/DAILY_CALLS')
    setDailyCallsAddon(json.success && json.data ? json.data : null)
  }, [])

  const loadDetail = useCallback(async (conversationId: string) => {
    setDetailLoading(true)
    try {
      const json = await requestJson<ConversationDetail>(`/api/crm/conversations/${conversationId}`)
      const row = json.success && json.data ? json.data : null
      setSelectedConversation(row)
      setAssigneeDraft(row?.assignedTo?.id || '__none__')
      setStatusDraft(row?.status || 'OPEN')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadConversationAi = useCallback(async (conversationId: string, options?: { silent?: boolean }) => {
    setGeneratingAi(true)
    try {
      const json = await requestJson<ConversationAiSuggestion>(`/api/crm/conversations/${conversationId}/ai`)
      if (selectedConversationIdRef.current !== conversationId) return
      if (!json.success || !json.data) {
        if (!options?.silent) {
          alert(json.error || 'No se pudo generar la sugerencia IA.')
        }
        return
      }
      setConversationAi(json.data)
    } finally {
      if (selectedConversationIdRef.current === conversationId) {
        setGeneratingAi(false)
      }
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadConversations(), loadMeta(), loadDailyCallsAddon()])
  }, [loadConversations, loadDailyCallsAddon, loadMeta])

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
    if (!selectedConversationId) {
      setSelectedConversation(null)
      return
    }
    void loadDetail(selectedConversationId)
  }, [loadDetail, selectedConversationId])

  useEffect(() => {
    if (!liveMode) return

    const runLiveRefresh = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (liveRefreshInFlightRef.current) return

      liveRefreshInFlightRef.current = true
      try {
        await loadConversations()
        if (selectedConversationIdRef.current) {
          await loadDetail(selectedConversationIdRef.current)
        }
      } finally {
        liveRefreshInFlightRef.current = false
      }
    }

    const interval = window.setInterval(() => {
      void runLiveRefresh()
    }, 8000)

    return () => window.clearInterval(interval)
  }, [liveMode, loadConversations, loadDetail])

  useEffect(() => {
    setMaterialSearch('')
    setMaterialResults([])
    setSelectedMaterial(null)
    setInterestNotes('')
    setConversationAi(null)
    setPreparedCallSession(null)
    setCallError(null)
    setCallInvitePreview(null)
    setEditingConversationName(false)
    setConversationNameDraft('')
  }, [selectedConversationId])

  useEffect(() => {
    if (!selectedConversation) return
    setConversationNameDraft(selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || '')
  }, [selectedConversation])

  useEffect(() => {
    if (!selectedConversation) return

    const scrollToLatestMessage = () => {
      if (lastConversationMessageRef.current) {
        lastConversationMessageRef.current.scrollIntoView({ block: 'end', behavior: 'auto' })
        return
      }

      if (conversationThreadViewportRef.current) {
        conversationThreadViewportRef.current.scrollTop = conversationThreadViewportRef.current.scrollHeight
      }
    }

    const frame = window.requestAnimationFrame(scrollToLatestMessage)
    return () => window.cancelAnimationFrame(frame)
  }, [selectedConversation?.id, selectedConversation?.messages.length])

  async function openCallDialog(callType: 'video' | 'audio') {
    setCallDialogType(callType)
    setCallDialogOpen(true)
    setPreparedCallSession(null)
    setCallError(null)
    setCallState('BOOTING')

    if (!selectedConversation) {
      setCallError('Selecciona una conversación antes de abrir la llamada.')
      return
    }

    if (!dailyCallsAddon?.enabled) {
      setCallError('El addon Daily está inactivo para esta empresa. Actívalo en Integraciones CRM.')
      return
    }

    if (!dailyCallsAddon.ready) {
      setCallError(dailyCallsAddon.validation.message || 'El addon Daily todavía no está listo para abrir llamadas.')
      return
    }

    setPreparingCall(true)
    try {
      const json = await requestJson<PreparedCallSession>(`/api/crm/conversations/${selectedConversation.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType, sendWhatsappInvite: callType === 'video' }),
      })

      if (!json.success || !json.data) {
        setCallError(json.error || 'No se pudo preparar la sesión de llamada.')
        return
      }

      setPreparedCallSession(json.data)
    } finally {
      setPreparingCall(false)
    }
  }

  const stats = useMemo(() => {
    const openCount = conversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'DISABLED' && item.status !== 'SPAM').length
    const unassignedCount = conversations.filter((item) => !item.assignedTo).length
    const unreadCount = conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0)
    const slaBreachedCount = conversations.filter((item) => getConversationSlaMeta(item, locale).state === 'breached').length
    const highPriorityCount = conversations.filter((item) => getConversationPriorityMeta(item, locale).label === 'Prioridad alta').length
    return { openCount, unassignedCount, unreadCount, slaBreachedCount, highPriorityCount }
  }, [conversations, locale])

  const queueSummary = useMemo(() => {
    const mineCount = currentUserId ? conversations.filter((item) => item.assignedTo?.id === currentUserId).length : 0
    const unassignedCount = conversations.filter((item) => !item.assignedTo).length
    return {
      teamCount: conversations.length,
      mineCount,
      unassignedCount,
    }
  }, [conversations, currentUserId])

  const configuredSidebarProviders = useMemo(() => {
    const supportedProviders: ChannelProvider[] = ['WHATSAPP_CLOUD', 'MESSENGER', 'INSTAGRAM_DM', 'FACEBOOK_PAGE', 'WEB_CHATBOT', 'WEB_FORM']
    const activeProviderSet = new Set<ChannelProvider>()

    channels.forEach((channel) => {
      if (channel.status === 'DRAFT') return
      if (supportedProviders.includes(channel.provider)) {
        activeProviderSet.add(channel.provider)
      }
    })

    return supportedProviders.filter((provider) => activeProviderSet.has(provider))
  }, [channels])

  const advisorSummary = useMemo(() => {
    return [...assignees].sort((left, right) => {
      const leftImmediate = left.immediateCount ?? 0
      const rightImmediate = right.immediateCount ?? 0
      if (leftImmediate !== rightImmediate) return rightImmediate - leftImmediate

      const leftActive = left.activeCount ?? 0
      const rightActive = right.activeCount ?? 0
      if (leftActive !== rightActive) return rightActive - leftActive

      const leftUnread = left.unreadCount ?? 0
      const rightUnread = right.unreadCount ?? 0
      if (leftUnread !== rightUnread) return rightUnread - leftUnread

      return formatAssigneeName(left).localeCompare(formatAssigneeName(right), 'es')
    })
  }, [assignees])

  const queueScopedConversations = useMemo(() => {
    const sortByOperationalPriority = (items: ConversationListItem[]) => [...items].sort((left, right) => {
      const leftRank = getConversationOperationalRank(left, locale)
      const rightRank = getConversationOperationalRank(right, locale)
      if (leftRank.timestamp !== rightRank.timestamp) return rightRank.timestamp - leftRank.timestamp
      return rightRank.score - leftRank.score
    })

    if (queueScope === 'MINE') {
      if (!currentUserId) return []
      return sortByOperationalPriority(conversations.filter((item) => item.assignedTo?.id === currentUserId))
    }

    if (queueScope === 'UNASSIGNED') {
      return sortByOperationalPriority(conversations.filter((item) => !item.assignedTo))
    }

    return sortByOperationalPriority(conversations)
  }, [conversations, currentUserId, locale, queueScope])

  const queueFocusSummary = useMemo(() => {
    const immediateCount = queueScopedConversations.filter((item) => {
      const sla = getConversationSlaMeta(item, locale)
      const priority = getConversationPriorityMeta(item, locale)
      return sla.state === 'breached' || priority.label === 'Prioridad alta'
    }).length
    const waitingCustomerCount = queueScopedConversations.filter((item) => item.status === 'PENDING').length
    const newUnassignedCount = queueScopedConversations.filter((item) => !item.assignedTo && item.status === 'OPEN').length
    const botHandoffCount = queueScopedConversations.filter((item) => item.status === 'BOT_ACTIVE').length
    const hybridPhoneActivityCount = queueScopedConversations.filter((item) => getConversationListSignal(item).hasPhoneActivity).length
    const hybridCollisionCount = queueScopedConversations.filter((item) => getConversationListSignal(item).hasCollision).length

    return {
      allCount: queueScopedConversations.length,
      immediateCount,
      waitingCustomerCount,
      newUnassignedCount,
      botHandoffCount,
      hybridPhoneActivityCount,
      hybridCollisionCount,
    }
  }, [locale, queueScopedConversations])

  const visibleConversations = useMemo(() => {
    const focusFiltered = queueScopedConversations.filter((item) => {
      if (queueFocus === 'ALL') return true
      if (queueFocus === 'IMMEDIATE') {
        const sla = getConversationSlaMeta(item, locale)
        const priority = getConversationPriorityMeta(item, locale)
        return sla.state === 'breached' || priority.label === 'Prioridad alta'
      }
      if (queueFocus === 'WAITING_CUSTOMER') return item.status === 'PENDING'
      if (queueFocus === 'NEW_UNASSIGNED') return !item.assignedTo && item.status === 'OPEN'
      if (queueFocus === 'BOT_HANDOFF') return item.status === 'BOT_ACTIVE'
      if (queueFocus === 'HYBRID_PHONE_ACTIVITY') return getConversationListSignal(item).hasPhoneActivity
      if (queueFocus === 'HYBRID_COLLISION') return getConversationListSignal(item).hasCollision
      return true
    })

    if (originFilter === 'ALL') return focusFiltered
    return focusFiltered.filter((item) => getOriginFilterGroup(getConversationOrigin(item.channelConnection).key) === originFilter)
  }, [locale, originFilter, queueFocus, queueScopedConversations])

  const dateScopedConversations = useMemo(() => {
    return visibleConversations.filter((item) => isConversationWithinDatePreset(item.lastMessageAt, datePreset))
  }, [datePreset, visibleConversations])

  const inboxStatusCounts = useMemo(() => {
    const pendingCount = dateScopedConversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'DISABLED' && item.status !== 'SPAM').length
    const resolvedCount = dateScopedConversations.filter((item) => item.status === 'RESOLVED' || item.status === 'DISABLED').length
    return {
      pendingCount,
      resolvedCount,
      allCount: dateScopedConversations.length,
    }
  }, [dateScopedConversations])

  const displayedConversations = useMemo(() => {
    if (inboxStatusTab === 'ALL') return dateScopedConversations
    if (inboxStatusTab === 'RESOLVED') return dateScopedConversations.filter((item) => item.status === 'RESOLVED' || item.status === 'DISABLED')
    return dateScopedConversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'DISABLED' && item.status !== 'SPAM')
  }, [dateScopedConversations, inboxStatusTab])

  useEffect(() => {
    setQueueFocus('ALL')
  }, [queueScope])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    setSelectedConversationId((current) => current && displayedConversations.some((item) => item.id === current) ? current : displayedConversations[0]?.id ?? null)
  }, [displayedConversations])

  useEffect(() => {
    if (!newConversationOpen) return
    void loadConversationStarterOptions()
  }, [clientSearch, leadSearch, newConversationOpen])

  function toggleMuteSelectedConversation() {
    if (!selectedConversationId) return
    setMutedCrmConversationIds((current) => current.includes(selectedConversationId)
      ? current.filter((item) => item !== selectedConversationId)
      : [...current, selectedConversationId])
  }

  async function submitAssign() {
    if (!selectedConversation) return
    setAssigning(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToUserId: assigneeDraft === '__none__' ? null : assigneeDraft,
          status: statusDraft,
        }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo actualizar la atención de la conversación.')
        return
      }
      await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
    } finally {
      setAssigning(false)
    }
  }

  async function takeConversation(conversationId: string) {
    if (!currentUserId) return
    setAssigning(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToUserId: currentUserId,
          status: 'HUMAN_ACTIVE',
        }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo tomar la conversación.')
        return
      }
      await Promise.all([
        loadConversations(),
        selectedConversationId === conversationId ? loadDetail(conversationId) : Promise.resolve(),
      ])
    } finally {
      setAssigning(false)
    }
  }

  async function submitMessage() {
    if (!selectedConversation) return
    const requiresAttachment = messageTypeDraft === 'IMAGE' || messageTypeDraft === 'AUDIO' || messageTypeDraft === 'DOCUMENT'
    if (hybridComposerGuard && !hybridOverrideConfirmed) {
      alert('Hay actividad reciente desde el celular. Confirma primero en el composer que revisaste esa intervención antes de enviar desde el CRM.')
      return
    }
    if (messageTypeDraft === 'TEXT' && !messageDraft.trim()) {
      alert('Escribe un mensaje antes de enviar.')
      return
    }
    if (requiresAttachment && !attachmentUrlDraft.trim()) {
      alert('Debes indicar la URL del archivo multimedia.')
      return
    }

    setSending(true)
    try {
      const sendMessageRequest = (forceHybridOverride = false) => requestJson<ConversationMessage>(`/api/crm/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyText: messageDraft,
          messageType: messageTypeDraft,
          attachments: requiresAttachment
            ? [{ type: messageTypeDraft, url: attachmentUrlDraft, filename: attachmentNameDraft || null }]
            : [],
          forceHybridOverride: forceHybridOverride || hybridOverrideConfirmed,
        }),
      }) as Promise<SendMessageResponse>

      let json = await sendMessageRequest(false)
      if (!json.success && json.code === 'HYBRID_RECENT_PHONE_ACTIVITY') {
        const shouldOverride = window.confirm(`${json.error || 'Parece que ya hubo respuestas cruzadas en esta conversación.'}\n\n${json.recentPhoneActivity ? formatRecentPhoneActivityHint(json.recentPhoneActivity, locale, naText) : 'Revisa el hilo antes de responder.'}\n\nPulsa Aceptar para enviar de todas formas desde el CRM.`)
        if (!shouldOverride) {
          return
        }
        json = await sendMessageRequest(true)
      }

      if (!json.success) {
        if (json.data) {
          await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
        }
        alert(json.error || 'No se pudo registrar el mensaje.')
        return
      }
      setMessageDraft('')
      setMessageTypeDraft('TEXT')
      resetAttachmentComposer()
      await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
    } finally {
      setSending(false)
    }
  }

  function openAttachmentPicker() {
    if (!attachmentInputRef.current || !selectedConversation || uploadingAttachment) return
    attachmentInputRef.current.accept = mapDraftMessageTypeToAttachmentAccept(messageTypeDraft)
    attachmentInputRef.current.value = ''
    attachmentInputRef.current.click()
  }

  async function uploadConversationAttachment(file: File) {
    if (!selectedConversation) {
      alert('Selecciona una conversación antes de subir adjuntos.')
      return
    }

    setUploadingAttachment(true)
    setAttachmentUploadProgress(0)
    try {
      const json = await uploadFileWithProgress<UploadedConversationAttachment>({
        url: `/api/crm/conversations/${selectedConversation.id}/attachments`,
        file,
        onProgress: (progress) => setAttachmentUploadProgress(progress),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo subir el adjunto.')
        return
      }

      setAttachmentUrlDraft(json.data.url)
      setAttachmentNameDraft(json.data.name)
      setMessageTypeDraft(mapUploadedAttachmentTypeToMessageType(json.data.type))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo subir el adjunto.')
    } finally {
      setUploadingAttachment(false)
      setAttachmentUploadProgress(null)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
    }
  }

  async function handleAttachmentInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadConversationAttachment(file)
  }

  async function startAudioRecording() {
    if (!selectedConversation) {
      alert('Selecciona una conversación antes de grabar audio.')
      return
    }
    if (recordingAudio || uploadingAttachment) return
    const blocker = await getAudioRecordingBlocker()
    if (blocker) {
      setAudioRecordingIssue(blocker)
      alert(blocker)
      return
    }

    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      const selectedMimeType = preferredMimeTypes.find((mimeType) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType))
      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.addEventListener('dataavailable', (recordedEvent) => {
        if (recordedEvent.data.size > 0) {
          chunks.push(recordedEvent.data)
        }
      })

      recorder.addEventListener('stop', () => {
        const outputMimeType = recorder.mimeType || selectedMimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: outputMimeType })
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        setRecordingAudio(false)
        if (blob.size === 0) return
        const extension = inferAudioExtension(outputMimeType)
        const file = new File([blob], `nota-voz-${Date.now()}${extension}`, { type: outputMimeType })
        void uploadConversationAttachment(file)
      })

      recorder.start()
      setMessageTypeDraft('AUDIO')
      setAudioRecordingIssue(null)
      setRecordingAudio(true)
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      setRecordingAudio(false)
      const message = formatAudioRecordingError(error)
      setAudioRecordingIssue(message)
      alert(message)
    }
  }

  function stopAudioRecording() {
    if (!recordingAudio) return
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    setRecordingAudio(false)
  }

  function handleLibraryAttachment(item: CrmFileItem) {
    const attachment = mapLibraryItemToConversationAttachment(item)
    setAttachmentUrlDraft(attachment.url)
    setAttachmentNameDraft(attachment.name)
    setMessageTypeDraft(attachment.messageType)
  }

  async function resolveConversation() {
    if (!selectedConversation) return
    setResolving(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}/resolve`, { method: 'POST' })
      if (!json.success) {
        alert(json.error || 'No se pudo resolver la conversación.')
        return
      }
      await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
    } finally {
      setResolving(false)
    }
  }

  async function updateConversationAction(action: 'report' | 'disable') {
    if (!selectedConversation) return

    const confirmMessage = action === 'report'
      ? 'Esta conversación se marcará como reportada y pasará a SPAM. ¿Deseas continuar?'
      : 'Esta conversación se deshabilitará temporalmente y quedará resuelta. ¿Deseas continuar?'

    if (!window.confirm(confirmMessage)) return

    const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la conversación.')
      return
    }

    await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
  }

  async function deleteConversationPermanently() {
    if (!selectedConversation) return
    if (!window.confirm('Esta acción eliminará la conversación definitivamente. No se puede deshacer. ¿Deseas continuar?')) return

    const deletedConversationId = selectedConversation.id
    const json = await requestJson(`/api/crm/conversations/${deletedConversationId}`, { method: 'DELETE' })
    if (!json.success) {
      alert(json.error || 'No se pudo eliminar la conversación.')
      return
    }

    setSelectedConversation(null)
    setSelectedConversationId(null)
    await loadConversations()
  }

  async function saveConversationName() {
    if (!selectedConversation) return
    const trimmed = conversationNameDraft.trim()
    if (!trimmed) {
      alert('Escribe un nombre antes de guardar.')
      return
    }

    setSavingConversationName(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name: trimmed }),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo actualizar el nombre.')
        return
      }

      setEditingConversationName(false)
      await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
    } finally {
      setSavingConversationName(false)
    }
  }

  async function createTaskFromAiSuggestion() {
    if (!selectedConversation || !conversationAi) return

    const relationPayload = selectedConversation.opportunity
      ? { opportunityId: selectedConversation.opportunity.id }
      : selectedConversation.lead
        ? { leadId: selectedConversation.lead.id }
        : selectedConversation.cliente
          ? { clienteId: selectedConversation.cliente.id }
          : null

    if (!relationPayload) {
      alert('La conversación aún no tiene lead, cliente u oportunidad para crear una tarea vinculada.')
      return
    }

    setAiTaskDraft({
      title: conversationAi.taskSuggestion.title,
      description: conversationAi.taskSuggestion.description,
      priority: conversationAi.taskSuggestion.priority,
      dueAt: conversationAi.taskSuggestion.dueAt ? conversationAi.taskSuggestion.dueAt.slice(0, 16) : '',
      assignedToUserId: conversationAi.taskSuggestion.assignedToUserId || selectedConversation.assignedTo?.id || currentUserId || '__none__',
    })
    setAiTaskDialogOpen(true)
  }

  async function submitAiTaskSuggestion() {
    if (!selectedConversation || !conversationAi) return

    const relationPayload = selectedConversation.opportunity
      ? { opportunityId: selectedConversation.opportunity.id }
      : selectedConversation.lead
        ? { leadId: selectedConversation.lead.id }
        : selectedConversation.cliente
          ? { clienteId: selectedConversation.cliente.id }
          : null

    if (!relationPayload) {
      alert('La conversación aún no tiene lead, cliente u oportunidad para crear una tarea vinculada.')
      return
    }

    if (!aiTaskDraft.title.trim()) {
      alert('Debes indicar un título para la tarea.')
      return
    }

    setCreatingAiTask(true)
    try {
      const json = await requestJson('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiTaskDraft.title.trim(),
          description: aiTaskDraft.description.trim(),
          priority: aiTaskDraft.priority,
          dueAt: aiTaskDraft.dueAt ? new Date(aiTaskDraft.dueAt).toISOString() : null,
          assignedToUserId: aiTaskDraft.assignedToUserId === '__none__' ? null : aiTaskDraft.assignedToUserId,
          aiAudit: {
            auditEntryId: conversationAi.auditEntryId || null,
            conversationId: selectedConversation.id,
            originalTaskSuggestion: conversationAi.taskSuggestion,
          },
          ...relationPayload,
        }),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo crear la tarea desde la sugerencia IA.')
        return
      }

      setAiTaskDialogOpen(false)
      await Promise.all([
        loadConversations(),
        loadDetail(selectedConversation.id),
        loadConversationAi(selectedConversation.id, { silent: true }),
      ])
    } finally {
      setCreatingAiTask(false)
    }
  }

  async function createOpportunityFromAiSuggestion() {
    if (!selectedConversation || !conversationAi) return
    if (selectedConversation.opportunity) {
      alert('La conversación ya tiene una oportunidad vinculada.')
      return
    }
    if (!selectedConversation.lead && !selectedConversation.cliente) {
      alert('Necesitas un lead o cliente asociado para pasar esta conversación a oportunidad.')
      return
    }

    const contactLabel = selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'contacto CRM'

    setCreatingAiOpportunity(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}/create-opportunity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Oportunidad IA · ${contactLabel}`,
          description: conversationAi.summary,
          stage: 'NEW',
        }),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo crear la oportunidad desde la sugerencia IA.')
        return
      }

      await Promise.all([
        loadConversations(),
        loadDetail(selectedConversation.id),
        loadConversationAi(selectedConversation.id, { silent: true }),
      ])
    } finally {
      setCreatingAiOpportunity(false)
    }
  }

  async function runSimulation() {
    if (!simulateForm.channelConnectionId) {
      alert('Selecciona un canal para simular.')
      return
    }
    setSimulating(true)
    try {
      const json = await requestJson(`/api/crm/conversations/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulateForm),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo simular el inbound.')
        return
      }
      setSimulatorOpen(false)
      setSimulateForm((prev) => ({ ...prev, nombre: '', email: '', telefono: '', empresaNombre: '', ciudad: '', documento: '', message: '', sourceCampaign: '', sourceMedium: '', sourceContent: '' }))
      await loadConversations()
    } finally {
      setSimulating(false)
    }
  }

  async function searchMaterials() {
    if (!materialSearch.trim()) {
      setMaterialResults([])
      return
    }

    setMaterialLoading(true)
    try {
      const params = new URLSearchParams({
        search: materialSearch.trim(),
        activo: 'true',
        sort: 'stockDesc',
        pageSize: '6',
      })
      const json = await requestJson<MaterialLookupItem[]>(`/api/materiales?${params.toString()}`)
      setMaterialResults(Array.isArray(json.data) ? json.data : [])
    } finally {
      setMaterialLoading(false)
    }
  }

  async function saveInterestSelection() {
    if (!selectedConversation) return
    if (!selectedMaterial && !interestNotes.trim()) {
      alert('Selecciona un producto o escribe el interés consignado.')
      return
    }

    const relationPayload = selectedConversation.opportunity
      ? { opportunityId: selectedConversation.opportunity.id }
      : selectedConversation.lead
        ? { leadId: selectedConversation.lead.id }
        : selectedConversation.cliente
          ? { clienteId: selectedConversation.cliente.id }
          : null

    if (!relationPayload) {
      alert('Esta conversación aún no tiene un lead, cliente u oportunidad asociada para consignar el interés.')
      return
    }

    const stock = selectedMaterial ? getVisibleStock(selectedMaterial) : null
    const price = selectedMaterial ? getMaterialPrice(selectedMaterial) : null

    setSavingInterest(true)
    try {
      const json = await requestJson('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...relationPayload,
          type: 'NOTE',
          summary: selectedMaterial ? `Interés comercial registrado: ${selectedMaterial.nombre}` : 'Interés comercial registrado desde conversación',
          details: [
            selectedMaterial ? `Producto: ${selectedMaterial.nombre}` : null,
            selectedMaterial?.categoria ? `Categoría: ${selectedMaterial.categoria}` : null,
            selectedMaterial?.proveedor ? `Proveedor: ${selectedMaterial.proveedor}` : null,
            stock !== null ? `Stock visible: ${stock}` : null,
            price !== null ? `Precio de referencia: ${formatMoney(price, locale)}` : null,
            interestNotes.trim() ? `Observación comercial: ${interestNotes.trim()}` : null,
          ].filter(Boolean).join('\n'),
        }),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo consignar el interés comercial.')
        return
      }

      alert('Interés comercial consignado en el CRM.')
      await loadDetail(selectedConversation.id)
    } finally {
      setSavingInterest(false)
    }
  }

  const messagingWindowState = useMemo(() => {
    if (!selectedConversation) return null
    const provider = selectedConversation.channelConnection.provider
    const needsWindow = provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX' || provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER' || provider === 'INSTAGRAM_DM'
    if (!needsWindow) return null

    const latestInbound = selectedConversation.messages
      .filter((message) => message.direction === 'INBOUND')
      .map((message) => new Date(message.occurredAt))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null

    if (!latestInbound) {
      return { open: false, label: 'Sin inbound previo', hint: 'Aún no existe una ventana de respuesta abierta para este canal.' }
    }

    const expiresAt = latestInbound.getTime() + 24 * 60 * 60 * 1000
    const open = Date.now() <= expiresAt
    return {
      open,
      label: open ? 'Ventana 24h abierta' : 'Fuera de ventana 24h',
      hint: `${open ? 'Último inbound' : 'La ventana cerró'}: ${formatDate(latestInbound.toISOString(), locale, naText)}`,
    }
  }, [locale, naText, selectedConversation])

  const hybridComposerGuard = useMemo(() => {
    if (!selectedConversation) return null

    return getRecentPhoneOutboundGuard(selectedConversation.messages)
  }, [selectedConversation])

  const callSetupItems = useMemo(() => buildCallSetupItems({
    conversation: selectedConversation,
    addon: dailyCallsAddon,
    messagingWindowState,
    callType: callDialogType,
  }), [callDialogType, dailyCallsAddon, messagingWindowState, selectedConversation])

  useEffect(() => {
    setHybridOverrideConfirmed(false)
  }, [selectedConversation?.id, hybridComposerGuard?.messageId])

  const [detailPanelTab, setDetailPanelTab] = useState<'CHAT' | 'CRM' | 'AI' | 'CAPTURES'>('CHAT')

  useEffect(() => {
    setDetailPanelTab('CHAT')
  }, [selectedConversationId])

  useEffect(() => {
    if (detailPanelTab !== 'AI') return
    if (!selectedConversationId) return
    if (conversationAi) return
    void loadConversationAi(selectedConversationId, { silent: true })
  }, [conversationAi, detailPanelTab, loadConversationAi, selectedConversationId])

  const compactToolbarLayout = (
    <div className="space-y-3">
      <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.32)]">
        <CardContent className="space-y-4 p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Panel global CRM</p>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Prospectos y clientes</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Inbox omnicanal ordenado para revisar, responder y asignar conversaciones sin perder el contexto comercial.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm text-slate-600">
                <div className="grid gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tiempo real</span>
                  <span>{liveMode ? `Activo · ${formatDate(lastRefreshAt, locale, 'sin sincronizar')}` : 'Pausado'}</span>
                </div>
                <Switch checked={liveMode} onCheckedChange={setLiveMode} />
              </div>
              <Button variant="outline" className="rounded-2xl border-slate-200 bg-white" onClick={() => void Promise.all([loadConversations(), loadMeta()])}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refrescar
              </Button>
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white">
                <Link href="/dashboard/crm/agenda">Agenda</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white">
                <Link href="/dashboard/notificaciones">Notificaciones</Link>
              </Button>
              <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => setSimulatorOpen(true)}>
                Simular inbound
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_220px_auto] xl:items-center">
            <div className="relative">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversaciones, teléfonos, correos o mensajes..." className="h-11 rounded-2xl border-slate-200 bg-slate-50/60 pl-4 pr-4" />
            </div>
            <Select value={datePreset} onValueChange={(value) => setDatePreset(value as InboxDatePreset)}>
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7D">Últimos 7 días</SelectItem>
                <SelectItem value="30D">Últimos 30 días</SelectItem>
                <SelectItem value="ALL">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInboxStatusTab('PENDING')}
                className={inboxStatusTab === 'PENDING' ? 'rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800' : 'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600'}
              >
                Por resolver {inboxStatusCounts.pendingCount}
              </button>
              <button
                type="button"
                onClick={() => setInboxStatusTab('RESOLVED')}
                className={inboxStatusTab === 'RESOLVED' ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800' : 'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600'}
              >
                Resueltos y pausados {inboxStatusCounts.resolvedCount}
              </button>
              <button
                type="button"
                onClick={() => setInboxStatusTab('ALL')}
                className={inboxStatusTab === 'ALL' ? 'rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800' : 'rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600'}
              >
                Todos {inboxStatusCounts.allCount}
              </button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Conversaciones</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setQueueScope('TEAM')} className={queueScope === 'TEAM' ? 'rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Todos</button>
                <button type="button" onClick={() => setQueueScope('MINE')} className={queueScope === 'MINE' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Asignados a mí</button>
                <button type="button" onClick={() => setQueueScope('UNASSIGNED')} className={queueScope === 'UNASSIGNED' ? 'rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Sin asignar</button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Por actividad</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setQueueFocus('ALL')} className={queueFocus === 'ALL' ? 'rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Todos</button>
                <button type="button" onClick={() => setQueueFocus('IMMEDIATE')} className={queueFocus === 'IMMEDIATE' ? 'rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Atención inmediata</button>
                <button type="button" onClick={() => setQueueFocus('WAITING_CUSTOMER')} className={queueFocus === 'WAITING_CUSTOMER' ? 'rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Esperando cliente</button>
                <button type="button" onClick={() => setQueueFocus('BOT_HANDOFF')} className={queueFocus === 'BOT_HANDOFF' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Asignados a la IA</button>
                <button type="button" onClick={() => setQueueFocus('HYBRID_PHONE_ACTIVITY')} className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>Actividad celular</button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canales</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setProviderFilter('WHATSAPP_CLOUD')} className={(providerFilter === 'WHATSAPP_CLOUD' || providerFilter === 'WHATSAPP_SANDBOX') ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>
                  <span className="inline-flex items-center gap-2"><ChannelProviderBadge provider="WHATSAPP_CLOUD" />WhatsApp</span>
                </button>
                <button type="button" onClick={() => setProviderFilter('MESSENGER')} className={providerFilter === 'MESSENGER' ? 'rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>
                  <span className="inline-flex items-center gap-2"><ChannelProviderBadge provider="MESSENGER" />Messenger</span>
                </button>
                <button type="button" onClick={() => setProviderFilter('INSTAGRAM_DM')} className={providerFilter === 'INSTAGRAM_DM' ? 'rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>
                  <span className="inline-flex items-center gap-2"><ChannelProviderBadge provider="INSTAGRAM_DM" />Instagram</span>
                </button>
                <button type="button" onClick={() => setProviderFilter('FACEBOOK_PAGE')} className={providerFilter === 'FACEBOOK_PAGE' ? 'rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>
                  <span className="inline-flex items-center gap-2"><ChannelProviderBadge provider="FACEBOOK_PAGE" />Facebook</span>
                </button>
                <button type="button" onClick={() => setProviderFilter('ALL')} className={providerFilter === 'ALL' ? 'rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}>
                  Todos
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | ConversationStatus)}>
              <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Estado exacto" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Asesor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los asesores</SelectItem>
                {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as OriginFilter)}>
              <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los orígenes</SelectItem>
                <SelectItem value="EMAIL">Correo</SelectItem>
                <SelectItem value="FORM">Formulario</SelectItem>
                <SelectItem value="CHATBOT">Chatbot</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="SOCIAL">Social</SelectItem>
                <SelectItem value="PHONE">Llamada</SelectItem>
                <SelectItem value="REFERRAL">Referido</SelectItem>
                <SelectItem value="IMPORT">Importado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los canales</SelectItem>
                {channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 rounded-2xl border-slate-200 bg-white" onClick={() => void loadConversations()}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  if (props.hideHero) {
    const selectedProvider = selectedConversation ? formatProviderDisplayName(selectedConversation.channelConnection.provider) : null

    return (
      <div className="space-y-4 pb-4">
        <div className="grid gap-4 xl:grid-cols-[320px_380px_minmax(0,1fr)] xl:items-stretch">
          <Card className="overflow-hidden rounded-[30px] border-slate-200 bg-white/95 shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)] xl:sticky xl:top-4 xl:flex xl:h-[95vh] xl:flex-col">
            <CardContent className="flex h-full min-h-0 flex-col gap-4 p-3.5">
              {props.sidebarHeader ? props.sidebarHeader : null}

              <Button className="h-12 w-full justify-start rounded-[24px] bg-[linear-gradient(135deg,#315efb,#5675ff)] px-4 text-left text-white shadow-[0_18px_36px_-24px_rgba(49,94,251,0.7)] hover:bg-[linear-gradient(135deg,#2b52dc,#4b6ef2)]" onClick={() => setNewConversationOpen(true)}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/18 text-base font-semibold">+</span>
                <span className="ml-3 flex flex-col items-start">
                  <span className="text-sm font-semibold">Iniciar conversación</span>
                  <span className="text-[11px] font-medium text-blue-100">Cliente, prospecto o número de WhatsApp</span>
                </span>
              </Button>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="rounded-[28px] border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <Button variant="outline" className="rounded-2xl border-slate-200 bg-white" onClick={() => void Promise.all([loadConversations(), loadMeta()])}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Refrescar
                    </Button>
                    <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <span>{liveMode ? 'Tiempo real activo' : 'Tiempo real pausado'}</span>
                      <Switch checked={liveMode} onCheckedChange={setLiveMode} />
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <button type="button" onClick={() => { setQueueScope('TEAM'); setQueueFocus('ALL'); setProviderFilter('ALL'); setChannelFilter('ALL'); }} className={queueScope === 'TEAM' && queueFocus === 'ALL' && providerFilter === 'ALL' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" />Todos</span>
                      <span className={queueScope === 'TEAM' && queueFocus === 'ALL' && providerFilter === 'ALL' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.teamCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueScope('MINE')} className={queueScope === 'MINE' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><CheckCheck className="h-4 w-4" />Asignados a mí</span>
                      <span className={queueScope === 'MINE' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.mineCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueScope('UNASSIGNED')} className={queueScope === 'UNASSIGNED' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Sin asignar</span>
                      <span className={queueScope === 'UNASSIGNED' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.unassignedCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueFocus('IMMEDIATE')} className={queueFocus === 'IMMEDIATE' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" />No leídos / urgentes</span>
                      <span className={queueFocus === 'IMMEDIATE' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.immediateCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueFocus('WAITING_CUSTOMER')} className={queueFocus === 'WAITING_CUSTOMER' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Sin respuestas</span>
                      <span className={queueFocus === 'WAITING_CUSTOMER' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.waitingCustomerCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueFocus('BOT_HANDOFF')} className={queueFocus === 'BOT_HANDOFF' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4" />Asignadas a la IA</span>
                      <span className={queueFocus === 'BOT_HANDOFF' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.botHandoffCount}</span>
                    </button>
                    <button type="button" onClick={() => setQueueFocus('HYBRID_PHONE_ACTIVITY')} className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                      <span className="inline-flex items-center gap-2 text-sm font-medium"><PhoneCall className="h-4 w-4" />Actividad celular</span>
                      <span className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.hybridPhoneActivityCount}</span>
                    </button>
                    {configuredSidebarProviders.length > 0 ? <p className="px-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canales activos</p> : null}
                    {configuredSidebarProviders.map((provider) => (
                      <button key={provider} type="button" onClick={() => setProviderFilter(provider)} className={providerFilter === provider || (provider === 'WHATSAPP_CLOUD' && providerFilter === 'WHATSAPP_SANDBOX') ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                        <span className="inline-flex items-center gap-2 text-sm font-medium"><ChannelProviderBadge provider={provider} />{formatProviderDisplayName(provider)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <details className="rounded-[28px] border border-slate-200 bg-white p-3.5">
                <summary className="cursor-pointer list-none px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros avanzados</summary>
                <div className="mt-3 grid gap-2">
                  <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                    <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Asesor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los asesores</SelectItem>
                      {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as OriginFilter)}>
                    <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Origen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los orígenes</SelectItem>
                      <SelectItem value="EMAIL">Correo</SelectItem>
                      <SelectItem value="FORM">Formulario</SelectItem>
                      <SelectItem value="CHATBOT">Chatbot</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="SOCIAL">Social</SelectItem>
                      <SelectItem value="PHONE">Llamada</SelectItem>
                      <SelectItem value="REFERRAL">Referido</SelectItem>
                      <SelectItem value="IMPORT">Importado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue placeholder="Canal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos los canales</SelectItem>
                      {channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                </details>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)] xl:sticky xl:top-4 xl:flex xl:h-[95vh] xl:flex-col">
            <CardContent className="flex h-full min-h-0 flex-col p-3">
              <div className="border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <p className="shrink-0 text-sm font-semibold text-slate-950">Conversaciones</p>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversaciones..." className="h-9 rounded-2xl border-slate-200 bg-white" />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">{displayedConversations.length} visibles en la cola actual.</p>
                <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Select value={datePreset} onValueChange={(value) => setDatePreset(value as InboxDatePreset)}>
                    <SelectTrigger className="h-8.5 rounded-2xl border-slate-200 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7D">Últimos 7 días</SelectItem>
                      <SelectItem value="30D">Últimos 30 días</SelectItem>
                      <SelectItem value="ALL">Todo el historial</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="h-8.5 rounded-2xl border-slate-200 bg-white px-3 text-xs" onClick={() => void loadConversations()}>
                    Aplicar
                  </Button>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-slate-200 pt-2.5">
                  <button type="button" onClick={() => setInboxStatusTab('PENDING')} className={inboxStatusTab === 'PENDING' ? 'rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-blue-700' : 'rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500'}>
                    <span className="block">Por resolver</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{inboxStatusCounts.pendingCount}</span>
                  </button>
                  <button type="button" onClick={() => setInboxStatusTab('RESOLVED')} className={inboxStatusTab === 'RESOLVED' ? 'rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-emerald-700' : 'rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500'}>
                    <span className="block">Resueltos y pausados</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{inboxStatusCounts.resolvedCount}</span>
                  </button>
                  <button type="button" onClick={() => setInboxStatusTab('ALL')} className={inboxStatusTab === 'ALL' ? 'rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-800' : 'rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500'}>
                    <span className="block">Todos</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{inboxStatusCounts.allCount}</span>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pt-3">
                <div className="space-y-1.5">
                  {loading ? <span className="sr-only" aria-live="polite">Cargando conversaciones...</span> : null}
                  {!loading && displayedConversations.length === 0 ? <p className="px-2 py-4 text-sm text-slate-500">No hay conversaciones para mostrar.</p> : null}
                  {displayedConversations.map((item) => {
                    const isActive = item.id === selectedConversationId
                    const preview = getConversationPreviewText(item.messages?.[0], item.sourceCampaign || item.contactEmail || item.contactPhone || naText)
                    const slaMeta = getConversationSlaMeta(item, locale)
                    const statusMeta = getConversationStatusMeta(item.status)
                    const hasUnread = item.unreadCount > 0
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedConversationId(item.id)}
                        className={isActive
                          ? 'w-full rounded-[18px] border-2 border-blue-500 bg-[linear-gradient(135deg,rgba(191,219,254,0.95),rgba(239,246,255,1))] px-3 py-2.5 text-left shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)]'
                          : hasUnread
                            ? 'w-full rounded-[18px] border-2 border-blue-400 bg-[linear-gradient(135deg,rgba(219,234,254,0.98),rgba(239,246,255,0.94))] px-3 py-2.5 text-left shadow-[0_18px_34px_-26px rgba(37,99,235,0.55)] transition hover:border-blue-500 hover:bg-blue-100/80'
                            : 'w-full rounded-[18px] border border-transparent bg-transparent px-3 py-2.5 text-left transition hover:border-slate-200 hover:bg-slate-50/70'}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="relative shrink-0">
                              <IdentityAvatar label={item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || item.contactPhone || item.contactEmail || 'Contacto'} imageUrl={item.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="sm" />
                              <div className="absolute -bottom-1 -right-1">
                                <ChannelProviderBadge provider={item.channelConnection.provider} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="truncate text-[13px] font-semibold leading-5 text-slate-950">{renderHighlightedText(item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto', search)}</p>
                                    {item.unreadCount > 0 ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">{item.unreadCount}</span> : null}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="block text-[10px] font-medium leading-4 text-slate-400">{formatConversationListTime(item.lastMessageAt, locale)}</span>
                                  <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                                </div>
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-[12px] leading-4.5 text-slate-500">{renderHighlightedText(preview, search)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                                <span>{formatProviderDisplayName(item.channelConnection.provider)}</span>
                                <span className={`rounded-full border px-1.5 py-0.5 ${slaMeta.className}`}>{slaMeta.label}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)] xl:h-[95vh]">
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="sticky top-0 z-20 border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-2.5 lg:px-5">
                {!selectedConversation ? (
                  <div className="flex h-full min-h-[120px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                    Selecciona una conversación en la columna izquierda para abrir el chat y su contexto comercial.
                  </div>
                ) : (
                  (() => {
                    const selectedSla = getConversationSlaMeta(selectedConversation, locale)
                    const selectedPriority = getConversationPriorityMeta(selectedConversation, locale)
                    const selectedStatus = getConversationStatusMeta(selectedConversation.status)
                    const isMuted = mutedCrmConversationIds.includes(selectedConversation.id)
                    return (
                      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="relative shrink-0">
                              <IdentityAvatar label={selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación'} imageUrl={selectedConversation.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="lg" />
                              <div className="absolute -bottom-1 -right-1">
                                <ChannelProviderBadge provider={selectedConversation.channelConnection.provider} size="md" />
                              </div>
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {editingConversationName ? (
                                  <div className="flex items-center gap-2">
                                    <Input value={conversationNameDraft} onChange={(event) => setConversationNameDraft(event.target.value)} className="h-9 w-[220px] rounded-xl border-slate-200 bg-white" placeholder="Nombre del lead o contacto" />
                                    <Button type="button" size="sm" className="rounded-xl" onClick={() => void saveConversationName()} disabled={savingConversationName}>{savingConversationName ? 'Guardando...' : 'Guardar'}</Button>
                                    <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => { setEditingConversationName(false); setConversationNameDraft(selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || '') }}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-950 sm:text-base">{renderHighlightedText(selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación sin alias', search)}</h2>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-500" onClick={() => setEditingConversationName(true)} aria-label="Editar nombre de la conversación">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {isMuted ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Silenciado</span> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold uppercase tracking-[0.14em] text-slate-600">{selectedProvider}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">{selectedConversation.contactPhone || naText}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">{selectedConversation.contactEmail || naText}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${selectedStatus.className}`}>{selectedStatus.label}</span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${selectedPriority.className}`}>{selectedPriority.label}</span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${selectedSla.className}`}>{selectedSla.label}</span>
                            <span className="text-xs text-slate-500">{selectedSla.elapsedLabel}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-[20px] border border-slate-200 bg-white/92 p-1.5 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.35)]">
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => void openCallDialog('audio')} aria-label="Abrir modal de llamada" title="Llamada de audio">
                            <PhoneCall className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => void openCallDialog('video')} aria-label="Abrir modal de videollamada" title="Videollamada">
                            <Video className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="rounded-xl border-slate-200 bg-white" aria-label="Opciones de conversación">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                              <DropdownMenuLabel>Conversación CRM</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={toggleMuteSelectedConversation}>
                                <BellOff className="mr-2 h-4 w-4" />
                                {isMuted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                              </DropdownMenuItem>
                              {selectedConversation.lead ? (
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/crm/leads/${selectedConversation.lead.id}`}>
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                    Abrir lead
                                  </Link>
                                </DropdownMenuItem>
                              ) : null}
                              {selectedConversation.contactPhone ? (
                                <DropdownMenuItem asChild>
                                  <a href={`tel:${selectedConversation.contactPhone}`}>
                                    <PhoneCall className="mr-2 h-4 w-4" />
                                    Llamar
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              {!selectedConversation.assignedTo && currentUserId ? (
                                <DropdownMenuItem onSelect={() => void takeConversation(selectedConversation.id)} disabled={assigning}>
                                  <Check className="mr-2 h-4 w-4" />
                                  {assigning ? 'Tomando...' : 'Tomar conversación'}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onSelect={() => void resolveConversation()} disabled={resolving || selectedConversation.status === 'RESOLVED' || selectedConversation.status === 'DISABLED'}>
                                <Clock3 className="mr-2 h-4 w-4" />
                                {resolving ? 'Resolviendo...' : 'Resolver'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void updateConversationAction('disable')}>
                                <Clock3 className="mr-2 h-4 w-4" />
                                Deshabilitar temporalmente
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void updateConversationAction('report')}>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Reportar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => void deleteConversationPermanently()} className="text-rose-700 focus:text-rose-700">
                                <X className="mr-2 h-4 w-4" />
                                Eliminar definitivamente
                              </DropdownMenuItem>
                              <DropdownMenuLabel>Vista del panel</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => setDetailPanelTab('CHAT')}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDetailPanelTab('CRM')}>
                                <CheckCheck className="mr-2 h-4 w-4" />
                                CRM
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDetailPanelTab('AI')}>
                                <Bot className="mr-2 h-4 w-4" />
                                IA
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDetailPanelTab('CAPTURES')}>
                                <FileText className="mr-2 h-4 w-4" />
                                Capturas
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })()
                )}
              </div>

              <div className={detailPanelTab === 'CHAT' ? 'min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.07),transparent_32%),linear-gradient(180deg,#ffffff,#fbfdff)] p-3 lg:p-3.5' : 'min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.07),transparent_32%),linear-gradient(180deg,#ffffff,#fbfdff)] p-3 lg:p-3.5'}>
                {!selectedConversation ? null : detailPanelTab === 'CHAT' ? (
                  <div className="h-full">
                    <Card className="flex h-full min-h-0 flex-col rounded-[24px] border border-slate-200 bg-white/98 shadow-none">
                      <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 p-3.5 lg:p-4">
                        <div className="min-h-0 rounded-[24px] border border-slate-200/80 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" style={CONVERSATION_WALLPAPER_STYLE}>
                          <div className="h-full space-y-3 overflow-y-auto px-1.5 pr-2 sm:px-3 lg:px-5 xl:px-7">
                          {selectedConversation.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes registrados.</p> : null}
                          {selectedConversation.messages.map((message, index) => {
                            const hasCollision = hasMessageCollision(message)

                            return (
                              <div ref={index === selectedConversation.messages.length - 1 ? lastConversationMessageRef : null} key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[80%] rounded-[24px] border border-sky-200 bg-white/96 px-4 py-3 text-[13px] text-slate-700 shadow-[0_16px_36px_-28px_rgba(14,116,144,0.45)]' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[80%] rounded-[22px] border border-dashed border-slate-300 bg-white/90 px-4 py-3 text-[13px] text-slate-600' : 'mr-auto max-w-[80%] rounded-[24px] border border-slate-200 bg-white/96 px-4 py-3 text-[13px] text-slate-700 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.22)]'}>
                                <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
                                  <span className="font-semibold text-slate-700">{getMessageDisplayName(message, selectedConversation)}</span>
                                  <span>{formatDate(message.occurredAt, locale, naText)}</span>
                                </div>
                                {hasCollision ? <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-900">Hubo respuestas casi al mismo tiempo desde el CRM y fuera del CRM.</p> : null}
                                {renderConversationMessageBody({
                                  message,
                                  search,
                                  onOpenInvitePreview: setCallInvitePreview,
                                })}
                                {renderConversationAttachments(message.attachmentsJson)}
                              </div>
                            )
                          })}
                          </div>
                        </div>

                        <div className="grid gap-2.5 rounded-[20px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3">
                          {messagingWindowState ? (
                            <div className={messagingWindowState.open ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800'}>
                              <span className="font-semibold">{messagingWindowState.label}:</span> {messagingWindowState.hint}
                            </div>
                          ) : null}
                          {hybridComposerGuard ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-3 text-xs text-rose-800">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div className="space-y-2">
                                  <p className="font-semibold">Posible cruce de respuestas</p>
                                  <p>Detectamos una respuesta desde el CRM y otra fuera del CRM casi al mismo tiempo. Revisa el hilo antes de volver a responder.</p>
                                  {hybridComposerGuard.bodyText ? <p className="rounded-xl bg-white/70 px-2.5 py-2 text-[11px] leading-5 text-slate-700">"{hybridComposerGuard.bodyText}"</p> : null}
                                  <label className="flex items-start gap-2 text-[11px] text-slate-700">
                                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={hybridOverrideConfirmed} onChange={(event) => setHybridOverrideConfirmed(event.target.checked)} />
                                    <span>Ya revisé el cruce y aun así quiero responder desde el CRM.</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <CrmFileLibraryPicker
                            open={libraryPickerOpen}
                            onOpenChange={setLibraryPickerOpen}
                            onPick={handleLibraryAttachment}
                            allowFolders={false}
                            title="Cargar desde carpeta interna"
                          />
                          <input ref={attachmentInputRef} type="file" className="hidden" onChange={(event) => void handleAttachmentInputChange(event)} />
                          <div className="grid gap-2">
                            <div className="flex items-end gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl border-slate-200 bg-white" disabled={!selectedConversation || uploadingAttachment} aria-label="Agregar emoji o adjunto">
                                    <Plus className="h-5 w-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="top" className="w-60 rounded-2xl p-2">
                                  <DropdownMenuLabel>Agregar al mensaje</DropdownMenuLabel>
                                  <DropdownMenuItem onSelect={() => setShowEmojiPicker((current) => !current)}>
                                    <Smile className="mr-2 h-4 w-4" />
                                    Emojis
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    setMessageTypeDraft('IMAGE')
                                    setShowEmojiPicker(false)
                                    openAttachmentPicker()
                                  }}>
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    Cargar imagen
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    setMessageTypeDraft('AUDIO')
                                    setShowEmojiPicker(false)
                                    openAttachmentPicker()
                                  }}>
                                    <FileAudio className="mr-2 h-4 w-4" />
                                    Cargar audio
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    setShowEmojiPicker(false)
                                    if (recordingAudio) stopAudioRecording()
                                    else void startAudioRecording()
                                  }}>
                                    <FileAudio className="mr-2 h-4 w-4" />
                                    {recordingAudio ? 'Detener grabación' : 'Grabar audio'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    setMessageTypeDraft('DOCUMENT')
                                    setShowEmojiPicker(false)
                                    openAttachmentPicker()
                                  }}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cargar documento
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    setShowEmojiPicker(false)
                                    setLibraryPickerOpen(true)
                                  }}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Cargar desde carpeta interna
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Textarea value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} rows={2} className="min-h-[54px] flex-1 resize-none rounded-2xl border-slate-200 bg-white" placeholder={messageTypeDraft === 'TEXT' ? 'Escribe una respuesta...' : 'Opcional para multimedia, especialmente en WhatsApp.'} />
                              <Button type="button" size="icon" className="h-11 w-11 shrink-0 rounded-2xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => void submitMessage()} disabled={sending || uploadingAttachment || recordingAudio || Boolean(hybridComposerGuard && !hybridOverrideConfirmed)} aria-label="Enviar mensaje">
                                <SendHorizontal className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                          {showEmojiPicker ? (
                            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                              {EMOJI_CHOICES.map((emoji) => (
                                <button key={emoji} type="button" onClick={() => setMessageDraft((current) => `${current}${emoji}`)} className="rounded-xl border border-slate-200 px-2.5 py-2 text-lg hover:bg-slate-50">
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {messageTypeDraft !== 'TEXT' ? (
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="grid gap-2 lg:col-span-2">
                                <Label>Adjunto</Label>
                                <div className="flex flex-wrap gap-2">
                                  <Button type="button" variant="outline" className="rounded-xl" onClick={openAttachmentPicker} disabled={uploadingAttachment}>
                                    {uploadingAttachment ? 'Subiendo archivo...' : messageTypeDraft === 'IMAGE' ? 'Subir imagen' : messageTypeDraft === 'AUDIO' ? 'Subir audio' : 'Subir documento'}
                                  </Button>
                                  {messageTypeDraft === 'AUDIO' ? (
                                    <Button type="button" variant={recordingAudio ? 'destructive' : 'outline'} className="rounded-xl" onClick={recordingAudio ? stopAudioRecording : () => void startAudioRecording()} disabled={uploadingAttachment}>
                                      {recordingAudio ? 'Detener grabación' : 'Grabar voz'}
                                    </Button>
                                  ) : null}
                                  <Button type="button" variant="ghost" size="icon" className="rounded-xl text-slate-600" onClick={resetAttachmentComposer} aria-label="Cerrar adjunto">
                                    <X className="h-4 w-4" />
                                  </Button>
                                  {attachmentUrlDraft ? (
                                    <Button type="button" variant="ghost" className="rounded-xl text-slate-600" onClick={resetAttachmentComposer}>
                                      Quitar adjunto
                                    </Button>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-500">{recordingAudio ? 'Grabando nota de voz... al detenerla se subirá automáticamente al chat.' : uploadingAttachment && attachmentUploadProgress !== null ? `Subiendo adjunto... ${attachmentUploadProgress}%` : attachmentUrlDraft ? 'Adjunto listo para enviar por el canal.' : audioRecordingIssue && messageTypeDraft === 'AUDIO' ? audioRecordingIssue : 'El archivo se sube primero al CRM para que WhatsApp pueda descargarlo desde una URL pública.'}</p>
                              </div>
                              <div className="grid gap-2 lg:col-span-2">
                                <Label>Nombre visible</Label>
                                <Input value={attachmentNameDraft} onChange={(e) => setAttachmentNameDraft(e.target.value)} className="rounded-2xl border-slate-200 bg-white" placeholder="catalogo.pdf o imagen-promocion.jpg" />
                              </div>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-end gap-3 text-xs text-slate-500">
                            <p>{recordingAudio ? 'Grabando nota de voz... al detenerla se subirá automáticamente al chat.' : uploadingAttachment && attachmentUploadProgress !== null ? `Subiendo adjunto... ${attachmentUploadProgress}%` : attachmentUrlDraft ? 'Adjunto listo para enviar por el canal.' : ''}</p>
                            {sending ? <span className="font-medium text-blue-700">Enviando...</span> : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : detailPanelTab === 'CRM' ? (
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">Atención y asignación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado de atención</Label>
                            <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as ConversationStatus)}>
                              <SelectTrigger className="rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ATTENTION_STATUS_OPTIONS.map((item) => {
                                  const meta = getConversationStatusMeta(item)
                                  return <SelectItem key={item} value={item}>{meta.label}</SelectItem>
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Responsable</Label>
                            <Select value={assigneeDraft} onValueChange={setAssigneeDraft}>
                              <SelectTrigger className="rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin asesor</SelectItem>
                                {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button className="w-full rounded-xl" onClick={() => void submitAssign()} disabled={assigning}>{assigning ? 'Guardando...' : 'Guardar atención'}</Button>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">Relaciones CRM</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-slate-600">
                          <p>Lead: {selectedConversation.lead ? <Link href={`/dashboard/crm/leads/${selectedConversation.lead.id}`} className="font-medium text-sky-700 hover:underline">{selectedConversation.lead.nombre}</Link> : 'Sin lead'}</p>
                          <p>Cliente: {selectedConversation.cliente?.nombre || 'Sin cliente'}</p>
                          <p>Oportunidad: {selectedConversation.opportunity?.title || 'Sin oportunidad'}</p>
                          {selectedConversation.opportunity && selectedConversation.cliente ? (
                            <Button asChild variant="ghost" className="h-auto p-0 text-sky-700 hover:text-sky-800">
                              <Link href={`/dashboard/cotizador?crmOpportunityId=${selectedConversation.opportunity.id}&clienteId=${selectedConversation.cliente.id}&opportunityTitle=${encodeURIComponent(selectedConversation.opportunity.title)}`}>Ir al cotizador</Link>
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">Alertas y seguimiento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-600">
                          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getConversationPriorityMeta(selectedConversation, locale).className}`}>{getConversationPriorityMeta(selectedConversation, locale).label}</span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getConversationSlaMeta(selectedConversation, locale).className}`}>{getConversationSlaMeta(selectedConversation, locale).label}</span>
                            </div>
                            <p className="text-sm leading-6 text-slate-600">{getConversationSlaMeta(selectedConversation, locale).elapsedLabel}. Usa esta señal para priorizar respuesta, asignación y resolución del hilo.</p>
                          </div>
                          {selectedConversation.lead ? (
                            <Button asChild variant="outline" className="w-full rounded-xl border-slate-200 bg-white">
                              <Link href="/dashboard/crm">Ir a editar lead y pasar a pipeline</Link>
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Interés y stock</CardTitle>
                        <CardDescription>Busca el producto que pidió el cliente y deja trazabilidad comercial.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void searchMaterials()
                            }
                          }} placeholder="Buscar producto, proveedor o categoría..." />
                          <Button className="rounded-xl" variant="outline" onClick={() => void searchMaterials()} disabled={materialLoading}>{materialLoading ? 'Buscando...' : 'Buscar stock'}</Button>
                        </div>
                        {materialResults.length > 0 ? (
                          <div className="space-y-2">
                            {materialResults.map((material) => {
                              const stock = getVisibleStock(material)
                              const selected = selectedMaterial?.id === material.id
                              return (
                                <button key={material.id} type="button" onClick={() => setSelectedMaterial(material)} className={selected ? 'w-full rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3 text-left shadow-sm' : 'w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left'}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-slate-900">{material.nombre}</p>
                                      <p className="mt-1 text-xs text-slate-500">{material.categoria || 'Sin categoría'} · {material.proveedor || 'Sin proveedor'}</p>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className={stock > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{stock > 0 ? `Stock ${stock}` : 'Sin stock'}</p>
                                      <p className="mt-1 text-slate-500">{formatMoney(getMaterialPrice(material), locale)}</p>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                        <div className="grid gap-2">
                          <Label>Qué pidió o en qué está interesado</Label>
                          <Textarea value={interestNotes} onChange={(e) => setInterestNotes(e.target.value)} rows={4} placeholder="Ejemplo: quiere 200 unidades, entrega esta semana, validar stock inmediato y cerrar en venta real si hay disponibilidad." />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => {
                            setSelectedMaterial(null)
                            setInterestNotes('')
                          }} disabled={savingInterest}>Limpiar</Button>
                          <Button className="rounded-xl" onClick={() => void saveInterestSelection()} disabled={savingInterest}>{savingInterest ? 'Consignando...' : 'Consignar interés'}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : detailPanelTab === 'AI' ? (
                  <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Copiloto comercial</CardTitle>
                      <CardDescription>Resumen, sugerencias y acciones operativas a partir del hilo actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <Button variant="outline" className="rounded-xl border-emerald-200 bg-white" onClick={() => selectedConversation ? void loadConversationAi(selectedConversation.id) : undefined} disabled={generatingAi}>{generatingAi ? 'Analizando...' : conversationAi ? 'Regenerar sugerencia' : 'Generar sugerencia IA'}</Button>
                        {selectedConversation ? <Link href={`/dashboard/crm/auditoria-ia?conversationId=${selectedConversation.id}`} className="inline-flex items-center text-sm font-medium text-emerald-700 hover:underline">Ver auditoría de este hilo</Link> : null}
                      </div>
                      {conversationAi ? (
                        <>
                          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                            <span className={`rounded-full border px-2.5 py-1 font-semibold ${getConversationSentimentMeta(conversationAi.sentiment).className}`}>{getConversationSentimentMeta(conversationAi.sentiment).label}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">Confianza {conversationAi.confidence}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">{conversationAi.engine.mode === 'LLM' ? `IA ${conversationAi.engine.model || conversationAi.engine.provider}` : 'Reglas internas'}</span>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resumen</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{conversationAi.summary}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta sugerida</p>
                              <Button variant="ghost" className="h-auto rounded-lg px-2 py-1 text-xs text-emerald-700 hover:text-emerald-800" onClick={() => {
                                setMessageTypeDraft('TEXT')
                                setAttachmentUrlDraft('')
                                setAttachmentNameDraft('')
                                setMessageDraft(conversationAi.suggestedReply)
                                setDetailPanelTab('CHAT')
                              }}>Usar en borrador</Button>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{conversationAi.suggestedReply}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Prioridad: {conversationAi.taskSuggestion.priority}</div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Vence: {formatDate(conversationAi.taskSuggestion.dueAt, locale, 'Sin fecha')}</div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Responsable: {conversationAi.taskSuggestion.assignedToLabel || 'Sin asignar'}</div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void createTaskFromAiSuggestion()} disabled={creatingAiTask}>{creatingAiTask ? 'Creando tarea...' : 'Crear tarea'}</Button>
                              <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void createOpportunityFromAiSuggestion()} disabled={creatingAiOpportunity || Boolean(selectedConversation.opportunity) || (!selectedConversation.lead && !selectedConversation.cliente)}>{creatingAiOpportunity ? 'Creando oportunidad...' : 'Pasar a oportunidad'}</Button>
                            </div>
                          </div>
                          {conversationAi.nextActions.length ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Siguiente paso sugerido</p>
                              <div className="mt-2 space-y-2">
                                {conversationAi.nextActions.map((action) => <div key={action} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">{action}</div>)}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500">Genera la sugerencia IA para ver resumen, respuesta y acciones recomendadas.</div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Últimas capturas</CardTitle>
                      <CardDescription>Datos detectados, automatización aplicada y trazabilidad de deduplicación.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedConversation.captures.length === 0 ? <p className="text-sm text-muted-foreground">Sin capturas registradas.</p> : null}
                      {selectedConversation.captures.map((capture) => (
                        (() => {
                          const normalized = asRecord(capture.normalizedDataJson)
                          const dedupe = asRecord(normalized?.dedupe)
                          const dedupeLead = asRecord(dedupe?.lead)
                          const dedupeConversation = asRecord(dedupe?.conversation)
                          const detectedName = pickString(normalized?.aiName) || pickString(normalized?.fromName)
                          const detectedEmail = pickString(normalized?.aiEmail) || pickString(normalized?.fromAddress)
                          const detectedPhone = pickString(normalized?.aiPhone) || pickString(normalized?.phone)
                          const detectedCompany = pickString(normalized?.aiCompany) || pickString(normalized?.empresaNombre)
                          const detectedCity = pickString(normalized?.aiCity) || pickString(normalized?.ciudad)
                          const detectedRequest = pickString(normalized?.aiRequestSummary) || pickString(normalized?.messageText)
                          const detectedProduct = pickString(normalized?.aiProductOrService)
                          const autoCategory = pickString(normalized?.autoCategory)
                          const autoLeadStatus = pickString(normalized?.autoLeadStatusApplied) || pickString(normalized?.autoLeadStatus)
                          const autoOpportunityId = pickString(normalized?.autoOpportunityId)
                          const autoTaskId = pickString(normalized?.autoTaskId)
                          const leadDedupeStrategy = pickString(dedupeLead?.strategy)
                          const leadDedupeConfidence = pickString(dedupeLead?.confidence)
                          const leadDedupeFields = pickStringArray(dedupeLead?.matchedFields)
                          const conversationDedupeStrategy = pickString(dedupeConversation?.strategy)
                          const conversationDedupeConfidence = pickString(dedupeConversation?.confidence)
                          const conversationDedupeFields = pickStringArray(dedupeConversation?.matchedFields)

                          return (
                            <div key={capture.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-900">{capture.captureType}</span>
                                <span className="text-xs text-slate-500">{formatDate(capture.createdAt, locale, naText)}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{capture.utmSource || 'sin utm_source'} · {capture.utmMedium || 'sin utm_medium'} · {capture.utmCampaign || 'sin campaña'}</p>
                              {detectedName || detectedEmail || detectedPhone || detectedCompany || detectedCity || detectedRequest ? (
                                <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600">
                                  <p className="font-semibold text-slate-900">Desglose detectado</p>
                                  {detectedName ? <p><span className="font-medium text-slate-900">Nombre:</span> {detectedName}</p> : null}
                                  {detectedEmail ? <p><span className="font-medium text-slate-900">Correo:</span> {detectedEmail}</p> : null}
                                  {detectedPhone ? <p><span className="font-medium text-slate-900">Teléfono:</span> {detectedPhone}</p> : null}
                                  {detectedCompany ? <p><span className="font-medium text-slate-900">Empresa:</span> {detectedCompany}</p> : null}
                                  {detectedCity ? <p><span className="font-medium text-slate-900">Ciudad:</span> {detectedCity}</p> : null}
                                  {detectedProduct ? <p><span className="font-medium text-slate-900">Producto/servicio:</span> {detectedProduct}</p> : null}
                                  {detectedRequest ? <p className="leading-5"><span className="font-medium text-slate-900">Solicitud:</span> {detectedRequest}</p> : null}
                                </div>
                              ) : null}
                              {autoCategory || autoLeadStatus || autoOpportunityId || autoTaskId ? (
                                <div className="mt-3 grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                                  <p className="font-semibold">Automatización comercial</p>
                                  {autoCategory ? <p><span className="font-medium">Clasificación:</span> {autoCategory}</p> : null}
                                  {autoLeadStatus ? <p><span className="font-medium">Estado lead:</span> {autoLeadStatus}</p> : null}
                                  {autoOpportunityId ? <p><span className="font-medium">Oportunidad:</span> creada/vinculada</p> : null}
                                  {autoTaskId ? <p><span className="font-medium">Tarea:</span> creada/vinculada</p> : null}
                                </div>
                              ) : null}
                              {leadDedupeStrategy || conversationDedupeStrategy ? (
                                <div className="mt-3 grid gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900">
                                  <p className="font-semibold">Trazabilidad de deduplicación</p>
                                  {leadDedupeStrategy ? <div className="grid gap-1 rounded-xl border border-sky-200 bg-white/80 p-2.5"><p className="font-medium text-slate-900">Lead reutilizado</p><p><span className="font-medium text-slate-900">Regla:</span> {leadDedupeStrategy}</p>{leadDedupeConfidence ? <p><span className="font-medium text-slate-900">Confianza:</span> {leadDedupeConfidence}</p> : null}{leadDedupeFields.length ? <p><span className="font-medium text-slate-900">Campos:</span> {leadDedupeFields.join(', ')}</p> : null}</div> : null}
                                  {conversationDedupeStrategy ? <div className="grid gap-1 rounded-xl border border-sky-200 bg-white/80 p-2.5"><p className="font-medium text-slate-900">Conversación reutilizada</p><p><span className="font-medium text-slate-900">Regla:</span> {conversationDedupeStrategy}</p>{conversationDedupeConfidence ? <p><span className="font-medium text-slate-900">Confianza:</span> {conversationDedupeConfidence}</p> : null}{conversationDedupeFields.length ? <p><span className="font-medium text-slate-900">Campos:</span> {conversationDedupeFields.join(', ')}</p> : null}</div> : null}
                                </div>
                              ) : null}
                            </div>
                          )
                        })()
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4.5 pb-4">
      {props.hideHero ? null : (
        <ErpPageHero
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'CRM', href: '/dashboard/crm' },
            props.initialProviderFilter === 'WEB_CHATBOT'
              ? { label: 'Panel chatbot' }
              : { label: 'Conversaciones' },
          ]}
          eyebrow="CRM Omnicanal"
          title={props.title || 'Bandeja de conversaciones'}
          description={props.description || 'Opera el inbox de pruebas, asigna hilos a asesores, simula inbound y convierte conversaciones en oportunidades sin salir del CRM.'}
          actions={
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-2 text-sm text-slate-600">
                <div className="grid gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tiempo real</span>
                  <span>{liveMode ? `Activo · ${formatDate(lastRefreshAt, locale, 'sin sincronizar')}` : 'Pausado'}</span>
                </div>
                <Switch checked={liveMode} onCheckedChange={setLiveMode} />
              </div>
              <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => void Promise.all([loadConversations(), loadMeta()])}>
                Refrescar
              </Button>
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
                <Link href="/dashboard/crm/integraciones">Canales e iframe</Link>
              </Button>
              {providerFilter === 'WEB_CHATBOT' ? (
                <Button asChild variant="outline" className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                  <Link href="/dashboard/crm/conversations">Ver inbox completo</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                  <Link href="/dashboard/crm/chatbot">Panel chatbot</Link>
                </Button>
              )}
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
                <Link href="/dashboard/notificaciones">Notificaciones</Link>
              </Button>
              <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => setSimulatorOpen(true)}>
                Simular inbound
              </Button>
            </>
          }
          stats={[
            { label: 'Conversaciones abiertas', value: stats.openCount, hint: 'Hilos activos sin cerrar', tone: 'sky' },
            { label: 'Sin asignar', value: stats.unassignedCount, hint: 'Pendientes por tomar', tone: 'amber' },
            { label: 'No leidas', value: stats.unreadCount, hint: 'Mensajes pendientes de revisar', tone: 'teal' },
            { label: 'SLA vencido', value: stats.slaBreachedCount, hint: 'Conversaciones que piden reacción inmediata', tone: 'amber' },
          ]}
        />
      )}

      {props.hideHero ? compactToolbarLayout : (
      <>

      <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)]">
        <CardContent className="grid gap-2.5 p-3 md:grid-cols-5 md:p-4">
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Buscar</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, telefono, email o mensaje..." className="h-9 rounded-lg border-slate-200 bg-white" />
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | ConversationStatus)}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asesor</Label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Origen</Label>
            <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as OriginFilter)}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="EMAIL">Correo</SelectItem>
                <SelectItem value="FORM">Formulario</SelectItem>
                <SelectItem value="CHATBOT">Chatbot</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="SOCIAL">Social</SelectItem>
                <SelectItem value="PHONE">Llamada</SelectItem>
                <SelectItem value="REFERRAL">Referido</SelectItem>
                <SelectItem value="IMPORT">Importado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canal</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proveedor</Label>
            <Select value={providerFilter} onValueChange={(value) => setProviderFilter(value as 'ALL' | ChannelProvider)} disabled={Boolean(props.initialProviderFilter)}>
              <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="WEB_CHATBOT">Chatbot web</SelectItem>
                <SelectItem value="WEB_FORM">Formulario web</SelectItem>
                <SelectItem value="WHATSAPP_CLOUD">WhatsApp Cloud</SelectItem>
                <SelectItem value="WHATSAPP_SANDBOX">WhatsApp Sandbox</SelectItem>
                <SelectItem value="FACEBOOK_PAGE">Facebook Page</SelectItem>
                <SelectItem value="MESSENGER">Messenger</SelectItem>
                <SelectItem value="INSTAGRAM_DM">Instagram DM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5 md:col-span-2">
            <Button className="h-9 w-full rounded-lg" onClick={() => void loadConversations()}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)]">
        <CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setQueueScope('TEAM')}
              className={queueScope === 'TEAM' ? 'rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Equipo</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{queueSummary.teamCount}</p>
              <p className="mt-1 text-xs text-slate-500">Vista completa del inbox operativo.</p>
            </button>
            <button
              type="button"
              onClick={() => setQueueScope('MINE')}
              className={queueScope === 'MINE' ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Mis conversaciones</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{queueSummary.mineCount}</p>
              <p className="mt-1 text-xs text-slate-500">Lo que ya está bajo tu gestión.</p>
            </button>
            <button
              type="button"
              onClick={() => setQueueScope('UNASSIGNED')}
              className={queueScope === 'UNASSIGNED' ? 'rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sin tomar</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{queueSummary.unassignedCount}</p>
              <p className="mt-1 text-xs text-slate-500">Hilos nuevos pendientes por responsable.</p>
            </button>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            {queueScope === 'TEAM' ? 'Cola de equipo activa: prioriza SLA y conversaciones sin tomar.' : null}
            {queueScope === 'MINE' ? 'Cola personal activa: revisa tus hilos vencidos y pendientes de respuesta.' : null}
            {queueScope === 'UNASSIGNED' ? 'Cola de toma activa: reclama conversaciones nuevas antes de que venza el SLA.' : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.2)]">
        <CardContent className="grid gap-3 p-3 md:grid-cols-7 md:p-4">
          <button
            type="button"
            onClick={() => setQueueFocus('ALL')}
            className={queueFocus === 'ALL' ? 'rounded-2xl border border-slate-300 bg-slate-100 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Todo</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.allCount}</p>
            <p className="mt-1 text-xs text-slate-500">Vista completa de la cola activa.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('IMMEDIATE')}
            className={queueFocus === 'IMMEDIATE' ? 'rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Atención inmediata</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.immediateCount}</p>
            <p className="mt-1 text-xs text-slate-500">SLA vencido o prioridad alta.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('NEW_UNASSIGNED')}
            className={queueFocus === 'NEW_UNASSIGNED' ? 'rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Nuevas sin tomar</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.newUnassignedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Conversaciones abiertas sin responsable.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('WAITING_CUSTOMER')}
            className={queueFocus === 'WAITING_CUSTOMER' ? 'rounded-2xl border border-indigo-300 bg-indigo-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Esperando cliente</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.waitingCustomerCount}</p>
            <p className="mt-1 text-xs text-slate-500">Hilos ya respondidos pendientes de retorno.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('BOT_HANDOFF')}
            className={queueFocus === 'BOT_HANDOFF' ? 'rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bot a humano</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.botHandoffCount}</p>
            <p className="mt-1 text-xs text-slate-500">Hilos donde ya toca relevo humano.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('HYBRID_PHONE_ACTIVITY')}
            className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Actividad celular</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.hybridPhoneActivityCount}</p>
            <p className="mt-1 text-xs text-slate-500">Último evento detectado fuera del CRM.</p>
          </button>
          <button
            type="button"
            onClick={() => setQueueFocus('HYBRID_COLLISION')}
            className={queueFocus === 'HYBRID_COLLISION' ? 'rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-left' : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Colisiones</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueFocusSummary.hybridCollisionCount}</p>
            <p className="mt-1 text-xs text-slate-500">Posibles dobles respuestas detectadas.</p>
          </button>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-slate-200 bg-white/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.2)]">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardInfoHeader
            title={<CardTitle className="text-lg">Vista por asesor</CardTitle>}
            description="Usa responsables elegibles de CRM para cortar la cola y ver carga, urgencias y espera de cliente por asesor."
            tone="action"
          />
        </CardHeader>
        <CardContent className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4 md:p-4">
          <button
            type="button"
            onClick={() => setAssignedFilter('ALL')}
            className={assignedFilter === 'ALL' ? 'rounded-2xl border border-sky-300 bg-sky-50 px-3 py-3 text-left' : 'rounded-2xl border border-sky-100 bg-sky-50/40 px-3 py-3 text-left hover:bg-sky-50/70'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Todos los asesores</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{queueSummary.teamCount}</p>
            <p className="mt-1 text-xs text-slate-500">Vista consolidada del frente comercial.</p>
          </button>
          {advisorSummary.map((assignee) => {
            const isActive = assignedFilter === assignee.id
            return (
              <button
                key={assignee.id}
                type="button"
                onClick={() => setAssignedFilter(assignee.id)}
                className={isActive ? 'rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-left' : 'rounded-2xl border border-emerald-100 bg-emerald-50/35 px-3 py-3 text-left hover:bg-emerald-50/60'}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{formatAssigneeName(assignee)}</p>
                    <p className="mt-1 text-xs text-slate-500">{assignee.email || 'Sin correo visible'}</p>
                  </div>
                  {(assignee.immediateCount ?? 0) > 0 ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">{assignee.immediateCount} urgente</span> : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2">
                    <p className="font-semibold text-slate-900">{assignee.activeCount ?? 0}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Activas</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2">
                    <p className="font-semibold text-slate-900">{assignee.waitingCustomerCount ?? 0}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Espera</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2">
                    <p className="font-semibold text-slate-900">{assignee.unreadCount ?? 0}</p>
                    <p className="mt-1 text-[11px] text-slate-500">No leídas</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">Última actividad: {formatDate(assignee.lastLoginAt, locale, 'sin registro')}</p>
              </button>
            )
          })}
        </CardContent>
      </Card>
      </>
      )}

      <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="rounded-[24px] border-slate-200 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardInfoHeader
              title={<CardTitle className="text-lg">{queueScope === 'TEAM' ? 'Cola del equipo' : queueScope === 'MINE' ? 'Mis conversaciones' : 'Conversaciones sin tomar'} ({displayedConversations.length})</CardTitle>}
              description={queueFocus === 'ALL' ? 'Hilos omnicanal ordenados por urgencia operativa, SLA y prioridad comercial.' : queueFocus === 'IMMEDIATE' ? 'Ataca primero los hilos con SLA vencido o criticidad alta.' : queueFocus === 'NEW_UNASSIGNED' ? 'Reclama rápido las conversaciones nuevas para que no queden sin responsable.' : queueFocus === 'BOT_HANDOFF' ? 'Revisa los casos donde el bot ya dejó contexto y hace falta intervención humana.' : 'Monitorea hilos pausados esperando respuesta del cliente.'}
              tone="action"
            />
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 md:p-4">
            {loading ? <span className="sr-only" aria-live="polite">Cargando conversaciones...</span> : null}
            {!loading && displayedConversations.length === 0 ? <p className="text-sm text-muted-foreground">No hay conversaciones para mostrar.</p> : null}
            {displayedConversations.map((item) => {
              const isActive = item.id === selectedConversationId
              const isMuted = mutedCrmConversationIds.includes(item.id)
              const preview = getConversationPreviewText(item.messages?.[0], item.sourceCampaign || item.contactEmail || item.contactPhone || naText)
              const origin = getConversationOrigin(item.channelConnection)
              const signal = getConversationListSignal(item)
              const slaMeta = getConversationSlaMeta(item, locale)
              const priorityMeta = getConversationPriorityMeta(item, locale)
              const statusMeta = getConversationStatusMeta(item.status)
              const providerLabel = formatProviderDisplayName(item.channelConnection.provider)
              const hasUnread = item.unreadCount > 0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedConversationId(item.id)}
                  className={isActive
                    ? 'w-full rounded-3xl border-2 border-blue-500 bg-[linear-gradient(180deg,rgba(191,219,254,0.9),#eff6ff)] p-4 text-left shadow-[0_22px_40px_-28px_rgba(37,99,235,0.72)]'
                    : hasUnread
                      ? 'w-full rounded-3xl border-2 border-blue-400 bg-[linear-gradient(180deg,rgba(219,234,254,0.9),#eff6ff)] p-4 text-left shadow-[0_18px_34px_-26px_rgba(37,99,235,0.52)] transition-shadow hover:shadow-md hover:border-blue-500 hover:bg-blue-100/70'
                      : 'w-full rounded-3xl border border-sky-100 bg-[linear-gradient(180deg,_rgba(240,249,255,0.72),_#ffffff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md hover:bg-sky-50/70'}
                >
                                            {item.unreadCount > 0 ? <span className="text-xs font-semibold text-blue-700">{item.unreadCount} sin leer</span> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative shrink-0">
                        <IdentityAvatar label={item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || item.contactPhone || item.contactEmail || 'Contacto'} imageUrl={item.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="md" />
                        <div className="absolute -bottom-1 -right-1">
                          <ChannelProviderBadge provider={item.channelConnection.provider} />
                        </div>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{renderHighlightedText(item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto sin nombre', search)}</span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            <ChannelProviderBadge provider={item.channelConnection.provider} />
                            {providerLabel}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${priorityMeta.className}`}>{priorityMeta.label}</span>
                          {signal.hasPhoneActivity ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Celular</span> : null}
                          {signal.hasCollision ? <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">Colisión</span> : null}
                          {isMuted ? <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">Silenciado</span> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <OriginChip originKey={origin.key} label={origin.label} />
                          <span>{item.channelConnection.name}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-slate-600">{renderHighlightedText(preview, search)}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-right">
                      <span className="text-xs font-medium text-slate-500">{formatConversationListTime(item.lastMessageAt, locale)}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusMeta.className}`}>{statusMeta.label}</span>
                      {item.unreadCount > 0 ? <span className="text-xs font-semibold text-amber-700">{item.unreadCount} sin leer</span> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{item.assignedTo?.name || item.assignedTo?.email || 'Sin asesor'}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${slaMeta.className}`}><Clock3 className="h-3.5 w-3.5" />{slaMeta.label}</span>
                    <span>{slaMeta.elapsedLabel}</span>
                  </div>
                  {!item.assignedTo && currentUserId ? (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800 hover:bg-emerald-100"
                        onClick={(event) => {
                          event.stopPropagation()
                          void takeConversation(item.id)
                        }}
                        disabled={assigning}
                      >
                        Tomar conversación
                      </Button>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.28)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardInfoHeader
              title={<CardTitle className="text-lg">Detalle</CardTitle>}
              description="Asignación, contexto del lead, oportunidad y mensajes del hilo seleccionado."
              tone="data"
            />
          </CardHeader>
          <CardContent className="space-y-4 p-3 md:p-4" aria-busy={detailLoading}>
            {detailLoading ? <span className="sr-only">Cargando detalle...</span> : null}
            {!detailLoading && !selectedConversation ? <p className="text-sm text-muted-foreground">Selecciona una conversación para ver el detalle.</p> : null}
            {selectedConversation ? (
              <>
                {(() => {
                  const selectedSla = getConversationSlaMeta(selectedConversation, locale)
                  const selectedPriority = getConversationPriorityMeta(selectedConversation, locale)
                  const selectedStatus = getConversationStatusMeta(selectedConversation.status)
                  const isMuted = mutedCrmConversationIds.includes(selectedConversation.id)
                  return (
                <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative shrink-0">
                      <IdentityAvatar label={selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación'} imageUrl={selectedConversation.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="lg" />
                      <div className="absolute -bottom-1 -right-1">
                        <ChannelProviderBadge provider={selectedConversation.channelConnection.provider} size="md" />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {editingConversationName ? (
                          <div className="flex items-center gap-2">
                            <Input value={conversationNameDraft} onChange={(event) => setConversationNameDraft(event.target.value)} className="h-10 w-[260px] rounded-xl border-slate-200 bg-white" placeholder="Nombre del lead o contacto" />
                            <Button type="button" size="sm" className="rounded-xl" onClick={() => void saveConversationName()} disabled={savingConversationName}>{savingConversationName ? 'Guardando...' : 'Guardar'}</Button>
                            <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => { setEditingConversationName(false); setConversationNameDraft(selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || '') }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h2 className="text-xl font-semibold text-slate-950">{renderHighlightedText(selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación sin alias', search)}</h2>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-500" onClick={() => setEditingConversationName(true)} aria-label="Editar nombre de la conversación">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedStatus.className}`}>{selectedStatus.label}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedPriority.className}`}>{selectedPriority.label}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedSla.className}`}>{selectedSla.label}</span>
                        {isMuted ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Silenciado</span> : null}
                      </div>
                      <p className="text-sm text-slate-600">
                        {selectedConversation.contactPhone || naText} · {selectedConversation.contactEmail || naText}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                          <ChannelProviderBadge provider={selectedConversation.channelConnection.provider} />
                          <span>{formatProviderDisplayName(selectedConversation.channelConnection.provider)}</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span>Origen:</span>
                          <OriginChip originKey={getConversationOrigin(selectedConversation.channelConnection).key} label={getConversationOrigin(selectedConversation.channelConnection).label} />
                        </span>
                        <span>Canal: {selectedConversation.channelConnection.name}</span>
                        <span>Último mensaje: {formatDate(selectedConversation.lastMessageAt, locale, naText)}</span>
                        <span>{selectedSla.elapsedLabel}</span>
                        <span>Capturas: {selectedConversation.captures.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-xl border-slate-200 bg-white" aria-label="Opciones de conversación">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                        <DropdownMenuLabel>Conversación CRM</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={toggleMuteSelectedConversation}>
                          <BellOff className="mr-2 h-4 w-4" />
                          {isMuted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void updateConversationAction('disable')}>
                          <Clock3 className="mr-2 h-4 w-4" />
                          Deshabilitar temporalmente
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void updateConversationAction('report')}>
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Reportar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void deleteConversationPermanently()} className="text-rose-700 focus:text-rose-700">
                          <X className="mr-2 h-4 w-4" />
                          Eliminar definitivamente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {selectedConversation.lead ? (
                      <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
                        <Link href={`/dashboard/crm/leads/${selectedConversation.lead.id}`}>Abrir lead</Link>
                      </Button>
                    ) : null}
                    {selectedConversation.contactPhone ? (
                      <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
                        <a href={`tel:${selectedConversation.contactPhone}`}>Llamar</a>
                      </Button>
                    ) : null}
                    {!selectedConversation.assignedTo && currentUserId ? (
                      <Button variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" onClick={() => void takeConversation(selectedConversation.id)} disabled={assigning}>
                        {assigning ? 'Tomando...' : 'Tomar conversación'}
                      </Button>
                    ) : null}
                    <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void resolveConversation()} disabled={resolving || selectedConversation.status === 'RESOLVED' || selectedConversation.status === 'DISABLED'}>
                      {resolving ? 'Resolviendo...' : 'Resolver'}
                    </Button>
                  </div>
                </div>
                  )
                })()}

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Atención y asignación</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado de atención</Label>
                          <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as ConversationStatus)}>
                            <SelectTrigger className="rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ATTENTION_STATUS_OPTIONS.map((item) => {
                                const meta = getConversationStatusMeta(item)
                                return <SelectItem key={item} value={item}>{meta.label}</SelectItem>
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Responsable</Label>
                        <Select value={assigneeDraft} onValueChange={setAssigneeDraft}>
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin asesor</SelectItem>
                            {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        </div>
                        <Button className="w-full rounded-xl" onClick={() => void submitAssign()} disabled={assigning}>
                          {assigning ? 'Guardando...' : 'Guardar atención'}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Relaciones CRM</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        <p>
                          Lead:{' '}
                          {selectedConversation.lead ? (
                            <Link href={`/dashboard/crm/leads/${selectedConversation.lead.id}`} className="font-medium text-sky-700 hover:underline">
                              {selectedConversation.lead.nombre}
                            </Link>
                          ) : 'Sin lead'}
                        </p>
                        <p>Cliente: {selectedConversation.cliente?.nombre || 'Sin cliente'}</p>
                        <p>Oportunidad: {selectedConversation.opportunity?.title || 'Sin oportunidad'}</p>
                        {selectedConversation.opportunity && selectedConversation.cliente ? (
                          <Button asChild variant="ghost" className="h-auto p-0 text-sky-700 hover:text-sky-800">
                            <Link href={`/dashboard/cotizador?crmOpportunityId=${selectedConversation.opportunity.id}&clienteId=${selectedConversation.cliente.id}&opportunityTitle=${encodeURIComponent(selectedConversation.opportunity.title)}`}>
                              Ir al cotizador
                            </Link>
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Alertas y seguimiento</CardTitle>
                        <CardDescription>Los nuevos inbounds ahora generan una notificación interna para el responsable del hilo.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-slate-600">
                        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getConversationPriorityMeta(selectedConversation, locale).className}`}>{getConversationPriorityMeta(selectedConversation, locale).label}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getConversationSlaMeta(selectedConversation, locale).className}`}>{getConversationSlaMeta(selectedConversation, locale).label}</span>
                          </div>
                          <p className="text-sm leading-6 text-slate-600">{getConversationSlaMeta(selectedConversation, locale).elapsedLabel}. Usa esta señal para priorizar respuesta, asignación y resolución del hilo.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                          <p className="font-medium text-slate-900">Panel actual de prospectos y mensajes</p>
                          <p className="mt-1 leading-6">Este detalle sirve para operar el hilo, responder y dejar contexto. El paso a pipeline ahora se hace unicamente desde Editar lead.</p>
                        </div>
                        {selectedConversation.lead ? (
                          <Button asChild variant="outline" className="w-full rounded-xl border-slate-200 bg-white">
                            <Link href="/dashboard/crm">Ir a editar lead y pasar a pipeline</Link>
                          </Button>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500">
                            Esta conversación aun no tiene lead asociado para moverla al pipeline desde el flujo oficial.
                          </div>
                        )}
                        <Button asChild variant="outline" className="w-full rounded-xl border-slate-200 bg-white">
                          <Link href="/dashboard/notificaciones">Abrir centro de notificaciones</Link>
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Ultimas capturas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedConversation.captures.length === 0 ? <p className="text-sm text-muted-foreground">Sin capturas registradas.</p> : null}
                        {selectedConversation.captures.map((capture) => (
                          (() => {
                            const normalized = asRecord(capture.normalizedDataJson)
                            const dedupe = asRecord(normalized?.dedupe)
                            const dedupeLead = asRecord(dedupe?.lead)
                            const dedupeConversation = asRecord(dedupe?.conversation)
                            const detectedName = pickString(normalized?.aiName) || pickString(normalized?.fromName)
                            const detectedEmail = pickString(normalized?.aiEmail) || pickString(normalized?.fromAddress)
                            const detectedPhone = pickString(normalized?.aiPhone) || pickString(normalized?.phone)
                            const detectedCompany = pickString(normalized?.aiCompany) || pickString(normalized?.empresaNombre)
                            const detectedCity = pickString(normalized?.aiCity) || pickString(normalized?.ciudad)
                            const detectedRequest = pickString(normalized?.aiRequestSummary) || pickString(normalized?.messageText)
                            const detectedProduct = pickString(normalized?.aiProductOrService)
                            const autoCategory = pickString(normalized?.autoCategory)
                            const autoLeadStatus = pickString(normalized?.autoLeadStatusApplied) || pickString(normalized?.autoLeadStatus)
                            const autoOpportunityId = pickString(normalized?.autoOpportunityId)
                            const autoTaskId = pickString(normalized?.autoTaskId)
                            const leadDedupeStrategy = pickString(dedupeLead?.strategy)
                            const leadDedupeConfidence = pickString(dedupeLead?.confidence)
                            const leadDedupeFields = pickStringArray(dedupeLead?.matchedFields)
                            const conversationDedupeStrategy = pickString(dedupeConversation?.strategy)
                            const conversationDedupeConfidence = pickString(dedupeConversation?.confidence)
                            const conversationDedupeFields = pickStringArray(dedupeConversation?.matchedFields)

                            return (
                              <div key={capture.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-slate-900">{capture.captureType}</span>
                                  <span className="text-xs text-slate-500">{formatDate(capture.createdAt, locale, naText)}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {capture.utmSource || 'sin utm_source'} · {capture.utmMedium || 'sin utm_medium'} · {capture.utmCampaign || 'sin campaña'}
                                </p>
                                {detectedName || detectedEmail || detectedPhone || detectedCompany || detectedCity || detectedRequest ? (
                                  <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600">
                                    <p className="font-semibold text-slate-900">Desglose detectado</p>
                                    {detectedName ? <p><span className="font-medium text-slate-900">Nombre:</span> {detectedName}</p> : null}
                                    {detectedEmail ? <p><span className="font-medium text-slate-900">Correo:</span> {detectedEmail}</p> : null}
                                    {detectedPhone ? <p><span className="font-medium text-slate-900">Teléfono:</span> {detectedPhone}</p> : null}
                                    {detectedCompany ? <p><span className="font-medium text-slate-900">Empresa:</span> {detectedCompany}</p> : null}
                                    {detectedCity ? <p><span className="font-medium text-slate-900">Ciudad:</span> {detectedCity}</p> : null}
                                    {detectedProduct ? <p><span className="font-medium text-slate-900">Producto/servicio:</span> {detectedProduct}</p> : null}
                                    {detectedRequest ? <p className="leading-5"><span className="font-medium text-slate-900">Solicitud:</span> {detectedRequest}</p> : null}
                                  </div>
                                ) : null}
                                {autoCategory || autoLeadStatus || autoOpportunityId || autoTaskId ? (
                                  <div className="mt-3 grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                                    <p className="font-semibold">Automatización comercial</p>
                                    {autoCategory ? <p><span className="font-medium">Clasificación:</span> {autoCategory}</p> : null}
                                    {autoLeadStatus ? <p><span className="font-medium">Estado lead:</span> {autoLeadStatus}</p> : null}
                                    {autoOpportunityId ? <p><span className="font-medium">Oportunidad:</span> creada/vinculada</p> : null}
                                    {autoTaskId ? <p><span className="font-medium">Tarea:</span> creada/vinculada</p> : null}
                                  </div>
                                ) : null}
                                {leadDedupeStrategy || conversationDedupeStrategy ? (
                                  <div className="mt-3 grid gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900">
                                    <p className="font-semibold">Trazabilidad de deduplicación</p>
                                    {leadDedupeStrategy ? (
                                      <div className="grid gap-1 rounded-xl border border-sky-200 bg-white/80 p-2.5">
                                        <p className="font-medium text-slate-900">Lead reutilizado</p>
                                        <p><span className="font-medium text-slate-900">Regla:</span> {leadDedupeStrategy}</p>
                                        {leadDedupeConfidence ? <p><span className="font-medium text-slate-900">Confianza:</span> {leadDedupeConfidence}</p> : null}
                                        {leadDedupeFields.length ? <p><span className="font-medium text-slate-900">Campos:</span> {leadDedupeFields.join(', ')}</p> : null}
                                      </div>
                                    ) : null}
                                    {conversationDedupeStrategy ? (
                                      <div className="grid gap-1 rounded-xl border border-sky-200 bg-white/80 p-2.5">
                                        <p className="font-medium text-slate-900">Conversación reutilizada</p>
                                        <p><span className="font-medium text-slate-900">Regla:</span> {conversationDedupeStrategy}</p>
                                        {conversationDedupeConfidence ? <p><span className="font-medium text-slate-900">Confianza:</span> {conversationDedupeConfidence}</p> : null}
                                        {conversationDedupeFields.length ? <p><span className="font-medium text-slate-900">Campos:</span> {conversationDedupeFields.join(', ')}</p> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })()
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Mensajes</CardTitle>
                        <CardDescription>Historial del hilo en modo pruebas.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Bot className="h-4 w-4 text-emerald-700" />
                                Copiloto comercial
                              </div>
                              <p className="text-xs leading-5 text-slate-600">
                                Genera un resumen corto del hilo y un borrador de respuesta para el asesor.
                              </p>
                              {selectedConversation ? (
                                <Link href={`/dashboard/crm/auditoria-ia?conversationId=${selectedConversation.id}`} className="inline-flex text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                                  Ver auditoría de este hilo
                                </Link>
                              ) : null}
                            </div>
                            <Button variant="outline" className="rounded-xl border-emerald-200 bg-white" onClick={() => selectedConversation ? void loadConversationAi(selectedConversation.id) : undefined} disabled={generatingAi}>
                              {generatingAi ? 'Analizando...' : conversationAi ? 'Regenerar sugerencia' : 'Generar sugerencia IA'}
                            </Button>
                          </div>

                          {conversationAi ? (
                            (() => {
                              const sentimentMeta = getConversationSentimentMeta(conversationAi.sentiment)
                              return (
                                <div className="mt-3 space-y-3">
                                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${sentimentMeta.className}`}>{sentimentMeta.label}</span>
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">Confianza {conversationAi.confidence}</span>
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
                                      {conversationAi.engine.mode === 'LLM' ? `IA ${conversationAi.engine.model || conversationAi.engine.provider}` : 'Reglas internas'}
                                    </span>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resumen</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-700">{conversationAi.summary}</p>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tarea sugerida</p>
                                      <span className="text-xs text-slate-500">{conversationAi.taskSuggestion.reason}</span>
                                    </div>
                                    <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Prioridad: {conversationAi.taskSuggestion.priority}</div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Vence: {formatDate(conversationAi.taskSuggestion.dueAt, locale, 'Sin fecha')}</div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Responsable: {conversationAi.taskSuggestion.assignedToLabel || 'Sin asignar'}</div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta sugerida</p>
                                      <Button
                                        variant="ghost"
                                        className="h-auto rounded-lg px-2 py-1 text-xs text-emerald-700 hover:text-emerald-800"
                                        onClick={() => {
                                          setMessageTypeDraft('TEXT')
                                          setAttachmentUrlDraft('')
                                          setAttachmentNameDraft('')
                                          setMessageDraft(conversationAi.suggestedReply)
                                        }}
                                      >
                                        Usar en borrador
                                      </Button>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{conversationAi.suggestedReply}</p>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Acciones rápidas</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {!selectedConversation.assignedTo || selectedConversation.assignedTo.id !== currentUserId ? (
                                        <Button
                                          variant="outline"
                                          className="rounded-xl border-slate-200 bg-white"
                                          onClick={() => void takeConversation(selectedConversation.id)}
                                          disabled={assigning || !currentUserId}
                                        >
                                          {assigning ? 'Asignando...' : 'Asignarme'}
                                        </Button>
                                      ) : null}
                                      <Button
                                        variant="outline"
                                        className="rounded-xl border-slate-200 bg-white"
                                        onClick={() => void createTaskFromAiSuggestion()}
                                        disabled={creatingAiTask}
                                      >
                                        {creatingAiTask ? 'Creando tarea...' : 'Crear tarea'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        className="rounded-xl border-slate-200 bg-white"
                                        onClick={() => void createOpportunityFromAiSuggestion()}
                                        disabled={creatingAiOpportunity || Boolean(selectedConversation.opportunity) || (!selectedConversation.lead && !selectedConversation.cliente)}
                                      >
                                        {creatingAiOpportunity ? 'Creando oportunidad...' : 'Pasar a oportunidad'}
                                      </Button>
                                    </div>
                                  </div>

                                  {conversationAi.nextActions.length ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Siguiente paso sugerido</p>
                                      <div className="mt-2 space-y-2">
                                        {conversationAi.nextActions.map((action) => (
                                          <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                                            {action}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {!conversationAi.connection.enabled ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                                      El proveedor LLM no está configurado. Esta sugerencia salió con reglas internas para que el inbox siga funcionando.
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })()
                          ) : null}
                        </div>

                        <div ref={conversationThreadViewportRef} className="max-h-[420px] space-y-3 overflow-y-auto rounded-[26px] border border-slate-200/80 bg-white/55 px-3 py-3 pr-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-4 lg:px-6 xl:px-8" style={CONVERSATION_WALLPAPER_STYLE}>
                          {selectedConversation.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes registrados.</p> : null}
                          {selectedConversation.messages.map((message: ConversationMessage, index) => {
                            const hasCollision = hasMessageCollision(message)

                            return (
                            <div ref={index === selectedConversation.messages.length - 1 ? lastConversationMessageRef : null} key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[78%] rounded-3xl border border-sky-200 bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_18px_42px_-30px_rgba(14,116,144,0.42)]' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[78%] rounded-3xl border border-dashed border-slate-300 bg-white/90 px-4 py-3 text-sm text-slate-600' : 'mr-auto max-w-[78%] rounded-3xl border border-slate-200 bg-white/96 px-4 py-3 text-sm text-slate-700 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.22)]'}>
                              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">{getMessageDisplayName(message, selectedConversation)}</span>
                                <span>{formatDate(message.occurredAt, locale, naText)}</span>
                              </div>
                              {hasCollision ? <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-900">Hubo respuestas casi al mismo tiempo desde el CRM y fuera del CRM.</p> : null}
                              {renderConversationMessageBody({
                                message,
                                search,
                                onOpenInvitePreview: setCallInvitePreview,
                              })}
                              {renderConversationAttachments(message.attachmentsJson)}
                            </div>
                          )})}
                        </div>
                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                          <Label>Responder desde el inbox</Label>
                          {messagingWindowState ? (
                            <div className={messagingWindowState.open ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800'}>
                              <span className="font-semibold">{messagingWindowState.label}:</span> {messagingWindowState.hint}
                            </div>
                          ) : null}
                          {hybridComposerGuard ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-3 text-xs text-rose-800">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div className="space-y-2">
                                  <p className="font-semibold">Posible cruce de respuestas</p>
                                  <p>Detectamos una respuesta desde el CRM y otra fuera del CRM casi al mismo tiempo. Revisa el hilo antes de volver a responder.</p>
                                  {hybridComposerGuard.bodyText ? <p className="rounded-xl bg-white/70 px-2.5 py-2 text-[11px] leading-5 text-slate-700">"{hybridComposerGuard.bodyText}"</p> : null}
                                  <label className="flex items-start gap-2 text-[11px] text-slate-700">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                      checked={hybridOverrideConfirmed}
                                      onChange={(event) => setHybridOverrideConfirmed(event.target.checked)}
                                    />
                                    <span>Ya revisé el cruce y aun así quiero responder desde el CRM.</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="grid gap-2">
                              <Label>Tipo</Label>
                              <Select value={messageTypeDraft} onValueChange={(value) => setMessageTypeDraft(value as 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT')}>
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
                              <Label>{messageTypeDraft === 'TEXT' ? 'Mensaje' : 'Texto o caption opcional'}</Label>
                              <Textarea value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} rows={4} placeholder={messageTypeDraft === 'TEXT' ? 'Escribe una respuesta...' : 'Opcional para multimedia, especialmente en WhatsApp.'} />
                            </div>
                          </div>
                          {messageTypeDraft !== 'TEXT' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                ref={attachmentInputRef}
                                type="file"
                                className="hidden"
                                onChange={(event) => void handleAttachmentInputChange(event)}
                              />
                              <div className="grid gap-2 sm:col-span-2">
                                <Label>Adjunto</Label>
                                <div className="flex flex-wrap gap-2">
                                  <Button type="button" variant="outline" className="rounded-xl" onClick={openAttachmentPicker} disabled={uploadingAttachment}>
                                    {uploadingAttachment ? 'Subiendo archivo...' : messageTypeDraft === 'IMAGE' ? 'Subir imagen' : messageTypeDraft === 'AUDIO' ? 'Subir audio' : 'Subir documento'}
                                  </Button>
                                  {messageTypeDraft === 'AUDIO' ? (
                                    <Button type="button" variant={recordingAudio ? 'destructive' : 'outline'} className="rounded-xl" onClick={recordingAudio ? stopAudioRecording : () => void startAudioRecording()} disabled={uploadingAttachment}>
                                      {recordingAudio ? 'Detener grabación' : 'Grabar voz'}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl text-slate-600"
                                    onClick={resetAttachmentComposer}
                                    aria-label="Cerrar adjunto"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  {attachmentUrlDraft ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="rounded-xl text-slate-600"
                                      onClick={resetAttachmentComposer}
                                    >
                                      Quitar adjunto
                                    </Button>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-500">
                                  {recordingAudio
                                    ? 'Grabando nota de voz... al detenerla se subirá automáticamente al chat.'
                                    : uploadingAttachment && attachmentUploadProgress !== null
                                      ? `Subiendo adjunto... ${attachmentUploadProgress}%`
                                      : attachmentUrlDraft
                                        ? 'Adjunto listo para enviar por el canal.'
                                        : audioRecordingIssue && messageTypeDraft === 'AUDIO'
                                          ? audioRecordingIssue
                                          : 'El archivo se sube primero al CRM para que WhatsApp pueda descargarlo desde una URL pública.'}
                                </p>
                              </div>
                              <div className="grid gap-2 sm:col-span-2">
                                <Label>Nombre visible</Label>
                                <Input value={attachmentNameDraft} onChange={(e) => setAttachmentNameDraft(e.target.value)} placeholder="catalogo.pdf o imagen-promocion.jpg" />
                              </div>
                              {attachmentUrlDraft ? (
                                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-600">
                                  <p className="font-medium text-slate-900">Archivo preparado</p>
                                  <p className="mt-1 truncate">{attachmentNameDraft || attachmentUrlDraft}</p>
                                  <a href={attachmentUrlDraft} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-medium text-sky-700 hover:underline">
                                    Abrir adjunto
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="flex justify-end">
                            <Button className="rounded-xl" onClick={() => void submitMessage()} disabled={sending || uploadingAttachment || recordingAudio || Boolean(hybridComposerGuard && !hybridOverrideConfirmed)}>
                              {sending ? 'Enviando...' : 'Enviar mensaje'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Interés y stock</CardTitle>
                        <CardDescription>Busca el producto que pidió el cliente, valida disponibilidad y deja trazabilidad comercial.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Input
                            value={materialSearch}
                            onChange={(e) => setMaterialSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void searchMaterials()
                              }
                            }}
                            placeholder="Buscar producto, proveedor o categoría..."
                          />
                          <Button className="rounded-xl" variant="outline" onClick={() => void searchMaterials()} disabled={materialLoading}>
                            {materialLoading ? 'Buscando...' : 'Buscar stock'}
                          </Button>
                        </div>

                        {materialResults.length > 0 ? (
                          <div className="space-y-2">
                            {materialResults.map((material) => {
                              const stock = getVisibleStock(material)
                              const selected = selectedMaterial?.id === material.id
                              return (
                                <button
                                  key={material.id}
                                  type="button"
                                  onClick={() => setSelectedMaterial(material)}
                                  className={selected ? 'w-full rounded-2xl border border-emerald-300 bg-emerald-50/80 p-3 text-left shadow-sm' : 'w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left'}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-slate-900">{material.nombre}</p>
                                      <p className="mt-1 text-xs text-slate-500">{material.categoria || 'Sin categoría'} · {material.proveedor || 'Sin proveedor'}</p>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className={stock > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>{stock > 0 ? `Stock ${stock}` : 'Sin stock'}</p>
                                      <p className="mt-1 text-slate-500">{formatMoney(getMaterialPrice(material), locale)}</p>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : materialSearch.trim() && !materialLoading ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                            No encontré coincidencias con ese término en productos activos.
                          </div>
                        ) : null}

                        {selectedMaterial ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">Seleccionado: {selectedMaterial.nombre}</p>
                              <Button asChild variant="ghost" className="h-auto p-0 text-sky-700 hover:text-sky-800">
                                <Link href={`/dashboard/productos?search=${encodeURIComponent(selectedMaterial.nombre)}`}>Ver en productos</Link>
                              </Button>
                            </div>
                            <p className="mt-2 leading-6">Stock visible: {getVisibleStock(selectedMaterial)} {selectedMaterial.unidadMedida || 'unidad'} · Precio ref.: {formatMoney(getMaterialPrice(selectedMaterial), locale)}</p>
                          </div>
                        ) : null}

                        <div className="grid gap-2">
                          <Label>Qué pidió o en qué está interesado</Label>
                          <Textarea value={interestNotes} onChange={(e) => setInterestNotes(e.target.value)} rows={4} placeholder="Ejemplo: quiere 200 unidades, entrega esta semana, validar stock inmediato y cerrar en venta real si hay disponibilidad." />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => {
                            setSelectedMaterial(null)
                            setInterestNotes('')
                          }} disabled={savingInterest}>
                            Limpiar
                          </Button>
                          <Button className="rounded-xl" onClick={() => void saveInterestSelection()} disabled={savingInterest}>
                            {savingInterest ? 'Consignando...' : 'Consignar interés'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newConversationOpen} onOpenChange={(open) => {
        setNewConversationOpen(open)
        if (!open) resetNewConversationForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Iniciar conversación</DialogTitle>
            <DialogDescription>Hoy puedes abrir hilos salientes por WhatsApp desde clientes, prospectos o un número manual. Facebook, Instagram, Messenger, TikTok y X siguen entrando por integraciones o inbound.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
                <button type="button" onClick={() => setNewConversationMode('CLIENTE')} className={newConversationMode === 'CLIENTE' ? 'rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm' : 'rounded-xl px-3 py-2 text-sm font-semibold text-slate-500'}>Cliente ERP</button>
                <button type="button" onClick={() => setNewConversationMode('LEAD')} className={newConversationMode === 'LEAD' ? 'rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm' : 'rounded-xl px-3 py-2 text-sm font-semibold text-slate-500'}>Prospecto CRM</button>
                <button type="button" onClick={() => setNewConversationMode('MANUAL')} className={newConversationMode === 'MANUAL' ? 'rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm' : 'rounded-xl px-3 py-2 text-sm font-semibold text-slate-500'}>Número manual</button>
              </div>
            </div>

            {newConversationMode === 'CLIENTE' ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Buscar cliente</Label>
                  <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nombre, documento o correo" />
                </div>
                <div className="grid gap-2">
                  <Label>Cliente</Label>
                  <Select value={selectedClientId || '__none__'} onValueChange={(value) => setSelectedClientId(value === '__none__' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin selección</SelectItem>
                      {clientOptions.map((item) => <SelectItem key={item.id} value={item.id}>{`${item.nombre} · ${item.celular || item.telefono || item.email || item.documento}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {newConversationMode === 'LEAD' ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Buscar prospecto</Label>
                  <Input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Nombre, empresa o correo" />
                </div>
                <div className="grid gap-2">
                  <Label>Prospecto</Label>
                  <Select value={selectedLeadId || '__none__'} onValueChange={(value) => setSelectedLeadId(value === '__none__' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un prospecto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin selección</SelectItem>
                      {leadOptions.map((item) => <SelectItem key={item.id} value={item.id}>{`${item.nombre} · ${item.celular || item.telefono || item.email || item.empresaNombre || 'sin teléfono visible'}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {newConversationMode === 'MANUAL' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nombre visible</Label>
                  <Input value={manualConversationName} onChange={(event) => setManualConversationName(event.target.value)} placeholder="Nombre del contacto o empresa" />
                </div>
                <div className="grid gap-2">
                  <Label>Número de WhatsApp</Label>
                  <Input value={manualConversationPhone} onChange={(event) => setManualConversationPhone(event.target.value)} placeholder="573001234567" />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs leading-5 text-slate-600">
              El sistema abrirá o reutilizará el hilo existente del número seleccionado y lo dejará listo en la bandeja del inbox. Si no hay ventana activa de 24 horas, WhatsApp puede exigir plantilla aprobada para el primer mensaje saliente.
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => {
              setNewConversationOpen(false)
              setSimulatorOpen(true)
            }}>
              Simular inbound QA
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setNewConversationOpen(false)}>Cancelar</Button>
              <Button onClick={() => void startNewConversation()} disabled={openingConversation}>{openingConversation ? 'Abriendo...' : 'Abrir conversación'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="z-[181] max-w-3xl rounded-[28px] border-slate-200 bg-white/98 p-0 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]" overlayClassName="z-[180] bg-slate-950/75 backdrop-blur-[2px]">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,.14),transparent_38%),linear-gradient(180deg,#f8fbff,#ffffff)] px-6 py-5">
          <DialogHeader>
            <DialogTitle>{callDialogType === 'audio' ? 'Llamada embebida CRM' : 'Videollamada embebida CRM'}</DialogTitle>
            <DialogDescription>
              Este modal debe abrirse siempre para confirmar si el CRM está intentando preparar la sala y qué falta para contactar al prospecto por el canal actual.
            </DialogDescription>
          </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-3 md:grid-cols-2">
              {callSetupItems.map((item) => (
                <div key={`${item.title}-${item.detail}`} className={item.tone === 'ready' ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900' : item.tone === 'attention' ? 'rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900' : 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'}>
                  <div className="font-semibold">{item.title}</div>
                  <div className="mt-1 leading-6">{item.detail}</div>
                </div>
              ))}
            </div>

            {dailyCallsAddon?.settings.connectionMode === 'CUSTOMER_DAILY' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Cuenta autogestionada</div>
                    <div className="mt-1 leading-6 text-amber-900">Daily puede pedir tarjeta y credito inicial para habilitar la API en cuentas nuevas.</div>
                  </div>
                </div>
              </div>
            ) : null}

            {callError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{callError}</div>
            ) : null}

            {preparingCall ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">Preparando sesión Daily para esta conversación...</div>
            ) : null}

            {preparedCallSession ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                  <div className="font-semibold">Sala preparada</div>
                  <div className="mt-1">{preparedCallSession.readinessMessage}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Contacto</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{preparedCallSession.contactLabel}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Canal</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{preparedCallSession.provider}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Room</div>
                    <div className="mt-2 break-all text-sm font-medium text-slate-950">{preparedCallSession.roomName}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dominio Daily</div>
                    <div className="mt-2 text-sm font-medium text-slate-950">{preparedCallSession.domainHost || 'Resuelto por backend'}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="font-semibold text-slate-950">Estado de sesión</div>
                  <div className="mt-1 leading-6">La llamada queda registrada en CRM cuando Daily notifica entrada, salida o error de sesión.</div>
                  <div className="mt-2 text-xs text-slate-500">URL base calculada: {preparedCallSession.joinUrl}</div>
                </div>
                {preparedCallSession.callType === 'video' ? (
                  <div className={preparedCallSession.inviteDispatch.sent ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900'}>
                    <div className="font-semibold">Invitación al cliente</div>
                    <div className="mt-1 leading-6">
                      {preparedCallSession.inviteDispatch.sent
                        ? `Se envió el enlace de acceso por WhatsApp a ${preparedCallSession.inviteDispatch.recipient || 'el contacto'}.`
                        : preparedCallSession.inviteDispatch.error || 'No se pudo enviar automáticamente la invitación por WhatsApp.'}
                    </div>
                    {preparedCallSession.guestInviteUrl ? <div className="mt-2 break-all text-xs opacity-80">Enlace invitado: {preparedCallSession.guestInviteUrl}</div> : null}
                  </div>
                ) : null}
                <CrmDailyCallEmbed session={preparedCallSession} onStateChange={setCallState} />
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setCallDialogOpen(false)}>Cerrar</Button>
            {preparedCallSession ? <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{callState === 'JOINED' ? 'Sesión activa' : callState === 'LEFT' ? 'Sesión cerrada' : callState === 'ERROR' ? 'Revisar error' : 'Abriendo sesión'}</div> : <Button asChild className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"><Link href="/dashboard/crm/integraciones">Configurar addon</Link></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(callInvitePreview)} onOpenChange={(open) => {
        if (!open) setCallInvitePreview(null)
      }}>
        <DialogContent className="max-w-5xl overflow-hidden border border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle>{callInvitePreview?.callType === 'audio' ? 'Llamada de audio del cliente' : 'Videollamada del cliente'}</DialogTitle>
            <DialogDescription>La invitacion se abre dentro del CRM para evitar nuevas ventanas y mantener el contexto del inbox.</DialogDescription>
          </DialogHeader>
          <div className="h-[78vh] bg-slate-50">
            {callInvitePreview ? (
              <iframe
                src={callInvitePreview.inviteUrl}
                title="Vista previa de invitacion Daily"
                allow="microphone; camera; fullscreen; display-capture"
                className="h-full w-full border-0"
              />
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="outline" className="rounded-2xl" onClick={() => setCallInvitePreview(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simular inbound</DialogTitle>
            <DialogDescription>Genera un mensaje o captura entrante para QA del funnel omnicanal sin depender de integraciones externas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Canal</Label>
              <Select value={simulateForm.channelConnectionId} onValueChange={(value) => setSimulateForm((prev) => ({ ...prev, channelConnectionId: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona un canal" /></SelectTrigger>
                <SelectContent>
                  {channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {formatRelativeChannel(item.provider)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label>Nombre</Label><Input value={simulateForm.nombre} onChange={(e) => setSimulateForm((prev) => ({ ...prev, nombre: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Empresa</Label><Input value={simulateForm.empresaNombre} onChange={(e) => setSimulateForm((prev) => ({ ...prev, empresaNombre: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Email</Label><Input value={simulateForm.email} onChange={(e) => setSimulateForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Teléfono</Label><Input value={simulateForm.telefono} onChange={(e) => setSimulateForm((prev) => ({ ...prev, telefono: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Ciudad</Label><Input value={simulateForm.ciudad} onChange={(e) => setSimulateForm((prev) => ({ ...prev, ciudad: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Documento</Label><Input value={simulateForm.documento} onChange={(e) => setSimulateForm((prev) => ({ ...prev, documento: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje</Label>
              <Textarea value={simulateForm.message} onChange={(e) => setSimulateForm((prev) => ({ ...prev, message: e.target.value }))} rows={4} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2"><Label>Campaña</Label><Input value={simulateForm.sourceCampaign} onChange={(e) => setSimulateForm((prev) => ({ ...prev, sourceCampaign: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Medio</Label><Input value={simulateForm.sourceMedium} onChange={(e) => setSimulateForm((prev) => ({ ...prev, sourceMedium: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Contenido</Label><Input value={simulateForm.sourceContent} onChange={(e) => setSimulateForm((prev) => ({ ...prev, sourceContent: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulatorOpen(false)}>Cancelar</Button>
            <Button onClick={() => void runSimulation()} disabled={simulating}>{simulating ? 'Simulando...' : 'Crear inbound'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiTaskDialogOpen} onOpenChange={setAiTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear tarea desde IA</DialogTitle>
            <DialogDescription>La sugerencia ya llega prellenada con prioridad, vencimiento y responsable. Ajusta lo que haga falta antes de crearla.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={aiTaskDraft.title} onChange={(e) => setAiTaskDraft((current) => ({ ...current, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={aiTaskDraft.description} onChange={(e) => setAiTaskDraft((current) => ({ ...current, description: e.target.value }))} rows={6} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Prioridad</Label>
                <Select value={aiTaskDraft.priority} onValueChange={(value) => setAiTaskDraft((current) => ({ ...current, priority: value as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Vencimiento</Label>
                <Input type="datetime-local" value={aiTaskDraft.dueAt} onChange={(e) => setAiTaskDraft((current) => ({ ...current, dueAt: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Responsable</Label>
                <Select value={aiTaskDraft.assignedToUserId} onValueChange={(value) => setAiTaskDraft((current) => ({ ...current, assignedToUserId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asesor</SelectItem>
                    {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{formatAssigneeName(item)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiTaskDialogOpen(false)} disabled={creatingAiTask}>Cancelar</Button>
            <Button onClick={() => void submitAiTaskSuggestion()} disabled={creatingAiTask}>{creatingAiTask ? 'Creando tarea...' : 'Crear tarea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}