'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ACCOUNT_INACTIVITY_DELETION_DAYS,
  ACCOUNT_RETENTION_WARNING_DAYS,
  PERSONAL_TRIAL_BUSINESS_DAYS,
  RETENTION_POLICY_LAST_UPDATED,
  RETENTION_POLICY_PATH,
} from '@/lib/retention-policy'

/**
 * Tarjeta informativa (siempre visible) con la política de retención de datos.
 * Se muestra en la página de Plan para que el usuario conozca las reglas antes de que
 * reciba el aviso por correo.
 */
export default function RetentionPolicyCard({ className }: { className?: string }) {
  const { t } = useI18n()

  const rules = [
    t('retention.policy.trial', { days: PERSONAL_TRIAL_BUSINESS_DAYS }),
    t('retention.policy.license'),
    t('retention.policy.inactivity', { days: ACCOUNT_INACTIVITY_DELETION_DAYS }),
    t('retention.policy.warning', { days: ACCOUNT_RETENTION_WARNING_DAYS }),
    t('retention.policy.scope'),
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-sky-600" aria-hidden />
          {t('retention.policy.title')}
        </CardTitle>
        <CardDescription>{t('retention.policy.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm text-slate-700">
          {rules.map((rule) => (
            <li key={rule} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
              <span className="leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{t('retention.policy.lastUpdated', { date: RETENTION_POLICY_LAST_UPDATED })}</span>
          <Link href={RETENTION_POLICY_PATH} className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900">
            {t('retention.banner.actions.policy')}
          </Link>
        </div>
        <p className="text-xs text-slate-500">{t('retention.policy.footer')}</p>
      </CardContent>
    </Card>
  )
}
