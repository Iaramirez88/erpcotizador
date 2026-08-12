'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type GuestCallState = 'BOOTING' | 'JOINING' | 'JOINED' | 'LEFT' | 'ERROR'

type DailyCallLike = {
  join: (args: Record<string, unknown>) => Promise<unknown>
  leave: () => Promise<unknown>
  destroy: () => void
  on: (eventName: string, listener: (event?: Record<string, unknown>) => void) => void
}

type ResolvedGuestSession = {
  url: string
  token: string
  name: string
  roomName?: string | null
  callType: 'audio' | 'video'
}

function teardownDailyCall(call: DailyCallLike | null, container: HTMLDivElement | null) {
  if (!call) return

  Promise.resolve(call.leave()).catch(() => null)
  call.destroy()

  if (container) {
    container.replaceChildren()
  }
}

function parseHashParams(hash: string) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const host = params.get('h') || ''
  const room = params.get('r') || ''
  return {
    host,
    room,
    url: host && room ? `https://${host}/${room}` : '',
    token: params.get('t') || '',
    name: 'Invitado',
  }
}

function ensureDailyIframePermissions(container: HTMLDivElement) {
  let attempts = 0

  const applyPermissions = () => {
    const iframe = container.querySelector('iframe')
    if (iframe) {
      iframe.setAttribute('allow', 'camera; microphone; autoplay; display-capture; fullscreen; clipboard-read; clipboard-write')
      iframe.setAttribute('allowfullscreen', 'true')
      return
    }

    if (attempts < 12) {
      attempts += 1
      window.requestAnimationFrame(applyPermissions)
    }
  }

  applyPermissions()
}

function formatDailyErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'No se pudo cargar la llamada.'
  if (/notallowederror|permission denied|permissions-policy/i.test(message)) {
    return 'El navegador bloqueó micrófono o cámara para esta llamada. Permítelos en el sitio y vuelve a intentar.'
  }
  return message
}

export function DailyGuestCallPage() {
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const callRef = useRef<DailyCallLike | null>(null)
  const [state, setState] = useState<GuestCallState>('BOOTING')
  const [error, setError] = useState<string | null>(null)
  const [hashValue, setHashValue] = useState('')
  const [resolvedSession, setResolvedSession] = useState<ResolvedGuestSession | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateHash = () => setHashValue(window.location.hash || '')
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  const callType = searchParams?.get('m') === 'a' ? 'audio' : 'video'
  const inviteToken = searchParams?.get('token')?.trim() || ''
  const legacySession = useMemo(() => parseHashParams(hashValue), [hashValue])

  useEffect(() => {
    if (!inviteToken) {
      setResolvedSession(null)
      return
    }

    let cancelled = false

    async function resolveInvite() {
      setError(null)
      setState('BOOTING')
      try {
        const response = await fetch(`/api/public/daily-call?token=${encodeURIComponent(inviteToken)}`, { cache: 'no-store' })
        const json = await response.json().catch(() => ({})) as { success?: boolean; data?: ResolvedGuestSession; error?: string }
        if (cancelled) return
        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error || 'No se pudo resolver la invitación.')
        }
        setResolvedSession(json.data)
      } catch (resolveError) {
        if (cancelled) return
        setResolvedSession(null)
        setError(formatDailyErrorMessage(resolveError))
        setState('ERROR')
      }
    }

    void resolveInvite()

    return () => {
      cancelled = true
    }
  }, [inviteToken])

  const session = resolvedSession ?? (inviteToken ? null : { ...legacySession, roomName: legacySession.room, callType })
  const effectiveCallType = resolvedSession?.callType || callType

  useEffect(() => {
    let active = true

    async function boot() {
      if (!containerRef.current) return
      if (!session) return
      if (!session.url || !session.token) {
        setState('ERROR')
        setError('El enlace de invitación es inválido o está incompleto.')
        return
      }

      setState('JOINING')
      setError(null)

      try {
        const DailyIframeModule = await import('@daily-co/daily-js')
        if (!active || !containerRef.current) return

        teardownDailyCall(callRef.current, containerRef.current)
        callRef.current = null

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
        ensureDailyIframePermissions(containerRef.current)
        frame.on('joined-meeting', () => setState('JOINED'))
        frame.on('left-meeting', () => setState('LEFT'))
        frame.on('error', (event) => {
          const rawMessage = typeof event?.errorMsg === 'string' ? event.errorMsg : typeof event?.error === 'string' ? event.error : 'No se pudo abrir la llamada.'
          const message = formatDailyErrorMessage(rawMessage)
          setError(message)
          setState('ERROR')
        })

        await frame.join({
          url: session.url,
          token: session.token,
          userName: session.name,
          startVideoOff: effectiveCallType === 'audio',
          startAudioOff: false,
        })
      } catch (bootError) {
        setError(formatDailyErrorMessage(bootError))
        setState('ERROR')
      }
    }

    void boot()

    return () => {
      active = false
      const current = callRef.current
      teardownDailyCall(current, containerRef.current)
      callRef.current = null
    }
  }, [effectiveCallType, session])

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white/95 px-5 py-4 shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">SGDigital Call Invite</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{effectiveCallType === 'audio' ? 'Llamada de audio' : 'Videollamada'} con tu asesor</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Abre el micrófono y la cámara cuando el navegador lo pida para entrar correctamente a la sala.</p>
          {session?.roomName ? <div className="mt-3 text-xs text-slate-500">Sala: {session.roomName}</div> : null}
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

        <div className="relative h-[78vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)]">
          {(state === 'BOOTING' || state === 'JOINING') ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/88 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando la llamada...
              </div>
            </div>
          ) : null}
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </main>
  )
}