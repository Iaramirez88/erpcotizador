'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

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

  const [open, setOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [reason, setReason] = useState<PlanPaywall['reason']>('NONE')
  const [trial, setTrial] = useState<TrialInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStartingTrial, setIsStartingTrial] = useState(false)
  const [companyCode, setCompanyCode] = useState('')
  const [isClaimingCode, setIsClaimingCode] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plan', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as PlanApiResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo cargar el plan')
        setOpen(false)
        return
      }

      const pw = json.effective?.paywall
      const tr = json.effective?.trial ?? null

      setTrial(tr)
      setReason(pw?.reason ?? 'NONE')
      setBlocking(Boolean(pw?.blocking))
      setOpen(Boolean(pw?.show))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
    if (reason === 'TRIAL_ACTIVE') return 'Prueba gratis activa'
    if (reason === 'TRIAL_EXPIRED') return 'Tu prueba terminó'
    if (reason === 'PERSONAL_NO_PLAN') return 'Activa tu prueba gratis'
    return 'Plan'
  }, [reason])

  const description = useMemo(() => {
    if (reason === 'TRIAL_ACTIVE') {
      const days = trial?.daysLeft
      return days ? `Te quedan ${days} día(s) de Intermedio.` : 'Tu prueba Intermedio está activa.'
    }
    if (reason === 'TRIAL_EXPIRED') {
      return 'Para seguir usando las funciones, elige un plan y realiza el pago.'
    }
    if (reason === 'PERSONAL_NO_PLAN') {
      return 'Puedes activar 7 días gratis del plan Intermedio o elegir un plan.'
    }
    return 'Gestiona tu plan.'
  }, [reason, trial?.daysLeft])

  async function startTrial() {
    setIsStartingTrial(true)
    setError(null)
    try {
      const res = await fetch('/api/plan/trial/start', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as StartTrialResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo iniciar el trial')
        return
      }

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
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
        setError(json.error || 'No se pudo validar el código')
        return
      }

      setCompanyCode('')
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsClaimingCode(false)
    }
  }

  function goToPlans() {
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
              ¿Tienes un código de empresa? Ingresa el código para activar tu acceso.
            </p>
            <div className="flex gap-2">
              <Input
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                placeholder="Código de empresa"
                autoComplete="one-time-code"
              />
              <Button
                variant="outline"
                onClick={claimCompanyCode}
                disabled={isClaimingCode || isLoading || !companyCode.trim()}
              >
                Validar
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={goToPlans} disabled={isLoading}>
            Ver planes
          </Button>

          {canStartTrial ? (
            <Button onClick={startTrial} disabled={isStartingTrial || isLoading}>
              Activar prueba 7 días
            </Button>
          ) : blocking ? (
            <Button onClick={goToPlans} disabled={isLoading}>
              Elegir plan y pagar
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)} disabled={isLoading}>
              Continuar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
