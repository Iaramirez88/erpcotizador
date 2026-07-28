"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BellOff, Check, CheckCheck, ChevronDown, Clock3, Copy, Image as ImageIcon, Info, LogOut, MoreVertical, Paperclip, Plus, Search, SendHorizontal, Smile, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatImagePreview } from '@/components/ui/chat-image-preview'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmFileItem } from '@/components/crm/crm-files-types'
import { useChatMutePreferences } from '@/hooks/use-chat-mute-preferences'
import { toast } from '@/hooks/use-toast'
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

type InternalChatMessage = {
  id: string
  bodyText?: string | null
  occurredAt: string
  sentByUserId?: string | null
  sentByUser?: { id: string; name?: string | null; email?: string | null } | null
  attachments?: ChatAttachment[]
  status?: 'PENDING' | 'SENT' | 'READ' | null
  canDelete?: boolean
}

type InternalThreadSummary = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  lastMessageAt: string
  unreadCount: number
  participantsCount?: number
  participants?: Array<{ id: string; userId: string; lastReadAt?: string | null; user: TeamUser }>
  counterpart?: TeamUser | null
  lastMessage?: InternalChatMessage | null
}

type InternalThreadDetail = {
  id: string
  type: 'DIRECT' | 'GROUP'
  title?: string | null
  createdById?: string | null
  participants: Array<{ id: string; userId: string; lastReadAt?: string | null; user: TeamUser }>
  messages: InternalChatMessage[]
}

type ConversationStatus = 'OPEN' | 'PENDING' | 'BOT_ACTIVE' | 'HUMAN_ACTIVE' | 'RESOLVED' | 'SPAM'
type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM'
type ChannelProvider = 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'
type BridgeKind = 'GENERIC' | 'GMAIL' | 'OUTLOOK' | 'TIKTOK' | 'YOUTUBE'

type ConversationMessage = {
  id: string
  direction: MessageDirection
  bodyText?: string | null
  status?: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null
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
  channelConnection: { id: string; name: string; provider: ChannelProvider; status: string; bridgeKind?: BridgeKind | null }
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
  senderLabel?: string | null
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type Props = {
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}

type ChatTab = 'updates' | 'crm' | 'team' | 'support'

type UploadProgressState = {
  name: string
  progress: number
}

type MessageContextMenuState = {
  messageId: string
  x: number
  y: number
}

type OptimisticTeamMessage = InternalChatMessage & {
  threadId: string
  status: 'PENDING'
  canDelete: false
}

const EMOJI_CHOICES = ['😀', '😂', '😉', '😍', '🤝', '👏', '🔥', '✅', '🙏', '📌', '📎', '🚀']
const SUPPORT_EMAIL = 'ivanimage@hotmail.com'
const SUPPORT_WHATSAPP = '3115385427'
const SUPPORT_WHATSAPP_URL = 'https://wa.me/573115385427'
const SUPPORT_EMAIL_SUBJECT = 'Soporte configuración inicial'
const SUPPORT_TAB_LABEL = 'Ayuda y soporte'
const SUPPORT_REQUEST_TEMPLATE = [
  'Hola, necesito ayuda con:',
  '- Empresa o espacio:',
  '- Usuario que reporta:',
  '- Cambio o problema:',
  '- Detalle breve:',
].join('\n')

function shouldDefaultToSupport(role: string | null) {
  return Boolean(role && role !== 'ADMIN' && role !== 'MANAGER')
}

function normalizeMutedThreadIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)))
}

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

function shouldHideFromGlobalChat(conversation: Pick<ConversationListItem, 'channelConnection'>) {
  return conversation.channelConnection.provider === 'WEB_FORM'
    && (conversation.channelConnection.bridgeKind === 'GMAIL' || conversation.channelConnection.bridgeKind === 'OUTLOOK')
}

function formatThreadName(thread: InternalThreadSummary | InternalThreadDetail | null) {
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

function renderAttachments(attachments: ChatAttachment[] | undefined, onImageLoad?: () => void) {
  if (!attachments?.length) return null
  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        attachment.type === 'image' ? (
          <ChatImagePreview key={`${attachment.url}-${attachment.name}`} src={attachment.url} alt={attachment.name} title={attachment.name}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img src={attachment.url} alt={attachment.name} className="max-h-60 w-full object-cover" onLoad={onImageLoad} />
              <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">{attachment.name}</div>
            </div>
          </ChatImagePreview>
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

export default function FloatingChatDrawer({ canAccessTeamChat, canAccessCrmChat }: Props) {
  const storageTabKey = 'sg_floating_chat_last_tab'
  const hasStoredTabPreferenceRef = useRef(false)
  const hasHydratedTabPersistenceRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const teamTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const crmMessagesRef = useRef<HTMLDivElement | null>(null)
  const teamMessagesRef = useRef<HTMLDivElement | null>(null)
  const crmMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const teamMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const crmScrollTimersRef = useRef<number[]>([])
  const teamScrollTimersRef = useRef<number[]>([])
  const crmShouldStickToBottomRef = useRef(true)
  const teamShouldStickToBottomRef = useRef(true)
  const crmDistanceFromBottomRef = useRef(0)
  const teamDistanceFromBottomRef = useRef(0)
  const previousConversationKeyRef = useRef<string | null>(null)
  const previousThreadKeyRef = useRef<string | null>(null)
  const unreadAlertsSnapshotRef = useRef<Record<string, number>>({})
  const unreadAlertsHydratedRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ChatTab>('updates')
  const [teamView, setTeamView] = useState<'direct' | 'groups'>('direct')
  const [teamMobilePanel, setTeamMobilePanel] = useState<'options' | 'chat'>('options')
  const [loading, setLoading] = useState(true)
  const [crmLoading, setCrmLoading] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [sendingCrm, setSendingCrm] = useState(false)
  const [sendingTeam, setSendingTeam] = useState(false)
  const [startingThread, setStartingThread] = useState(false)
  const [uploadingTeamAttachment, setUploadingTeamAttachment] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
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
  const [teamAttachmentUpload, setTeamAttachmentUpload] = useState<UploadProgressState | null>(null)
  const [teamLibraryPickerOpen, setTeamLibraryPickerOpen] = useState(false)
  const [groupForm, setGroupForm] = useState({ title: '', participantUserIds: [] as string[] })
  const [showCrmScrollToBottom, setShowCrmScrollToBottom] = useState(false)
  const [showTeamScrollToBottom, setShowTeamScrollToBottom] = useState(false)
  const [supportCopyStatus, setSupportCopyStatus] = useState<string | null>(null)
  const { mutedCrmConversationIds, mutedTeamThreadIds, setMutedCrmConversationIds, setMutedTeamThreadIds } = useChatMutePreferences()
  const [threadSearchOpen, setThreadSearchOpen] = useState(false)
  const [threadSearch, setThreadSearch] = useState('')
  const [sharedFilesOpen, setSharedFilesOpen] = useState(false)
  const [threadInfoOpen, setThreadInfoOpen] = useState(false)
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuState | null>(null)
  const [optimisticTeamMessages, setOptimisticTeamMessages] = useState<OptimisticTeamMessage[]>([])
  const [leavingGroup, setLeavingGroup] = useState(false)
  const availableTabs = useMemo<ChatTab[]>(() => {
    const nextTabs: ChatTab[] = ['updates', 'support']
    if (canAccessCrmChat) nextTabs.push('crm')
    if (canAccessTeamChat) nextTabs.push('team')
    return nextTabs
  }, [canAccessCrmChat, canAccessTeamChat])

  function clearScrollTimers(timersRef: React.MutableRefObject<number[]>) {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timersRef.current = []
  }

  function scrollContainerToBottom(container: HTMLDivElement | null, endAnchor: HTMLDivElement | null, behavior: ScrollBehavior = 'smooth') {
    if (!container) return
    window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior })
      endAnchor?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  function scheduleScrollToBottom(
    container: HTMLDivElement | null,
    endAnchor: HTMLDivElement | null,
    timersRef: React.MutableRefObject<number[]>,
    behavior: ScrollBehavior = 'auto',
  ) {
    if (!container) return
    clearScrollTimers(timersRef)
    scrollContainerToBottom(container, endAnchor, behavior)
    const retries = [80, 220, 420]
    timersRef.current = retries.map((delay) => window.setTimeout(() => {
      scrollContainerToBottom(container, endAnchor, 'auto')
    }, delay))
  }

  function isContainerNearBottom(container: HTMLDivElement | null, threshold = 80) {
    if (!container) return true
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceToBottom <= threshold
  }

  function distanceFromBottom(container: HTMLDivElement | null) {
    if (!container) return 0
    return Math.max(container.scrollHeight - container.scrollTop - container.clientHeight, 0)
  }

  function restoreScrollDistance(container: HTMLDivElement | null, distance: number) {
    if (!container) return
    window.requestAnimationFrame(() => {
      const nextTop = Math.max(container.scrollHeight - container.clientHeight - distance, 0)
      container.scrollTop = nextTop
    })
  }

  function handleCrmViewportScroll() {
    const nearBottom = isContainerNearBottom(crmMessagesRef.current)
    crmDistanceFromBottomRef.current = distanceFromBottom(crmMessagesRef.current)
    crmShouldStickToBottomRef.current = nearBottom
    setShowCrmScrollToBottom(!nearBottom)
    if (!nearBottom) {
      clearScrollTimers(crmScrollTimersRef)
    }
  }

  function handleTeamViewportScroll() {
    const nearBottom = isContainerNearBottom(teamMessagesRef.current)
    teamDistanceFromBottomRef.current = distanceFromBottom(teamMessagesRef.current)
    teamShouldStickToBottomRef.current = nearBottom
    setShowTeamScrollToBottom(!nearBottom)
    if (!nearBottom) {
      clearScrollTimers(teamScrollTimersRef)
    }
  }

  function jumpCrmToBottom() {
    crmShouldStickToBottomRef.current = true
    crmDistanceFromBottomRef.current = 0
    setShowCrmScrollToBottom(false)
    scheduleScrollToBottom(crmMessagesRef.current, crmMessagesEndRef.current, crmScrollTimersRef, 'smooth')
  }

  function jumpTeamToBottom() {
    teamShouldStickToBottomRef.current = true
    teamDistanceFromBottomRef.current = 0
    setShowTeamScrollToBottom(false)
    scheduleScrollToBottom(teamMessagesRef.current, teamMessagesEndRef.current, teamScrollTimersRef, 'smooth')
  }

  useEffect(() => {
    return () => {
      clearScrollTimers(crmScrollTimersRef)
      clearScrollTimers(teamScrollTimersRef)
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageTabKey)
      if (saved === 'updates' || saved === 'crm' || saved === 'team' || saved === 'support') {
        hasStoredTabPreferenceRef.current = true
        setActiveTab(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (availableTabs.includes(activeTab)) return
    if (shouldDefaultToSupport(currentUserRole) && availableTabs.includes('support')) {
      setActiveTab('support')
      return
    }
    setActiveTab(availableTabs[0] ?? 'updates')
  }, [activeTab, availableTabs, currentUserRole])

  useEffect(() => {
    if (hasHydratedTabPersistenceRef.current) {
      hasStoredTabPreferenceRef.current = true
    } else {
      hasHydratedTabPersistenceRef.current = true
    }

    try {
      window.localStorage.setItem(storageTabKey, activeTab)
    } catch {
      // ignore
    }
  }, [activeTab])

  async function loadBase() {
    setLoading(true)
    try {
      const [meResult, usersResult, conversationsResult, threadsResult] = await Promise.allSettled([
        requestJson<{ id: string; role?: string | null }>('/api/me'),
        canAccessTeamChat ? requestJson<TeamUser[]>('/api/crm/assignees') : Promise.resolve({ success: true, data: [] as TeamUser[] }),
        canAccessCrmChat ? requestJson<ConversationListItem[]>('/api/crm/conversations') : Promise.resolve({ success: true, data: [] as ConversationListItem[] }),
        canAccessTeamChat ? requestJson<InternalThreadSummary[]>('/api/crm/internal-chat/threads') : Promise.resolve({ success: true, data: [] as InternalThreadSummary[] }),
      ])

      const meRes = meResult.status === 'fulfilled' ? meResult.value : null
      const usersRes = usersResult.status === 'fulfilled' ? usersResult.value : null
      const conversationsRes = conversationsResult.status === 'fulfilled' ? conversationsResult.value : null
      const threadsRes = threadsResult.status === 'fulfilled' ? threadsResult.value : null

      setCurrentUserId(meRes?.data?.id ?? null)
      setCurrentUserRole(meRes?.data?.role ?? null)
      setTeamUsers(Array.isArray(usersRes?.data) ? usersRes.data : [])
      const nextConversations = Array.isArray(conversationsRes?.data) ? conversationsRes.data : []
      const nextVisibleConversations = nextConversations.filter((item) => !shouldHideFromGlobalChat(item))
      const nextThreads = Array.isArray(threadsRes?.data) ? threadsRes.data : []
      setCrmConversations(nextConversations)
      setTeamThreads(nextThreads)
      setSelectedConversationId((current) => canAccessCrmChat && current && nextVisibleConversations.some((item) => item.id === current) ? current : canAccessCrmChat ? nextVisibleConversations[0]?.id ?? null : null)
      setSelectedThreadId((current) => canAccessTeamChat && current && nextThreads.some((item) => item.id === current) ? current : canAccessTeamChat ? nextThreads[0]?.id ?? null : null)
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
      setTeamAttachmentUpload(null)
      clearScrollTimers(teamScrollTimersRef)
      setThreadSearchOpen(false)
      setThreadSearch('')
      setMessageContextMenu(null)
    }
  }, [activeTab])

  useEffect(() => {
    if (!messageContextMenu) return

    function closeMenu() {
      setMessageContextMenu(null)
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    window.addEventListener('keydown', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
      window.removeEventListener('keydown', closeMenu)
    }
  }, [messageContextMenu])

  useEffect(() => {
    if (activeTab !== 'team') return
    setTeamMobilePanel(selectedThreadId ? 'chat' : 'options')
  }, [activeTab, selectedThreadId])

  useEffect(() => {
    const textarea = teamTextareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    const nextHeight = Math.min(textarea.scrollHeight, 140)
    textarea.style.height = `${Math.max(nextHeight, 44)}px`
  }, [teamMessageDraft, selectedThreadId])

  useEffect(() => {
    const conversationKey = selectedConversation
      ? `${selectedConversation.id}:${selectedConversation.messages.at(-1)?.id ?? 'empty'}:${selectedConversation.messages.length}`
      : null
    const conversationChanged = previousConversationKeyRef.current !== conversationKey
    previousConversationKeyRef.current = conversationKey

    if (!open || activeTab !== 'crm' || !selectedConversation || !conversationChanged) return
    if (crmShouldStickToBottomRef.current || selectedConversationId !== selectedConversation.id) {
      scheduleScrollToBottom(crmMessagesRef.current, crmMessagesEndRef.current, crmScrollTimersRef, 'auto')
    } else {
      restoreScrollDistance(crmMessagesRef.current, crmDistanceFromBottomRef.current)
    }
  }, [activeTab, open, selectedConversationId, selectedConversation])

  useEffect(() => {
    const threadKey = selectedThread
      ? `${selectedThread.id}:${selectedThread.messages.at(-1)?.id ?? 'empty'}:${selectedThread.messages.length}`
      : null
    const threadChanged = previousThreadKeyRef.current !== threadKey
    previousThreadKeyRef.current = threadKey

    if (!open || activeTab !== 'team' || !selectedThread || !threadChanged) return
    if (teamShouldStickToBottomRef.current || selectedThreadId !== selectedThread.id) {
      scheduleScrollToBottom(teamMessagesRef.current, teamMessagesEndRef.current, teamScrollTimersRef, 'auto')
    } else {
      restoreScrollDistance(teamMessagesRef.current, teamDistanceFromBottomRef.current)
    }
  }, [activeTab, open, selectedThreadId, selectedThread])

  useEffect(() => {
    if (!open || activeTab !== 'crm') return
    crmShouldStickToBottomRef.current = true
    setShowCrmScrollToBottom(false)
    scheduleScrollToBottom(crmMessagesRef.current, crmMessagesEndRef.current, crmScrollTimersRef, 'auto')
  }, [activeTab, open, selectedConversationId])

  useEffect(() => {
    if (!open || activeTab !== 'team') return
    teamShouldStickToBottomRef.current = true
    setShowTeamScrollToBottom(false)
    scheduleScrollToBottom(teamMessagesRef.current, teamMessagesEndRef.current, teamScrollTimersRef, 'auto')
  }, [activeTab, open, selectedThreadId])

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

  const visibleCrmConversations = useMemo(() => crmConversations.filter((item) => !shouldHideFromGlobalChat(item)), [crmConversations])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    return visibleCrmConversations.filter((item) => {
      if (!term) return true
      const name = item.contactDisplayName?.toLowerCase() ?? item.lead?.nombre?.toLowerCase() ?? item.cliente?.nombre?.toLowerCase() ?? ''
      const preview = item.messages?.[0]?.bodyText?.toLowerCase() ?? ''
      return name.includes(term) || preview.includes(term)
    })
  }, [search, visibleCrmConversations])

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
    const crmAlerts = !canAccessCrmChat ? [] : visibleCrmConversations
      .filter((item) => item.unreadCount > 0)
      .map((item) => ({
        id: item.id,
        kind: 'crm' as const,
        title: item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto CRM',
        subtitle: formatChannel(item.channelConnection.provider),
        preview: item.messages?.[0]?.bodyText || item.contactEmail || item.contactPhone || 'Mensaje nuevo',
        occurredAt: item.lastMessageAt,
        unreadCount: item.unreadCount,
        senderLabel: item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || item.contactEmail || item.contactPhone || 'Contacto CRM',
      }))

    const teamAlerts = !canAccessTeamChat ? [] : teamThreads
      .filter((item) => item.unreadCount > 0)
      .map((item) => ({
        id: item.id,
        kind: 'team' as const,
        title: item.type === 'GROUP' ? item.title || 'Grupo interno' : item.counterpart?.name || item.counterpart?.email || 'Compañero',
        subtitle: item.type === 'GROUP' ? 'Grupo de equipo' : 'Chat interno',
        preview: item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto nuevo' : 'Mensaje nuevo'),
        occurredAt: item.lastMessageAt,
        unreadCount: item.unreadCount,
        senderLabel: item.lastMessage?.sentByUser?.name || item.lastMessage?.sentByUser?.email || item.counterpart?.name || item.counterpart?.email || item.title || 'Compañero',
      }))

    return [...crmAlerts, ...teamAlerts].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [canAccessCrmChat, canAccessTeamChat, teamThreads, visibleCrmConversations])

  const unreadTotal = useMemo(() => unreadAlerts.reduce((sum, item) => sum + item.unreadCount, 0), [unreadAlerts])

  const selectedThreadMessages = useMemo(() => {
    if (!selectedThread) return [] as InternalChatMessage[]
    const optimistic = optimisticTeamMessages.filter((message) => message.threadId === selectedThread.id)
    return [...selectedThread.messages, ...optimistic].sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
  }, [optimisticTeamMessages, selectedThread])

  const visibleTeamMessages = useMemo(() => {
    const term = threadSearch.trim().toLowerCase()
    if (!term) return selectedThreadMessages

    return selectedThreadMessages.filter((message) => {
      const body = message.bodyText?.toLowerCase() ?? ''
      const attachmentText = (message.attachments ?? []).map((attachment) => `${attachment.name} ${attachment.mimeType ?? ''}`.toLowerCase()).join(' ')
      const sender = `${message.sentByUser?.name ?? ''} ${message.sentByUser?.email ?? ''}`.toLowerCase()
      return body.includes(term) || attachmentText.includes(term) || sender.includes(term)
    })
  }, [selectedThreadMessages, threadSearch])

  const selectedThreadSharedFiles = useMemo(() => {
    if (!selectedThread) return [] as Array<ChatAttachment & { messageId: string; occurredAt: string; senderLabel: string }>

    return selectedThread.messages
      .flatMap((message) => (message.attachments ?? []).map((attachment) => ({
        ...attachment,
        messageId: message.id,
        occurredAt: message.occurredAt,
        senderLabel: message.sentByUser?.name || message.sentByUser?.email || 'Usuario',
      })))
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
  }, [selectedThread])

  const activeDirectUserId = useMemo(() => {
    if (!selectedThread || selectedThread.type !== 'DIRECT' || !currentUserId) return null
    return selectedThread.participants.find((participant) => participant.userId !== currentUserId)?.userId ?? null
  }, [currentUserId, selectedThread])

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

  useEffect(() => {
    const snapshot = Object.fromEntries(unreadAlerts.map((alert) => [`${alert.kind}:${alert.id}`, alert.unreadCount]))

    if (!unreadAlertsHydratedRef.current) {
      unreadAlertsHydratedRef.current = true
      unreadAlertsSnapshotRef.current = snapshot
      return
    }

    unreadAlerts.forEach((alert) => {
      const key = `${alert.kind}:${alert.id}`
      const previousCount = unreadAlertsSnapshotRef.current[key] ?? 0
      const hasNewUnread = alert.unreadCount > previousCount
      const isMuted = alert.kind === 'team'
        ? mutedTeamThreadIds.includes(alert.id)
        : mutedCrmConversationIds.includes(alert.id)
      const isOpenThread = alert.kind === 'team'
        ? open && activeTab === 'team' && selectedThreadId === alert.id
        : open && activeTab === 'crm' && selectedConversationId === alert.id
      if (!hasNewUnread || isMuted || isOpenThread) return

      toast({
        title: `Nuevo mensaje de ${alert.senderLabel || alert.title}`,
        description: alert.preview,
      })
    })

    unreadAlertsSnapshotRef.current = snapshot
  }, [activeTab, mutedCrmConversationIds, mutedTeamThreadIds, open, selectedConversationId, selectedThreadId, unreadAlerts])

  async function handleOpenAlert(alert: InboxAlert) {
    setOpen(true)
    if (alert.kind === 'crm') {
      if (!canAccessCrmChat) return
      setActiveTab('crm')
      setSelectedConversationId(alert.id)
      await loadConversationDetail(alert.id)
      return
    }

    if (!canAccessTeamChat) return
    setActiveTab('team')
    setTeamView('direct')
    setSelectedThreadId(alert.id)
    await loadThreadDetail(alert.id)
  }

  async function copySupportTemplate() {
    try {
      await navigator.clipboard.writeText(SUPPORT_REQUEST_TEMPLATE)
      setSupportCopyStatus('Plantilla copiada')
      window.setTimeout(() => setSupportCopyStatus(null), 2200)
    } catch {
      setSupportCopyStatus('No se pudo copiar')
      window.setTimeout(() => setSupportCopyStatus(null), 2200)
    }
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
      jumpCrmToBottom()
    } finally {
      setSendingCrm(false)
    }
  }

  async function sendTeamMessage(options?: {
    bodyText?: string
    attachments?: ChatAttachment[]
    suppressEmptyAlert?: boolean
  }) {
    if (!selectedThreadId) {
      if (!options?.suppressEmptyAlert) {
        alert('Selecciona un chat o grupo antes de enviar.')
      }
      return false
    }
    const bodyText = typeof options?.bodyText === 'string' ? options.bodyText : teamMessageDraft
    const attachments = options?.attachments ?? pendingTeamAttachments
    if (!bodyText.trim() && attachments.length === 0) {
      if (!options?.suppressEmptyAlert) {
        alert('Escribe un mensaje o agrega un adjunto.')
      }
      return false
    }
    setSendingTeam(true)
    const optimisticMessageId = `optimistic-${Date.now()}`
    const optimisticMessage: OptimisticTeamMessage = {
      id: optimisticMessageId,
      threadId: selectedThreadId,
      bodyText: bodyText || null,
      occurredAt: new Date().toISOString(),
      sentByUserId: currentUserId,
      sentByUser: selectedThread?.participants.find((participant) => participant.userId === currentUserId)?.user ?? null,
      attachments,
      status: 'PENDING',
      canDelete: false,
    }
    setOptimisticTeamMessages((current) => [...current, optimisticMessage])
    try {
      const json = await requestJson(`/api/crm/internal-chat/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyText, attachments }),
      })
      if (!json.success) {
        setOptimisticTeamMessages((current) => current.filter((message) => message.id !== optimisticMessageId))
        alert(json.error || 'No se pudo enviar el mensaje interno.')
        return false
      }
      setTeamMessageDraft('')
      setPendingTeamAttachments([])
      setOptimisticTeamMessages((current) => current.filter((message) => message.id !== optimisticMessageId))
      await Promise.all([loadBase(), loadThreadDetail(selectedThreadId)])
      jumpTeamToBottom()
      return true
    } catch {
      setOptimisticTeamMessages((current) => current.filter((message) => message.id !== optimisticMessageId))
      alert('No se pudo enviar el mensaje interno.')
      return false
    } finally {
      setSendingTeam(false)
    }
  }

  async function handleSendTeamMessage() {
    await sendTeamMessage()
  }

  function openTeamAttachmentPicker(kind: 'image' | 'document') {
    if (!fileInputRef.current || !selectedThreadId || uploadingTeamAttachment) return
    fileInputRef.current.accept = kind === 'image'
      ? 'image/png,image/jpeg,image/webp,image/gif'
      : 'application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  function handleTeamMessageKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (sendingTeam || !selectedThreadId || uploadingTeamAttachment) return
    void handleSendTeamMessage()
  }

  async function handleStartTeamChat(userId: string) {
    if (!canAccessTeamChat) return
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
    setTeamAttachmentUpload({ name: file.name, progress: 0 })
    try {
      const json = await uploadFileWithProgress<ChatAttachment>({
        url: `/api/crm/internal-chat/threads/${selectedThreadId}/attachments`,
        file,
        onProgress: (progress) => {
          setTeamAttachmentUpload({ name: file.name, progress })
        },
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo subir el adjunto.')
        return
      }
      const uploadedAttachment = json.data as ChatAttachment
      const sent = await sendTeamMessage({
        bodyText: teamMessageDraft,
        attachments: [uploadedAttachment],
        suppressEmptyAlert: true,
      })
      if (!sent) {
        setPendingTeamAttachments((current) => [...current, uploadedAttachment])
      }
    } finally {
      setUploadingTeamAttachment(false)
      setTeamAttachmentUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleTeamLibraryAttachment(item: CrmFileItem) {
    if (!selectedThreadId) {
      alert('Selecciona primero un chat o grupo para adjuntar archivos.')
      return
    }

    const attachment = mapLibraryItemToAttachment(item)
    const sent = await sendTeamMessage({
      bodyText: teamMessageDraft,
      attachments: [attachment],
      suppressEmptyAlert: true,
    })

    if (!sent) {
      setPendingTeamAttachments((current) =>
        current.some((existing) => existing.url === attachment.url) ? current : [...current, attachment]
      )
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

  async function handleDeleteTeamMessage(messageId: string) {
    if (!selectedThreadId) return
    setMessageContextMenu(null)
    const json = await requestJson(`/api/crm/internal-chat/threads/${selectedThreadId}/messages/${messageId}`, {
      method: 'DELETE',
    })
    if (!json.success) {
      alert(json.error || 'No se pudo borrar el mensaje.')
      await loadThreadDetail(selectedThreadId)
      return
    }
    await Promise.all([loadBase(), loadThreadDetail(selectedThreadId)])
  }

  function toggleMuteSelectedThread() {
    if (!selectedThreadId) return
    setMutedTeamThreadIds((current) => current.includes(selectedThreadId)
      ? current.filter((item) => item !== selectedThreadId)
      : [...current, selectedThreadId])
  }

  function toggleMuteSelectedConversation() {
    if (!selectedConversationId) return
    setMutedCrmConversationIds((current) => current.includes(selectedConversationId)
      ? current.filter((item) => item !== selectedConversationId)
      : [...current, selectedConversationId])
  }

  async function handleLeaveSelectedGroup() {
    if (!selectedThreadId || selectedThread?.type !== 'GROUP') return
    const confirmed = window.confirm('Vas a salir de este grupo. Podrás volver solo si te agregan de nuevo.')
    if (!confirmed) return

    setLeavingGroup(true)
    try {
      const json = await requestJson(`/api/crm/internal-chat/threads/${selectedThreadId}/leave`, {
        method: 'POST',
      })
      if (!json.success) {
        alert(json.error || 'No se pudo salir del grupo.')
        return
      }

      setSelectedThreadId(null)
      setSelectedThread(null)
      setPendingTeamAttachments([])
      setTeamMessageDraft('')
      setThreadSearch('')
      setThreadSearchOpen(false)
      await loadBase()
    } finally {
      setLeavingGroup(false)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[70] flex flex-col items-end sm:right-6">
      <div className="relative flex flex-col items-end">
        <div
          className={cn(
            'pointer-events-auto absolute bottom-0 right-0 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden rounded-t-[26px] border border-b-0 border-slate-200 bg-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.45)] transition-all duration-300',
            'w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-[min(680px,calc(100vw-3rem))] lg:w-[min(780px,calc(100vw-4rem))]',
            open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0',
          )}
        >
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] px-4 py-2 sm:px-4.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Chat global</p>
            <CrmFileLibraryPicker
              open={teamLibraryPickerOpen}
              onOpenChange={setTeamLibraryPickerOpen}
              onPick={handleTeamLibraryAttachment}
              allowFolders={false}
              title="Cargar desde Administrador de archivos"
            />
                <h3 className="mt-0.5 text-[14px] font-semibold text-slate-950 sm:text-[15px]">Mensajes y novedades</h3>
                <p className="mt-0.5 text-xs text-slate-600">Trabaja con el chat sin bloquear el resto del dashboard.</p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg md:hidden" aria-label="Cambiar sección del chat">
                      <MoreVertical className="h-4.5 w-4.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 rounded-2xl p-1.5">
                    <DropdownMenuItem onSelect={() => setActiveTab('updates')}>
                      Novedades
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveTab('support')}>
                      {SUPPORT_TAB_LABEL}
                    </DropdownMenuItem>
                    {canAccessCrmChat ? <DropdownMenuItem onSelect={() => setActiveTab('crm')}>
                      CRM
                    </DropdownMenuItem> : null}
                    {canAccessTeamChat ? <DropdownMenuItem onSelect={() => setActiveTab('team')}>
                      Equipo
                    </DropdownMenuItem> : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setOpen(false)}>
                  <X className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>
            {activeTab === 'updates' ? (
              <div className="mt-2 space-y-2">
                <div className="hidden grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 md:grid">
                  <button type="button" onClick={() => setActiveTab('updates')} className="rounded-xl bg-white px-3 py-1.5 text-[10px] font-medium text-slate-950 shadow-sm">
                    Novedades
                  </button>
                  <button type="button" onClick={() => setActiveTab('support')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    {SUPPORT_TAB_LABEL}
                  </button>
                  {canAccessCrmChat ? <button type="button" onClick={() => setActiveTab('crm')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    CRM
                  </button> : null}
                  {canAccessTeamChat ? <button type="button" onClick={() => setActiveTab('team')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    Equipo
                  </button> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-white overflow-x-hidden">
            {activeTab === 'updates' ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-2 text-[12px] text-slate-600">
                  {loading ? 'Sincronizando mensajes nuevos...' : unreadAlerts.length ? `${unreadAlerts.length} hilos con novedades` : 'No tienes mensajes nuevos'}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  <div className="space-y-2.5">
                    {unreadAlerts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-500">Todo está al día. Cuando llegue un mensaje nuevo te saldrá aquí y en el badge del botón flotante.</div> : null}
                    {unreadAlerts.map((alert) => (
                      <button key={`${alert.kind}-${alert.id}`} type="button" onClick={() => void handleOpenAlert(alert)} className="w-full rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-950">{alert.title}</span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{alert.subtitle}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[13px] text-slate-600">{alert.preview}</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{alert.unreadCount}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">{formatDate(alert.occurredAt, 'Sin fecha')}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'crm' && canAccessCrmChat ? (
              <div className="grid h-full min-h-0 overflow-hidden grid-rows-[minmax(220px,0.88fr)_minmax(0,1.12fr)] md:grid-cols-[minmax(300px,0.92fr)_minmax(340px,1.08fr)] md:grid-rows-1">
                <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-b border-slate-100 md:border-b-0 md:border-r">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <div className="space-y-2">
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contacto, mensaje o canal..." className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                      <div className="hidden grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 md:grid">
                        <button type="button" onClick={() => setActiveTab('updates')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          Novedades
                        </button>
                        <button type="button" onClick={() => setActiveTab('support')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          {SUPPORT_TAB_LABEL}
                        </button>
                        {canAccessCrmChat ? <button type="button" onClick={() => setActiveTab('crm')} className={cn('rounded-xl px-3 py-1.5 text-[10px] font-medium', activeTab === 'crm' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                          CRM
                        </button> : null}
                        {canAccessTeamChat ? <button type="button" onClick={() => setActiveTab('team')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          Equipo
                        </button> : null}
                      </div>
                    </div>
                    <div className="mt-3 text-[13px] text-slate-600">Bandeja CRM</div>
                  </div>
                  <div className="min-h-0 overflow-y-auto overflow-x-hidden p-2.5">
                    <div className="space-y-2.5">
                      {filteredConversations.map((item) => (
                        <button key={item.id} type="button" onClick={() => setSelectedConversationId(item.id)} className={cn('w-full min-w-0 rounded-[22px] border px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md', selectedConversationId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">{item.contactDisplayName || item.lead?.nombre || item.cliente?.nombre || 'Contacto CRM'}</p>
                              <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{item.messages?.[0]?.bodyText || item.contactEmail || item.contactPhone || 'Sin mensajes aún'}</p>
                            </div>
                            {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>{formatChannel(item.channelConnection.provider)}</span>
                            <span>{formatDate(item.lastMessageAt, 'Sin fecha')}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-2 text-[13px] text-slate-600">Detalle de conversación</div>
                  <div className="shrink-0 px-4 pt-2.5">
                    {crmLoading ? <span className="sr-only">Cargando conversación...</span> : null}
                    {!crmLoading && !selectedConversation ? <p className="pb-3 text-sm text-slate-500">Selecciona un hilo CRM para responderlo aquí.</p> : null}
                    {selectedConversation ? (
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-950">{selectedConversation.contactDisplayName || selectedConversation.lead?.nombre || selectedConversation.cliente?.nombre || 'Contacto CRM'}</h4>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{formatChannel(selectedConversation.channelConnection.provider)}</span>
                            </div>
                            <p className="mt-1 text-[13px] text-slate-600">{selectedConversation.contactPhone || selectedConversation.contactEmail || 'Sin dato de contacto visible'}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label="Opciones del chat CRM">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                              <DropdownMenuLabel>Conversación CRM</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={toggleMuteSelectedConversation}>
                                <BellOff className="mr-2 h-4 w-4" />
                                {selectedConversationId && mutedCrmConversationIds.includes(selectedConversationId) ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div
                    ref={crmMessagesRef}
                    onScroll={handleCrmViewportScroll}
                    className="min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2.5"
                  >
                    {selectedConversation ? (
                      <div className="min-w-0 space-y-2.5">
                        {selectedConversation.messages.map((message) => (
                          <div key={message.id} className={message.direction === 'OUTBOUND' ? 'ml-auto max-w-[94%] min-w-0 rounded-[22px] border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-slate-700' : message.direction === 'SYSTEM' ? 'mx-auto max-w-[94%] min-w-0 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600' : 'mr-auto max-w-[94%] min-w-0 rounded-[22px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700'}>
                            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-slate-500">
                              <span>{message.direction}</span>
                              <span>{formatDate(message.occurredAt, 'Sin fecha')}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words leading-5">{renderHighlightedText(message.bodyText || 'Sin texto', search)}</p>
                            {message.direction === 'OUTBOUND' && getCrmMessageStatusLabel(message.status) ? (
                              <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                {renderCrmMessageStatusIcon(message.status)}
                                <span>{getCrmMessageStatusLabel(message.status)}</span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        <div ref={crmMessagesEndRef} aria-hidden="true" className="h-px w-full" />
                      </div>
                    ) : null}
                  </div>
                  {selectedConversation && showCrmScrollToBottom ? (
                    <button
                      type="button"
                      onClick={jumpCrmToBottom}
                      className="absolute bottom-[92px] right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700 shadow-[0_14px_30px_-18px_rgba(14,116,144,0.45)] transition hover:bg-sky-50"
                      aria-label="Ir al último mensaje"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </button>
                  ) : null}
                  <div className="shrink-0 border-t border-slate-100 p-3">
                    <div className="grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 p-3">
                      <Label className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 sm:block">Responder al cliente</Label>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <Textarea
                          value={crmMessageDraft}
                          onChange={(event) => setCrmMessageDraft(event.target.value)}
                          rows={2}
                          placeholder="Escribe una respuesta rápida sin salir de la pantalla..."
                          className="min-h-[52px] resize-none rounded-2xl bg-white text-sm leading-5 sm:min-h-[64px]"
                        />
                        <Button size="sm" className="h-10 rounded-xl px-4 text-[10px]" onClick={() => void handleSendCrmMessage()} disabled={sendingCrm || !selectedConversationId}>
                          {sendingCrm ? 'Enviando...' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'team' && canAccessTeamChat ? (
              <div className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[minmax(360px,0.48fr)_minmax(0,0.52fr)] md:grid-rows-1">
                <div className="border-b border-slate-100 px-4 py-2 md:hidden">
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setTeamMobilePanel('options')}
                      className={cn('rounded-xl px-3 py-2 text-[10px] font-medium', teamMobilePanel === 'options' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}
                    >
                      Opciones
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamMobilePanel('chat')}
                      className={cn('rounded-xl px-3 py-2 text-[10px] font-medium', teamMobilePanel === 'chat' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}
                    >
                      Chat
                    </button>
                  </div>
                </div>

                <div className={cn('grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-b border-slate-100 md:border-b-0 md:border-r', teamMobilePanel === 'chat' ? 'hidden md:grid' : 'grid')}>
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <div className="space-y-2">
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contacto, compañero, grupo o mensaje..." className="h-9 rounded-xl border-slate-200 bg-white text-sm" />
                      <div className="hidden grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 md:grid">
                        <button type="button" onClick={() => setActiveTab('updates')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          Novedades
                        </button>
                        <button type="button" onClick={() => setActiveTab('support')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          {SUPPORT_TAB_LABEL}
                        </button>
                        {canAccessCrmChat ? <button type="button" onClick={() => setActiveTab('crm')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                          CRM
                        </button> : null}
                        {canAccessTeamChat ? <button type="button" onClick={() => setActiveTab('team')} className={cn('rounded-xl px-3 py-1.5 text-[10px] font-medium', activeTab === 'team' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                          Equipo
                        </button> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] text-slate-600">Equipo y grupos</span>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-[10px]" onClick={() => setGroupDialogOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Nuevo grupo
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button type="button" onClick={() => setTeamView('direct')} className={cn('rounded-xl px-3 py-1.5 text-[10px] font-medium', teamView === 'direct' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                        Directos
                      </button>
                      <button type="button" onClick={() => setTeamView('groups')} className={cn('rounded-xl px-3 py-1.5 text-[10px] font-medium', teamView === 'groups' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                        Grupos creados
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto p-2.5">
                    {teamView === 'direct' ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Abrir chat nuevo</p>
                          {filteredTeamUsers.map((user) => (
                            <div key={user.id} className={cn('flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition-colors', activeDirectUserId === user.id ? 'border-sky-300 bg-sky-50/80 shadow-sm' : 'border-slate-200 bg-slate-50/70')}>
                              <div>
                                <p className="text-sm font-medium text-slate-950">{user.name || user.email || user.id}</p>
                                <p className="text-xs text-slate-500">{user.email || 'Sin correo visible'}</p>
                              </div>
                              <Button variant={activeDirectUserId === user.id ? 'default' : 'outline'} size="sm" className="h-8 rounded-xl px-3 text-[10px]" onClick={() => void handleStartTeamChat(user.id)} disabled={startingThread}>
                                {activeDirectUserId === user.id ? 'Activo' : 'Abrir'}
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Chats activos</p>
                          {directThreads.map((item) => (
                            <button key={item.id} type="button" onClick={() => {
                              setSelectedThreadId(item.id)
                              setTeamMobilePanel('chat')
                            }} className={cn('w-full min-w-0 rounded-[22px] border px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md', selectedThreadId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-5 text-slate-950">{item.counterpart?.name || item.counterpart?.email || 'Chat interno'}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{renderHighlightedText(item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto enviado' : 'Sin mensajes aún'), search)}</p>
                                </div>
                                {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                              </div>
                              <p className="mt-1.5 text-[11px] text-slate-500">{formatDate(item.lastMessageAt, 'Sin fecha')}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Grupos creados por ti</p>
                        {createdGroupThreads.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-500">Aún no has creado grupos internos.</p> : null}
                        {createdGroupThreads.map((item) => (
                          <div key={item.id} className={cn('rounded-[22px] border px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md', selectedThreadId === item.id ? 'border-sky-300 bg-sky-50/80' : 'border-slate-200 bg-white')}>
                            <button type="button" onClick={() => {
                              setSelectedThreadId(item.id)
                              setTeamMobilePanel('chat')
                            }} className="w-full text-left">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold leading-5 text-slate-950">{item.title || 'Grupo interno'}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{item.lastMessage?.bodyText || (item.lastMessage?.attachments?.length ? 'Adjunto compartido' : 'Sin mensajes aún')}</p>
                                </div>
                                {item.unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">{item.unreadCount}</span> : null}
                              </div>
                              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>{item.participantsCount || item.participants?.length || 0} participantes</span>
                                <span>{formatDate(item.lastMessageAt, 'Sin fecha')}</span>
                              </div>
                            </button>
                            <div className="mt-2 flex justify-end">
                              <Button variant="outline" size="sm" className="h-8 rounded-xl px-3 text-[10px] text-rose-700 hover:text-rose-800" onClick={() => void handleDeleteGroup(item.id)} disabled={deletingGroupId === item.id}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                {deletingGroupId === item.id ? 'Eliminando...' : 'Eliminar'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={cn('relative min-h-0 min-w-0 overflow-hidden', teamMobilePanel === 'options' ? 'hidden md:grid' : 'grid', 'grid-rows-[auto_minmax(0,1fr)_auto]')}>
                  <div className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>{selectedThread ? formatThreadName(selectedThread) : 'Conversación interna'}</span>
                      <div className="flex items-center gap-1.5">
                        {selectedThread ? (
                          <>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setThreadSearchOpen((current) => !current)} aria-label="Buscar en el chat">
                              <Search className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" aria-label="Más opciones del chat">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
                                <DropdownMenuLabel>Conversación</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => setSharedFilesOpen(true)}>
                                  <Paperclip className="mr-2 h-4 w-4" />
                                  Archivos compartidos
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setThreadInfoOpen(true)}>
                                  <Info className="mr-2 h-4 w-4" />
                                  Información del contacto
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setThreadSearchOpen(true)}>
                                  <Search className="mr-2 h-4 w-4" />
                                  Buscar en el chat
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={toggleMuteSelectedThread}>
                                  <BellOff className="mr-2 h-4 w-4" />
                                  {selectedThreadId && mutedTeamThreadIds.includes(selectedThreadId) ? 'Activar notificaciones' : 'Silenciar notificaciones'}
                                </DropdownMenuItem>
                                {selectedThread.type === 'GROUP' ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => void handleLeaveSelectedGroup()} className="text-rose-700 focus:text-rose-800">
                                      <LogOut className="mr-2 h-4 w-4" />
                                      {leavingGroup ? 'Saliendo...' : 'Salir del grupo'}
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : null}
                        <button type="button" onClick={() => setTeamMobilePanel('options')} className="text-[10px] font-medium text-sky-700 md:hidden">
                          Ver opciones
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 h-full overflow-hidden">
                    {teamLoading ? <span className="sr-only">Cargando chat interno...</span> : null}
                    {!teamLoading && !selectedThread ? <p className="text-sm text-slate-500">Selecciona un compañero o un grupo para abrir la conversación.</p> : null}
                    {selectedThread ? (
                      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 px-3 py-3">

                        {threadSearchOpen ? (
                          <div className="shrink-0 rounded-[18px] border border-slate-200 bg-white px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-slate-400" />
                              <Input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Buscar mensajes, archivos o remitente..." className="h-8 border-0 px-0 shadow-none focus-visible:ring-0" />
                              <button type="button" onClick={() => { setThreadSearch(''); setThreadSearchOpen(false) }} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                                Cerrar
                              </button>
                            </div>
                            {threadSearch.trim() ? <p className="mt-1 text-[11px] text-slate-500">{visibleTeamMessages.length} resultado(s) en esta conversación</p> : null}
                          </div>
                        ) : null}

                        <div
                          ref={teamMessagesRef}
                          onScroll={handleTeamViewportScroll}
                          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-2"
                        >
                          {visibleTeamMessages.length === 0 ? <p className="text-sm text-slate-500">{threadSearch.trim() ? 'No hay coincidencias para esta búsqueda.' : 'No hay mensajes en este chat.'}</p> : null}
                          {visibleTeamMessages.map((message) => {
                            const isOwn = Boolean(currentUserId && message.sentByUserId === currentUserId)
                            return (
                              <div
                                key={message.id}
                                onContextMenu={(event) => {
                                  if (!canDeleteInternalMessage(message, currentUserId)) return
                                  event.preventDefault()
                                  setMessageContextMenu({ messageId: message.id, x: event.clientX, y: event.clientY })
                                }}
                                className={isOwn ? 'ml-auto max-w-[94%] min-w-0 rounded-[22px] border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-700' : 'mr-auto max-w-[94%] min-w-0 rounded-[22px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700'}
                              >
                                <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-slate-500">
                                  <span>{message.sentByUser?.name || message.sentByUser?.email || 'Usuario'}</span>
                                  <span>{formatDate(message.occurredAt, 'Sin fecha')}</span>
                                </div>
                                {message.bodyText ? <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5">{renderHighlightedText(message.bodyText, threadSearch)}</p> : null}
                                {renderAttachments(message.attachments, () => {
                                  if (teamShouldStickToBottomRef.current) {
                                    scheduleScrollToBottom(teamMessagesRef.current, teamMessagesEndRef.current, teamScrollTimersRef, 'auto')
                                  }
                                })}
                                {isOwn ? (
                                  <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                    {renderMessageStatusIcon(message.status)}
                                    <span>
                                      {message.status === 'READ' ? 'Visto' : message.status === 'SENT' ? 'Entregado' : 'Enviando'}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                          <div ref={teamMessagesEndRef} aria-hidden="true" className="h-px w-full" />
                        </div>
                        {messageContextMenu ? (
                          <div className="fixed z-[130] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45)]" style={{ left: `${messageContextMenu.x}px`, top: `${messageContextMenu.y}px` }}>
                            <button type="button" onClick={() => void handleDeleteTeamMessage(messageContextMenu.messageId)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50">
                              <Trash2 className="h-4 w-4" />
                              Borrar mensaje
                            </button>
                            <p className="px-3 pb-1 pt-0.5 text-[11px] text-slate-500">Disponible solo durante 30 segundos desde el envío.</p>
                          </div>
                        ) : null}
                        {showTeamScrollToBottom ? (
                          <button
                            type="button"
                            onClick={jumpTeamToBottom}
                            className="absolute bottom-[108px] right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700 shadow-[0_14px_30px_-18px_rgba(14,116,144,0.45)] transition hover:bg-sky-50"
                            aria-label="Ir al último mensaje"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-slate-100 p-3">
                    <div className="grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50/80 p-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void handleUploadTeamAttachment(file)
                        }}
                      />
                      {teamAttachmentUpload ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-700">
                            <span className="truncate">Subiendo {teamAttachmentUpload.name}</span>
                            <span className="font-semibold text-sky-700">{teamAttachmentUpload.progress}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-sky-600 transition-[width] duration-150" style={{ width: `${teamAttachmentUpload.progress}%` }} />
                          </div>
                        </div>
                      ) : null}

                      {pendingTeamAttachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2.5">
                          {pendingTeamAttachments.map((attachment) => (
                            <div key={`${attachment.url}-${attachment.name}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                              <span className="max-w-[220px] truncate">{attachment.name}</span>
                              <button type="button" onClick={() => setPendingTeamAttachments((current) => current.filter((item) => item.url !== attachment.url))} className="text-slate-500 hover:text-slate-800">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex items-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-2xl" disabled={!selectedThreadId || uploadingTeamAttachment} aria-label="Agregar emoji o adjunto">
                              <Plus className="h-4.5 w-4.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="top" className="w-56 rounded-2xl p-2">
                            <DropdownMenuLabel>Agregar</DropdownMenuLabel>
                            <div className="grid grid-cols-6 gap-1.5 px-1 py-1">
                              {EMOJI_CHOICES.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => setTeamMessageDraft((current) => `${current}${emoji}`)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-base hover:bg-slate-50"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(event) => {
                              event.preventDefault()
                              openTeamAttachmentPicker('image')
                            }}>
                              <ImageIcon className="mr-2 h-4 w-4" />
                              Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(event) => {
                              event.preventDefault()
                              openTeamAttachmentPicker('document')
                            }}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              Documento
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                              setTeamLibraryPickerOpen(true)
                            }}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              Cargar desde Administrador de archivos
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Textarea ref={teamTextareaRef} value={teamMessageDraft} onChange={(event) => setTeamMessageDraft(event.target.value)} onKeyDown={handleTeamMessageKeyDown} rows={1} placeholder={selectedThread?.type === 'GROUP' ? 'Escribe un mensaje para el grupo...' : 'Escribe un mensaje para tu compañero...'} disabled={!selectedThreadId} className="min-h-[44px] max-h-[140px] flex-1 overflow-hidden rounded-2xl bg-white px-3 py-2.5 text-sm leading-5" />
                        <Button size="icon" className="h-11 w-11 shrink-0 rounded-2xl" onClick={() => void handleSendTeamMessage()} disabled={sendingTeam || !selectedThreadId || uploadingTeamAttachment} aria-label={sendingTeam ? 'Enviando mensaje' : 'Enviar mensaje'}>
                          <SendHorizontal className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'support' ? (
              <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 sm:p-5">
                <div className="hidden grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 md:grid">
                  <button type="button" onClick={() => setActiveTab('updates')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    Novedades
                  </button>
                  <button type="button" onClick={() => setActiveTab('support')} className={cn('rounded-xl px-3 py-1.5 text-[10px] font-medium', activeTab === 'support' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600')}>
                    {SUPPORT_TAB_LABEL}
                  </button>
                  {canAccessCrmChat ? <button type="button" onClick={() => setActiveTab('crm')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    CRM
                  </button> : null}
                  {canAccessTeamChat ? <button type="button" onClick={() => setActiveTab('team')} className="rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-600">
                    Equipo
                  </button> : null}
                </div>

                <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 md:mt-0">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Envía la solicitud con contexto claro</div>
                      <p className="mt-1 text-sm text-slate-600">Copia una plantilla rápida y compártela por correo o WhatsApp para acelerar la respuesta.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-10 rounded-xl px-4 text-[11px]" onClick={() => void copySupportTemplate()}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar plantilla
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm leading-6 text-slate-700 whitespace-pre-line">
                    {SUPPORT_REQUEST_TEMPLATE}
                  </div>
                  {supportCopyStatus ? <div className="mt-2 text-xs font-medium text-sky-800">{supportCopyStatus}</div> : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Correo</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{SUPPORT_EMAIL}</div>
                    <p className="mt-2 text-sm text-slate-600">Úsalo para solicitudes formales, detalle del cambio y soporte de configuración.</p>
                    <Button asChild className="mt-4 h-10 rounded-xl px-4 text-[11px]">
                      <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_EMAIL_SUBJECT)}&body=${encodeURIComponent(SUPPORT_REQUEST_TEMPLATE)}`}>Escribir por correo</a>
                    </Button>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">WhatsApp</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{SUPPORT_WHATSAPP}</div>
                    <p className="mt-2 text-sm text-slate-600">Úsalo cuando necesites una respuesta más directa para revisar el cambio solicitado.</p>
                    <Button asChild variant="outline" className="mt-4 h-10 rounded-xl px-4 text-[11px]">
                      <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={cn('pointer-events-auto mb-4 mr-4 flex flex-col items-end gap-2 transition-all duration-300 sm:mb-6 sm:mr-0', open ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100')}>
          <Button
            type="button"
            onClick={() => setOpen((current) => {
              const nextOpen = !current
              if (nextOpen && !hasStoredTabPreferenceRef.current && shouldDefaultToSupport(currentUserRole)) {
                setActiveTab('support')
              }
              return nextOpen
            })}
            className="relative h-14 rounded-full bg-slate-950 px-5 text-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.65)] hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
            <span>Chat</span>
            {unreadTotal > 0 ? <span className="absolute -right-1 -top-1 min-w-6 rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">{unreadTotal > 99 ? '99+' : unreadTotal}</span> : null}
          </Button>
        </div>
      </div>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="z-[120] max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Crear grupo interno</DialogTitle>
            <DialogDescription>Arma grupos operativos, compártelos en la pestaña de grupos creados y elimínalos cuando ya no hagan falta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1.5">
            <div className="grid gap-1.5">
              <Label>Nombre del grupo</Label>
              <Input value={groupForm.title} onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ejemplo: Producción semana 14" />
            </div>
            <div className="grid gap-1.5">
              <Label>Buscar participantes</Label>
              <Input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Nombre o correo..." />
            </div>
            <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">
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
                      className={selected ? 'flex w-full items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left'}
                    >
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-slate-500">{selected ? 'Incluido' : 'Agregar'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
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

      <Dialog open={sharedFilesOpen} onOpenChange={setSharedFilesOpen}>
        <DialogContent className="z-[120] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Archivos compartidos</DialogTitle>
            <DialogDescription>Historial de adjuntos enviados en esta conversación.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {selectedThreadSharedFiles.length === 0 ? <p className="text-sm text-slate-500">Aún no hay archivos compartidos en este chat.</p> : null}
            {selectedThreadSharedFiles.map((attachment) => (
              <a key={`${attachment.messageId}-${attachment.url}`} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">{attachment.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{attachment.senderLabel} · {formatDate(attachment.occurredAt, 'Sin fecha')}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Abrir</span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={threadInfoOpen} onOpenChange={setThreadInfoOpen}>
        <DialogContent className="z-[120] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Información del contacto</DialogTitle>
            <DialogDescription>Resumen de la conversación interna y sus participantes.</DialogDescription>
          </DialogHeader>
          {selectedThread ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tipo</div>
                <div className="mt-1 font-medium text-slate-950">{selectedThread.type === 'GROUP' ? 'Grupo interno' : 'Chat directo'}</div>
                <div className="mt-2 text-xs text-slate-500">Notificaciones {selectedThreadId && mutedTeamThreadIds.includes(selectedThreadId) ? 'silenciadas' : 'activas'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participantes</div>
                <div className="mt-3 space-y-2">
                  {selectedThread.participants.map((participant) => (
                    <div key={participant.id} className="rounded-xl border border-slate-200 px-3 py-2">
                      <div className="font-medium text-slate-950">{participant.user.name || participant.user.email || participant.user.id}</div>
                      <div className="text-xs text-slate-500">{participant.user.email || 'Sin correo visible'}{participant.user.role ? ` · ${participant.user.role}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function mapLibraryItemToAttachment(item: CrmFileItem): ChatAttachment {
  if (!item.url) {
    throw new Error('Solo puedes vincular archivos existentes de la biblioteca, no carpetas.')
  }

  return {
    name: item.name,
    url: item.url,
    type: item.type === 'image' ? 'image' : 'document',
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  }
}

function canDeleteInternalMessage(message: Pick<InternalChatMessage, 'sentByUserId' | 'occurredAt' | 'canDelete'>, currentUserId: string | null) {
  if (!currentUserId || message.sentByUserId !== currentUserId) return false
  if (message.canDelete === false) return false
  const occurredAt = new Date(message.occurredAt).getTime()
  if (!Number.isFinite(occurredAt)) return false
  return (Date.now() - occurredAt) <= 30_000
}

function renderMessageStatusIcon(status: InternalChatMessage['status']) {
  if (status === 'READ') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
  }
  if (status === 'SENT') {
    return <Check className="h-3.5 w-3.5 text-sky-600" />
  }
  if (status === 'PENDING') {
    return <Check className="h-3.5 w-3.5 text-slate-400" />
  }
  return null
}

function renderCrmMessageStatusIcon(status: ConversationMessage['status']) {
  if (status === 'READ') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
  }
  if (status === 'DELIVERED') {
    return <Check className="h-3.5 w-3.5 text-sky-600" />
  }
  if (status === 'SENT' || status === 'PENDING') {
    return <Check className="h-3.5 w-3.5 text-slate-400" />
  }
  if (status === 'QUEUED') {
    return <Clock3 className="h-3.5 w-3.5 text-slate-400" />
  }
  if (status === 'FAILED') {
    return <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
  }
  return null
}

function getCrmMessageStatusLabel(status: ConversationMessage['status']) {
  if (status === 'READ') return 'Visto'
  if (status === 'DELIVERED') return 'Llegó'
  if (status === 'SENT') return 'Enviado'
  if (status === 'PENDING' || status === 'QUEUED') return 'Enviando'
  if (status === 'FAILED') return 'Falló'
  return null
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