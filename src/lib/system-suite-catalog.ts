import { ANNUAL_DISCOUNT_PCT, type BillingCycle } from '@/lib/plans'
import { HR_PLAN_PARENT, HR_PLAN_SUBMODULES } from '@/lib/hr-plan-catalog'

export type SuiteSubmodule = {
  code: string
  title: string
  description: string
  monthlyPriceCOP: number
}

export type SuiteParentModule = {
  code: string
  title: string
  description: string
  monthlyBundlePriceCOP: number
  audience: string
  submodules: SuiteSubmodule[]
}

export const SYSTEM_SUITE_PARENTS: SuiteParentModule[] = [
  {
    code: 'SALES',
    title: 'Cotizaciones y Ventas',
    description: 'Frente comercial para cotizar, convertir, facturar y sostener seguimiento postventa.',
    monthlyBundlePriceCOP: 429000,
    audience: 'Para equipos que viven del flujo cotización > aprobación > entrega > recaudo.',
    submodules: [
      { code: 'SALES-QUOTE', title: 'Cotizador', description: 'Cálculo de productos, tirajes y servicios.', monthlyPriceCOP: 140000 },
      { code: 'SALES-PROPOSALS', title: 'Cotizaciones', description: 'Propuestas, estados y seguimiento comercial.', monthlyPriceCOP: 110000 },
      { code: 'SALES-CUSTOMERS', title: 'Clientes', description: 'Base maestra comercial e historial de atención.', monthlyPriceCOP: 80000 },
      { code: 'SALES-DELIVERIES', title: 'Remisiones', description: 'Entregas, soportes y cierres posteriores a la venta.', monthlyPriceCOP: 60000 },
      { code: 'SALES-POS', title: 'POS y facturación', description: 'Caja, cobro inmediato y facturación transaccional.', monthlyPriceCOP: 150000 },
    ],
  },
  {
    code: 'CRM',
    title: 'CRM y Gestor de Tareas',
    description: 'Captación, pipeline, agenda, tareas e inbox omnicanal como una sola unidad comercial.',
    monthlyBundlePriceCOP: 469000,
    audience: 'Para equipos comerciales que necesitan orden de prospectos, tareas y conversaciones.',
    submodules: [
      { code: 'CRM-INBOX', title: 'Inbox omnicanal', description: 'WhatsApp, chat y conversaciones centralizadas.', monthlyPriceCOP: 150000 },
      { code: 'CRM-PIPE', title: 'Leads y pipeline', description: 'Captación, oportunidades y etapas.', monthlyPriceCOP: 120000 },
      { code: 'CRM-AGENDA', title: 'Agenda comercial', description: 'Agenda de visitas, reuniones y seguimientos.', monthlyPriceCOP: 70000 },
      { code: 'CRM-TASKS', title: 'Gestor de tareas', description: 'Tareas, responsables y coordinación del equipo.', monthlyPriceCOP: 85000 },
      { code: 'CRM-FILES', title: 'Repositorio comercial', description: 'Archivos, propuestas y soportes asociados al cliente.', monthlyPriceCOP: 65000 },
      { code: 'CRM-AUTO', title: 'Chatbot e integraciones', description: 'Automatización básica y conexiones de canales.', monthlyPriceCOP: 105000 },
    ],
  },
  {
    code: 'OPS',
    title: 'Operaciones y Producción',
    description: 'Ejecución operativa, órdenes, materiales y captura del avance productivo.',
    monthlyBundlePriceCOP: 369000,
    audience: 'Para empresas que convierten ventas en producción o prestación operativa con trazabilidad.',
    submodules: [
      { code: 'OPS-WO', title: 'Órdenes de trabajo', description: 'Planeación y seguimiento de órdenes.', monthlyPriceCOP: 120000 },
      { code: 'OPS-MAT', title: 'Productos y materiales', description: 'Catálogo, terminados y estructuras base.', monthlyPriceCOP: 100000 },
      { code: 'OPS-SCAN', title: 'Escaneos y OCR', description: 'Captura documental, avances y evidencia.', monthlyPriceCOP: 90000 },
      { code: 'OPS-PRINT', title: 'Producción especializada', description: 'Litografía, planta y operación especializada.', monthlyPriceCOP: 140000 },
    ],
  },
  {
    code: 'RES',
    title: 'Inventario, productos y compras',
    description: 'Abastecimiento, existencias y reposición conectados con la operación.',
    monthlyBundlePriceCOP: 309000,
    audience: 'Para empresas que necesitan control real sobre stock, bodegas y compras.',
    submodules: [
      { code: 'RES-INV', title: 'Inventario', description: 'Existencias, movimientos y disponibilidad.', monthlyPriceCOP: 130000 },
      { code: 'RES-WHS', title: 'Bodegas y traslados', description: 'Ubicaciones, traslados y control multi-bodega.', monthlyPriceCOP: 80000 },
      { code: 'RES-BUY', title: 'Compras', description: 'Requisiciones, órdenes y recepción.', monthlyPriceCOP: 100000 },
      { code: 'RES-SUP', title: 'Proveedores', description: 'Aliados, condiciones y abastecimiento.', monthlyPriceCOP: 65000 },
    ],
  },
  {
    code: 'FIN',
    title: 'Finanzas y Analítica',
    description: 'Control contable, cierres, reportes y lectura financiera del negocio.',
    monthlyBundlePriceCOP: 489000,
    audience: 'Para empresas que necesitan formalizar finanzas y tomar decisiones con datos.',
    submodules: [
      { code: 'FIN-ACC', title: 'Contabilidad', description: 'Comprobantes, asientos, periodos y reglas.', monthlyPriceCOP: 240000 },
      { code: 'FIN-TRE', title: 'Tesorería y cierres', description: 'Control de caja, pagos y cierres operativos.', monthlyPriceCOP: 160000 },
      { code: 'FIN-REP', title: 'Reportes y BI', description: 'KPIs, cortes y análisis por sede o proceso.', monthlyPriceCOP: 120000 },
      { code: 'FIN-AUD', title: 'Auditoría e indicadores', description: 'Seguimiento avanzado de gestión y calidad de dato.', monthlyPriceCOP: 100000 },
    ],
  },
  {
    code: 'AI',
    title: 'IA y Automatización',
    description: 'Capas de productividad con IA aplicada a contenido, imagen y revisión operativa.',
    monthlyBundlePriceCOP: 259000,
    audience: 'Para equipos que quieren acelerar producción y análisis con IA útil, no experimental.',
    submodules: [
      { code: 'AI-IMG', title: 'Generador de imágenes', description: 'Creatividad asistida para piezas visuales.', monthlyPriceCOP: 95000 },
      { code: 'AI-VEC', title: 'Vectorizador', description: 'Conversión y preparación de imágenes para producción.', monthlyPriceCOP: 75000 },
      { code: 'AI-KB', title: 'Conocimiento IA', description: 'Conocimiento operativo y ayuda asistida.', monthlyPriceCOP: 85000 },
      { code: 'AI-AUD', title: 'Auditorías IA', description: 'Revisión de CRM y operación con señales automáticas.', monthlyPriceCOP: 75000 },
    ],
  },
  {
    code: 'VERT',
    title: 'Verticales Especializados',
    description: 'Capas específicas por industria sobre la base operativa del sistema.',
    monthlyBundlePriceCOP: 489000,
    audience: 'Para empresas que además del ERP necesitan una operación muy adaptada a su nicho.',
    submodules: [
      { code: 'VERT-REST', title: 'Restaurante', description: 'Operación de servicio, caja e insumos.', monthlyPriceCOP: 200000 },
      { code: 'VERT-ODON', title: 'Odontología', description: 'Ficha clínica, control del paciente y visitas.', monthlyPriceCOP: 180000 },
      { code: 'VERT-DOTA', title: 'Dotaciones', description: 'Pedidos corporativos, uniformes y EPP.', monthlyPriceCOP: 220000 },
    ],
  },
  {
    code: HR_PLAN_PARENT.code,
    title: HR_PLAN_PARENT.title,
    description: HR_PLAN_PARENT.description,
    monthlyBundlePriceCOP: HR_PLAN_PARENT.monthlyPriceCOP,
    audience: HR_PLAN_PARENT.audience,
    submodules: HR_PLAN_SUBMODULES.map((item) => ({
      code: item.code,
      title: item.title,
      description: item.description,
      monthlyPriceCOP: item.monthlyPriceCOP,
    })),
  },
]

export const SYSTEM_SUITE_GLOBAL = {
  code: 'SG-SUITE',
  title: 'Suite Global SGDigital',
  description: 'Venta corporativa de toda la suite: comercial, CRM, operaciones, recursos, finanzas, IA, verticales y RRHH.',
  monthlyPriceCOP: 3290000,
} as const

export function getSystemSuitePricingSummary(cycle: BillingCycle) {
  const parentsSubtotalMonthlyCOP = SYSTEM_SUITE_PARENTS.reduce((sum, item) => sum + item.monthlyBundlePriceCOP, 0)
  const suiteMonthlyCOP = SYSTEM_SUITE_GLOBAL.monthlyPriceCOP
  const monthlySavingsCOP = Math.max(0, parentsSubtotalMonthlyCOP - suiteMonthlyCOP)

  if (cycle === 'MONTHLY') {
    return {
      parentsSubtotalMonthlyCOP,
      suiteMonthlyCOP,
      monthlySavingsCOP,
      parentsSubtotalCOP: parentsSubtotalMonthlyCOP,
      suiteTotalCOP: suiteMonthlyCOP,
      savingsCOP: monthlySavingsCOP,
      annualDiscountPct: 0,
    }
  }

  const parentsSubtotalCOP = Math.round(parentsSubtotalMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const suiteTotalCOP = Math.round(suiteMonthlyCOP * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100))
  const savingsCOP = Math.max(0, parentsSubtotalCOP - suiteTotalCOP)

  return {
    parentsSubtotalMonthlyCOP,
    suiteMonthlyCOP,
    monthlySavingsCOP,
    parentsSubtotalCOP,
    suiteTotalCOP,
    savingsCOP,
    annualDiscountPct: ANNUAL_DISCOUNT_PCT,
  }
}