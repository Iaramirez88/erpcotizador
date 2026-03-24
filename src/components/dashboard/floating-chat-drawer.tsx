"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Paperclip, Plus, Smile, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type TeamUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
}

type ChatAttachment = {
  name: string
  url: string
  type: 'image' | 'document'
  mimeType?: string | null
  sizeBytes?: number | null
}

type InternalChatMessage = {
  id: string
  bodyText?: string | null
  occurredAt: string
  sentByUserId?: string | null
  sentByUser?: { id: string; name?: string | null; email?: string | null } | null
  attachments?: ChatAttachment[]
}

type InternalThreadSummary = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  lastMessageAt: string
  unreadCount: number
  participantsCount?: number
  participants?: Array<{ id: string; userId: string; user: TeamUser }>
  counterpart?: TeamUser | null
  lastMessage?: InternalChatMessage | null
}

type InternalThreadDetail = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  participants: Array<{ id: string; userId: string; user: TeamUser }>
  messages: InternalChatMessage[]
}

type ConversationStatus = 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM'
type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM'
type ChannelProvider = 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'

type ConversationMessage = {
  id: string
  direction: MessageDirection
  bodyText?: string | null
  occurredAt: string
  sentByUser?: { id: string; name?: string | null; email?: string | null } | null
}

type ConversationListItem = {
  id: string
  status: ConversationStatus
  unreadCount: number
  lastMessageAt: string
  contactDisplayName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  lead?: { id: string; nombre: string } | null
  cliente?: { id: string; nombre: string; documento: string } | null
  channelConnection: { id: string; name: string; provider: ChannelProvider; status: string }
  messages?: ConversationMessage[]
}

type ConversationDetail = ConversationListItem & {
  messages: ConversationMessage[]
}

type InboxAlert = {
  id: string
  kind: 'crm' | 'team'
  title: string
  subtitle: string
  preview: string
  occurredAt: string
  unreadCount: number
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

const EMOJI_CHOICES = ['😀', '😂', '😉', '😍', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀']

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatChannel(provider: ChannelProvider) {
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

function formatThreadName(thread: InternalThreadSummary | InternalThreadDetail | null) {
  if (!thread) return 'Chat interno'
  if (thread.type === 'GROUP') return thread.title || 'Grupo interno'
  return 'counterpart' in thread
    ? thread.counterpart?.name || thread.counterpart?.email || 'Chat directo'
    : thread.participants.find(Boolean)?.user.name || thread.participants.find(Boolean)?.user.email || 'Chat directo'
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

function renderAttachments(attachments: ChatAttachment[] | undefined) {
  if (!attachments?.length) return null
  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        attachment.type === 'image' ? (
          <a key={`${attachment.url}-${attachment.name}`} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={attachment.url} alt={attachment.name} className="max-h-60 w-full object-cover" />
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">{attachment.name}</div>
          </a>
        ) : (
          <a key={`${attachment.url}-${attachment.name}`} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{attachment.name}</p>
              <p className="text-xs text-slate-500">{attachment.mimeType || 'Documento'}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Abrir</span>
          </a>
        )
      ))}
    </div>
  )
}

export default function FloatingChatDrawer() {
  const storageTabKey = 'sg_floating_chat_last_tab'
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'updates' | 'crm' | 'team'>('updates')
  const [teamView, setTeamView] = useState<'direct' | 'groups'>('direct')
  const [loading, setLoading] = useState(true)
  const [crmLoading, setCrmLoading] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [sendingCrm, setSendingCrm] = useState(false)
  const [sendingTeam, setSendingTeam] = useState(false)
  const [startingThread, setStartingThread] = useState(false)
  const [uploadingTeamAttachment, setUploadingTeamAttachment] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [crmConversations, setCrmConversations] = useState<ConversationListItem[]>([])
  const [teamThreads, setTeamThreads] = useState<InternalThreadSummary[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null)
  const [selectedThread, setSelectedThread] = useState<InternalThreadDetail | null>(null)
  const [crmMessageDraft, setCrmMessageDraft] = useState('')
  const [teamMessageDraft, setTeamMessageDraft] = useState('')
  const [pendingTeamAttachments, setPendingTeamAttachments] = useState<ChatAttachment[]>([])
  const [groupForm, setGroupForm] = useState({ title: '', participantUserIds: [] as string[] })

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageTabKey)
      if (saved === 'updates' || saved === 'crm' || saved === 'team') {
        setActiveTab(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageTabKey, activeTab)
    } catch {
      // ignore
    }
  }, [activeTab])

  async function loadBase() {
    setLoading(true)
    try {
      const [meRes, usersRes, conversationsRes, threadsRes] = await Promise.all([
        requestJson<{ id: string }>('/api/me'),
        requestJson<TeamUser[]>('/api/crm/assignees'),
        requestJson<ConversationListItem[]>('/api/crm/conversations'),
        requestJson<InternalThreadSummary[]>('/api/crm/internal-chat/threads'),
      ])

      setCurrentUserId(meRes.data?.id ?? null)
      setTeamUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
      const nextConversations = Array.isArray(conversationsRes.data) ? conversationsRes.data : []
      const nextThreads = Array.isArray(threadsRes.data) ? threadsRes.data : []
      setCrmConversations(nextConversations)
      setTeamThreads(nextThreads)
      setSelectedConversationId((current) => current && nextConversations.some((item) => item.id === current) ? current : nextConversations[0]?.id ?? null)
      setSelectedThreadId((current) => current && nextThreads.some((item) => item.id === current) ? current : nextThreads[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }

  async function loadConversationDetail(conversationId: string) {
    setCrmLoading(true)
    try {
      const json = await requestJson<ConversationDetail>(`/api/crm/conversations/${conversationId}`)
      setSelectedConversation(json.success && json.data ? json.data : null)
      await loadBase()
    } finally {
      setCrmLoading(false)
    }
  }

  async function loadThreadDetail(threadId: string) {
    setTeamLoading(true)
    try {
      const json = await requestJson<InternalThreadDetail>(`/api/crm/internal-chat/threads/${threadId}`)
      setSelectedThread(json.success && json.data ? json.data : null)
      await loadBase()
    } finally {
      setTeamLoading(false)
    }
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadBase()
      if (selectedConversationId && open && activeTab === 'crm') {
        void loadConversationDetail(selectedConversationId)
      }
      if (selectedThreadId && open && activeTab === 'team') {
        void loadThreadDetail(selectedThreadId)
      }
    }, 6000)
    return () => window.clearInterval(interval)
  }, [activeTab, open, selectedConversationId, selectedThreadId])

  useEffect(() => {
    if (!open || activeTab !== 'crm' || !selectedConversationId) return
    void loadConversationDetail(selectedConversationId)
  }, [activeTab, open, selectedConversationId])

  useEffect(() => {
    if (!open || activeTab !== 'team' || !selectedThreadId) return
    void loadThreadDetail(selectedThreadId)
  }, [activeTab, open, selectedThreadId])

  useEffect(() => {
    if (activeTab !== 'team') {
      setPendingTeamAttachments([])
      setShowEmojiPicker(false)
    }
  }, [activeTab])

  const filteredTeamUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return teamUsers
      .filter((item) => item.id !== currentUserId)
      .filter((item) => {
        if (!term) return true
        const name = item.name?.toLowerCase() ?? ''
        const email = item.email?.toLowerCase() ?? ''
        return name.includes(term) || email.includes(term)
      })
      .slice(0, 10)
  }, [currentUserId, search, teamUsers])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return crmConversations.filter((item) => {
      if (!term) return true
      const name = item.contactDisplayName?.toLowerCase() ?? item.lead?.nombre?.toLowerCase() ?? item.cliente?.nombre?.toLowerCase() ?? ''
      const preview = item.messages?.[0]?.bodyText?.toLowerCase() ?? ''
      return name.includes(term) || preview.includes(term)
    })
  }, [crmConversations, search])

  const directThreads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return teamThreads.filter((item) => {
      if (item.type !== 'DIRECT') return false
      if (!term) return true
      const name = item.counterpart?.name?.toLowerCase() ?? item.counterpart?.email?.toLowerCase() ?? ''
      const preview = item.lastMessage?.bodyText?.toLowerCase() ?? ''
      return name.includes(term) || preview.includes(term)
    })
  }, [search, teamThreads])

  const createdGroupThreads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return teamThreads.filter((item) => {
      if (item.type !== 'GROUP') return false
      if (item.createdById !== currentUserId) return false
      if (!term) return true
      const title = item.title?.toLowerCase() ?? ''
      const preview = item.lastMessage?.bodyText?.toLowerCase() ?? ''
      return title.includes(term) || preview.includes(term)
    })
  }, [currentUserId, search, teamThreads])

  const groupCandidateUsers = useMemo(() => {
    const term = groupSearch.trim().toLowerCase()
    return teamUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => {
        if (!term) return true
        return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
      })
  }, [currentUserId, groupSearch, teamUsers])

  const unreadAlerts = useMemo<InboxAlert[]>(() => {
    const crmAlerts = crmConversations
      .filter((item) => item.unreadCount > 0)
      .map((item) => ({
        id: item.id,
        kind: 'crm' as const,
        title: item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto CRM',
        subtitle: formatChannel(item.channelConnection.provider),
        preview: item.messages?.[0]?.bodyText || item.contactEmail || item.contactPhone || 'Mensaje nuevo',
        occurredAt: item.lastMessageAt,
        unreadCount: item.unreadCount,
      }))

    const teamAlerts = teamThreads
      .filter((item) => item.unreadCount > 0)
      .map((item) => ({
        id: item.id,
        kind: 'team' as const,
        title: item.type === 'GROUP' ? item.title || 'Grupo interno' : item.counterpart?.name || item.counterpart?.email || 'Compañero',
        subtitle: item.type === 'GROUP' ? 'Grupo de equipo' : 'Chat interno',
        preview: item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto nuevo' : 'Mensaje nuevo'),
        occurredAt: item.lastMessageAt,
        unreadCount: item.unreadCount,
      }))

    return [...crmAlerts, ...teamAlerts].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [crmConversations, teamThreads])

  const unreadTotal = useMemo(() => unreadAlerts.reduce((sum, item) => sum + item.unreadCount, 0), [unreadAlerts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const previous = Number((window as typeof window & { __sgFloatingChatUnread?: number }).__sgFloatingChatUnread ?? 0)
    ;(window as typeof window & { __sgFloatingChatUnread?: number }).__sgFloatingChatUnread = unreadTotal
    if (previous <= 0 || unreadTotal <= previous) return

    try {
      const context = new window.AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, context.currentTime)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.24)
      window.setTimeout(() => void context.close().catch(() => null), 300)
    } catch {
      // ignore
    }
  }, [unreadTotal])

  async function handleOpenAlert(alert: InboxAlert) {
    setOpen(true)
    if (alert.kind === 'crm') {
      setActiveTab('crm')
      setSelectedConversationId(alert.id)
      await loadConversationDetail(alert.id)
      return
    }

    setActiveTab('team')
    setTeamView('direct')
    setSelectedThreadId(alert.id)
    await loadThreadDetail(alert.id)
  }

  async function handleSendCrmMessage() {
    if (!selectedConversationId || !crmMessageDraft.trim()) {
      alert('Escribe un mensaje antes de enviarlo.')
      return
    }
    setSendingCrm(true)
    try {
      const json = await requestJson(`/api/crm/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText: crmMessageDraft }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo enviar el mensaje.')
        return
      }
      setCrmMessageDraft('')
      await Promise.all([loadBase(), loadConversationDetail(selectedConversationId)])
    } finally {
      setSendingCrm(false)
    }
  }

  async function handleSendTeamMessage() {
    if (!selectedThreadId) {
      alert('Selecciona un chat o grupo antes de enviar.')
      return
    }
    if (!teamMessageDraft.trim() && pendingTeamAttachments.length === 0) {
      alert('Escribe un mensaje o agrega un adjunto.')
      return
    }
    setSendingTeam(true)
    try {
      const json = await requestJson(`/api/crm/internal-chat/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText: teamMessageDraft, attachments: pendingTeamAttachments }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo enviar el mensaje interno.')
        return
      }
      setTeamMessageDraft('')
      setPendingTeamAttachments([])
      setShowEmojiPicker(false)
      await Promise.all([loadBase(), loadThreadDetail(selectedThreadId)])
    } finally {
      setSendingTeam(false)
    }
  }

  async function handleStartTeamChat(userId: string) {
    setStartingThread(true)
    try {
      const json = await requestJson<InternalThreadSummary>('/api/crm/internal-chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantUserId: userId }),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo abrir el chat interno.')
        return
      }
      setOpen(true)
      setActiveTab('team')
      setTeamView('direct')
      setSelectedThreadId(json.data.id)
      await Promise.all([loadBase(), loadThreadDetail(json.data.id)])
    } finally {
      setStartingThread(false)
    }
  }

  async function handleUploadTeamAttachment(file: File) {
    if (!selectedThreadId) {
      alert('Selecciona primero un chat o grupo para adjuntar archivos.')
      return
    }
    setUploadingTeamAttachment(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/crm/internal-chat/threads/${selectedThreadId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<ChatAttachment>
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo subir el adjunto.')
        return
      }
      setPendingTeamAttachments((current) => [...current, json.data as ChatAttachment])
    } finally {
      setUploadingTeamAttachment(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleCreateGroup() {
    if (!groupForm.title.trim()) {
      alert('Define un nombre para el grupo.')
      return
    }
    if (groupForm.participantUserIds.length === 0) {
      alert('Agrega al menos un participante adicional.')
      return
    }

    setCreatingGroup(true)
    try {
      const json = await requestJson<InternalThreadSummary>('/api/crm/internal-chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadType: 'GROUP',
          title: groupForm.title,
          participantUserIds: groupForm.participantUserIds,
        }),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo crear el grupo.')
        return
      }
      setGroupDialogOpen(false)
      setGroupForm({ title: '', participantUserIds: [] })
      setGroupSearch('')
      setOpen(true)
      setActiveTab('team')
      setTeamView('groups')
      setSelectedThreadId(json.data.id)
      await Promise.all([loadBase(), loadThreadDetail(json.data.id)])
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleDeleteGroup(threadId: string) {
    const confirmed = window.confirm('Se eliminará el grupo y su historial interno. Esta acción no se puede deshacer.')
    if (!confirmed) return

    setDeletingGroupId(threadId)
    try {
      const json = await requestJson(`/api/crm/internal-chat/threads/${threadId}`, { method: 'DELETE' })
      if (!json.success) {
        alert(json.error || 'No se pudo eliminar el grupo.')
        return
      }
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null)
        setSelectedThread(null)
        setPendingTeamAttachments([])
        setTeamMessageDraft('')
      }
      await loadBase()
    } finally {
      setDeletingGroupId(null)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[70] flex flex-col items-end sm:right-6">
      <div className="relative flex flex-col items-end">
        <div
          className={cn(
            'pointer-events-auto absolute bottom-0 right-0 flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-slate-200 bg-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45)] transition-all duration-300',
            'w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[min(720px,calc(100vw-3rem))] lg:w-[min(820px,calc(100vw-4rem))]',
            open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0',
          )}
        >
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Chat global</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950 sm:text-lg">Mensajes y novedades</h3>
                <p className="mt-1 text-[13px] text-slate-600">Trabaja con el chat sin bloquear el resto del dashboard.</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contacto, compañero, grupo o mensaje..." className="h-10 rounded-xl border-slate-200 bg-white text-sm" />
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setActiveTab('updates')} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium', activeTab === 'updates' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                  Novedades {unreadTotal > 0 ? `(${unreadTotal})` : ''}
                </button>
                <button type="button" onClick={() => setActiveTab('crm')} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium', activeTab === 'crm' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                  CRM
                </button>
                <button type="button" onClick={() => setActiveTab('team')} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium', activeTab === 'team' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                  Equipo
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-white overflow-x-hidden">
            {activeTab === 'updates' ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                  {loading ? 'Sincronizando mensajes nuevos...' : unreadAlerts.length ? `${unreadAlerts.length} hilos con novedades` : 'No tienes mensajes nuevos'}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                  <div className="space-y-3">
                    {unreadAlerts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Todo está al día. Cuando llegue un mensaje nuevo te saldrá aquí y en el badge del botón flotante.</div> : null}
                    {unreadAlerts.map((alert) => (
                      <button key={`${alert.kind}-${alert.id}`} type="button" onClick={() => void handleOpenAlert(alert)} className="w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-950">{alert.title}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{alert.subtitle}</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{alert.preview}</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{alert.unreadCount}</span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{formatDate(alert.occurredAt, 'Sin fecha')}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'crm' ? (
              <div className="grid h-full min-h-0 overflow-hidden grid-rows-[minmax(220px,0.82fr)_minmax(0,1.18fr)] md:grid-cols-[minmax(320px,0.92fr)_minmax(360px,1.08fr)] md:grid-rows-1">
                <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-b border-slate-100 md:border-b-0 md:border-r">
                  <div className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-600">Bandeja CRM</div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden p-3">
                    <div className="space-y-3">
                      {filteredConversations.map((item) => (
                        <button key={item.id} type="button" onClick={() => setSelectedConversationId(item.id)} className={cn('w-full min-w-0 rounded-3xl border p-2.5 text-left shadow-sm transition-shadow hover:shadow-md', selectedConversationId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">{item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto CRM'}</p>
                              <p className="mt-1 line-clamp-2 text-[13px] text-slate-600">{item.messages?.[0]?.bodyText || item.contactEmail || item.contactPhone || 'Sin mensajes aún'}</p>
                            </div>
                            {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span>{formatChannel(item.channelConnection.provider)}</span>
                            <span>{formatDate(item.lastMessageAt, 'Sin fecha')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-600">Detalle de conversación</div>
                  <div className="shrink-0 px-4 pt-3">
                    {crmLoading ? <p className="text-sm text-slate-500">Cargando conversación...</p> : null}
                    {!crmLoading && !selectedConversation ? <p className="pb-4 text-sm text-slate-500">Selecciona un hilo CRM para responderlo aquí.</p> : null}
                    {selectedConversation ? (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-950 sm:text-base">{selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || 'Contacto CRM'}</h4>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{formatChannel(selectedConversation.channelConnection.provider)}</span>
                        </div>
                        <p className="mt-1.5 text-[13px] text-slate-600">{selectedConversation.contactPhone || selectedConversation.contactEmail || 'Sin dato de contacto visible'}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3">
                    {selectedConversation ? (
                      <div className="space-y-3 min-w-0">
                        {selectedConversation.messages.map((message) => (
                          <div key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[94%] min-w-0 rounded-3xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-[13px] text-slate-700' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[94%] min-w-0 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600' : 'mr-auto max-w-[94%] min-w-0 rounded-3xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700'}>
                            <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                              <span>{message.direction}</span>
                              <span>{formatDate(message.occurredAt, 'Sin fecha')}</span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap break-words leading-5">{message.bodyText || 'Sin texto'}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 border-t border-slate-100 p-4">
                    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Responder al cliente</Label>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <Textarea
                          value={crmMessageDraft}
                          onChange={(event) => setCrmMessageDraft(event.target.value)}
                          rows={2}
                          placeholder="Escribe una respuesta rápida sin salir de la pantalla..."
                          className="min-h-[72px] resize-none rounded-2xl bg-white text-sm leading-5"
                        />
                        <Button className="h-10 rounded-xl px-4" onClick={() => void handleSendCrmMessage()} disabled={sendingCrm || !selectedConversationId}>
                          {sendingCrm ? 'Enviando...' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'team' ? (
              <div className="grid h-full min-h-0 overflow-hidden grid-rows-[minmax(240px,0.82fr)_minmax(0,1.18fr)] md:grid-cols-[minmax(320px,0.96fr)_minmax(360px,1.04fr)] md:grid-rows-1">
                <div className="min-h-0 min-w-0 overflow-hidden border-b border-slate-100 md:border-b-0 md:border-r">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Equipo y grupos</span>
                      <Button variant="outline" className="rounded-xl" onClick={() => setGroupDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo grupo
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button type="button" onClick={() => setTeamView('direct')} className={cn('rounded-xl px-3 py-2 text-sm font-medium', teamView === 'direct' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                        Directos
                      </button>
                      <button type="button" onClick={() => setTeamView('groups')} className={cn('rounded-xl px-3 py-2 text-sm font-medium', teamView === 'groups' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                        Grupos creados
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 h-full overflow-y-auto p-3">
                    {teamView === 'direct' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Abrir chat nuevo</p>
                          {filteredTeamUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              <div>
                                <p className="font-medium text-slate-950">{user.name || user.email || user.id}</p>
                                <p className="text-sm text-slate-500">{user.email || 'Sin correo visible'}</p>
                              </div>
                              <Button variant="outline" className="rounded-xl" onClick={() => void handleStartTeamChat(user.id)} disabled={startingThread}>
                                Abrir
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Chats activos</p>
                          {directThreads.map((item) => (
                            <button key={item.id} type="button" onClick={() => setSelectedThreadId(item.id)} className={cn('w-full min-w-0 rounded-3xl border p-3 text-left shadow-sm transition-shadow hover:shadow-md', selectedThreadId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-950">{item.counterpart?.name || item.counterpart?.email || 'Chat interno'}</p>
                                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto enviado' : 'Sin mensajes aún')}</p>
                                </div>
                                {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                              </div>
                              <p className="mt-2 text-xs text-slate-500">{formatDate(item.lastMessageAt, 'Sin fecha')}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grupos creados por ti</p>
                        {createdGroupThreads.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Aún no has creado grupos internos.</p> : null}
                        {createdGroupThreads.map((item) => (
                          <div key={item.id} className={cn('rounded-3xl border p-3 shadow-sm transition-shadow hover:shadow-md', selectedThreadId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                            <button type="button" onClick={() => setSelectedThreadId(item.id)} className="w-full text-left">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-950">{item.title || 'Grupo interno'}</p>
                                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto compartido' : 'Sin mensajes aún')}</p>
                                </div>
                                {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                                <span>{item.participantsCount || item.participants?.length || 0} participantes</span>
                                <span>{formatDate(item.lastMessageAt, 'Sin fecha')}</span>
                              </div>
                            </button>
                            <div className="mt-3 flex justify-end">
                              <Button variant="outline" className="rounded-xl text-rose-700 hover:text-rose-800" onClick={() => void handleDeleteGroup(item.id)} disabled={deletingGroupId === item.id}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingGroupId === item.id ? 'Eliminando...' : 'Eliminar'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
                    {selectedThread ? formatThreadName(selectedThread) : 'Conversación interna'}
                  </div>
                  <div className="min-h-0 overflow-hidden p-4">
                    {teamLoading ? <p className="text-sm text-slate-500">Cargando chat interno...</p> : null}
                    {!teamLoading && !selectedThread ? <p className="text-sm text-slate-500">Selecciona un compañero o un grupo para abrir la conversación.</p> : null}
                    {selectedThread ? (
                      <div className="flex min-h-full min-w-0 flex-col gap-4">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{formatThreadName(selectedThread)}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{selectedThread.type === 'GROUP' ? 'Grupo interno' : 'Chat directo'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedThread.participants.map((participant) => (
                                <span key={participant.id} className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
                                  {participant.user.name || participant.user.email || participant.user.id}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                          {selectedThread.messages.length === 0 ? <p className="text-sm text-slate-500">No hay mensajes en este chat.</p> : null}
                          {selectedThread.messages.map((message) => {
                            const isOwn = Boolean(currentUserId && message.sentByUserId === currentUserId)
                            return (
                              <div key={message.id} className={isOwn ? 'ml-auto max-w-[94%] min-w-0 rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700' : 'mr-auto max-w-[94%] min-w-0 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                                  <span>{message.sentByUser?.name || message.sentByUser?.email || 'Usuario'}</span>
                                  <span>{formatDate(message.occurredAt, 'Sin fecha')}</span>
                                </div>
                                {message.bodyText ? <p className="mt-2 whitespace-pre-wrap break-words leading-6">{message.bodyText}</p> : null}
                                {renderAttachments(message.attachments)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-slate-100 p-4">
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Mensaje interno</Label>
                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) void handleUploadTeamAttachment(file)
                            }}
                          />
                          <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => setShowEmojiPicker((current) => !current)} disabled={!selectedThreadId}>
                            <Smile className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={!selectedThreadId || uploadingTeamAttachment}>
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={!selectedThreadId || uploadingTeamAttachment}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {showEmojiPicker ? (
                        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                          {EMOJI_CHOICES.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => setTeamMessageDraft((current) => `${current}${emoji}`)} className="rounded-xl border border-slate-200 px-2.5 py-2 text-lg hover:bg-slate-50">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {pendingTeamAttachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                          {pendingTeamAttachments.map((attachment) => (
                            <div key={`${attachment.url}-${attachment.name}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                              <span className="max-w-[220px] truncate">{attachment.name}</span>
                              <button type="button" onClick={() => setPendingTeamAttachments((current) => current.filter((item) => item.url !== attachment.url))} className="text-slate-500 hover:text-slate-800">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <Textarea value={teamMessageDraft} onChange={(event) => setTeamMessageDraft(event.target.value)} rows={4} placeholder={selectedThread?.type === 'GROUP' ? 'Escribe un mensaje para el grupo...' : 'Escribe un mensaje para tu compañero...'} disabled={!selectedThreadId} />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">{uploadingTeamAttachment ? 'Subiendo adjunto...' : 'Puedes combinar texto, emojis, imágenes y documentos en un solo envío.'}</p>
                        <Button className="rounded-xl" onClick={() => void handleSendTeamMessage()} disabled={sendingTeam || !selectedThreadId || uploadingTeamAttachment}>
                          {sendingTeam ? 'Enviando...' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'pointer-events-auto relative mb-4 mr-4 h-14 rounded-full bg-slate-950 px-5 text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.65)] hover:bg-slate-800 transition-all duration-300 sm:mb-6 sm:mr-0',
            open ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
          )}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
          <span>Chat</span>
          {unreadTotal > 0 ? <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">{unreadTotal > 99 ? '99+' : unreadTotal}</span> : null}
        </Button>
      </div>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear grupo interno</DialogTitle>
            <DialogDescription>Arma grupos operativos, compártelos en la pestaña de grupos creados y elimínalos cuando ya no hagan falta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre del grupo</Label>
              <Input value={groupForm.title} onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ejemplo: Producción semana 14" />
            </div>
            <div className="grid gap-2">
              <Label>Buscar participantes</Label>
              <Input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Nombre o correo..." />
            </div>
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {groupCandidateUsers.map((user) => {
                  const selected = groupForm.participantUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setGroupForm((current) => ({
                        ...current,
                        participantUserIds: selected ? current.participantUserIds.filter((item) => item !== user.id) : [...current.participantUserIds, user.id],
                      }))}
                      className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'}
                    >
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-slate-500">{selected ? 'Incluido' : 'Agregar'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4" />
                  Participantes del grupo
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">Tú</span>
                  {groupForm.participantUserIds.map((userId) => {
                    const user = teamUsers.find((item) => item.id === userId)
                    return <span key={userId} className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">{user?.name || user?.email || userId}</span>
                  })}
                  {!groupForm.participantUserIds.length ? <p className="text-sm text-slate-500">Aún no has seleccionado compañeros.</p> : null}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreateGroup()} disabled={creatingGroup}>{creatingGroup ? 'Creando...' : 'Crear grupo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}