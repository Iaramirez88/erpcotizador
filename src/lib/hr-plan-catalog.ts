import { ANNUAL_DISCOUNT_PCT, type BillingCycle } from '@/lib/plans'

export type HrPlanSubmodule = {
  code: string
  title: string
  description: string
  monthlyPriceCOP: number
  status: 'OPERATIVO'
}

export const HR_PLAN_PARENT = {
  code: 'RRHH',
  title: 'Recursos Humanos',
  description:
    'Suite integral para operar talento humano con una sola capa comercial: nomina, people ops, experiencia del colaborador y desarrollo.',
  monthlyPriceCOP: 1190000,
  audience: 'Para empresas que quieren montar un Buk propio sobre SGDigital sin comprar el ERP completo.',
  highlights: [
    'Version bilingue en las pantallas principales de nomina',
    'Base de datos operativa con datos demo para validacion funcional',
    'Cobro por suite completa o por submodulos independientes',
    'Precio recalibrado para empresas de 20 a 80 colaboradores con compra por empresa, no por usuario',
    'Activacion comercial por fases sin obligar cambio de plan full',
  ],
} as const

export const HR_PLAN_SUBMODULES: HrPlanSubmodule[] = [
  {
    code: 'RRHH-NOM',
    title: 'Nomina, periodos y liquidacion',
    description: 'Periodos, novedades, desprendibles, liquidaciones y control operativo de cierres.',
    monthlyPriceCOP: 290000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-EMP',
    title: 'Empleados y contratos',
    description: 'Hoja de vida, contratos, ubicacion contable, salario y seguridad social.',
    monthlyPriceCOP: 160000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-ASI',
    title: 'Asistencia y turnos',
    description: 'Control de marcaciones, tardanzas, permisos, ausencias y horas extra.',
    monthlyPriceCOP: 120000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-BEN',
    title: 'Beneficios, adelantos y catalogo',
    description: 'Solicitudes de beneficios, adelantos de nomina y catalogo de planes o packs.',
    monthlyPriceCOP: 120000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-DOC',
    title: 'Documentos y firma electronica',
    description: 'Documentos laborales, solicitudes de firma y trazabilidad del expediente.',
    monthlyPriceCOP: 160000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-ONB',
    title: 'Onboarding y offboarding',
    description: 'Journeys de ingreso, responsables, checklist y seguimiento por etapa.',
    monthlyPriceCOP: 130000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-SER',
    title: 'Servicio al colaborador',
    description: 'Casos internos, SLA, prioridad y bandeja de atencion al colaborador.',
    monthlyPriceCOP: 95000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-ETH',
    title: 'Canal de denuncias',
    description: 'Canal etico, seguimiento reservado y clasificacion de hallazgos.',
    monthlyPriceCOP: 75000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-ATS',
    title: 'Seleccion y ATS',
    description: 'Pipeline de candidatos, fuentes, etapas y reclutamiento base.',
    monthlyPriceCOP: 170000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-SUR',
    title: 'Encuestas y clima',
    description: 'Campanas de pulso, clima, onboarding y beneficios con resultados comparables.',
    monthlyPriceCOP: 85000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-PERF',
    title: 'Desempeno',
    description: 'Ciclos de evaluacion, periodos de prueba, calibracion y cierre.',
    monthlyPriceCOP: 145000,
    status: 'OPERATIVO',
  },
  {
    code: 'RRHH-LEARN',
    title: 'Capacitaciones',
    description: 'Asignacion de programas, cobertura, cumplimiento y seguimiento basico.',
    monthlyPriceCOP: 130000,
    status: 'OPERATIVO',
  },
]

export function getHrPlanPricingSummary(cycle: BillingCycle) {
  const modulesSubtotalMonthlyCOP = HR_PLAN_SUBMODULES.reduce((sum, item) => sum + item.monthlyPriceCOP, 0)
  const bundleMonthlyCOP = HR_PLAN_PARENT.monthlyPriceCOP
  const monthlySavingsCOP = Math.max(0, modulesSubtotalMonthlyCOP - bundleMonthlyCOP)

  if (cycle === 'MONTHLY') {
    return {
      modulesSubtotalMonthlyCOP,
      bundleMonthlyCOP,
      monthlySavingsCOP,
      modulesSubtotalCOP: modulesSubtotalMonthlyCOP,
      bundleTotalCOP: bundleMonthlyCOP,
      savingsCOP: monthlySavingsCOP,
      annualDiscountPct: 0,
    }
  }

  const modulesSubtotalCOP = Math.round(modulesSubtotalMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const bundleTotalCOP = Math.round(bundleMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const savingsCOP = Math.max(0, modulesSubtotalCOP - bundleTotalCOP)

  return {
    modulesSubtotalMonthlyCOP,
    bundleMonthlyCOP,
    monthlySavingsCOP,
    modulesSubtotalCOP,
    bundleTotalCOP,
    savingsCOP,
    annualDiscountPct: ANNUAL_DISCOUNT_PCT,
  }
}