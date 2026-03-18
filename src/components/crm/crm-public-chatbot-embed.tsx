"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type PublicChatbotMessage = {
  id: string
  role: 'assistant' | 'user' | 'system'
  body: string
  at: string
  author?: string | null
}

type PublicChatbotEmbedProps = {
  channelId: string
  title: string
  prompt: string
  assistantName: string
  accentColor: string
  allowHumanHandoff: boolean
}

type ChatIdentity = {
  nombre: string
  email: string
  telefono: string
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

export function CrmPublicChatbotEmbed(props: PublicChatbotEmbedProps) {
  const [ready, setReady] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [identity, setIdentity] = useState<ChatIdentity>({ nombre: '', email: '', telefono: '' })
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'error'>('connecting')
  const [messages, setMessages] = useState<PublicChatbotMessage[]>([buildWelcomeMessage(props.prompt)])

  const accentStyle = useMemo(() => ({ ['--chat-accent' as string]: props.accentColor }), [props.accentColor])

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
    if (!identity.nombre.trim() && !identity.email.trim() && !identity.telefono.trim()) {
      alert('Registra al menos nombre, email o telefono antes de enviar.')
      return
    }

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
          nombre: identity.nombre,
          email: identity.email,
          telefono: identity.telefono,
          message: trimmedMessage,
          requestHuman,
          externalThreadId: sessionId,
          providerMessageId: `${sessionId}-${Date.now()}`,
          landingPageUrl: window.location.href,
          referrerUrl: document.referrer || '',
          payload: {
            source: 'iframe-chatbot',
            userAgent: navigator.userAgent,
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_55%,#eef5ff_100%)] p-3 text-slate-950" style={accentStyle}>
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[420px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_-44px_rgba(15,23,42,0.42)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Chatbot CRM</p>
              <h1 className="mt-1 text-xl font-semibold">{props.title}</h1>
            </div>
            <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/90">
              {connectionState === 'online' ? 'En linea' : connectionState === 'error' ? 'Reconectando' : 'Conectando'}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{props.assistantName} captura cada mensaje y lo envía al inbox omnicanal del CRM en tiempo real.</p>
        </div>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={identity.nombre} onChange={(e) => setIdentity((current) => ({ ...current, nombre: e.target.value }))} placeholder="Nombre" className="h-11 rounded-xl border-slate-200 bg-white" />
            <Input value={identity.email} onChange={(e) => setIdentity((current) => ({ ...current, email: e.target.value }))} placeholder="Email" className="h-11 rounded-xl border-slate-200 bg-white" />
          </div>
          <Input value={identity.telefono} onChange={(e) => setIdentity((current) => ({ ...current, telefono: e.target.value }))} placeholder="Telefono o WhatsApp" className="h-11 rounded-xl border-slate-200 bg-white" />
          <p className="text-xs leading-5 text-slate-500">Para continuar, registra al menos uno de estos datos. Cada nuevo mensaje se consolida en la misma conversación del CRM.</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-4 py-4">
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%] rounded-[22px] bg-slate-950 px-4 py-3 text-sm text-white shadow-sm' : message.role === 'system' ? 'mx-auto max-w-[92%] rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900' : 'mr-auto max-w-[88%] rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm'}>
              <p className="whitespace-pre-wrap leading-6">{message.body}</p>
              {message.author ? <p className="mt-2 text-[11px] text-slate-500">{message.author}</p> : null}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-4">
          <div className="grid gap-3">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="Escribe tu mensaje aqui..." className="rounded-2xl border-slate-200" />
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={submitDraft} disabled={sending || !ready}>
                {sending ? 'Enviando...' : 'Enviar al CRM'}
              </Button>
              {props.allowHumanHandoff ? (
                <Button variant="outline" className="rounded-xl border-slate-200" onClick={requestHumanSupport} disabled={sending || !ready}>
                  Pedir asesor
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] leading-5 text-slate-500">Demo operativa: cada mensaje genera o actualiza lead, conversación e historial comercial en el CRM omnicanal. {syncing ? 'Sincronizando...' : 'Sincronización activa cada pocos segundos.'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}