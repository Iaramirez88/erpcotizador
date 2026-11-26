'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type TrialMilestone = 'welcome' | 'sevenDaysLeft' | 'oneDayLeft'

type OnboardingGateResponse = {
  ok?: boolean
  gate?: {
    milestone: TrialMilestone
    daysTotal: number
    daysLeft: number
  } | null
}

export default function OnboardingGate() {
  const pathname = usePathname() ?? ''
  const { t } = useI18n()
  const [gate, setGate] = useState<OnboardingGateResponse['gate'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as OnboardingGateResponse
        if (cancelled || !res.ok || !json.ok) return
        if (pathname.startsWith('/dashboard/onboarding')) return
        setGate(json.gate ?? null)
      } catch {
        // no-op
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pathname])

  async function handleDismiss() {
    const milestone = gate?.milestone
    if (milestone) {
      try {
        await fetch('/api/onboarding/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seen: true, milestone }),
        })
      } catch {
        // no-op
      }
    }
    setGate(null)
  }

  if (loading || pathname.startsWith('/dashboard/onboarding') || !gate) return null

  const { milestone, daysTotal } = gate
  const title = milestone === 'welcome'
    ? t('onboardingGate.title')
    : milestone === 'sevenDaysLeft'
      ? t('onboardingGate.reminder7.title')
      : t('onboardingGate.reminder1.title')
  const description = milestone === 'welcome'
    ? t('onboardingGate.description')
    : milestone === 'sevenDaysLeft'
      ? t('onboardingGate.reminder7.description')
      : t('onboardingGate.reminder1.description')
  const kicker = milestone === 'welcome' ? t('onboardingGate.welcome') : t('onboardingGate.reminderKicker')
  const headline = milestone === 'welcome'
    ? t('onboardingGate.trialTitle', { days: daysTotal })
    : milestone === 'sevenDaysLeft'
      ? t('onboardingGate.reminder7.headline')
      : t('onboardingGate.reminder1.headline')
  const body = milestone === 'welcome'
    ? t('onboardingGate.trialBody')
    : milestone === 'sevenDaysLeft'
      ? t('onboardingGate.reminder7.body')
      : t('onboardingGate.reminder1.body')

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen) void handleDismiss() }}>
      <DialogContent className="max-w-xl rounded-[30px] border-slate-200 p-0">
        <div className="border-b border-slate-100 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-950">{title}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{kicker}</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-950">{headline}</div>
            <div className="mt-2 text-sm text-emerald-900">
              {body}
            </div>
          </div>

          {milestone === 'welcome' ? (
            <p className="text-sm text-slate-600">
              {t('onboardingGate.nextStep')}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button type="button" onClick={() => void handleDismiss()}>{t('common.continue')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}