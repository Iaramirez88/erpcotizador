'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

type NominaNavigationContextValue = {
  menuVisible: boolean
  toggleMenu: () => void
}

const NominaNavigationContext = createContext<NominaNavigationContextValue | null>(null)
const STORAGE_KEY = 'sg_nomina_menu_visible'

export function NominaNavigationProvider({ children }: { children: ReactNode }) {
  const [menuVisible, setMenuVisible] = useState(true)

  useEffect(() => {
    setMenuVisible(window.localStorage.getItem(STORAGE_KEY) !== '0')
  }, [])

  function toggleMenu() {
    setMenuVisible((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <NominaNavigationContext.Provider value={{ menuVisible, toggleMenu }}>
      {children}
    </NominaNavigationContext.Provider>
  )
}

export function useNominaNavigation() {
  return useContext(NominaNavigationContext)
}

export function NominaMenuToggle() {
  const navigation = useNominaNavigation()

  if (!navigation) return null

  const label = navigation.menuVisible ? 'Ocultar menú de nómina' : 'Abrir menú de nómina'

  return (
    <button
      type="button"
      onClick={navigation.toggleMenu}
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-[#444444] dark:bg-[#1c1c1c] dark:text-[#b0b0b0] dark:hover:text-white"
      aria-label={label}
      title={label}
      aria-expanded={navigation.menuVisible}
    >
      {navigation.menuVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
    </button>
  )
}