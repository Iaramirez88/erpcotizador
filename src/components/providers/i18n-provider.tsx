'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_KEY,
  parseUiLanguage,
  translate,
  type TranslateVars,
  type UiLanguage,
} from '@/lib/i18n/messages'

type I18nContextValue = {
  language: UiLanguage
  setLanguage: (next: UiLanguage) => void
  t: (key: string, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'sgd_language'

function readCookieLanguage(): UiLanguage | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE_KEY}=([^;]*)`))
    return parseUiLanguage(match?.[1])
  } catch {
    return null
  }
}

function writeCookieLanguage(next: UiLanguage) {
  try {
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
  } catch {
    // ignore
  }
}

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: React.ReactNode
  initialLanguage?: UiLanguage
}) {
  const [language, setLanguageState] = useState<UiLanguage>(() => {
    const cookieLang = readCookieLanguage()
    if (cookieLang) return cookieLang

    try {
      const stored = parseUiLanguage(window.localStorage.getItem(STORAGE_KEY))
      if (stored) return stored
    } catch {
      // ignore
    }

    return initialLanguage ?? DEFAULT_LANGUAGE
  })

  const t = useCallback((key: string, vars?: TranslateVars) => translate(language, key, vars), [language])

  const setLanguage = useCallback((next: UiLanguage) => {
    setLanguageState(next)

    writeCookieLanguage(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }

    // Persistir en backend si hay sesión.
    void fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next }),
    }).catch(() => null)
  }, [])

  // Inicialización: localStorage > API (si logueado) > initialLanguage
  useEffect(() => {
    let cancelled = false

    // 0) cookie
    const cookieLang = readCookieLanguage()
    if (cookieLang) {
      try {
        window.localStorage.setItem(STORAGE_KEY, cookieLang)
      } catch {
        // ignore
      }
      return
    }

    // 1) localStorage
    try {
      const stored = parseUiLanguage(window.localStorage.getItem(STORAGE_KEY))
      if (stored) {
        writeCookieLanguage(stored)
        return
      }
    } catch {
      // ignore
    }

    // 2) backend (si hay sesión)
    ;(async () => {
      try {
        const res = await fetch('/api/ui-preferences', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { language?: string } } | null
        const apiLang = parseUiLanguage(json?.data?.language)
        if (!cancelled && apiLang) {
          setLanguageState(apiLang)
          writeCookieLanguage(apiLang)
          try {
            window.localStorage.setItem(STORAGE_KEY, apiLang)
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Mantener <html lang>
  useEffect(() => {
    try {
      document.documentElement.lang = language
    } catch {
      // ignore
    }
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key: string) => key,
    }
  }
  return ctx
}
