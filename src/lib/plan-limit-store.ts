import { create } from 'zustand'

type PlanLimitKey =
  | 'COTIZACIONES_PER_MONTH'
  | 'ORDENES_PER_MONTH'
  | 'REMISIONES_PER_MONTH'
  | 'PRODUCTOS_MAX'
  | 'CLIENTES_MAX'
  | 'PROVEEDORES_MAX'
  | 'SEDES_MAX'
  | 'USUARIOS_MAX'

export type PlanLimitReachedPayload = {
  ok: false
  code: 'PLAN_LIMIT_REACHED'
  message: string
  limitKey: PlanLimitKey
  current: number
  max: number
  planTier: string
  upgradeUrl: string
  /** Datos opcionales que expone el servicio central de capacidad (`@/lib/plan-capacity`). */
  resource?: string
  unit?: string
  percentage?: number
  level?: 'ok' | 'warning' | 'critical' | 'reached'
}

type PlanLimitState = {
  open: boolean
  payload: PlanLimitReachedPayload | null
  show: (payload: PlanLimitReachedPayload) => void
  hide: () => void
}

export const usePlanLimitStore = create<PlanLimitState>((set) => ({
  open: false,
  payload: null,
  show: (payload) => set({ open: true, payload }),
  hide: () => set({ open: false }),
}))
