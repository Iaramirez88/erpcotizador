import type { BillingCycle, PlanTier } from '@prisma/client'

export type { BillingCycle, PlanTier }

export type PlanInfo = {
  tier: PlanTier
  nombre: string
  descripcion: string
  precioMensualCOP: number
}

export const PLANES: PlanInfo[] = [
  {
    tier: 'CRM',
    nombre: 'CRM',
    descripcion: 'Plan especializado solo para CRM omnicanal, agenda comercial, leads, oportunidades, tareas y conversaciones del equipo.',
    precioMensualCOP: 150000,
  },
  {
    tier: 'BASIC',
    nombre: 'Básico',
    descripcion: 'Ideal para comenzar. Incluye 100 reportes, 100 remisiones, 100 órdenes de trabajo, 50 proveedores, 500 clientes, 200 productos, 1 sede, 2 usuarios, 300 cotizaciones/mes. Sin límite en Litografía, Escaneos y Terminados.',
    precioMensualCOP: 750000,
  },
  {
    tier: 'MEDIO',
    nombre: 'Medio',
    descripcion: 'Escala la operación comercial y logística con más capacidad de usuarios, sedes y volumen mensual, sin incluir CRM omnicanal.',
    precioMensualCOP: 1200000,
  },
  {
    tier: 'INTERMEDIO',
    nombre: 'Intermedio',
    descripcion: 'Todo ilimitado excepto: 6 sedes, 10 usuarios, 8.000 clientes y 5.000 cotizaciones por mes. CRM solo disponible en Full o CRM.',
    precioMensualCOP: 1650000,
  },
  {
    tier: 'FULL',
    nombre: 'Full',
    descripcion: 'Sin límites. Todas las funcionalidades y módulos habilitados.',
    precioMensualCOP: 2400000,
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

export function formatCOP(value: number, locale: string = 'es-CO'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString(locale)}`
  }
}
