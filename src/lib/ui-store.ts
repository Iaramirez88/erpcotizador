import { create } from "zustand"

type UiState = {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void

  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
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

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

  sidebarCollapsed: readInitialSidebarCollapsed(),
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
}))
