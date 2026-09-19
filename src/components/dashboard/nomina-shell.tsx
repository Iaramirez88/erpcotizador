'use client'

import type { ReactNode } from 'react'
import { NominaNavigationProvider, useNominaNavigation } from '@/components/dashboard/nomina-navigation-context'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { cn } from '@/lib/utils'

function NominaShellContent({ children }: { children: ReactNode }) {
  const navigation = useNominaNavigation()
  const menuVisible = navigation?.menuVisible ?? true

  return (
    <div className={cn(menuVisible && 'xl:grid xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-6')}>
      {menuVisible ? <NominaSubnav orientation="vertical" /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function NominaShell({ children }: { children: ReactNode }) {
  return (
    <NominaNavigationProvider>
      <NominaShellContent>{children}</NominaShellContent>
    </NominaNavigationProvider>
  )
}