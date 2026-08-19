'use client'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers/i18n-provider'
import { useTheme } from '@/components/providers/theme-provider'

export function ProfilePreferencesCard() {
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{t('profile.preferences.languageDescription')}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={language === 'es' ? 'default' : 'outline'} onClick={() => setLanguage('es')}>
          {t('common.spanish')}
        </Button>
        <Button type="button" variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')}>
          {t('common.english')}
        </Button>
      </div>

      <div className="border-t pt-3">
        <div className="mb-3 text-xs text-muted-foreground">{t('profile.preferences.themeDescription')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>
            {t('profile.preferences.themeLight')}
          </Button>
          <Button type="button" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>
            {t('profile.preferences.themeDark')}
          </Button>
          <Button type="button" variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}>
            {t('profile.preferences.themeSystem')}
          </Button>
        </div>
      </div>
    </div>
  )
}