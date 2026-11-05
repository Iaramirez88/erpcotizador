'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ACCOUNT_INACTIVITY_DELETION_DAYS,
  PERSONAL_TRIAL_BUSINESS_DAYS,
  RETENTION_DISMISS_COOKIE,
  RETENTION_POLICY_PATH,
  formatRetentionDate,
  retentionDismissValue,
  type AccountRetentionStage,
} from '@/lib/retention-policy'

export type RetentionNoticeBannerProps = {
  stage: AccountRetentionStage
  lastActivityAt: string | null
  deletionAt: string | null
  licenseExpiredAt: string | null
  trialExpiredAt: string | null
  canManageBilling: boolean
}

type BannerVariant = 'deletionDue' | 'inactivity' | 'licenseExpired' | 'trialEnded'

/**
 * Aviso visible en el dashboard sobre la política de retención:
 *  - licencia pagada vencida,
 *  - trial de 7 días hábiles terminado,
 *  - 7 días antes del borrado por inactividad,
 *  - o el mismo día del borrado.
 *
 * El "ocultar por hoy" se guarda en una cookie que el layout lee en el servidor, así el
 * aviso no reaparece en cada navegación del mismo día.
 */
export default function RetentionNoticeBanner(props: RetentionNoticeBannerProps) {
  const { t, language } = useI18n()
  const [hidden, setHidden] = useState(false)

  const variant: BannerVariant | null = props.stage === 'DELETION_DUE'
    ? 'deletionDue'
    : props.stage === 'WARNING'
      ? 'inactivity'
      : props.licenseExpiredAt
        ? 'licenseExpired'
        : props.trialExpiredAt
          ? 'trialEnded'
          : null

  if (!variant || hidden) return null

  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const formatDate = (iso: string | null) => (iso ? formatRetentionDate(new Date(iso), locale) : '')

  const title = t(`retention.banner.${variant}.title`)
  const description = t(`retention.banner.${variant}.description`, {
    days: PERSONAL_TRIAL_BUSINESS_DAYS,
    inactivityDays: ACCOUNT_INACTIVITY_DELETION_DAYS,
    date: formatDate(
      variant === 'licenseExpired'
        ? props.licenseExpiredAt
        : variant === 'trialEnded'
          ? props.trialExpiredAt
          : props.lastActivityAt
    ),
    deletionDate: formatDate(props.deletionAt),
  })

  const isCritical = variant === 'deletionDue'
  const Icon = isCritical ? AlertTriangle : variant === 'inactivity' ? Clock : ShieldAlert

  const dismiss = () => {
    try {
      document.cookie = `${RETENTION_DISMISS_COOKIE}=${retentionDismissValue()}; Path=/; Max-Age=86400; SameSite=Lax`
    } catch {
      // ignore
    }
    setHidden(true)
  }

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 rounded-2xl border px-3 py-2.5 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between',
        isCritical
          ? 'border-rose-300 bg-rose-50 text-rose-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="space-y-0.5">
          <div className="font-semibold leading-tight">{title}</div>
          <p className="text-xs leading-relaxed opacity-90 sm:text-[13px]">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {props.canManageBilling ? (
          <Button asChild size="sm" variant={isCritical ? 'destructive' : 'default'}>
            <Link href="/dashboard/configuracion/plan">{t('retention.banner.actions.renew')}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={RETENTION_POLICY_PATH}>{t('retention.banner.actions.policy')}</Link>
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="text-[11px] font-medium underline underline-offset-2 opacity-70 transition hover:opacity-100"
        >
          {t('retention.banner.dismiss')}
        </button>
      </div>
    </div>
  )
}
