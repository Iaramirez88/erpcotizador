import type { DecisionAnalysisTarget } from '@/lib/decision-engine/contracts'

export type BICatalogCapabilityType =
  | 'KPI'
  | 'ALERT'
  | 'RISK'
  | 'OPPORTUNITY'
  | 'RECOMMENDATION'
  | 'ACTION'
  | 'PREDICTION'
  | 'SNAPSHOT'
  | 'DELIVERY'

export type BICatalogCapability = {
  id: string
  target: DecisionAnalysisTarget
  type: BICatalogCapabilityType
  title: string
  description: string
  status: 'ACTIVE' | 'PLANNED'
  sourceIds: string[]
}

export type BICatalogDomain = {
  target: DecisionAnalysisTarget
  label: string
  objective: string
  capabilities: BICatalogCapability[]
}

export const BI_OFFICIAL_CATALOG: BICatalogDomain[] = [
  {
    target: 'company',
    label: 'Compañía',
    objective: 'Consolidar salud global, prioridades ejecutivas y narrativa gerencial sobre una sola lectura reusable.',
    capabilities: [
      {
        id: 'company-health-score',
        target: 'company',
        type: 'KPI',
        title: 'Health score global explicable',
        description: 'Puntaje consolidado con dimensiones comerciales, operativas y financieras para resumir la salud empresarial.',
        status: 'ACTIVE',
        sourceIds: ['sales-momentum', 'pipeline-coverage', 'commercial-hygiene', 'operations-load', 'finance-resilience'],
      },
      {
        id: 'company-summary',
        target: 'company',
        type: 'DELIVERY',
        title: 'Resumen ejecutivo narrativo',
        description: 'Narrativa gerencial que explica qué ocurre, dónde está la presión principal y cuál es la prioridad inmediata.',
        status: 'ACTIVE',
        sourceIds: ['executiveSummary'],
      },
      {
        id: 'company-priority-notifications',
        target: 'company',
        type: 'DELIVERY',
        title: 'Notificaciones ejecutivas priorizadas',
        description: 'Avisos automáticos a gerencia cuando un snapshot nuevo cae en atención o crítico.',
        status: 'ACTIVE',
        sourceIds: ['risk-finance-cashflow-receivables', 'action-protect-company-cashflow'],
      },
    ],
  },
  {
    target: 'crm',
    label: 'CRM',
    objective: 'Detectar disciplina de seguimiento, riesgo de estancamiento y potencial de cierre comercial.',
    capabilities: [
      {
        id: 'crm-follow-up-kpis',
        target: 'crm',
        type: 'KPI',
        title: 'KPIs de seguimiento y conversión',
        description: 'Leads sin gestión reciente, conversiones visibles y calidad del pipeline activo.',
        status: 'ACTIVE',
        sourceIds: ['crm-kpi-conversion'],
      },
      {
        id: 'crm-risks-opportunities',
        target: 'crm',
        type: 'RISK',
        title: 'Riesgos y oportunidades de cierre',
        description: 'Estancamiento comercial, leads sin seguimiento y deals con alta probabilidad de cierre.',
        status: 'ACTIVE',
        sourceIds: ['crm-alert-no-follow-up', 'crm-risk-stale-opportunities', 'crm-opportunity-high-potential'],
      },
      {
        id: 'crm-close-prediction',
        target: 'crm',
        type: 'PREDICTION',
        title: 'Predicción heurística de cierre cercano',
        description: 'Estimación de oportunidades listas para empuje de cierre usando probabilidad declarada y actividad reciente.',
        status: 'ACTIVE',
        sourceIds: ['crm-prediction-close-ready'],
      },
    ],
  },
  {
    target: 'sales',
    label: 'Ventas',
    objective: 'Monitorear tracción comercial, cartera de cotizaciones y recompra para orientar ingreso próximo.',
    capabilities: [
      {
        id: 'sales-kpis',
        target: 'sales',
        type: 'KPI',
        title: 'KPIs de venta neta, aprobación y clientes activos',
        description: 'Lectura base de performance comercial y disciplina de cotización.',
        status: 'ACTIVE',
        sourceIds: ['sales-kpi-net-sales', 'sales-kpi-quote-approval', 'sales-kpi-active-customers'],
      },
      {
        id: 'sales-pronostico',
        target: 'sales',
        type: 'PREDICTION',
        title: 'Pronóstico de ventas',
        description: 'Estimación heurística de venta neta del siguiente periodo comparable usando tendencia y aprobación comercial.',
        status: 'ACTIVE',
        sourceIds: ['sales-prediction-next-window'],
      },
    ],
  },
  {
    target: 'inventory',
    label: 'Inventario',
    objective: 'Prevenir quiebres, detectar sobrestock y estimar presión futura de materiales.',
    capabilities: [
      {
        id: 'inventory-kpis',
        target: 'inventory',
        type: 'KPI',
        title: 'KPIs de cobertura y actividad',
        description: 'Materiales activos, stock crítico, sobrestock y actividad reciente de movimientos.',
        status: 'ACTIVE',
        sourceIds: ['inventory-kpi-active-materials', 'inventory-kpi-low-stock', 'inventory-kpi-overstock'],
      },
      {
        id: 'inventory-demand-forecast',
        target: 'inventory',
        type: 'PREDICTION',
        title: 'Pronóstico de demanda',
        description: 'Estimación heurística de salidas de inventario del siguiente periodo comparable.',
        status: 'ACTIVE',
        sourceIds: ['inventory-prediction-next-risk'],
      },
    ],
  },
  {
    target: 'purchases',
    label: 'Compras',
    objective: 'Priorizar abastecimiento, exposición por costos y presión de autorizaciones.',
    capabilities: [
      {
        id: 'purchases-alerts',
        target: 'purchases',
        type: 'ALERT',
        title: 'Alertas de abastecimiento y costo',
        description: 'Materiales urgentes, alzas de costo y presión de compras pendientes.',
        status: 'ACTIVE',
        sourceIds: ['purchases-alert-urgent-replenishment', 'purchases-risk-cost-increase', 'purchases-risk-approval-cashflow'],
      },
      {
        id: 'purchases-pressure-prediction',
        target: 'purchases',
        type: 'PREDICTION',
        title: 'Predicción de presión de abastecimiento',
        description: 'Frentes de compra que seguirán requiriendo seguimiento prioritario.',
        status: 'ACTIVE',
        sourceIds: ['purchases-prediction-next-pressure'],
      },
    ],
  },
  {
    target: 'operations',
    label: 'Operaciones',
    objective: 'Detectar retrasos, carga operativa acumulada y cuellos de botella de producción.',
    capabilities: [
      {
        id: 'operations-alerts',
        target: 'operations',
        type: 'ALERT',
        title: 'Alertas operativas y cuellos',
        description: 'Órdenes retrasadas, etapas detenidas y sobrecarga por área responsable.',
        status: 'ACTIVE',
        sourceIds: ['operations-alert-overdue-orders', 'operations-risk-bottlenecks'],
      },
      {
        id: 'operations-pressure-prediction',
        target: 'operations',
        type: 'PREDICTION',
        title: 'Predicción de presión operativa',
        description: 'Estimación de frentes que seguirán requiriendo atención inmediata.',
        status: 'ACTIVE',
        sourceIds: ['operations-prediction-next-attention'],
      },
    ],
  },
  {
    target: 'finance',
    label: 'Finanzas',
    objective: 'Controlar resultado operativo, caja estimada, cartera y disciplina de cierre.',
    capabilities: [
      {
        id: 'finance-kpis',
        target: 'finance',
        type: 'KPI',
        title: 'KPIs de resultado, caja y cartera',
        description: 'Resultado operativo, flujo neto estimado y cartera visible para lectura financiera rápida.',
        status: 'ACTIVE',
        sourceIds: ['finance-kpi-operating-result', 'finance-kpi-net-cashflow', 'finance-kpi-receivables'],
      },
      {
        id: 'finance-cashflow-forecast',
        target: 'finance',
        type: 'PREDICTION',
        title: 'Pronóstico de flujo de caja',
        description: 'Estimación heurística del flujo neto del siguiente periodo comparable considerando tendencia, cartera y cuentas por pagar.',
        status: 'ACTIVE',
        sourceIds: ['finance-prediction-next-pressure'],
      },
    ],
  },
]

export function listOfficialBICatalog() {
  return BI_OFFICIAL_CATALOG
}