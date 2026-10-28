import { create } from "zustand"

type UiState = {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void

  sidebarCollapsed: boolean
  hydrateSidebarCollapsed: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void

  contabilidadNavPinned: string[]
  hydrateContabilidadNavPinned: () => void
  setContabilidadNavPinned: (hrefs: string[]) => void
  toggleContabilidadNavPinned: (href: string) => void
  clearContabilidadNavPinned: () => void

  routeLoading: boolean
  setRouteLoading: (loading: boolean) => void
}

function readInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('sg_sidebar_collapsed') === '1'
  } catch {
    return false
  }
}

function persistSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem('sg_sidebar_collapsed', collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}

const CONTABILIDAD_NAV_PINNED_KEY = 'sg_contabilidad_nav_pinned'

function readInitialContabilidadNavPinned(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(CONTABILIDAD_NAV_PINNED_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function persistContabilidadNavPinned(hrefs: string[]) {
  try {
    window.localStorage.setItem(CONTABILIDAD_NAV_PINNED_KEY, JSON.stringify(hrefs))
  } catch {
    // ignore
  }
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

  sidebarCollapsed: false,
  hydrateSidebarCollapsed: () => set({ sidebarCollapsed: readInitialSidebarCollapsed() }),
  setSidebarCollapsed: (collapsed) =>
    set(() => {
      persistSidebarCollapsed(collapsed)
      return { sidebarCollapsed: collapsed }
    }),
  toggleSidebarCollapsed: () =>
    set((s) => {
      const next = !s.sidebarCollapsed
      persistSidebarCollapsed(next)
      return { sidebarCollapsed: next }
    }),

  contabilidadNavPinned: [],
  hydrateContabilidadNavPinned: () => set({ contabilidadNavPinned: readInitialContabilidadNavPinned() }),
  setContabilidadNavPinned: (hrefs) =>
    set(() => {
      const next = Array.from(new Set(hrefs.filter((entry) => typeof entry === 'string')))
      persistContabilidadNavPinned(next)
      return { contabilidadNavPinned: next }
    }),
  toggleContabilidadNavPinned: (href) =>
    set((s) => {
      const next = s.contabilidadNavPinned.includes(href)
        ? s.contabilidadNavPinned.filter((entry) => entry !== href)
        : [...s.contabilidadNavPinned, href]
      persistContabilidadNavPinned(next)
      return { contabilidadNavPinned: next }
    }),
  clearContabilidadNavPinned: () =>
    set(() => {
      persistContabilidadNavPinned([])
      return { contabilidadNavPinned: [] }
    }),

  routeLoading: false,
  setRouteLoading: (loading) => set({ routeLoading: loading }),
}))
