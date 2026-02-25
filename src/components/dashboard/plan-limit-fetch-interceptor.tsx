'use client'

import { useEffect } from 'react'
import { usePlanLimitStore, type PlanLimitReachedPayload } from '@/lib/plan-limit-store'

function isPlanLimitPayload(value: unknown): value is PlanLimitReachedPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.code === 'PLAN_LIMIT_REACHED' && v.ok === false && typeof v.message === 'string'
}

function getUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return ''
}

export default function PlanLimitFetchInterceptor() {
  const show = usePlanLimitStore((s) => s.show)

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init)

      try {
        const url = getUrlString(input)
        if (!url.includes('/api/')) return res
        if (res.status !== 402) return res

        const clone = res.clone()
        const json = (await clone.json().catch(() => null)) as unknown
        if (isPlanLimitPayload(json)) {
          show(json)
        }
      } catch {
        // ignore
      }

      return res
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [show])

  return null
}
