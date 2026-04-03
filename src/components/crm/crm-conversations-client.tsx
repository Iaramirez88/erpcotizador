"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, FileText, Mail, MessageCircle, PhoneCall } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/components/providers/i18n-provider'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'

type ConversationStatus = 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM'
type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM'
type ChannelProvider = 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'
type BridgeKind = 'GENERIC' | 'GMAIL' | 'OUTLOOK' | 'TIKTOK' | 'YOUTUBE'
type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
type OriginFilter = 'ALL' | 'EMAIL' | 'FORM' | 'CHATBOT' | 'WHATSAPP' | 'SOCIAL' | 'PHONE' | 'REFERRAL' | 'IMPORT'

type Assignee = {
  id: string
  name?: string | null
  email?: string | null
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
  attachmentsJson?: Array<{
    type?: string | null
    url?: string | null
    name?: string | null
    alt?: string | null
  }> | null
  occurredAt: string
  sentByUser?: Assignee | null
}

type ConversationListItem = {
  id: string
  status: ConversationStatus
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

type CrmConversationsClientProps = {
  initialProviderFilter?: ChannelProvider | null
  title?: string
  description?: string
  hideHero?: boolean
}

const STATUS_OPTIONS: Array<'ALL' | ConversationStatus> = ['ALL', 'OPEN', 'PENDING', 'BOT_ACTIVE', 'HUMAN_ACTIVE', 'RESOLVED', 'SPAM']

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const res = await fetch(url, init)
  return (await res.json().catch(() => ({}))) as JsonResponse<T>
}

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
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

function getConversationOrigin(channel: Channel) {
  return getCrmOriginMeta({ provider: channel.provider, bridgeKind: channel.bridgeKind })
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

export function CrmConversationsClient(props: CrmConversationsClientProps) {
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = '—'

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ConversationStatus>('ALL')
  const [assignedFilter, setAssignedFilter] = useState<'ALL' | string>('ALL')
  const [channelFilter, setChannelFilter] = useState<'ALL' | string>('ALL')
  const [providerFilter, setProviderFilter] = useState<'ALL' | ChannelProvider>(props.initialProviderFilter ?? 'ALL')
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL')
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  const [assigning, setAssigning] = useState(false)
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
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
  const [messageDraft, setMessageDraft] = useState('')
  const [messageTypeDraft, setMessageTypeDraft] = useState<'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'>('TEXT')
  const [attachmentUrlDraft, setAttachmentUrlDraft] = useState('')
  const [attachmentNameDraft, setAttachmentNameDraft] = useState('')
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
      setSelectedConversationId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null)
      setLastRefreshAt(new Date().toISOString())
    } finally {
      setLoading(false)
    }
  }, [assignedFilter, channelFilter, providerFilter, search, statusFilter])

  const loadMeta = useCallback(async () => {
    const [assigneeRes, channelRes] = await Promise.all([
      requestJson<Assignee[]>('/api/crm/assignees'),
      requestJson<Channel[]>('/api/crm/channels'),
    ])
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
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadConversations(), loadMeta()])
  }, [loadConversations, loadMeta])

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null)
      return
    }
    void loadDetail(selectedConversationId)
  }, [loadDetail, selectedConversationId])

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
  }, [selectedConversationId])

  const stats = useMemo(() => {
    const openCount = conversations.filter((item) => item.status !== 'RESOLVED' && item.status !== 'SPAM').length
    const unassignedCount = conversations.filter((item) => !item.assignedTo).length
    const unreadCount = conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0)
    return { openCount, unassignedCount, unreadCount }
  }, [conversations])

  const visibleConversations = useMemo(() => {
    if (originFilter === 'ALL') return conversations
    return conversations.filter((item) => getOriginFilterGroup(getConversationOrigin(item.channelConnection).key) === originFilter)
  }, [conversations, originFilter])

  useEffect(() => {
    setSelectedConversationId((current) => current && visibleConversations.some((item) => item.id === current) ? current : visibleConversations[0]?.id ?? null)
  }, [visibleConversations])

  async function submitAssign() {
    if (!selectedConversation) return
    setAssigning(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversation.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId: assigneeDraft === '__none__' ? null : assigneeDraft }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo asignar la conversación.')
        return
      }
      await Promise.all([loadConversations(), loadDetail(selectedConversation.id)])
    } finally {
      setAssigning(false)
    }
  }

  async function submitMessage() {
    if (!selectedConversation) return
    const requiresAttachment = messageTypeDraft === 'IMAGE' || messageTypeDraft === 'AUDIO' || messageTypeDraft === 'DOCUMENT'
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
      const json = await requestJson<ConversationMessage>(`/api/crm/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyText: messageDraft,
          messageType: messageTypeDraft,
          attachments: requiresAttachment
            ? [{ type: messageTypeDraft, url: attachmentUrlDraft, filename: attachmentNameDraft || null }]
            : [],
        }),
      })
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

  return (
    <div className="space-y-6 pb-6">
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
          ]}
        />
      )}

      <Card className="rounded-[26px] border-slate-200 bg-white/90 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)]">
        <CardContent className="grid gap-3 p-4 md:grid-cols-5 md:p-5">
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Buscar</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, telefono, email o mensaje..." className="h-11 rounded-xl border-slate-200 bg-white" />
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | ConversationStatus)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asesor</Label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{item.name || item.email || item.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Origen</Label>
            <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as OriginFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
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
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canal</Label>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {channels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 md:col-span-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proveedor</Label>
            <Select value={providerFilter} onValueChange={(value) => setProviderFilter(value as 'ALL' | ChannelProvider)} disabled={Boolean(props.initialProviderFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
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
          <div className="flex items-end rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 md:col-span-2">
            <Button className="h-11 w-full rounded-xl" onClick={() => void loadConversations()}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-xl">Conversaciones ({visibleConversations.length})</CardTitle>
            <CardDescription>Hilos omnicanal con prioridad comercial y acceso rápido al lead.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            {loading ? <p className="text-sm text-muted-foreground">Cargando conversaciones...</p> : null}
            {!loading && visibleConversations.length === 0 ? <p className="text-sm text-muted-foreground">No hay conversaciones para mostrar.</p> : null}
            {visibleConversations.map((item) => {
              const isActive = item.id === selectedConversationId
              const preview = item.messages?.[0]?.bodyText || item.sourceCampaign || item.contactEmail || item.contactPhone || naText
              const origin = getConversationOrigin(item.channelConnection)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedConversationId(item.id)}
                  className={isActive ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto sin nombre'}</span>
                        <OriginChip originKey={origin.key} label={origin.label} />
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-600">{preview}</p>
                    </div>
                    <div className="grid gap-2 text-right">
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 bg-slate-100">{item.status}</span>
                      {item.unreadCount > 0 ? <span className="text-xs font-semibold text-amber-700">{item.unreadCount} sin leer</span> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.assignedTo?.name || item.assignedTo?.email || 'Sin asesor'}</span>
                    <span>{formatDate(item.lastMessageAt, locale, naText)}</span>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-xl">Detalle</CardTitle>
            <CardDescription>Asignación, contexto del lead, oportunidad y mensajes del hilo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-4 md:p-5" aria-busy={detailLoading}>
            {detailLoading ? <span className="sr-only">Cargando detalle...</span> : null}
            {!detailLoading && !selectedConversation ? <p className="text-sm text-muted-foreground">Selecciona una conversación para ver el detalle.</p> : null}
            {selectedConversation ? (
              <>
                <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-950">{selectedConversation.contactDisplayName || selectedConversation.contactPhone || selectedConversation.contactEmail || 'Conversación sin alias'}</h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{selectedConversation.status}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {selectedConversation.contactPhone || naText} · {selectedConversation.contactEmail || naText} · {selectedConversation.channelConnection.name}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span>Origen:</span>
                        <OriginChip originKey={getConversationOrigin(selectedConversation.channelConnection).key} label={getConversationOrigin(selectedConversation.channelConnection).label} />
                      </span>
                      <span>Canal: {selectedConversation.channelConnection.name}</span>
                      <span>Último mensaje: {formatDate(selectedConversation.lastMessageAt, locale, naText)}</span>
                      <span>Capturas: {selectedConversation.captures.length}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedConversation.lead ? (
                      <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
                        <Link href={`/dashboard/crm/leads/${selectedConversation.lead.id}`}>Abrir lead</Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void resolveConversation()} disabled={resolving || selectedConversation.status === 'RESOLVED'}>
                      {resolving ? 'Resolviendo...' : 'Resolver'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-4">
                    <Card className="rounded-3xl border-slate-200 bg-white/85">
                      <CardHeader>
                        <CardTitle className="text-base">Asignación</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Select value={assigneeDraft} onValueChange={setAssigneeDraft}>
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin asesor</SelectItem>
                            {assignees.map((item) => <SelectItem key={item.id} value={item.id}>{item.name || item.email || item.id}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button className="w-full rounded-xl" onClick={() => void submitAssign()} disabled={assigning}>
                          {assigning ? 'Guardando...' : 'Guardar asignación'}
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
                        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                          {selectedConversation.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes registrados.</p> : null}
                          {selectedConversation.messages.map((message: ConversationMessage) => (
                            <div key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[88%] rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[88%] rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600' : 'mr-auto max-w-[88%] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                                <span>{message.direction}</span>
                                <div className="flex items-center gap-2">
                                  {message.status ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{message.status}</span> : null}
                                  <span>{formatDate(message.occurredAt, locale, naText)}</span>
                                </div>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap leading-6">{message.bodyText || 'Sin contenido textual'}</p>
                              {Array.isArray(message.attachmentsJson) && message.attachmentsJson.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {message.attachmentsJson.map((attachment, index) => (
                                    <a
                                      key={`${message.id}-${index}`}
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
                              {'sentByUser' in message && message.sentByUser ? <p className="mt-2 text-[11px] text-slate-500">{message.sentByUser.name || message.sentByUser.email}</p> : null}
                            </div>
                          ))}
                        </div>
                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                          <Label>Responder desde el inbox</Label>
                          {messagingWindowState ? (
                            <div className={messagingWindowState.open ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800' : 'rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800'}>
                              <span className="font-semibold">{messagingWindowState.label}:</span> {messagingWindowState.hint}
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
                              <div className="grid gap-2 sm:col-span-2">
                                <Label>URL del archivo</Label>
                                <Input value={attachmentUrlDraft} onChange={(e) => setAttachmentUrlDraft(e.target.value)} placeholder="https://..." />
                              </div>
                              <div className="grid gap-2 sm:col-span-2">
                                <Label>Nombre visible</Label>
                                <Input value={attachmentNameDraft} onChange={(e) => setAttachmentNameDraft(e.target.value)} placeholder="catalogo.pdf o imagen-promocion.jpg" />
                              </div>
                            </div>
                          ) : null}
                          <div className="flex justify-end">
                            <Button className="rounded-xl" onClick={() => void submitMessage()} disabled={sending}>
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
    </div>
  )
}