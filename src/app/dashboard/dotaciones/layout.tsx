import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export default async function DotacionesLayout({ children }: { children: ReactNode }) {
  const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'DOTACIONES', action: 'READ', allowLegacyFallback: false })
  if (!access.ok) redirect('/dashboard')

  return children
}