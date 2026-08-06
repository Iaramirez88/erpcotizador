'use client'

import { createContext, useContext } from 'react'

type DashboardAccessContextValue = {
  allowedNavHrefs: string[] | null
  canAccessPayrollAdmin: boolean
  hasPayrollPortal: boolean
  payrollEntryHref: string
}

const DashboardAccessContext = createContext<DashboardAccessContextValue>({
  allowedNavHrefs: null,
  canAccessPayrollAdmin: false,
  hasPayrollPortal: false,
  payrollEntryHref: '/dashboard/nomina',
})

type DashboardAccessProviderProps = {
  value: DashboardAccessContextValue
  children: React.ReactNode
}

export function DashboardAccessProvider({ value, children }: DashboardAccessProviderProps) {
  return <DashboardAccessContext.Provider value={value}>{children}</DashboardAccessContext.Provider>
}

export function useDashboardAccess() {
  return useContext(DashboardAccessContext)
}