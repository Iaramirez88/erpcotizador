import type { ReactNode } from 'react'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'

type ContabilidadNominaLayoutProps = {
  children: ReactNode
}

export default function ContabilidadNominaLayout({ children }: ContabilidadNominaLayoutProps) {
  return (
    <div className="xl:grid xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">
      <NominaSubnav orientation="vertical" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
