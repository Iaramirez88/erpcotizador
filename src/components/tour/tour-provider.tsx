'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { driver, type Config, type Driver } from 'driver.js'
import { TOURS, tourIdFromPath, type TourId } from './tours'

async function waitForTourSelectors(
  selectors: string[],
  {
    timeoutMs,
    intervalMs,
    isActive,
  }: { timeoutMs: number; intervalMs: number; isActive: () => boolean }
): Promise<boolean> {
  const uniq = Array.from(new Set(selectors.map((s) => s.trim()).filter(Boolean)))
  if (uniq.length === 0) return true

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!isActive()) return false
    const allFound = uniq.every((sel) => typeof document !== 'undefined' && !!document.querySelector(sel))
    if (allFound) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return false
}

type TutorialPrefs = {
  seen?: Record<string, boolean>
}

type TourContextValue = {
  startTour: (id: TourId) => void
  startCurrentTour: () => void
  hasCurrentTour: boolean
  markCurrentTourSeen: () => Promise<void>
  resetCurrentTour: () => Promise<void>
}

const TourContext = createContext<TourContextValue | null>(null)

async function fetchTutorialPrefs(): Promise<TutorialPrefs> {
  const res = await fetch('/api/ui-preferences', { cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { tutorial?: TutorialPrefs }
  } | null

  const prefs = json?.success ? (json?.data?.tutorial ?? {}) : {}
  return {
    seen: typeof prefs?.seen === 'object' && prefs.seen ? prefs.seen : {},
  }
}

async function saveTutorialPrefs(next: TutorialPrefs): Promise<void> {
  await fetch('/api/ui-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tutorial: next }),
  }).catch(() => null)
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentTourId = useMemo(() => tourIdFromPath(pathname), [pathname])

  const [prefs, setPrefs] = useState<TutorialPrefs>({ seen: {} })
  const [loaded, setLoaded] = useState(false)

  const activeDriverRef = useRef<Driver | null>(null)
  const activeTourIdRef = useRef<TourId | null>(null)
  const prefsRef = useRef<TutorialPrefs>(prefs)
  const startSeqRef = useRef(0)

  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = await fetchTutorialPrefs()
      if (cancelled) return
      setPrefs(next)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setSeen = useCallback(async (tourId: TourId, value: boolean) => {
    const current = prefsRef.current
    const next: TutorialPrefs = {
      ...current,
      seen: {
        ...(current.seen ?? {}),
        [tourId]: value,
      },
    }
    prefsRef.current = next
    setPrefs(next)
    await saveTutorialPrefs(next)
  }, [])

  const startTour = useCallback(
    (id: TourId) => {
      const startSeq = (startSeqRef.current += 1)
      if (activeDriverRef.current) {
        try {
          activeDriverRef.current.destroy()
        } catch {
          // ignore
        }
        activeDriverRef.current = null
        activeTourIdRef.current = null
      }

      const def = TOURS[id]
      if (!def) return

      def.preStart?.()

      const stepSelectors = def.steps
        .map((s) => s.element)
        .filter((el): el is string => typeof el === 'string')

      void (async () => {
        const ready = await waitForTourSelectors(stepSelectors, {
          timeoutMs: 5000,
          intervalMs: 120,
          isActive: () => startSeqRef.current === startSeq,
        })

        if (!ready) return
        if (startSeqRef.current !== startSeq) return

        const onEnd = () => {
          const activeId = activeTourIdRef.current
          activeDriverRef.current = null
          activeTourIdRef.current = null
          if (activeId) {
            void setSeen(activeId, true)
          }
        }

        const config: Config = {
          showProgress: true,
          overlayOpacity: 0.55,
          allowClose: true,
          nextBtnText: 'Siguiente',
          prevBtnText: 'Atrás',
          doneBtnText: 'Listo',
          steps: def.steps,
          onDestroyed: () => onEnd(),
          onCloseClick: () => onEnd(),
        }

        const d = driver(config)

        activeDriverRef.current = d
        activeTourIdRef.current = id

        try {
          d.drive()
        } catch {
          onEnd()
        }
      })()
    },
    [setSeen]
  )

  const hasCurrentTour = !!currentTourId

  const startCurrentTour = useCallback(() => {
    if (!currentTourId) return
    startTour(currentTourId)
  }, [currentTourId, startTour])

  const markCurrentTourSeen = useCallback(async () => {
    if (!currentTourId) return
    await setSeen(currentTourId, true)
  }, [currentTourId, setSeen])

  const resetCurrentTour = useCallback(async () => {
    if (!currentTourId) return
    await setSeen(currentTourId, false)
  }, [currentTourId, setSeen])

  // Auto-run: solo primera vez por pantalla
  useEffect(() => {
    if (!loaded) return
    if (!currentTourId) return
    if (prefsRef.current.seen?.[currentTourId]) return

    const t = setTimeout(() => {
      startTour(currentTourId)
    }, 450)

    return () => clearTimeout(t)
  }, [currentTourId, loaded, startTour])

  const value: TourContextValue = useMemo(
    () => ({
      startTour,
      startCurrentTour,
      hasCurrentTour,
      markCurrentTourSeen,
      resetCurrentTour,
    }),
    [hasCurrentTour, markCurrentTourSeen, resetCurrentTour, startCurrentTour, startTour]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (ctx) return ctx

  return {
    startTour: () => undefined,
    startCurrentTour: () => undefined,
    hasCurrentTour: false,
    markCurrentTourSeen: async () => undefined,
    resetCurrentTour: async () => undefined,
  }
}
