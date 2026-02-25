import 'server-only'

import { cookies } from 'next/headers'
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY, parseUiLanguage, translate, type TranslateVars, type UiLanguage } from '@/lib/i18n/messages'

export async function getServerLanguage(): Promise<UiLanguage> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value
  return parseUiLanguage(raw) ?? DEFAULT_LANGUAGE
}

export async function tServer(key: string, vars?: TranslateVars, language?: UiLanguage) {
  const lang = language ?? (await getServerLanguage())
  return translate(lang, key, vars)
}
