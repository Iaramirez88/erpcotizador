'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PlanTier } from '@/lib/plans'

type PlanPaywall = {
  show: boolean
  blocking: boolean
  reason: 'NONE' | 'PERSONAL_NO_PLAN' | 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED'
}

type TrialInfo = {
  tier: PlanTier | null
  startedAt: string | null
  validUntil: string | null
  isActive: boolean
  isExpired: boolean
  daysLeft: number | null
}

type TrialNoticeMode = 'intro' | 'last-day' | 'expired' | 'generic' | null

type EffectiveInfo =
  | {
      planTier: PlanTier
      paywall: PlanPaywall
      trial: TrialInfo
    }
  | null

type PlanApiResponse =
  | {
      ok: true
      effective: EffectiveInfo
    }
  | { ok?: false; error?: string }

type StartTrialResponse =
  | {
      ok: true
      paywall?: PlanPaywall
      trial?: TrialInfo
    }
  | { ok?: false; error?: string }

export default function PlanPaywallModal() {
  const router = useRouter()
  const { t } = useI18n()

  const [open, setOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [reason, setReason] = useState<PlanPaywall['reason']>('NONE')
  const [trial, setTrial] = useState<TrialInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStartingTrial, setIsStartingTrial] = useState(false)
  const [companyCode, setCompanyCode] = useState('')
  const [isClaimingCode, setIsClaimingCode] = useState(false)
  const [noticeMode, setNoticeMode] = useState<TrialNoticeMode>(null)

  function resolveClientVisibility(nextReason: PlanPaywall['reason'], nextTrial: TrialInfo | null, serverOpen: boolean) {
    if (nextReason === 'TRIAL_EXPIRED') {
      setNoticeMode('expired')
      return true
    }

    if (nextReason === 'TRIAL_ACTIVE') {
      const startedAt = nextTrial?.startedAt ?? 'unknown'
      const validUntil = nextTrial?.validUntil ?? 'unknown'
      const daysLeft = nextTrial?.daysLeft ?? null

      if (daysLeft !== null && daysLeft <= 1) {
        const lastDayKey = `sg_trial_last_day_seen:${validUntil}`
        const alreadySeen = window.localStorage.getItem(lastDayKey) === '1'
        setNoticeMode('last-day')
        if (!alreadySeen) {
          window.localStorage.setItem(lastDayKey, '1')
          return true
        }
        return false
      }

      const introKey = `sg_trial_intro_seen:${startedAt}`
      const alreadySeen = window.localStorage.getItem(introKey) === '1'
      setNoticeMode('intro')
      if (!alreadySeen) {
        window.localStorage.setItem(introKey, '1')
        return true
      }
      return false
    }

    setNoticeMode(nextReason === 'PERSONAL_NO_PLAN' ? 'generic' : null)
    return serverOpen
  }

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plan', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as PlanApiResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || t('planPaywall.error.loadPlan'))
        setOpen(false)
        return
      }

      const pw = json.effective?.paywall
      const tr = json.effective?.trial ?? null

      setTrial(tr)
      setReason(pw?.reason ?? 'NONE')
      setBlocking(Boolean(pw?.blocking))
      setOpen(resolveClientVisibility(pw?.reason ?? 'NONE', tr, Boolean(pw?.show)))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('planPaywall.error.unexpected'))
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const canStartTrial = useMemo(() => {
    if (reason !== 'PERSONAL_NO_PLAN') return false
    if (trial?.startedAt) return false
    return true
  }, [reason, trial?.startedAt])

  const title = useMemo(() => {
    if (reason === 'TRIAL_ACTIVE' && noticeMode === 'last-day') return t('planPaywall.title.lastDay')
    if (reason === 'TRIAL_ACTIVE') return t('planPaywall.title.trialActive')
    if (reason === 'TRIAL_EXPIRED') return t('planPaywall.title.trialExpired')
    if (reason === 'PERSONAL_NO_PLAN') return t('planPaywall.title.personalNoPlan')
    return t('planPaywall.title.default')
  }, [noticeMode, reason, t])

  const description = useMemo(() => {
    if (reason === 'TRIAL_ACTIVE') {
      const days = trial?.daysLeft
      if (noticeMode === 'last-day') {
        return t('planPaywall.description.lastDay')
      }
      return days
        ? t('planPaywall.description.trialActiveDays', { days })
        : t('planPaywall.description.trialActive')
    }
    if (reason === 'TRIAL_EXPIRED') {
      return t('planPaywall.description.trialExpired')
    }
    if (reason === 'PERSONAL_NO_PLAN') {
      return t('planPaywall.description.personalNoPlan')
    }
    return t('planPaywall.description.default')
  }, [noticeMode, reason, t, trial?.daysLeft])

  async function startTrial() {
    setIsStartingTrial(true)
    setError(null)
    try {
      const res = await fetch('/api/plan/trial/start', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as StartTrialResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || t('planPaywall.error.startTrial'))
        return
      }

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('planPaywall.error.unexpected'))
    } finally {
      setIsStartingTrial(false)
    }
  }

  async function claimCompanyCode() {
    const code = companyCode.trim()
    if (!code) return

    setIsClaimingCode(true)
    setError(null)
    try {
      const res = await fetch('/api/plan/company-code/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!res.ok || !json.ok) {
        setError(json.error || t('planPaywall.error.invalidCode'))
        return
      }

      setCompanyCode('')
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('planPaywall.error.unexpected'))
    } finally {
      setIsClaimingCode(false)
    }
  }

  function goToPlans() {
    // Permite que el usuario salga del modal al ir a la pantalla de planes.
    setOpen(false)
    router.push('/dashboard/configuracion/plan')
  }

  if (!open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (blocking) return
        setOpen(next)
      }}
    >
      <DialogContent hideClose={blocking}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {reason === 'PERSONAL_NO_PLAN' || reason === 'TRIAL_EXPIRED' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('planPaywall.companyCode.hint')}
            </p>
            <div className="flex gap-2">
              <Input
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                placeholder="WS-..."
                autoComplete="one-time-code"
              />
              <Button
                variant="outline"
                onClick={claimCompanyCode}
                disabled={isClaimingCode || isLoading || !companyCode.trim()}
              >
                {t('planPaywall.companyCode.validate')}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={goToPlans} disabled={isLoading}>
            {t('planPaywall.actions.viewPlans')}
          </Button>

          {canStartTrial ? (
            <Button onClick={startTrial} disabled={isStartingTrial || isLoading}>
              {t('planPaywall.actions.startTrial7')}
            </Button>
          ) : reason === 'TRIAL_ACTIVE' && noticeMode === 'last-day' ? (
            <Button onClick={goToPlans} disabled={isLoading}>
              {t('planPaywall.actions.choosePlan')}
            </Button>
          ) : blocking ? (
            <Button onClick={goToPlans} disabled={isLoading}>
              {t('planPaywall.actions.choosePlanAndPay')}
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)} disabled={isLoading}>
              {t('planPaywall.actions.continue')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
