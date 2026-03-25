"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type PublicChatbotMessage = {
  id: string
  role: 'assistant' | 'user' | 'system'
  body: string
  at: string
  author?: string | null
  attachments?: Array<{ type?: string | null; url?: string | null; alt?: string | null }>
  meta?: { nextField?: string | null }
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
  floatingLauncherEnabled: boolean
  launcherLabel: string
  launcherIcon: string
  launcherPosition: 'right' | 'left'
  launcherSize: 'compact' | 'standard' | 'large'
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
}

type ChatIdentity = {
  nombre: string
  email: string
  telefono: string
  producto: string
}

type ConversationSyncResponse = {
  success?: boolean
  data?: {
    messages?: PublicChatbotMessage[]
  }
}

const identityStorageSuffix = 'identity'
const sessionStorageSuffix = 'session'

function makeSessionId(channelId: string) {
  return `webchat-${channelId}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`
}

function nowIso() {
  return new Date().toISOString()
}

function buildWelcomeMessage(prompt: string): PublicChatbotMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    body: prompt,
    at: nowIso(),
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
    producto: current.producto || ((nextField === 'product' || canTreatAsProduct) ? trimmedMessage : current.producto),
  }
}

export function CrmPublicChatbotEmbed(props: PublicChatbotEmbedProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [identity, setIdentity] = useState<ChatIdentity>({ nombre: '', email: '', telefono: '', producto: '' })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'error'>('connecting')
  const [messages, setMessages] = useState<PublicChatbotMessage[]>([buildWelcomeMessage(props.prompt)])
  const [panelOpen, setPanelOpen] = useState(!props.floatingLauncherEnabled)

  const accentStyle = useMemo(() => ({ ['--chat-accent' as string]: props.accentColor, ['--chat-background' as string]: props.backgroundColor, ['--chat-page-background' as string]: props.pageBackgroundColor, fontFamily: props.fontFamily }), [props.accentColor, props.backgroundColor, props.pageBackgroundColor, props.fontFamily])
  const launcherMetrics = useMemo(() => getLauncherMetrics(props.launcherSize), [props.launcherSize])
  const latestAssistantPrompt = useMemo(() => {
    const assistantMessages = [...messages].reverse().find((item) => item.role === 'assistant' && item.meta?.nextField)
    return assistantMessages?.meta?.nextField || null
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return

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
          producto: typeof parsed.producto === 'string' ? parsed.producto : '',
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
        throw new Error('No se pudo sincronizar la conversación')
      }

      const json = await response.json().catch(() => ({})) as ConversationSyncResponse
      const serverMessages = Array.isArray(json.data?.messages)
        ? json.data?.messages.filter((item) => item.body)
        : []

      setMessages(serverMessages.length > 0 ? [buildWelcomeMessage(props.prompt), ...serverMessages] : [buildWelcomeMessage(props.prompt)])
      setConnectionState('online')
    } catch (error) {
      console.error(error)
      setConnectionState('error')
    } finally {
      setSyncing(false)
    }
  }, [props.channelId, props.prompt, sessionId])

  useEffect(() => {
    if (!ready || !sessionId) return

    void syncConversation()
    const interval = window.setInterval(() => {
      void syncConversation()
    }, 3500)

    return () => window.clearInterval(interval)
  }, [ready, sessionId, syncConversation])

  async function sendMessage(messageBody: string, requestHuman = false) {
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
          producto: nextIdentity.producto,
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
          },
        }),
      })

      if (!response.ok) {
        throw new Error('No se pudo enviar el mensaje')
      }

      setConnectionState('online')
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

  function openPanel() {
    setPanelOpen(true)
  }

  function closePanel() {
    if (!props.floatingLauncherEnabled) return
    setPanelOpen(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const emitResize = () => {
      const measuredHeight = rootRef.current?.scrollHeight
      const fallbackHeight = props.floatingLauncherEnabled && !panelOpen
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
  }, [connectionState, launcherMetrics.buttonHeight, messages.length, panelOpen, props.channelId, props.floatingLauncherEnabled, sending, syncing])

  return (
    <div ref={rootRef} className="sgd-chatbot-page p-3 text-slate-950" style={{ ...accentStyle, minHeight: props.floatingLauncherEnabled && !panelOpen ? '96px' : '100vh', background: props.floatingLauncherEnabled && !panelOpen ? 'transparent' : `radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 30%), linear-gradient(180deg, ${props.pageBackgroundColor} 0%, ${props.pageBackgroundColor} 45%, ${props.backgroundColor} 100%)`, position: 'relative' }}>
      {props.customCss.trim() ? <style>{props.customCss}</style> : null}
      {props.floatingLauncherEnabled && !panelOpen ? (
        <div style={{ minHeight: '80px', position: 'relative' }}>
          <button
            type="button"
            onClick={openPanel}
            style={{
              position: 'absolute',
              bottom: 12,
              [props.launcherPosition]: 12,
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
              {props.floatingLauncherEnabled ? (
                <button type="button" onClick={closePanel} className="rounded-full bg-white/14 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20">
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sgd-chatbot-messages flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4">
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'sgd-chatbot-bubble-user ml-auto max-w-[88%] rounded-[22px] bg-slate-950 px-4 py-3 text-sm text-white shadow-sm' : message.role === 'system' ? 'sgd-chatbot-bubble-system mx-auto max-w-[92%] rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900' : 'sgd-chatbot-bubble-assistant mr-auto max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm'}>
              <p className="whitespace-pre-wrap leading-6">{message.body}</p>
              {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {message.attachments.filter((item) => item?.type === 'image' && item?.url).map((item, index) => (
                    <img key={`${message.id}-attachment-${index}`} src={item.url || ''} alt={item.alt || 'Imagen del producto'} className="w-full rounded-2xl border border-slate-200 object-cover" />
                  ))}
                </div>
              ) : null}
              {message.author ? <p className="mt-2 text-[11px] text-slate-500">{message.author}</p> : null}
            </div>
          ))}
        </div>

        <div className="sgd-chatbot-composer border-t border-slate-100 bg-white px-4 py-4">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{props.messageLabel}</p>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={props.messagePlaceholder} className="rounded-2xl border-slate-200" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 rounded-xl text-white" style={{ backgroundColor: props.accentColor }} onClick={submitDraft} disabled={sending || !ready}>
                {sending ? 'Enviando...' : 'Responder'}
              </Button>
              {props.allowHumanHandoff ? (
                <Button variant="outline" className="rounded-xl border-slate-200" onClick={requestHumanSupport} disabled={sending || !ready}>
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