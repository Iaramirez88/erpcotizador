import type { ReactNode } from 'react'
import { NominaShell } from '@/components/dashboard/nomina-shell'

type NominaLayoutProps = {
  children: ReactNode
}

export default function NominaLayout({ children }: NominaLayoutProps) {
  return <NominaShell>{children}</NominaShell>
}
