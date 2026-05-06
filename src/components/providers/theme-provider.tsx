'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'sg_theme_preference'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function getInitialThemeState(): Pick<ThemeContextValue, 'theme' | 'resolvedTheme'> {
  if (typeof window === 'undefined') {
    return { theme: 'system', resolvedTheme: 'light' }
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'

  return {
    theme,
    resolvedTheme: resolveTheme(theme),
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedTheme)
  root.style.colorScheme = resolvedTheme

  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    metaTheme.setAttribute('content', resolvedTheme === 'dark' ? '#08101d' : '#f4f7fb')
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState(getInitialThemeState)
  const { theme, resolvedTheme } = themeState

  useEffect(() => {
    applyTheme(resolvedTheme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme)
    }

    let cancelled = false

    void fetch('/api/ui-preferences', { cache: 'no-store' })
      .then((res) => res.json().catch(() => null))
      .then((json: { success?: boolean; data?: { theme?: ThemePreference } } | null) => {
        if (cancelled || !json?.success) return
        const remoteTheme = json.data?.theme
        if (remoteTheme !== 'light' && remoteTheme !== 'dark' && remoteTheme !== 'system') return
        const nextResolvedTheme = resolveTheme(remoteTheme)

        setThemeState((current) => {
          if (current.theme === remoteTheme && current.resolvedTheme === nextResolvedTheme) {
            return current
          }

          return {
            theme: remoteTheme,
            resolvedTheme: nextResolvedTheme,
          }
        })

        window.localStorage.setItem(STORAGE_KEY, remoteTheme)
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [resolvedTheme, theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme !== 'system') return
      const nextResolvedTheme = getSystemTheme()
      setThemeState((current) => {
        if (current.theme !== 'system' || current.resolvedTheme === nextResolvedTheme) {
          return current
        }

        return {
          theme: current.theme,
          resolvedTheme: nextResolvedTheme,
        }
      })
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  function setTheme(nextTheme: ThemePreference) {
    const nextResolvedTheme = resolveTheme(nextTheme)
    setThemeState({ theme: nextTheme, resolvedTheme: nextResolvedTheme })
    applyTheme(nextResolvedTheme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    }

    void fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: nextTheme }),
    }).catch(() => null)
  }

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [resolvedTheme, theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }
  return context
}