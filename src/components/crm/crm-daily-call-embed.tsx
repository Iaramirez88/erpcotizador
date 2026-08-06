'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type CallState = 'BOOTING' | 'JOINING' | 'JOINED' | 'LEFT' | 'ERROR'

type Props = {
  session: {
    conversationId: string
    roomName: string
    callType: 'video' | 'audio'
    joinUrl: string
    ownerToken: string
    ownerDisplayName: string
    expiresAt: string
    sessionKey: string
  }
  onStateChange?: (state: CallState) => void
}

type DailyCallLike = {
  join: (args: Record<string, unknown>) => Promise<unknown>
  leave: () => Promise<unknown>
  destroy: () => void
  on: (eventName: string, listener: (event?: Record<string, unknown>) => void) => void
}

async function reportSessionEvent(args: {
  conversationId: string
  sessionKey: string
  roomName: string
  callType: 'video' | 'audio'
  event: 'JOINED' | 'LEFT' | 'FAILED'
  occurredAt: string
  startedAt?: string | null
  endedAt?: string | null
  durationSeconds?: number | null
  errorMessage?: string | null
}) {
  await fetch(`/api/crm/conversations/${args.conversationId}/call/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).catch(() => null)
}

export function CrmDailyCallEmbed({ session, onStateChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const callRef = useRef<DailyCallLike | null>(null)
  const startedAtRef = useRef<string | null>(null)
  const leftReportedRef = useRef(false)
  const [state, setState] = useState<CallState>('BOOTING')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

  useEffect(() => {
    let active = true

    async function boot() {
      if (!containerRef.current) return

      setState('JOINING')
      setError(null)

      try {
        const DailyIframeModule = await import('@daily-co/daily-js')
        if (!active || !containerRef.current) return

        const DailyIframe = DailyIframeModule.default
        const frame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          showFullscreenButton: true,
          showParticipantsBar: true,
          activeSpeakerMode: true,
          lang: 'es',
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '24px',
            backgroundColor: '#f8fafc',
          },
        }) as DailyCallLike

        callRef.current = frame

        frame.on('joined-meeting', () => {
          const occurredAt = new Date().toISOString()
          startedAtRef.current = occurredAt
          setState('JOINED')
          void reportSessionEvent({
            conversationId: session.conversationId,
            sessionKey: session.sessionKey,
            roomName: session.roomName,
            callType: session.callType,
            event: 'JOINED',
            occurredAt,
            startedAt: occurredAt,
          })
        })

        frame.on('left-meeting', () => {
          if (leftReportedRef.current) return
          leftReportedRef.current = true
          const occurredAt = new Date().toISOString()
          const durationSeconds = startedAtRef.current
            ? Math.max(0, Math.round((Date.parse(occurredAt) - Date.parse(startedAtRef.current)) / 1000))
            : null
          setState('LEFT')
          void reportSessionEvent({
            conversationId: session.conversationId,
            sessionKey: session.sessionKey,
            roomName: session.roomName,
            callType: session.callType,
            event: 'LEFT',
            occurredAt,
            startedAt: startedAtRef.current,
            endedAt: occurredAt,
            durationSeconds,
          })
        })

        frame.on('error', (event) => {
          const message = typeof event?.errorMsg === 'string'
            ? event.errorMsg
            : typeof event?.error === 'string'
              ? event.error
              : 'Daily no pudo abrir la sesión.'
          setError(message)
          setState('ERROR')
          void reportSessionEvent({
            conversationId: session.conversationId,
            sessionKey: session.sessionKey,
            roomName: session.roomName,
            callType: session.callType,
            event: 'FAILED',
            occurredAt: new Date().toISOString(),
            errorMessage: message,
          })
        })

        await frame.join({
          url: session.joinUrl,
          token: session.ownerToken,
          userName: session.ownerDisplayName,
          startVideoOff: session.callType === 'audio',
          startAudioOff: false,
        })
      } catch (bootError) {
        const message = bootError instanceof Error ? bootError.message : 'No se pudo cargar Daily.'
        setError(message)
        setState('ERROR')
        void reportSessionEvent({
          conversationId: session.conversationId,
          sessionKey: session.sessionKey,
          roomName: session.roomName,
          callType: session.callType,
          event: 'FAILED',
          occurredAt: new Date().toISOString(),
          errorMessage: message,
        })
      }
    }

    void boot()

    return () => {
      active = false
      const current = callRef.current
      if (!current) return
      Promise.resolve(current.leave()).catch(() => null).finally(() => {
        current.destroy()
      })
      callRef.current = null
    }
  }, [session])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-slate-950">Sala embebida en el CRM</div>
          <div className={state === 'JOINED' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800' : state === 'ERROR' ? 'rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800' : 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700'}>
            {state === 'BOOTING' ? 'Inicializando' : state === 'JOINING' ? 'Conectando' : state === 'JOINED' ? 'En llamada' : state === 'LEFT' ? 'Finalizada' : 'Con error'}
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-500">Expira: {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.expiresAt))}</div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <div className="relative h-[65vh] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
        {state === 'BOOTING' || state === 'JOINING' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando Daily...
            </div>
          </div>
        ) : null}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}