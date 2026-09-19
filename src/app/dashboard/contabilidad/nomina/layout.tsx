import type { ReactNode } from 'react'
import { NominaShell } from '@/components/dashboard/nomina-shell'

type ContabilidadNominaLayoutProps = {
  children: ReactNode
}

export default function ContabilidadNominaLayout({ children }: ContabilidadNominaLayoutProps) {
  return <NominaShell>{children}</NominaShell>
}
