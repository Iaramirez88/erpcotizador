import { Suspense } from 'react'
import { RopExternalOnboardingClient } from './rop-external-onboarding-client'

export const runtime = 'nodejs'

export default function RopJoinPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500 sm:px-6">Cargando portal de acceso...</div>}>
      <RopExternalOnboardingClient />
    </Suspense>
  )
}