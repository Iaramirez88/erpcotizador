"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Image as ImageIcon, Paperclip, Plus, Smile, Trash2, Users, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { uploadFileWithProgress } from '@/lib/upload-file-with-progress'

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

type ThreadMessage = {
  id: string
  bodyText?: string | null
  occurredAt: string
  sentByUserId?: string | null
  sentByUser?: { id: string; name?: string | null; email?: string | null } | null
  attachments?: ChatAttachment[]
}

type ThreadSummary = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  lastMessageAt: string
  unreadCount: number
  participantsCount?: number
  counterpart?: TeamUser | null
  lastMessage?: ThreadMessage | null
}

type ThreadDetail = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  participants: Array<{
    id: string
    userId: string
    user: TeamUser
  }>
  messages: ThreadMessage[]
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type UploadProgressState = {
  name: string
  progress: number
}

const EMOJI_CHOICES = ['😀', '😂', '😉', '😍', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀']

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

function threadTitle(thread: ThreadSummary | ThreadDetail | null) {
  if (!thread) return 'Chat interno'
  if (thread.type === 'GROUP') return thread.title || 'Grupo interno'
  if ('participants' in thread && Array.isArray(thread.participants)) {
    return thread.participants.find(Boolean)?.user.name || thread.participants.find(Boolean)?.user.email || 'Chat directo'
  }
  if ('counterpart' in thread) {
    return thread.counterpart?.name || thread.counterpart?.email || 'Chat directo'
  }
  return 'Chat directo'
}

function renderAttachments(attachments: ChatAttachment[] | undefined, onImageLoad?: () => void) {
  if (!attachments?.length) return null
  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        attachment.type === 'image' ? (
          <a key={`${attachment.url}-${attachment.name}`} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={attachment.url} alt={attachment.name} className="max-h-72 w-full object-cover" onLoad={onImageLoad} />
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

export function CrmTeamChatClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollTimersRef = useRef<number[]>([])
  const shouldStickToBottomRef = useRef(true)
  const distanceFromBottomRef = useRef(0)
  const previousThreadKeyRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [creatingThread, setCreatingThread] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<'direct' | 'groups'>('direct')
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [attachmentUpload, setAttachmentUpload] = useState<UploadProgressState | null>(null)
  const [groupForm, setGroupForm] = useState({ title: '', participantUserIds: [] as string[] })
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  function clearScrollTimers() {
    scrollTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    scrollTimersRef.current = []
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth') {
    const container = messagesViewportRef.current
    if (!container) return
    window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior })
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  function scheduleScrollToBottom(behavior: ScrollBehavior = 'auto') {
    const container = messagesViewportRef.current
    if (!container) return
    clearScrollTimers()
    scrollMessagesToBottom(behavior)
    scrollTimersRef.current = [80, 220, 420].map((delay) => window.setTimeout(() => {
      scrollMessagesToBottom('auto')
    }, delay))
  }

  function isNearBottom(threshold = 80) {
    const container = messagesViewportRef.current
    if (!container) return true
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceToBottom <= threshold
  }

  function getDistanceFromBottom() {
    const container = messagesViewportRef.current
    if (!container) return 0
    return Math.max(container.scrollHeight - container.scrollTop - container.clientHeight, 0)
  }

  function restoreScrollDistance(distance: number) {
    const container = messagesViewportRef.current
    if (!container) return
    window.requestAnimationFrame(() => {
      const nextTop = Math.max(container.scrollHeight - container.clientHeight - distance, 0)
      container.scrollTop = nextTop
    })
  }

  function handleViewportScroll() {
    const nearBottom = isNearBottom()
    distanceFromBottomRef.current = getDistanceFromBottom()
    shouldStickToBottomRef.current = nearBottom
    setShowScrollToBottom(!nearBottom)
    if (!nearBottom) {
      clearScrollTimers()
    }
  }

  function jumpToBottom() {
    shouldStickToBottomRef.current = true
    distanceFromBottomRef.current = 0
    setShowScrollToBottom(false)
    scheduleScrollToBottom('smooth')
  }

  async function loadBase() {
    setLoading(true)
    try {
      const [meRes, usersRes, threadsRes] = await Promise.all([
        requestJson<{ id: string }>('/api/me'),
        requestJson<TeamUser[]>('/api/crm/assignees'),
        requestJson<ThreadSummary[]>('/api/crm/internal-chat/threads'),
      ])

      setCurrentUserId(meRes.data?.id ?? null)
      setTeamUsers(Array.isArray(usersRes.data) ? usersRes.data : [])

      const nextThreads = Array.isArray(threadsRes.data) ? threadsRes.data : []
      setThreads(nextThreads)
      setSelectedThreadId((current) => current && nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(threadId: string) {
    setDetailLoading(true)
    try {
      const detailRes = await requestJson<ThreadDetail>(`/api/crm/internal-chat/threads/${threadId}`)
      setSelectedThread(detailRes.success && detailRes.data ? detailRes.data : null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      clearScrollTimers()
    }
  }, [])

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    if (!selectedThreadId) {
      setSelectedThread(null)
      setPendingAttachments([])
      setAttachmentUpload(null)
      return
    }
    void loadDetail(selectedThreadId)
  }, [selectedThreadId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadBase()
      if (selectedThreadId) {
        void loadDetail(selectedThreadId)
      }
    }, 4000)

    return () => window.clearInterval(interval)
  }, [selectedThreadId])

  useEffect(() => {
    const threadKey = selectedThread
      ? `${selectedThread.id}:${selectedThread.messages.at(-1)?.id ?? 'empty'}:${selectedThread.messages.length}`
      : null
    const threadChanged = previousThreadKeyRef.current !== threadKey
    previousThreadKeyRef.current = threadKey

    if (!selectedThread || !threadChanged) return
    if (shouldStickToBottomRef.current) {
      scheduleScrollToBottom('auto')
    } else {
      restoreScrollDistance(distanceFromBottomRef.current)
    }
  }, [selectedThread])

  useEffect(() => {
    if (!selectedThreadId) return
    shouldStickToBottomRef.current = true
    setShowScrollToBottom(false)
  }, [selectedThreadId])

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return teamUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => {
        if (!term) return true
        const name = user.name?.toLowerCase() ?? ''
        const email = user.email?.toLowerCase() ?? ''
        return name.includes(term) || email.includes(term)
      })
      .slice(0, 12)
  }, [currentUserId, search, teamUsers])

  const directThreads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return threads.filter((thread) => {
      if (thread.type !== 'DIRECT') return false
      if (!term) return true
      const name = thread.counterpart?.name?.toLowerCase() ?? ''
      const email = thread.counterpart?.email?.toLowerCase() ?? ''
      const preview = thread.lastMessage?.bodyText?.toLowerCase() ?? ''
      return name.includes(term) || email.includes(term) || preview.includes(term)
    })
  }, [search, threads])

  const createdGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    return threads.filter((thread) => {
      if (thread.type !== 'GROUP') return false
      if (thread.createdById !== currentUserId) return false
      if (!term) return true
      const title = thread.title?.toLowerCase() ?? ''
      const preview = thread.lastMessage?.bodyText?.toLowerCase() ?? ''
      return title.includes(term) || preview.includes(term)
    })
  }, [currentUserId, search, threads])

  const groupCandidateUsers = useMemo(() => {
    const term = groupSearch.trim().toLowerCase()
    return teamUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => {
        if (!term) return true
        return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
      })
  }, [currentUserId, groupSearch, teamUsers])

  async function handleStartConversation(userId: string) {
    setCreatingThread(true)
    try {
      const json = await requestJson<ThreadSummary>('/api/crm/internal-chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantUserId: userId }),
      })

      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo abrir el chat con el compañero.')
        return
      }

      await loadBase()
      setSelectedThreadId(json.data.id)
    } finally {
      setCreatingThread(false)
    }
  }

  async function sendMessage(options?: {
    bodyText?: string
    attachments?: ChatAttachment[]
    suppressEmptyAlert?: boolean
  }) {
    if (!selectedThreadId) return false
    const bodyText = typeof options?.bodyText === 'string' ? options.bodyText : messageDraft
    const attachments = options?.attachments ?? pendingAttachments
    if (!bodyText.trim() && attachments.length === 0) {
      if (!options?.suppressEmptyAlert) {
        alert('Escribe un mensaje o agrega un adjunto antes de enviarlo.')
      }
      return false
    }

    setSending(true)
    try {
      const json = await requestJson(`/api/crm/internal-chat/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText, attachments }),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo enviar el mensaje.')
        return false
      }

      setMessageDraft('')
      setPendingAttachments([])
      await Promise.all([loadBase(), loadDetail(selectedThreadId)])
      jumpToBottom()
      return true
    } finally {
      setSending(false)
    }
  }

  async function handleSendMessage() {
    await sendMessage()
  }

  async function handleUploadAttachment(file: File) {
    if (!selectedThreadId) {
      alert('Selecciona un chat o grupo antes de adjuntar archivos.')
      return
    }

    setUploadingAttachment(true)
    setAttachmentUpload({ name: file.name, progress: 0 })
    try {
      const json = await uploadFileWithProgress<ChatAttachment>({
        url: `/api/crm/internal-chat/threads/${selectedThreadId}/attachments`,
        file,
        onProgress: (progress) => {
          setAttachmentUpload({ name: file.name, progress })
        },
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo subir el adjunto.')
        return
      }

      const uploadedAttachment = json.data as ChatAttachment
      const sent = await sendMessage({
        bodyText: messageDraft,
        attachments: [uploadedAttachment],
        suppressEmptyAlert: true,
      })
      if (!sent) {
        setPendingAttachments((current) => [...current, uploadedAttachment])
      }
    } finally {
      setUploadingAttachment(false)
      setAttachmentUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleCreateGroup() {
    if (!groupForm.title.trim()) {
      alert('Escribe un nombre para el grupo.')
      return
    }
    if (groupForm.participantUserIds.length === 0) {
      alert('Agrega al menos un participante adicional.')
      return
    }

    setCreatingGroup(true)
    try {
      const json = await requestJson<ThreadSummary>('/api/crm/internal-chat/threads', {
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
      setView('groups')
      setGroupSearch('')
      setGroupForm({ title: '', participantUserIds: [] })
      await loadBase()
      setSelectedThreadId(json.data.id)
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleDeleteGroup(threadId: string) {
    const confirmed = window.confirm('Se eliminará el grupo interno y su historial. Esta acción no se puede deshacer.')
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
      }

      await loadBase()
    } finally {
      setDeletingGroupId(null)
    }
  }

  return (
    <>
    <div className="space-y-4">
      <Card className="rounded-[26px] border-slate-200 bg-white/90 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)]">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1.2fr_0.8fr] md:p-5">
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Buscar persona o chat</Label>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o texto del mensaje..." className="h-11 rounded-xl border-slate-200 bg-white" />
          </div>
          <div className="grid gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
            <Button variant="outline" className="h-11 w-full rounded-xl border-slate-200 bg-white" onClick={() => void loadBase()}>
              Refrescar equipo
            </Button>
            <Button className="h-11 w-full rounded-xl" onClick={() => setGroupDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear grupo
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Compañeros</CardTitle>
              <CardDescription>Abre chats directos con usuarios de tu empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-5">
              {visibleUsers.length === 0 ? <p className="text-sm text-muted-foreground">No hay compañeros para mostrar con ese filtro.</p> : null}
              {visibleUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div>
                    <p className="font-medium text-slate-950">{user.name || user.email || user.id}</p>
                    <p className="text-sm text-slate-500">{user.email || 'Sin correo visible'}{user.role ? ` · ${user.role}` : ''}</p>
                  </div>
                  <Button className="rounded-xl" onClick={() => void handleStartConversation(user.id)} disabled={creatingThread}>
                    {creatingThread ? 'Abriendo...' : 'Abrir chat'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Hilos internos</CardTitle>
              <CardDescription>Alterna entre directos y grupos creados por ti.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-5">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setView('direct')} className={cn('rounded-xl px-3 py-2 text-sm font-medium', view === 'direct' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                  Directos
                </button>
                <button type="button" onClick={() => setView('groups')} className={cn('rounded-xl px-3 py-2 text-sm font-medium', view === 'groups' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                  Grupos creados
                </button>
              </div>
              {loading ? <p className="text-sm text-muted-foreground">Cargando chats...</p> : null}
              {!loading && view === 'direct' && directThreads.length === 0 ? <p className="text-sm text-muted-foreground">No hay chats directos todavía.</p> : null}
              {!loading && view === 'groups' && createdGroups.length === 0 ? <p className="text-sm text-muted-foreground">No has creado grupos internos todavía.</p> : null}
              {(view === 'direct' ? directThreads : createdGroups).map((thread) => {
                const isActive = thread.id === selectedThreadId
                return view === 'direct' ? (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={isActive ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-950">{thread.counterpart?.name || thread.counterpart?.email || 'Chat interno'}</p>
                        <p className="line-clamp-2 text-sm text-slate-600">{thread.lastMessage?.bodyText || (thread.lastMessage?.attachments?.length ? 'Adjunto compartido.' : 'Sin mensajes todavía.')}</p>
                      </div>
                      {thread.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Nuevo</span> : null}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{formatDate(thread.lastMessageAt, 'Sin actividad')}</p>
                  </button>
                ) : (
                  <div key={thread.id} className={isActive ? 'rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}>
                    <button type="button" onClick={() => setSelectedThreadId(thread.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-950">{thread.title || 'Grupo interno'}</p>
                          <p className="line-clamp-2 text-sm text-slate-600">{thread.lastMessage?.bodyText || (thread.lastMessage?.attachments?.length ? 'Adjunto compartido.' : 'Sin mensajes todavía.')}</p>
                        </div>
                        {thread.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Nuevo</span> : null}
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{thread.participantsCount || 0} participantes · {formatDate(thread.lastMessageAt, 'Sin actividad')}</p>
                    </button>
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" className="rounded-xl text-rose-700 hover:text-rose-800" onClick={() => void handleDeleteGroup(thread.id)} disabled={deletingGroupId === thread.id}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingGroupId === thread.id ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-xl">Conversación interna</CardTitle>
            <CardDescription>Comunicación operativa entre compañeros y grupos sin salir del CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-5">
            {detailLoading ? <span className="sr-only">Cargando conversación...</span> : null}
            {!selectedThread ? <p className="text-sm text-muted-foreground">Selecciona un compañero o un chat para empezar.</p> : null}
            {selectedThread ? (
              <>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{selectedThread.type === 'GROUP' ? 'Grupo interno' : 'Participantes'}</p>
                      <p className="mt-1 text-base font-semibold text-slate-950">{threadTitle(selectedThread)}</p>
                    </div>
                    {selectedThread.type === 'GROUP' && selectedThread.createdById === currentUserId ? (
                      <span className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">Administrador del grupo</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedThread.participants.map((participant) => (
                      <span key={participant.id} className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
                        {participant.user.name || participant.user.email || participant.user.id}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  ref={messagesViewportRef}
                  onScroll={handleViewportScroll}
                  className="max-h-[520px] space-y-3 overflow-y-auto pr-1"
                >
                  {selectedThread.messages.length === 0 ? <p className="text-sm text-muted-foreground">No hay mensajes en este chat.</p> : null}
                  {selectedThread.messages.map((message) => {
                    const isOwn = Boolean(currentUserId && message.sentByUserId === currentUserId)
                    return (
                      <div key={message.id} className={isOwn ? 'ml-auto max-w-[88%] rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700' : 'mr-auto max-w-[88%] rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700'}>
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                          <span>{message.sentByUser?.name || message.sentByUser?.email || 'Usuario'}</span>
                          <span>{formatDate(message.occurredAt, 'Sin fecha')}</span>
                        </div>
                        {message.bodyText ? <p className="mt-2 whitespace-pre-wrap leading-6">{message.bodyText}</p> : null}
                        {renderAttachments(message.attachments, () => {
                          if (shouldStickToBottomRef.current) {
                            scheduleScrollToBottom('auto')
                          }
                        })}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} aria-hidden="true" className="h-px w-full" />
                </div>
                {selectedThread && showScrollToBottom ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-full border-sky-200 bg-white text-sky-700 shadow-[0_14px_30px_-18px_rgba(14,116,144,0.45)] hover:bg-sky-50"
                      onClick={jumpToBottom}
                      aria-label="Ir al último mensaje"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </Button>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Nuevo mensaje</Label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void handleUploadAttachment(file)
                        }}
                      />
                      <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => setShowEmojiPicker((current) => !current)} disabled={!selectedThreadId}>
                        <Smile className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={!selectedThreadId || uploadingAttachment}>
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={!selectedThreadId || uploadingAttachment}>
                        <Paperclip className="h-4 w-4" />
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
                  {attachmentUpload ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span className="truncate">Subiendo {attachmentUpload.name}</span>
                        <span className="text-xs font-semibold text-sky-700">{attachmentUpload.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-600 transition-[width] duration-150" style={{ width: `${attachmentUpload.progress}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {pendingAttachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                      {pendingAttachments.map((attachment) => (
                        <div key={`${attachment.url}-${attachment.name}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                          <span className="max-w-[260px] truncate">{attachment.name}</span>
                          <button type="button" onClick={() => setPendingAttachments((current) => current.filter((item) => item.url !== attachment.url))} className="text-slate-500 hover:text-slate-800">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} rows={4} placeholder={selectedThread.type === 'GROUP' ? 'Escribe un mensaje para el grupo...' : 'Escribe un mensaje interno para el equipo...'} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">{uploadingAttachment ? `Subiendo adjunto... ${attachmentUpload?.progress ?? 0}%` : 'Puedes enviar texto, emojis, imágenes y documentos.'}</p>
                    <Button className="rounded-xl" onClick={() => void handleSendMessage()} disabled={sending || uploadingAttachment}>
                      {sending ? 'Enviando...' : 'Enviar mensaje'}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
    <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear grupo interno</DialogTitle>
          <DialogDescription>Úsalo para coordinar equipos operativos, compartir archivos y cerrar grupos cuando ya no sean necesarios.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nombre del grupo</Label>
            <Input value={groupForm.title} onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ejemplo: Taller de producción" />
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
    </>
  )
}