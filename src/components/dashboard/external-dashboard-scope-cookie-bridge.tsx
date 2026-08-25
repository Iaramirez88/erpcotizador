'use client'

import { useEffect } from 'react'
import {
  EXTERNAL_DASHBOARD_SCOPE_COOKIE,
  EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING,
} from '@/lib/external-dashboard-scope'

type Props = {
  enabled: boolean
}

export default function ExternalDashboardScopeCookieBridge({ enabled }: Props) {
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (enabled) {
      document.cookie = `${EXTERNAL_DASHBOARD_SCOPE_COOKIE}=${EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax`
      return
    }

    document.cookie = `${EXTERNAL_DASHBOARD_SCOPE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  }, [enabled])

  return null
}