export type GanttTemplateItem = {
  key: string
  title: string
  parentKey?: string
  offsetDays: number
  durationDays: number
  isMilestone?: boolean
  colorHex: string
}

export type GanttPlanTemplate = {
  id: string
  name: string
  sector: string
  description: string
  colorHex: string
  items: GanttTemplateItem[]
}

export const GANTT_PLAN_TEMPLATES: GanttPlanTemplate[] = [
  {
    id: 'SALES_B2B',
    name: 'Proceso comercial B2B',
    sector: 'Ventas',
    description: 'Prospección, diagnóstico, propuesta, negociación y cierre comercial.',
    colorHex: '#0F766E',
    items: [
      { key: 'discovery', title: 'Descubrimiento y calificación', offsetDays: 0, durationDays: 5, colorHex: '#0F766E' },
      { key: 'research', title: 'Investigar cuenta y decisores', parentKey: 'discovery', offsetDays: 0, durationDays: 2, colorHex: '#14B8A6' },
      { key: 'meeting', title: 'Reunión de diagnóstico', parentKey: 'discovery', offsetDays: 3, durationDays: 1, colorHex: '#14B8A6' },
      { key: 'proposal', title: 'Construcción de propuesta', offsetDays: 5, durationDays: 5, colorHex: '#2563EB' },
      { key: 'review', title: 'Validación técnica y financiera', parentKey: 'proposal', offsetDays: 5, durationDays: 3, colorHex: '#60A5FA' },
      { key: 'send', title: 'Propuesta enviada', parentKey: 'proposal', offsetDays: 9, durationDays: 1, isMilestone: true, colorHex: '#2563EB' },
      { key: 'negotiation', title: 'Negociación y ajustes', offsetDays: 10, durationDays: 7, colorHex: '#D97706' },
      { key: 'close', title: 'Cierre comercial', offsetDays: 17, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
    ],
  },
  {
    id: 'SOFTWARE_PROJECT',
    name: 'Desarrollo de software',
    sector: 'Tecnología',
    description: 'Descubrimiento, diseño, desarrollo, QA, despliegue y estabilización.',
    colorHex: '#2563EB',
    items: [
      { key: 'planning', title: 'Descubrimiento y alcance', offsetDays: 0, durationDays: 7, colorHex: '#2563EB' },
      { key: 'requirements', title: 'Historias de usuario y criterios', parentKey: 'planning', offsetDays: 0, durationDays: 4, colorHex: '#60A5FA' },
      { key: 'architecture', title: 'Arquitectura y plan técnico', parentKey: 'planning', offsetDays: 4, durationDays: 3, colorHex: '#60A5FA' },
      { key: 'design', title: 'Diseño UX/UI', offsetDays: 5, durationDays: 10, colorHex: '#7C3AED' },
      { key: 'development', title: 'Desarrollo', offsetDays: 12, durationDays: 20, colorHex: '#0F766E' },
      { key: 'frontend', title: 'Frontend', parentKey: 'development', offsetDays: 12, durationDays: 16, colorHex: '#14B8A6' },
      { key: 'backend', title: 'Backend e integraciones', parentKey: 'development', offsetDays: 12, durationDays: 18, colorHex: '#0D9488' },
      { key: 'qa', title: 'QA y pruebas de aceptación', offsetDays: 28, durationDays: 8, colorHex: '#D97706' },
      { key: 'release', title: 'Salida a producción', offsetDays: 36, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
      { key: 'stabilization', title: 'Estabilización', offsetDays: 37, durationDays: 5, colorHex: '#64748B' },
    ],
  },
  {
    id: 'MARKETING_CAMPAIGN',
    name: 'Campaña de marketing',
    sector: 'Marketing',
    description: 'Estrategia, producción de contenidos, pauta, lanzamiento y optimización.',
    colorHex: '#BE123C',
    items: [
      { key: 'strategy', title: 'Estrategia de campaña', offsetDays: 0, durationDays: 5, colorHex: '#BE123C' },
      { key: 'audience', title: 'Audiencia y propuesta de valor', parentKey: 'strategy', offsetDays: 0, durationDays: 3, colorHex: '#FB7185' },
      { key: 'channels', title: 'Canales, presupuesto y KPI', parentKey: 'strategy', offsetDays: 2, durationDays: 3, colorHex: '#FB7185' },
      { key: 'creative', title: 'Producción creativa', offsetDays: 5, durationDays: 10, colorHex: '#7C3AED' },
      { key: 'copy', title: 'Copys y piezas', parentKey: 'creative', offsetDays: 5, durationDays: 6, colorHex: '#A78BFA' },
      { key: 'landing', title: 'Landing y analítica', parentKey: 'creative', offsetDays: 8, durationDays: 7, colorHex: '#8B5CF6' },
      { key: 'approval', title: 'Aprobación de campaña', offsetDays: 15, durationDays: 1, isMilestone: true, colorHex: '#D97706' },
      { key: 'launch', title: 'Lanzamiento', offsetDays: 16, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
      { key: 'optimization', title: 'Monitoreo y optimización', offsetDays: 17, durationDays: 14, colorHex: '#0F766E' },
      { key: 'report', title: 'Informe de resultados', offsetDays: 31, durationDays: 3, colorHex: '#334155' },
    ],
  },
  {
    id: 'ERP_IMPLEMENTATION',
    name: 'Implementación ERP',
    sector: 'Consultoría',
    description: 'Diagnóstico, parametrización, migración, capacitación y puesta en marcha.',
    colorHex: '#7C3AED',
    items: [
      { key: 'diagnosis', title: 'Diagnóstico de procesos', offsetDays: 0, durationDays: 8, colorHex: '#7C3AED' },
      { key: 'setup', title: 'Parametrización', offsetDays: 8, durationDays: 15, colorHex: '#2563EB' },
      { key: 'migration', title: 'Preparación y migración de datos', offsetDays: 15, durationDays: 12, colorHex: '#0F766E' },
      { key: 'integrations', title: 'Integraciones', offsetDays: 18, durationDays: 12, colorHex: '#0891B2' },
      { key: 'uat', title: 'Pruebas con usuarios', offsetDays: 30, durationDays: 7, colorHex: '#D97706' },
      { key: 'training', title: 'Capacitación', offsetDays: 34, durationDays: 5, colorHex: '#EA580C' },
      { key: 'go-live', title: 'Puesta en marcha', offsetDays: 40, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
      { key: 'support', title: 'Acompañamiento inicial', offsetDays: 41, durationDays: 10, colorHex: '#64748B' },
    ],
  },
  {
    id: 'EVENT_PRODUCTION',
    name: 'Producción de evento',
    sector: 'Eventos',
    description: 'Concepto, proveedores, comunicación, montaje, ejecución y cierre.',
    colorHex: '#D97706',
    items: [
      { key: 'concept', title: 'Concepto, alcance y presupuesto', offsetDays: 0, durationDays: 5, colorHex: '#D97706' },
      { key: 'suppliers', title: 'Contratación de proveedores', offsetDays: 5, durationDays: 10, colorHex: '#2563EB' },
      { key: 'communications', title: 'Convocatoria y comunicaciones', offsetDays: 8, durationDays: 18, colorHex: '#BE123C' },
      { key: 'logistics', title: 'Logística y producción', offsetDays: 15, durationDays: 12, colorHex: '#0F766E' },
      { key: 'setup', title: 'Montaje', offsetDays: 27, durationDays: 2, colorHex: '#7C3AED' },
      { key: 'event', title: 'Evento', offsetDays: 29, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
      { key: 'closure', title: 'Desmontaje y cierre', offsetDays: 30, durationDays: 3, colorHex: '#64748B' },
    ],
  },
  {
    id: 'CREATIVE_PROJECT',
    name: 'Proyecto creativo',
    sector: 'Diseño',
    description: 'Brief, concepto, diseño, revisión, artes finales y entrega.',
    colorHex: '#C026D3',
    items: [
      { key: 'brief', title: 'Brief y referencias', offsetDays: 0, durationDays: 3, colorHex: '#C026D3' },
      { key: 'concept', title: 'Conceptualización', offsetDays: 3, durationDays: 5, colorHex: '#7C3AED' },
      { key: 'proposal', title: 'Propuesta visual', offsetDays: 8, durationDays: 6, colorHex: '#2563EB' },
      { key: 'review', title: 'Revisión con cliente', offsetDays: 14, durationDays: 1, isMilestone: true, colorHex: '#D97706' },
      { key: 'adjustments', title: 'Ajustes', offsetDays: 15, durationDays: 5, colorHex: '#EA580C' },
      { key: 'approval', title: 'Aprobación final', offsetDays: 20, durationDays: 1, isMilestone: true, colorHex: '#16A34A' },
      { key: 'delivery', title: 'Artes finales y entrega', offsetDays: 21, durationDays: 3, colorHex: '#334155' },
    ],
  },
]

export function getGanttPlanTemplate(templateId: string) {
  return GANTT_PLAN_TEMPLATES.find((template) => template.id === templateId) ?? null
}
