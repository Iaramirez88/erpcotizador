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

export function DailyGuestCallPage() {
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const callRef = useRef<DailyCallLike | null>(null)
  const [state, setState] = useState<GuestCallState>('BOOTING')
  const [error, setError] = useState<string | null>(null)
  const [hashValue, setHashValue] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateHash = () => setHashValue(window.location.hash || '')
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  const callType = searchParams?.get('m') === 'a' ? 'audio' : 'video'
  const session = useMemo(() => parseHashParams(hashValue), [hashValue])

  useEffect(() => {
    let active = true

    async function boot() {
      if (!containerRef.current) return
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
        frame.on('joined-meeting', () => setState('JOINED'))
        frame.on('left-meeting', () => setState('LEFT'))
        frame.on('error', (event) => {
          const message = typeof event?.errorMsg === 'string' ? event.errorMsg : typeof event?.error === 'string' ? event.error : 'No se pudo abrir la llamada.'
          setError(message)
          setState('ERROR')
        })

        await frame.join({
          url: session.url,
          token: session.token,
          userName: session.name,
          startVideoOff: callType === 'audio',
          startAudioOff: false,
        })
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : 'No se pudo cargar la llamada.')
        setState('ERROR')
      }
    }

    void boot()

    return () => {
      active = false
      const current = callRef.current
      if (!current) return
      Promise.resolve(current.leave()).catch(() => null).finally(() => current.destroy())
      callRef.current = null
    }
  }, [callType, session.name, session.token, session.url])

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white/95 px-5 py-4 shadow-[0_24px_52px_-38px_rgba(15,23,42,0.28)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">SGDigital Call Invite</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{callType === 'audio' ? 'Llamada de audio' : 'Videollamada'} con tu asesor</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Abre el micrófono y la cámara cuando el navegador lo pida para entrar correctamente a la sala.</p>
          {session.room ? <div className="mt-3 text-xs text-slate-500">Sala: {session.room}</div> : null}
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