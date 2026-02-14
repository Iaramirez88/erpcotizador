export type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

export type BillingCycle = 'MONTHLY' | 'YEARLY'

export type PlanInfo = {
  tier: PlanTier
  nombre: string
  descripcion: string
  precioMensualCOP: number
}

export const PLANES: PlanInfo[] = [
  {
    tier: 'BASIC',
    nombre: 'Básico',
    descripcion: 'Lo esencial para empezar.',
    precioMensualCOP: 99000,
  },
  {
    tier: 'MEDIO',
    nombre: 'Medio',
    descripcion: 'Operación diaria organizada.',
    precioMensualCOP: 199000,
  },
  {
    tier: 'INTERMEDIO',
    nombre: 'Intermedio',
    descripcion: 'Control real de la empresa.',
    precioMensualCOP: 299000,
  },
  {
    tier: 'FULL',
    nombre: 'Full',
    descripcion: 'Escala sin límites.',
    precioMensualCOP: 399000,
  },
]

export const ANNUAL_DISCOUNT_PCT = 10

export function getPlanPriceCOP(tier: PlanTier, cycle: BillingCycle): number {
  const plan = PLANES.find((p) => p.tier === tier)
  if (!plan) throw new Error(`PlanTier inválido: ${tier}`)

  if (cycle === 'MONTHLY') return plan.precioMensualCOP

  // YEARLY: 12 meses con descuento
  const annual = plan.precioMensualCOP * 12
  const discounted = annual * (1 - ANNUAL_DISCOUNT_PCT / 100)
  return Math.round(discounted)
}

export function getDefaultPlanTier(): PlanTier {
  // En dev dejamos FULL por defecto
  if (process.env.NODE_ENV !== 'production') return 'FULL'
  return 'BASIC'
}

export function formatCOP(value: number): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('es-CO')}`
  }
}
