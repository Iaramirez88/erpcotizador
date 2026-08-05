"use client"

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BellOff, Bot, Check, CheckCheck, Clock3, Facebook, FileAudio, FileText, Image as ImageIcon, Instagram, Mail, MessageCircle, MoreVertical, PhoneCall, Plus, RefreshCcw, SendHorizontal, Smile } from 'lucide-react'
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

type ConversationStatus = 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM'
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

const STATUS_OPTIONS: Array<'ALL' | ConversationStatus> = ['ALL', 'OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'RESOLVED', 'SPAM']
const ATTENTION_STATUS_OPTIONS: ConversationStatus[] = ['OPEN', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'PENDING', 'RESOLVED', 'SPAM']
const EMOJI_CHOICES = ['😀', '😂', '😉', '😍', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀']

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

function getMessageOriginMeta(origin: MessageOrigin) {
  switch (origin) {
    case 'PHONE_APP':
      return { label: 'Celular', className: 'bg-amber-100 text-amber-800' }
    case 'CRM_AGENT':
      return { label: 'CRM', className: 'bg-sky-100 text-sky-800' }
    case 'BOT':
      return { label: 'Bot', className: 'bg-emerald-100 text-emerald-800' }
    case 'SYSTEM':
      return { label: 'Sistema', className: 'bg-slate-200 text-slate-700' }
    default:
      return { label: 'Cliente', className: 'bg-white/80 text-slate-700' }
  }
}

function renderConversationAttachments(attachments: ConversationMessage['attachmentsJson']) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment, index) => {
        const attachmentType = String(attachment.type || '').trim().toLowerCase()
        const attachmentUrl = String(attachment.url || '').trim()
        if (!attachmentUrl) return null

        const attachmentLabel = attachment.name || attachment.alt || attachmentUrl || 'Adjunto'

        if (attachmentType === 'image') {
          return (
            <ChatImagePreview
              key={`${attachmentUrl}-${index}`}
              src={attachmentUrl}
              alt={attachment.alt || attachmentLabel}
              title={attachmentLabel}
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90">
                <img src={attachmentUrl} alt={attachment.alt || attachmentLabel} className="max-h-80 w-full object-cover" />
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

function renderCrmMessageStatusIcon(status: ConversationMessage['status']) {
  if (status === 'READ') return <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
  if (status === 'DELIVERED') return <Check className="h-3.5 w-3.5 text-sky-600" />
  if (status === 'SENT') return <Check className="h-3.5 w-3.5 text-slate-400" />
  if (status === 'QUEUED') return <Clock3 className="h-3.5 w-3.5 text-slate-400" />
  if (status === 'FAILED') return <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
  return null
}

function getCrmMessageStatusLabel(status: ConversationMessage['status']) {
  if (status === 'READ') return 'Visto'
  if (status === 'DELIVERED') return 'Llegó'
  if (status === 'SENT') return 'Enviado'
  if (status === 'QUEUED') return 'Enviando'
  if (status === 'FAILED') return 'Falló'
  return status || null
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
  if (conversation.status === 'RESOLVED' || conversation.status === 'SPAM') {
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
  if (sla.state === 'breached' || conversation.unreadCount >= 3 || (!conversation.assignedTo && conversation.status !== 'RESOLVED' && conversation.status !== 'SPAM')) {
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

  if (!conversation.assignedTo && conversation.status !== 'RESOLVED' && conversation.status !== 'SPAM') score += 35
  if (conversation.unreadCount > 0) score += Math.min(conversation.unreadCount, 5) * 5
  if (conversation.status === 'BOT_ACTIVE') score += 18
  if (conversation.status === 'OPEN') score += 12
  if (conversation.status === 'PENDING') score -= 8

  const lastMessageAt = new Date(conversation.lastMessageAt).getTime()
  const timestamp = Number.isNaN(lastMessageAt) ? 0 : lastMessageAt

  return { score, timestamp, slaState: sla.state, priorityLabel: priority.label }
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
  const [liveMode, setLiveMode] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialResults, setMaterialResults] = useState<MaterialLookupItem[]>([])
  const [materialLoading, setMaterialLoading] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialLookupItem | null>(null)
  const [interestNotes, setInterestNotes] = useState('')
  const [savingInterest, setSavingInterest] = useState(false)

  const [assigneeDraft, setAssigneeDraft] = useState('__none__')
  const [statusDraft, setStatusDraft] = useState<ConversationStatus>('OPEN')
  const [messageDraft, setMessageDraft] = useState('')
  const [messageTypeDraft, setMessageTypeDraft] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'>('TEXT')
  const [attachmentUrlDraft, setAttachmentUrlDraft] = useState('')
  const [attachmentNameDraft, setAttachmentNameDraft] = useState('')
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState<number | null>(null)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [hybridOverrideConfirmed, setHybridOverrideConfirmed] = useState(false)
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
    void Promise.all([loadConversations(), loadMeta()])
  }, [loadConversations, loadMeta])

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
    if (!selectedConversationId) {
      setSelectedConversation(null)
      return
    }
    void loadDetail(selectedConversationId)
  }, [loadDetail, selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) return
    void loadConversationAi(selectedConversationId, { silent: true })
  }, [loadConversationAi, selectedConversationId])

  useEffect(() => {
    if (!liveMode) return

    const interval = window.setInterval(() => {
      void loadConversations()
      if (selectedConversationId) {
        void loadDetail(selectedConversationId)
      }
    }, 4000)

    return () => window.clearInterval(interval)
  }, [liveMode, loadConversations, loadDetail, selectedConversationId])

  useEffect(() => {
    setMaterialSearch('')
    setMaterialResults([])
    setSelectedMaterial(null)
    setInterestNotes('')
    setConversationAi(null)
  }, [selectedConversationId])

  const stats = useMemo(() => {
    const openCount = conversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'SPAM').length
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
      if (leftRank.score !== rightRank.score) return rightRank.score - leftRank.score
      return rightRank.timestamp - leftRank.timestamp
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
    const pendingCount = dateScopedConversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'SPAM').length
    const resolvedCount = dateScopedConversations.filter((item) => item.status === 'RESOLVED').length
    return {
      pendingCount,
      resolvedCount,
      allCount: dateScopedConversations.length,
    }
  }, [dateScopedConversations])

  const displayedConversations = useMemo(() => {
    if (inboxStatusTab === 'ALL') return dateScopedConversations
    if (inboxStatusTab === 'RESOLVED') return dateScopedConversations.filter((item) => item.status === 'RESOLVED')
    return dateScopedConversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'SPAM')
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
        const shouldOverride = window.confirm(`${json.error || 'Se detectó actividad reciente desde el celular.'}\n\n${json.recentPhoneActivity ? formatRecentPhoneActivityHint(json.recentPhoneActivity, locale, naText) : 'Revisa el hilo antes de responder.'}\n\nPulsa Aceptar para enviar de todas formas desde el CRM.`)
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
      setAttachmentUrlDraft('')
      setAttachmentNameDraft('')
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
    if (typeof window === 'undefined' || !window.navigator.mediaDevices?.getUserMedia) {
      alert('Este navegador no permite grabar audio desde el CRM.')
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
      setRecordingAudio(true)
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      setRecordingAudio(false)
      alert(error instanceof Error ? error.message : 'No se pudo iniciar la grabación de audio.')
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

    const recentPhoneOutbound = [...selectedConversation.messages]
      .filter((message) => message.direction === 'OUTBOUND' && getMessageOrigin(message) === 'PHONE_APP')
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0] ?? null

    if (!recentPhoneOutbound) return null

    const elapsedMs = Date.now() - new Date(recentPhoneOutbound.occurredAt).getTime()
    if (Number.isNaN(elapsedMs) || elapsedMs > 5 * 60 * 1000) return null

    return {
      messageId: recentPhoneOutbound.id,
      occurredAt: recentPhoneOutbound.occurredAt,
      bodyText: recentPhoneOutbound.bodyText,
      hasCollision: hasMessageCollision(recentPhoneOutbound),
    }
  }, [selectedConversation])

  useEffect(() => {
    setHybridOverrideConfirmed(false)
  }, [selectedConversation?.id, hybridComposerGuard?.messageId])

  const [detailPanelTab, setDetailPanelTab] = useState<'CHAT' | 'CRM' | 'AI' | 'CAPTURES'>('CHAT')

  useEffect(() => {
    setDetailPanelTab('CHAT')
  }, [selectedConversationId])

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
                Resueltos {inboxStatusCounts.resolvedCount}
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
        <div className="grid gap-4 xl:min-h-[calc(100vh-7rem)] xl:grid-cols-[360px_minmax(0,1fr)] xl:items-stretch">
          <Card className="overflow-hidden rounded-[30px] border-slate-200 bg-white/95 shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)] xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-7rem)] xl:flex-col">
            <CardContent className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3.5">
              {props.sidebarHeader ? props.sidebarHeader : null}

              <Button className="h-12 w-full justify-start rounded-[24px] bg-[linear-gradient(135deg,#315efb,#5675ff)] px-4 text-left text-white shadow-[0_18px_36px_-24px_rgba(49,94,251,0.7)] hover:bg-[linear-gradient(135deg,#2b52dc,#4b6ef2)]" onClick={() => setSimulatorOpen(true)}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/18 text-base font-semibold">+</span>
                <span className="ml-3 flex flex-col items-start">
                  <span className="text-sm font-semibold">Nuevo chat</span>
                  <span className="text-[11px] font-medium text-blue-100">Simular inbound o abrir un nuevo hilo</span>
                </span>
              </Button>

              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="space-y-3">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversaciones..." className="h-11 rounded-2xl border-slate-200 bg-white" />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Select value={datePreset} onValueChange={(value) => setDatePreset(value as InboxDatePreset)}>
                      <SelectTrigger className="h-10 rounded-2xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7D">Últimos 7 días</SelectItem>
                        <SelectItem value="30D">Últimos 30 días</SelectItem>
                        <SelectItem value="ALL">Todo el historial</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-10 rounded-2xl border-slate-200 bg-white px-3" onClick={() => void loadConversations()}>
                      Aplicar
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100/90 p-1">
                    <button type="button" onClick={() => setInboxStatusTab('PENDING')} className={inboxStatusTab === 'PENDING' ? 'rounded-xl bg-white px-2.5 py-2 text-sm font-semibold text-blue-700 shadow-sm' : 'rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-500'}>
                      <span className="block">Por resolver</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{inboxStatusCounts.pendingCount}</span>
                    </button>
                    <button type="button" onClick={() => setInboxStatusTab('RESOLVED')} className={inboxStatusTab === 'RESOLVED' ? 'rounded-xl bg-white px-2.5 py-2 text-sm font-semibold text-emerald-700 shadow-sm' : 'rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-500'}>
                      <span className="block">Resueltos</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{inboxStatusCounts.resolvedCount}</span>
                    </button>
                    <button type="button" onClick={() => setInboxStatusTab('ALL')} className={inboxStatusTab === 'ALL' ? 'rounded-xl bg-white px-2.5 py-2 text-sm font-semibold text-slate-800 shadow-sm' : 'rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-500'}>
                      <span className="block">Todos</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{inboxStatusCounts.allCount}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-3.5">
                <div className="flex flex-col gap-3 px-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Bandeja</p>
                      <p className="mt-1 text-xs text-slate-500">{displayedConversations.length} conversaciones visibles</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <div className="grid gap-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tiempo real</span>
                        <span>{liveMode ? 'Activo' : 'Pausado'}</span>
                      </div>
                      <Switch checked={liveMode} onCheckedChange={setLiveMode} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <button type="button" onClick={() => setQueueScope('TEAM')} className={queueScope === 'TEAM' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                    <span className="inline-flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" />Todos</span>
                    <span className={queueScope === 'TEAM' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.teamCount}</span>
                  </button>
                  <button type="button" onClick={() => setQueueScope('MINE')} className={queueScope === 'MINE' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                    <span className="inline-flex items-center gap-2 text-sm font-medium"><CheckCheck className="h-4 w-4" />Asignados a mí</span>
                    <span className={queueScope === 'MINE' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.mineCount}</span>
                  </button>
                  <button type="button" onClick={() => setQueueScope('UNASSIGNED')} className={queueScope === 'UNASSIGNED' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}>
                    <span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Sin asignar</span>
                    <span className={queueScope === 'UNASSIGNED' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueSummary.unassignedCount}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-3.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Por actividad</p>
                <div className="mt-3 space-y-1.5">
                  <button type="button" onClick={() => setQueueFocus('ALL')} className={queueFocus === 'ALL' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" />Todos</span><span className={queueFocus === 'ALL' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.allCount}</span></button>
                  <button type="button" onClick={() => setQueueFocus('IMMEDIATE')} className={queueFocus === 'IMMEDIATE' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" />No leídos / urgentes</span><span className={queueFocus === 'IMMEDIATE' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.immediateCount}</span></button>
                  <button type="button" onClick={() => setQueueFocus('WAITING_CUSTOMER')} className={queueFocus === 'WAITING_CUSTOMER' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Sin respuestas</span><span className={queueFocus === 'WAITING_CUSTOMER' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.waitingCustomerCount}</span></button>
                  <button type="button" onClick={() => setQueueFocus('BOT_HANDOFF')} className={queueFocus === 'BOT_HANDOFF' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4" />Asignadas a la IA</span><span className={queueFocus === 'BOT_HANDOFF' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.botHandoffCount}</span></button>
                  <button type="button" onClick={() => setQueueFocus('HYBRID_PHONE_ACTIVITY')} className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><PhoneCall className="h-4 w-4" />Actividad celular</span><span className={queueFocus === 'HYBRID_PHONE_ACTIVITY' ? 'rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600'}>{queueFocusSummary.hybridPhoneActivityCount}</span></button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-3.5">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canales</p>
                <div className="mt-3 space-y-1.5">
                  <button type="button" onClick={() => setProviderFilter('WHATSAPP_CLOUD')} className={(providerFilter === 'WHATSAPP_CLOUD' || providerFilter === 'WHATSAPP_SANDBOX') ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><ChannelProviderBadge provider="WHATSAPP_CLOUD" />WhatsApp</span><span className="text-[11px] text-slate-400">Chat</span></button>
                  <button type="button" onClick={() => setProviderFilter('MESSENGER')} className={providerFilter === 'MESSENGER' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><ChannelProviderBadge provider="MESSENGER" />Messenger</span><span className="text-[11px] text-slate-400">Meta</span></button>
                  <button type="button" onClick={() => setProviderFilter('INSTAGRAM_DM')} className={providerFilter === 'INSTAGRAM_DM' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><ChannelProviderBadge provider="INSTAGRAM_DM" />Instagram</span><span className="text-[11px] text-slate-400">DM</span></button>
                  <button type="button" onClick={() => setProviderFilter('FACEBOOK_PAGE')} className={providerFilter === 'FACEBOOK_PAGE' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><ChannelProviderBadge provider="FACEBOOK_PAGE" />Facebook</span><span className="text-[11px] text-slate-400">Page</span></button>
                  <button type="button" onClick={() => setProviderFilter('ALL')} className={providerFilter === 'ALL' ? 'flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3.5 py-2.5 text-left text-blue-800' : 'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-50'}><span className="inline-flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" />Todos</span><span className="text-[11px] text-slate-400">Inbox</span></button>
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

              <div className="rounded-[28px] border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{queueScope === 'TEAM' ? 'Equipo' : queueScope === 'MINE' ? 'Mías' : 'Sin asignar'}</span>
                </div>
                <div className="max-h-[calc(100vh-320px)] space-y-1.5 overflow-y-auto p-3">
                  {loading ? <p className="px-2 py-4 text-sm text-slate-500">Cargando conversaciones...</p> : null}
                  {!loading && displayedConversations.length === 0 ? <p className="px-2 py-4 text-sm text-slate-500">No hay conversaciones para mostrar.</p> : null}
                  {displayedConversations.map((item) => {
                    const isActive = item.id === selectedConversationId
                    const preview = item.messages?.[0]?.bodyText || item.sourceCampaign || item.contactEmail || item.contactPhone || naText
                    const slaMeta = getConversationSlaMeta(item, locale)
                    const statusMeta = getConversationStatusMeta(item.status)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedConversationId(item.id)}
                        className={isActive ? 'w-full rounded-[22px] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] p-3 text-left shadow-[0_16px_32px_-28px_rgba(37,99,235,0.6)]' : 'w-full rounded-[22px] border border-transparent bg-white p-3 text-left transition hover:border-slate-200 hover:bg-slate-50/70'}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="relative shrink-0">
                              <IdentityAvatar label={item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || item.contactPhone || item.contactEmail || 'Contacto'} imageUrl={item.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="sm" />
                              <div className="absolute -bottom-1 -right-1">
                                <ChannelProviderBadge provider={item.channelConnection.provider} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-950">{renderHighlightedText(item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto', search)}</p>
                                {item.unreadCount > 0 ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">{item.unreadCount}</span> : null}
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-[13px] leading-5 text-slate-500">{renderHighlightedText(preview, search)}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span>{formatProviderDisplayName(item.channelConnection.provider)}</span>
                                <span className={`rounded-full border px-2 py-0.5 ${slaMeta.className}`}>{slaMeta.label}</span>
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 space-y-1 text-right">
                            <span className="block text-[11px] font-medium text-slate-400">{formatConversationListTime(item.lastMessageAt, locale)}</span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)] xl:h-[calc(100vh-7rem)]">
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
              <div className="sticky top-0 z-20 border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-3 lg:px-5">
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
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="relative shrink-0">
                              <IdentityAvatar label={selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación'} imageUrl={selectedConversation.contactAvatarUrl} fallbackImageUrl="/crm-contact-avatar-default.svg" size="lg" />
                              <div className="absolute -bottom-1 -right-1">
                                <ChannelProviderBadge provider={selectedConversation.channelConnection.provider} size="md" />
                              </div>
                            </div>
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-950 sm:text-base">{renderHighlightedText(selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación sin alias', search)}</h2>
                                {isMuted ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Silenciado</span> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.16em] text-slate-600">{selectedProvider}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">{selectedConversation.contactPhone || naText}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">{selectedConversation.contactEmail || naText}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedStatus.className}`}>{selectedStatus.label}</span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedPriority.className}`}>{selectedPriority.label}</span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedSla.className}`}>{selectedSla.label}</span>
                            <span className="text-sm text-slate-500">{selectedSla.elapsedLabel}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white/92 p-2 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.35)]">
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
                              <DropdownMenuItem onSelect={() => void resolveConversation()} disabled={resolving || selectedConversation.status === 'RESOLVED'}>
                                <Clock3 className="mr-2 h-4 w-4" />
                                {resolving ? 'Resolviendo...' : 'Resolver'}
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

              <div className={detailPanelTab === 'CHAT' ? 'min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.07),transparent_32%),linear-gradient(180deg,#ffffff,#fbfdff)] p-3.5 lg:p-4' : 'min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.07),transparent_32%),linear-gradient(180deg,#ffffff,#fbfdff)] p-3.5 lg:p-4'}>
                {!selectedConversation ? null : detailPanelTab === 'CHAT' ? (
                  <div className="h-full">
                    <Card className="flex h-full min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white/98 shadow-none">
                      <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-4 p-4 lg:p-5">
                        <div className="min-h-0 rounded-[24px] border border-slate-100 bg-slate-50/45 p-3">
                          <div className="h-full space-y-3 overflow-y-auto pr-1">
                          {selectedConversation.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes registrados.</p> : null}
                          {selectedConversation.messages.map((message: ConversationMessage) => {
                            const originMeta = getMessageOriginMeta(getMessageOrigin(message))
                            const hasCollision = hasMessageCollision(message)
                            const statusLabel = getCrmMessageStatusLabel(message.status)

                            return (
                              <div key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[86%] rounded-[28px] border border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] px-4 py-3 text-sm text-slate-700' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[86%] rounded-[26px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600' : 'mr-auto max-w-[86%] rounded-[28px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <span>{message.direction}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case ${originMeta.className}`}>{originMeta.label}</span>
                                    {hasCollision ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-800">Colisión</span> : null}
                                  </div>
                                  <span>{formatDate(message.occurredAt, locale, naText)}</span>
                                </div>
                                {hasCollision ? <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-900">Se detectó una posible doble respuesta entre el celular y el CRM en esta conversación.</p> : null}
                                <p className="mt-2 whitespace-pre-wrap leading-6">{renderHighlightedText(message.bodyText || 'Sin contenido textual', search)}</p>
                                {renderConversationAttachments(message.attachmentsJson)}
                                {message.direction === 'OUTBOUND' && statusLabel ? (
                                  <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                    {renderCrmMessageStatusIcon(message.status)}
                                    <span>{statusLabel}</span>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                          </div>
                        </div>

                        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4">
                          {messagingWindowState ? (
                            <div className={messagingWindowState.open ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800'}>
                              <span className="font-semibold">{messagingWindowState.label}:</span> {messagingWindowState.hint}
                            </div>
                          ) : null}
                          {hybridComposerGuard ? (
                            <div className={hybridComposerGuard.hasCollision ? 'rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-3 text-xs text-rose-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-xs text-amber-900'}>
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div className="space-y-2">
                                  <p className="font-semibold">{hybridComposerGuard.hasCollision ? 'Riesgo alto de doble respuesta' : 'Actividad reciente desde celular detectada'}</p>
                                  <p>Se detectó un mensaje saliente desde celular el {formatDate(hybridComposerGuard.occurredAt, locale, naText)}. Revisa esa intervención antes de contestar desde el CRM.</p>
                                  {hybridComposerGuard.bodyText ? <p className="rounded-xl bg-white/70 px-2.5 py-2 text-[11px] leading-5 text-slate-700">"{hybridComposerGuard.bodyText}"</p> : null}
                                  <label className="flex items-start gap-2 text-[11px] text-slate-700">
                                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={hybridOverrideConfirmed} onChange={(event) => setHybridOverrideConfirmed(event.target.checked)} />
                                    <span>Confirmo que revisé la actividad del celular y aun así quiero responder desde el CRM.</span>
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
                            <Label>{messageTypeDraft === 'TEXT' ? 'Mensaje' : 'Texto o caption opcional'}</Label>
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
                                  {attachmentUrlDraft ? (
                                    <Button type="button" variant="ghost" className="rounded-xl text-slate-600" onClick={() => {
                                      setAttachmentUrlDraft('')
                                      setAttachmentNameDraft('')
                                    }}>
                                      Quitar adjunto
                                    </Button>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-500">{recordingAudio ? 'Grabando nota de voz... al detenerla se subirá automáticamente al chat.' : uploadingAttachment && attachmentUploadProgress !== null ? `Subiendo adjunto... ${attachmentUploadProgress}%` : attachmentUrlDraft ? 'Adjunto listo para enviar por el canal.' : 'El archivo se sube primero al CRM para que WhatsApp pueda descargarlo desde una URL pública.'}</p>
                              </div>
                              <div className="grid gap-2 lg:col-span-2">
                                <Label>Nombre visible</Label>
                                <Input value={attachmentNameDraft} onChange={(e) => setAttachmentNameDraft(e.target.value)} className="rounded-2xl border-slate-200 bg-white" placeholder="catalogo.pdf o imagen-promocion.jpg" />
                              </div>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                            <p>{recordingAudio ? 'Grabando nota de voz... al detenerla se subirá automáticamente al chat.' : uploadingAttachment && attachmentUploadProgress !== null ? `Subiendo adjunto... ${attachmentUploadProgress}%` : attachmentUrlDraft ? 'Adjunto listo para enviar por el canal.' : 'Puedes enviar texto, emojis, audios, imágenes y documentos.'}</p>
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
            {loading ? <p className="text-sm text-muted-foreground">Cargando conversaciones...</p> : null}
            {!loading && displayedConversations.length === 0 ? <p className="text-sm text-muted-foreground">No hay conversaciones para mostrar.</p> : null}
            {displayedConversations.map((item) => {
              const isActive = item.id === selectedConversationId
              const isMuted = mutedCrmConversationIds.includes(item.id)
              const preview = item.messages?.[0]?.bodyText || item.sourceCampaign || item.contactEmail || item.contactPhone || naText
              const origin = getConversationOrigin(item.channelConnection)
              const signal = getConversationListSignal(item)
              const slaMeta = getConversationSlaMeta(item, locale)
              const priorityMeta = getConversationPriorityMeta(item, locale)
              const statusMeta = getConversationStatusMeta(item.status)
              const providerLabel = formatProviderDisplayName(item.channelConnection.provider)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedConversationId(item.id)}
                  className={isActive ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-sky-100 bg-[linear-gradient(180deg,_rgba(240,249,255,0.72),_#ffffff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md hover:bg-sky-50/70'}
                >
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
                        <h2 className="text-xl font-semibold text-slate-950">{renderHighlightedText(selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación sin alias', search)}</h2>
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
                    <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void resolveConversation()} disabled={resolving || selectedConversation.status === 'RESOLVED'}>
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

                        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                          {selectedConversation.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes registrados.</p> : null}
                          {selectedConversation.messages.map((message: ConversationMessage) => {
                            const originMeta = getMessageOriginMeta(getMessageOrigin(message))
                            const hasCollision = hasMessageCollision(message)
                            const statusLabel = getCrmMessageStatusLabel(message.status)

                            return (
                            <div key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[88%] rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[88%] rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600' : 'mr-auto max-w-[88%] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span>{message.direction}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case ${originMeta.className}`}>{originMeta.label}</span>
                                  {hasCollision ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-800">Colisión</span> : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>{formatDate(message.occurredAt, locale, naText)}</span>
                                </div>
                              </div>
                              {hasCollision ? <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-900">Se detectó una posible doble respuesta entre el celular y el CRM en esta conversación.</p> : null}
                              <p className="mt-2 whitespace-pre-wrap leading-6">{renderHighlightedText(message.bodyText || 'Sin contenido textual', search)}</p>
                              {renderConversationAttachments(message.attachmentsJson)}
                              {message.direction === 'OUTBOUND' && statusLabel ? (
                                <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                  {renderCrmMessageStatusIcon(message.status)}
                                  <span>{statusLabel}</span>
                                </div>
                              ) : null}
                              {'sentByUser' in message && message.sentByUser ? <p className="mt-2 text-[11px] text-slate-500">{message.sentByUser.name || message.sentByUser.email}</p> : null}
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
                            <div className={hybridComposerGuard.hasCollision ? 'rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-3 text-xs text-rose-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-xs text-amber-900'}>
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div className="space-y-2">
                                  <p className="font-semibold">
                                    {hybridComposerGuard.hasCollision ? 'Riesgo alto de doble respuesta' : 'Actividad reciente desde celular detectada'}
                                  </p>
                                  <p>
                                    Se detectó un mensaje saliente desde celular el {formatDate(hybridComposerGuard.occurredAt, locale, naText)}. Revisa esa intervención antes de contestar desde el CRM.
                                  </p>
                                  {hybridComposerGuard.bodyText ? <p className="rounded-xl bg-white/70 px-2.5 py-2 text-[11px] leading-5 text-slate-700">"{hybridComposerGuard.bodyText}"</p> : null}
                                  <label className="flex items-start gap-2 text-[11px] text-slate-700">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                      checked={hybridOverrideConfirmed}
                                      onChange={(event) => setHybridOverrideConfirmed(event.target.checked)}
                                    />
                                    <span>Confirmo que revisé la actividad del celular y aun así quiero responder desde el CRM.</span>
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
                                  {attachmentUrlDraft ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="rounded-xl text-slate-600"
                                      onClick={() => {
                                        setAttachmentUrlDraft('')
                                        setAttachmentNameDraft('')
                                      }}
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