'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ChatMutePrefs = {
  mutedCrmConversationIds: string[]
  mutedTeamThreadIds: string[]
}

type UiPreferencesResponse = {
  success?: boolean
  data?: {
    report?: {
      chat?: Partial<ChatMutePrefs>
    }
  }
}

const CHAT_MUTE_UPDATED_EVENT = 'ui-preferences:chat-mute-updated'

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
}

function normalizeChatMutePrefs(value: Partial<ChatMutePrefs> | null | undefined): ChatMutePrefs {
  return {
    mutedCrmConversationIds: normalizeStringList(value?.mutedCrmConversationIds),
    mutedTeamThreadIds: normalizeStringList(value?.mutedTeamThreadIds),
  }
}

export function useChatMutePreferences() {
  const [prefs, setPrefs] = useState<ChatMutePrefs>({
    mutedCrmConversationIds: [],
    mutedTeamThreadIds: [],
  })
  const prefsRef = useRef(prefs)

  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/ui-preferences', { cache: 'no-store' })
        const json = (await response.json().catch(() => null)) as UiPreferencesResponse | null
        if (cancelled || !json?.success) return
        const nextPrefs = normalizeChatMutePrefs(json.data?.report?.chat)
        prefsRef.current = nextPrefs
        setPrefs(nextPrefs)
      } catch {
        // ignore
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleUpdated(event: Event) {
      const detail = (event as CustomEvent<ChatMutePrefs>).detail
      if (!detail) return
      const nextPrefs = normalizeChatMutePrefs(detail)
      prefsRef.current = nextPrefs
      setPrefs(nextPrefs)
    }

    window.addEventListener(CHAT_MUTE_UPDATED_EVENT, handleUpdated)
    return () => window.removeEventListener(CHAT_MUTE_UPDATED_EVENT, handleUpdated)
  }, [])

  const persist = useCallback(async (nextPrefs: ChatMutePrefs) => {
    prefsRef.current = nextPrefs
    setPrefs(nextPrefs)
    window.dispatchEvent(new CustomEvent(CHAT_MUTE_UPDATED_EVENT, { detail: nextPrefs }))

    try {
      await fetch('/api/ui-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: { chat: nextPrefs } }),
      })
    } catch {
      // ignore; state is already updated locally
    }
  }, [])

  const setMutedCrmConversationIds = useCallback((nextValue: string[] | ((current: string[]) => string[])) => {
    const nextIds = normalizeStringList(typeof nextValue === 'function' ? nextValue(prefsRef.current.mutedCrmConversationIds) : nextValue)
    void persist({
      ...prefsRef.current,
      mutedCrmConversationIds: nextIds,
    })
  }, [persist])

  const setMutedTeamThreadIds = useCallback((nextValue: string[] | ((current: string[]) => string[])) => {
    const nextIds = normalizeStringList(typeof nextValue === 'function' ? nextValue(prefsRef.current.mutedTeamThreadIds) : nextValue)
    void persist({
      ...prefsRef.current,
      mutedTeamThreadIds: nextIds,
    })
  }, [persist])

  return {
    mutedCrmConversationIds: prefs.mutedCrmConversationIds,
    mutedTeamThreadIds: prefs.mutedTeamThreadIds,
    setMutedCrmConversationIds,
    setMutedTeamThreadIds,
  }
}