"use client"

import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/providers/i18n-provider"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useI18n()

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 flex-col justify-between p-10 bg-muted">
        <div className="flex items-center justify-between gap-3">
          <div className="text-2xl font-semibold tracking-tight">Ordex</div>
          <div className="flex items-center gap-2">
            <Button type="button" variant={language === 'es' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('es')}>
              {t('common.spanish')}
            </Button>
            <Button type="button" variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')}>
              {t('common.english')}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xl font-medium">{t('auth.tagline')}</div>
          <div className="text-sm text-muted-foreground">
            {t('auth.subtitle')}
          </div>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Ordex</div>
          <div>
            <Link href="/politica-de-privacidad" className="underline underline-offset-4 hover:text-foreground">
              Política de privacidad
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}
