'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import OnboardingWizardClient from '@/app/dashboard/onboarding/onboarding-wizard-client'
import type { CompanyOnboardingData } from '@/lib/company-onboarding'

type OnboardingStatusResponse = {
  ok?: boolean
  required?: boolean
  editable?: boolean
  data?: CompanyOnboardingData
}

export default function OnboardingGate() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [initialData, setInitialData] = useState<CompanyOnboardingData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as OnboardingStatusResponse
        if (cancelled || !res.ok || !json.ok) return
        if (pathname.startsWith('/dashboard/onboarding')) return
        setInitialData(json.data ?? null)
        setOpen(Boolean(json.required))
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
  }, [pathname, router])

  if (loading || pathname.startsWith('/dashboard/onboarding') || !open || !initialData) return null

  return (
    <OnboardingWizardClient
      mode="modal"
      open={open}
      required
      initialData={initialData}
      onCompleted={() => {
        setOpen(false)
        router.refresh()
      }}
      onDismiss={() => setOpen(false)}
    />
  )
}