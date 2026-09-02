import type { ModuleKey } from '@prisma/client'

export const BUSINESS_TYPES = [
  'ODONTOLOGIA',
  'RESTAURANTE',
  'ABOGADOS',
  'CLINICA',
  'CONTABILIDAD',
  'DOTACIONES',
  'LITOGRAFIA',
  'COMERCIO',
  'SERVICIOS',
] as const

export const RESTRICTED_SELF_ONBOARDING_BUSINESS_TYPES = [
  'ODONTOLOGIA',
  'RESTAURANTE',
  'DOTACIONES',
] as const

export const OPTIONAL_ADDONS = ['CRM', 'CONTABILIDAD', 'NOMINA'] as const

export const ONBOARDING_GOALS = [
  'SALES_PIPELINE',
  'OPERATIONS',
  'POINT_OF_SALE',
  'FINANCIAL_CONTROL',
  'CUSTOMER_FOLLOWUP',
] as const

export const SALES_MODELS = ['PRODUCTS', 'SERVICES', 'MIXED'] as const

export const WORKFLOW_NEEDS = ['APPOINTMENTS', 'INVENTORY', 'BILLING', 'ACCOUNTING', 'PRODUCTION'] as const

export const TEAM_SIZES = ['SOLO', 'SMALL', 'MEDIUM', 'LARGE'] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]
export type SalesModel = (typeof SALES_MODELS)[number]
export type WorkflowNeed = (typeof WORKFLOW_NEEDS)[number]
export type TeamSize = (typeof TEAM_SIZES)[number]
export type OptionalAddon = (typeof OPTIONAL_ADDONS)[number]

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value)
}

export type OnboardingAddonDefinition = {
  id: OptionalAddon
  title: string
  description: string
  helperText: string
  monthlyPriceCOP: number
  competitiveNote: string
  businessFit: Partial<Record<BusinessType, string>>
  modules: ModuleKey[]
}

export type BusinessOnboardingProfile = {
  heroTitle: string
  heroDescription: string
  priorityPrompt: string
  operationsPrompt: string
  addonsTitle: string
  addonsDescription: string
}

export type CompanyOnboardingData = {
  businessType: BusinessType
  primaryGoal: OnboardingGoal
  primaryGoals: OnboardingGoal[]
  salesModel: SalesModel
  workflowNeeds: WorkflowNeed[]
  teamSize: TeamSize
  optionalAddons: OptionalAddon[]
  notes: string
}

export type DashboardConfig = {
  headline: string
  description: string
  prioritizedHrefs: string[]
  allowedHrefs: string[]
  checklist: string[]
}

export type CompanyPreset = {
  modules: ModuleKey[]
  dashboard: DashboardConfig
}

const DEFAULT_MODULES: ModuleKey[] = ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES']

const MODULE_DEFAULT_HREF: Partial<Record<ModuleKey, string>> = {
  DASHBOARD: '/dashboard',
  COTIZADOR: '/dashboard/cotizador',
  COTIZACIONES: '/dashboard/cotizaciones',
  CLIENTES: '/dashboard/clientes',
  CRM: '/dashboard/crm',
  MATERIALES: '/dashboard/productos',
  INVENTARIO: '/dashboard/inventario',
  REMISIONES: '/dashboard/remisiones',
  POS: '/dashboard/pos',
  PROVEEDORES: '/dashboard/proveedores',
  COMPRAS: '/dashboard/compras',
  ORDENES: '/dashboard/ordenes',
  ESCANEOS: '/dashboard/escaneos',
  REPORTES: '/dashboard/reportes',
  CONTABILIDAD: '/dashboard/contabilidad',
  CONFIG: '/dashboard/configuracion/empresa',
}

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  ODONTOLOGIA: 'Odontología',
  RESTAURANTE: 'Restaurante',
  ABOGADOS: 'Abogados',
  CLINICA: 'Clínica',
  CONTABILIDAD: 'Contabilidad',
  DOTACIONES: 'Dotaciones',
  LITOGRAFIA: 'Litografía',
  COMERCIO: 'Comercio',
  SERVICIOS: 'Servicios profesionales',
}

const BUSINESS_TYPE_CARD_DESCRIPTIONS: Record<BusinessType, string> = {
  ODONTOLOGIA: 'Historia clínica, agenda, pacientes y flujo clínico base.',
  RESTAURANTE: 'Caja, inventario, compras y ritmo operativo diario.',
  ABOGADOS: 'Clientes, seguimiento de casos y operación de servicios profesionales.',
  CLINICA: 'Atención, pacientes y facturación de servicios de salud.',
  CONTABILIDAD: 'Cierres, cartera, reportes y operación financiera formal.',
  DOTACIONES: 'Cotización, pedidos, inventario y entregas para dotaciones.',
  LITOGRAFIA: 'Cotización, preprensa y producción litográfica con apoyo de IA.',
  COMERCIO: 'Venta, cobro, inventario y entregas para retail o distribución.',
  SERVICIOS: 'Cotización, clientes y operación ligera de servicios.',
}

const BUSINESS_ONBOARDING_PROFILES: Record<BusinessType, BusinessOnboardingProfile> = {
  ODONTOLOGIA: {
    heroTitle: 'Configura una operación clínica sin ruido',
    heroDescription: 'Priorizamos agenda, pacientes, odontograma y cobro clínico. Solo se muestran frentes que sí sirven para odontología.',
    priorityPrompt: '¿Qué debe quedar más fuerte en tu arranque clínico?',
    operationsPrompt: 'Ajusta cómo atiende tu consultorio desde el primer día.',
    addonsTitle: 'Amplía odontología solo donde sí paga retorno',
    addonsDescription: 'CRM, contabilidad y nómina aparecen como capas opcionales con precios reales del catálogo y foco en retorno por consulta, recaudo y seguimiento.',
  },
  RESTAURANTE: {
    heroTitle: 'Activa una operación rápida para servicio diario',
    heroDescription: 'Dejamos caja, inventario, compras y clientes listos para el ritmo del punto de venta.',
    priorityPrompt: '¿Qué frente manda hoy en tu restaurante?',
    operationsPrompt: 'Define el ritmo base de servicio, reposición y control.',
    addonsTitle: 'Suma solo lo que acelera ventas y control',
    addonsDescription: 'Los addons se presentan apagados para no recargar la operación. Puedes sumarlos si necesitas más control comercial o financiero.',
  },
  ABOGADOS: {
    heroTitle: 'Organiza casos y clientes desde un frente limpio',
    heroDescription: 'Dejamos visible solo lo que necesita un despacho: clientes, seguimiento y propuestas.',
    priorityPrompt: '¿Cuál es la prioridad operativa del despacho?',
    operationsPrompt: 'Ajusta cómo trabajará tu equipo entre clientes, casos y seguimiento.',
    addonsTitle: 'Activa módulos de expansión solo si aportan control',
    addonsDescription: 'El frente comercial y financiero se mantiene opcional para no contaminar la operación legal.',
  },
  CLINICA: {
    heroTitle: 'Ordena la atención clínica y el recaudo inicial',
    heroDescription: 'Mostramos una base enfocada en pacientes, atención y facturación, sin módulos ajenos al flujo clínico.',
    priorityPrompt: '¿Qué debe resolverse primero en la clínica?',
    operationsPrompt: 'Ajusta atención, citas y control operativo de base.',
    addonsTitle: 'Añade control comercial o financiero cuando ya haga falta',
    addonsDescription: 'Los addons se mantienen opcionales para que la clínica arranque simple y luego crezca por etapas.',
  },
  CONTABILIDAD: {
    heroTitle: 'Configura un frente financiero listo para operar',
    heroDescription: 'Priorizamos cartera, contabilidad, reportes y control de clientes para una operación contable seria.',
    priorityPrompt: '¿Dónde debe quedar el foco del equipo contable?',
    operationsPrompt: 'Ajusta cómo atenderás clientes, cierres y capacidad del equipo.',
    addonsTitle: 'Expande solo lo que sume prospección o coordinación',
    addonsDescription: 'Como contabilidad ya hace parte del núcleo, aquí priorizamos addons que mejoren seguimiento comercial y coordinación extendida.',
  },
  DOTACIONES: {
    heroTitle: 'Arma una operación de cotización a entrega',
    heroDescription: 'Cotizador, inventario, compras y remisiones quedan alineados para una venta con trazabilidad real.',
    priorityPrompt: '¿Qué parte del flujo necesita quedar mejor resuelta?',
    operationsPrompt: 'Define cómo venderás, comprarás y entregarás desde el arranque.',
    addonsTitle: 'Amplía seguimiento y control solo si tu ciclo lo pide',
    addonsDescription: 'Los precios se muestran claros para que elijas addons por utilidad real, no por paquete inflado.',
  },
  LITOGRAFIA: {
    heroTitle: 'Activa un frente litográfico listo para cotizar y producir',
    heroDescription: 'Priorizamos cotización litográfica, pedidos, producción y apoyo con IA sin mezclar módulos que no aportan al taller.',
    priorityPrompt: '¿Qué debe quedar más fuerte en tu arranque litográfico?',
    operationsPrompt: 'Ajusta cómo cotizarás, producirás y coordinarás el trabajo desde el primer día.',
    addonsTitle: 'Amplía la litografía solo cuando mejore cierre o control',
    addonsDescription: 'CRM, contabilidad y nómina se ofrecen como capas opcionales para crecer sin inflar el espacio base.',
  },
  COMERCIO: {
    heroTitle: 'Prepara una operación comercial ágil y visible',
    heroDescription: 'Dejamos POS, inventario, compras y remisiones listos para rotación diaria y control básico.',
    priorityPrompt: '¿Qué debe dominar primero en tu operación comercial?',
    operationsPrompt: 'Ajusta venta, stock y capacidad operativa del equipo.',
    addonsTitle: 'Suma solo las capas que mejoren margen o seguimiento',
    addonsDescription: 'CRM y contabilidad aparecen con referencia de valor para que el crecimiento sea gradual y rentable.',
  },
  SERVICIOS: {
    heroTitle: 'Configura un frente liviano para vender y ejecutar',
    heroDescription: 'Mostramos solo clientes, cotizador y cotizaciones para que el equipo arranque rápido.',
    priorityPrompt: '¿Qué debe quedar resuelto primero en tu servicio?',
    operationsPrompt: 'Define cómo venderás, atenderás y escalarás tu servicio.',
    addonsTitle: 'Añade seguimiento o control financiero cuando ya lo necesites',
    addonsDescription: 'Los addons quedan apagados por defecto para mantener un inicio limpio y competitivo.',
  },
}

const GOAL_LABELS: Record<OnboardingGoal, string> = {
  SALES_PIPELINE: 'vender y hacer seguimiento comercial',
  OPERATIONS: 'organizar la operación diaria',
  POINT_OF_SALE: 'facturar y cobrar rápido',
  FINANCIAL_CONTROL: 'tener control financiero',
  CUSTOMER_FOLLOWUP: 'centralizar clientes y agenda',
}

const COMMON_ALLOWED_HREFS = [
  '/dashboard',
  '/dashboard/perfil',
  '/dashboard/notificaciones',
  '/dashboard/ayuda',
  '/dashboard/reportes',
  '/dashboard/configuracion/empresa',
  '/dashboard/configuracion/usuarios',
  '/dashboard/configuracion/sedes',
  '/dashboard/configuracion/plan',
] as const

const BUSINESS_TYPE_CORE_MODULES: Record<BusinessType, ModuleKey[]> = {
  ODONTOLOGIA: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'CLIENTES', 'POS'],
  RESTAURANTE: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'POS', 'CLIENTES', 'INVENTARIO', 'COMPRAS', 'PROVEEDORES'],
  ABOGADOS: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'CLIENTES', 'COTIZACIONES'],
  CLINICA: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'CLIENTES', 'POS'],
  CONTABILIDAD: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'CLIENTES', 'CONTABILIDAD'],
  DOTACIONES: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'INVENTARIO', 'COMPRAS', 'PROVEEDORES', 'REMISIONES'],
  LITOGRAFIA: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES', 'ORDENES', 'ESCANEOS', 'MATERIALES'],
  COMERCIO: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'POS', 'CLIENTES', 'INVENTARIO', 'COMPRAS', 'PROVEEDORES', 'REMISIONES'],
  SERVICIOS: ['DASHBOARD', 'CONFIG', 'NOTIFICACIONES', 'REPORTES', 'COTIZADOR', 'COTIZACIONES', 'CLIENTES'],
}

const BUSINESS_TYPE_ALLOWED_HREFS: Record<BusinessType, string[]> = {
  ODONTOLOGIA: ['/dashboard/clientes', '/dashboard/odontologia', '/dashboard/pos'],
  RESTAURANTE: ['/dashboard/restaurante', '/dashboard/pos', '/dashboard/clientes', '/dashboard/inventario', '/dashboard/inventario/abastecimiento', '/dashboard/compras', '/dashboard/proveedores'],
  ABOGADOS: ['/dashboard/clientes', '/dashboard/cotizaciones'],
  CLINICA: ['/dashboard/clientes', '/dashboard/pos'],
  CONTABILIDAD: ['/dashboard/clientes', '/dashboard/contabilidad', '/dashboard/nomina'],
  DOTACIONES: ['/dashboard/dotaciones', '/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/clientes', '/dashboard/inventario', '/dashboard/inventario/abastecimiento', '/dashboard/compras', '/dashboard/proveedores', '/dashboard/remisiones'],
  LITOGRAFIA: ['/dashboard/litografia', '/dashboard/litografia/conocimiento-ia', '/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/clientes', '/dashboard/ordenes', '/dashboard/escaneos', '/dashboard/productos'],
  COMERCIO: ['/dashboard/pos', '/dashboard/clientes', '/dashboard/inventario', '/dashboard/inventario/abastecimiento', '/dashboard/compras', '/dashboard/proveedores', '/dashboard/remisiones'],
  SERVICIOS: ['/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/clientes'],
}

const BUSINESS_TYPE_PRIORITIES: Record<BusinessType, string[]> = {
  ODONTOLOGIA: ['/dashboard/odontologia', '/dashboard/clientes', '/dashboard/pos'],
  RESTAURANTE: ['/dashboard/restaurante', '/dashboard/pos', '/dashboard/inventario', '/dashboard/compras'],
  ABOGADOS: ['/dashboard/clientes', '/dashboard/cotizaciones'],
  CLINICA: ['/dashboard/clientes', '/dashboard/pos'],
  CONTABILIDAD: ['/dashboard/contabilidad', '/dashboard/nomina', '/dashboard/clientes'],
  DOTACIONES: ['/dashboard/dotaciones', '/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/remisiones'],
  LITOGRAFIA: ['/dashboard/litografia', '/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/ordenes'],
  COMERCIO: ['/dashboard/pos', '/dashboard/inventario', '/dashboard/remisiones'],
  SERVICIOS: ['/dashboard/cotizador', '/dashboard/cotizaciones', '/dashboard/clientes'],
}

const ADDON_DEFINITIONS: Record<OptionalAddon, OnboardingAddonDefinition> = {
  CRM: {
    id: 'CRM',
    title: 'CRM comercial',
    description: 'Activa embudo, agenda, tareas, conversaciones e inbox comercial cuando necesites más seguimiento.',
    helperText: 'Ideal si quieres seguimiento más fuerte de prospectos y clientes.',
    monthlyPriceCOP: 70000,
    competitiveNote: 'Precio competitivo frente a suites separadas de seguimiento y agenda.',
    businessFit: {
      ODONTOLOGIA: 'Útil para reactivar pacientes, recordar controles y dar seguimiento a tratamientos aceptados.',
      RESTAURANTE: 'Sirve si vendes eventos, reservas corporativas o convenios recurrentes.',
      ABOGADOS: 'Aporta seguimiento de prospectos, renovaciones y tareas previas al cierre.',
      CLINICA: 'Ayuda a sostener captación, recordatorios y seguimiento post atención.',
      CONTABILIDAD: 'Convierte el frente comercial en una tubería ordenada de prospectos y renovaciones.',
      DOTACIONES: 'Mejora el seguimiento de licitaciones, cotizaciones y cuentas clave.',
      COMERCIO: 'Sirve para mayoristas, cuentas B2B y clientes frecuentes.',
      SERVICIOS: 'Acelera seguimiento comercial cuando el cierre depende de varias conversaciones.',
    },
    modules: ['CRM'],
  },
  CONTABILIDAD: {
    id: 'CONTABILIDAD',
    title: 'Contabilidad',
    description: 'Activa comprobantes, reglas, cierres, reportes y control financiero formal.',
    helperText: 'Suma control contable completo al flujo del nicho.',
    monthlyPriceCOP: 85000,
    competitiveNote: 'Costo contenido para evitar pagar una suite financiera completa antes de necesitarla.',
    businessFit: {
      ODONTOLOGIA: 'Aterriza recaudo, egresos y cierre de caja clínica sin meter módulos ajenos al consultorio.',
      RESTAURANTE: 'Da más control sobre compras, caja y cierres cuando el volumen ya lo exige.',
      ABOGADOS: 'Formaliza ingresos, cartera y cierres sin duplicar trabajo fuera del despacho.',
      CLINICA: 'Ordena facturación clínica, cierres y trazabilidad financiera.',
      CONTABILIDAD: 'Ya hace parte del núcleo para este nicho.',
      DOTACIONES: 'Une ventas, compras y cierre financiero en un mismo flujo.',
      COMERCIO: 'Sirve cuando ya necesitas amarrar POS, inventario y cierre contable.',
      SERVICIOS: 'Permite pasar de operación ligera a control financiero formal sin cambiar de sistema.',
    },
    modules: ['CONTABILIDAD'],
  },
  NOMINA: {
    id: 'NOMINA',
    title: 'Nómina',
    description: 'Incluye gestión de empleados, periodos, novedades y liquidaciones.',
    helperText: 'Va dentro del bloque contabilidad y nómina; no se muestra como módulo aislado.',
    monthlyPriceCOP: 0,
    competitiveNote: 'Incluida dentro del bloque contable para no cobrar una capa aislada sin contexto.',
    businessFit: {
      ODONTOLOGIA: 'Conviene cuando pasas de uno o dos odontólogos a una operación con asistentes y especialistas.',
      RESTAURANTE: 'Útil para turnos, novedades y equipos con rotación.',
      ABOGADOS: 'Aplica cuando el despacho ya tiene estructura administrativa y pagos recurrentes.',
      CLINICA: 'Ayuda con equipos clínicos y administrativos en crecimiento.',
      CONTABILIDAD: 'Va incluida como parte natural del frente financiero.',
      DOTACIONES: 'Acompaña equipos de bodega, producción y comercial cuando el negocio escala.',
      COMERCIO: 'Tiene valor al crecer en vendedores, cajeros y auxiliares.',
      SERVICIOS: 'Sirve cuando el equipo deja de ser pequeño y ya requiere liquidación formal.',
    },
    modules: ['CONTABILIDAD'],
  },
}

const ADDON_ALLOWED_HREFS: Record<OptionalAddon, string[]> = {
  CRM: [
    '/dashboard/crm',
    '/dashboard/crm/agenda',
    '/dashboard/crm/archivos',
    '/dashboard/crm/chatbot',
    '/dashboard/crm/integraciones',
    '/dashboard/crm/leads',
    '/dashboard/crm/oportunidades',
    '/dashboard/crm/tareas',
    '/dashboard/espacios-trabajo',
    '/dashboard/chat',
  ],
  CONTABILIDAD: ['/dashboard/contabilidad', '/dashboard/nomina'],
  NOMINA: ['/dashboard/nomina'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function uniqueModules(modules: ModuleKey[]) {
  return Array.from(new Set(modules))
}

function addIfMissing(target: ModuleKey[], modules: ModuleKey[]) {
  const next = new Set(target)
  for (const moduleKey of modules) next.add(moduleKey)
  return Array.from(next)
}

export function getBusinessTypeLabel(value: BusinessType | null | undefined) {
  if (!value || !BUSINESS_TYPE_LABELS[value]) return 'Configuración personalizada'
  return BUSINESS_TYPE_LABELS[value]
}

export function getBusinessTypeCardDescription(value: BusinessType) {
  return BUSINESS_TYPE_CARD_DESCRIPTIONS[value]
}

export function getDefaultCompanyOnboardingData(): CompanyOnboardingData {
  return {
    businessType: 'SERVICIOS',
    primaryGoal: 'SALES_PIPELINE',
    primaryGoals: ['SALES_PIPELINE'],
    salesModel: 'SERVICES',
    workflowNeeds: [],
    teamSize: 'SOLO',
    optionalAddons: [],
    notes: '',
  }
}

export function getBusinessOnboardingProfile(businessType: BusinessType): BusinessOnboardingProfile {
  return BUSINESS_ONBOARDING_PROFILES[businessType]
}

export function getOptionalAddonDefinitions(businessType?: BusinessType): OnboardingAddonDefinition[] {
  const addons = OPTIONAL_ADDONS.map((addon) => ADDON_DEFINITIONS[addon])
  if (!businessType) return addons

  return addons.sort((left, right) => {
    const leftScore = left.businessFit[businessType] ? 1 : 0
    const rightScore = right.businessFit[businessType] ? 1 : 0
    return rightScore - leftScore
  })
}

export function parseCompanyOnboardingData(value: unknown): CompanyOnboardingData {
  const defaults = getDefaultCompanyOnboardingData()
  if (!isRecord(value)) return defaults

  const parsedPrimaryGoals = Array.isArray(value.primaryGoals)
    ? value.primaryGoals.filter((item): item is OnboardingGoal => typeof item === 'string' && (ONBOARDING_GOALS as readonly string[]).includes(item))
    : []
  const workflowNeeds = Array.isArray(value.workflowNeeds)
    ? value.workflowNeeds.filter((item): item is WorkflowNeed => typeof item === 'string' && (WORKFLOW_NEEDS as readonly string[]).includes(item))
    : []
  const optionalAddons = Array.isArray(value.optionalAddons)
    ? value.optionalAddons.filter((item): item is OptionalAddon => typeof item === 'string' && (OPTIONAL_ADDONS as readonly string[]).includes(item))
    : []

  const primaryGoal =
    typeof value.primaryGoal === 'string' && (ONBOARDING_GOALS as readonly string[]).includes(value.primaryGoal)
      ? (value.primaryGoal as OnboardingGoal)
      : parsedPrimaryGoals[0] ?? defaults.primaryGoal

  const primaryGoals = Array.from(new Set(parsedPrimaryGoals.length ? parsedPrimaryGoals : [primaryGoal]))

  return {
    businessType:
      typeof value.businessType === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value.businessType)
        ? (value.businessType as BusinessType)
        : defaults.businessType,
    primaryGoal,
    primaryGoals,
    salesModel:
      typeof value.salesModel === 'string' && (SALES_MODELS as readonly string[]).includes(value.salesModel)
        ? (value.salesModel as SalesModel)
        : defaults.salesModel,
    workflowNeeds,
    teamSize:
      typeof value.teamSize === 'string' && (TEAM_SIZES as readonly string[]).includes(value.teamSize)
        ? (value.teamSize as TeamSize)
        : defaults.teamSize,
    optionalAddons,
    notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 500) : '',
  }
}

export function resolveCompanyOnboardingData(value: unknown, fallbackBusinessType?: unknown): CompanyOnboardingData {
  const parsed = parseCompanyOnboardingData(value)
  if (!isBusinessType(fallbackBusinessType)) return parsed

  return {
    ...parsed,
    businessType: fallbackBusinessType,
  }
}

export function parseDashboardConfig(value: unknown): DashboardConfig | null {
  if (!isRecord(value)) return null
  const prioritizedHrefs = Array.isArray(value.prioritizedHrefs)
    ? value.prioritizedHrefs.filter((item): item is string => typeof item === 'string' && item.startsWith('/dashboard/'))
    : []
  const allowedHrefs = Array.isArray(value.allowedHrefs)
    ? value.allowedHrefs.filter((item): item is string => typeof item === 'string' && item.startsWith('/dashboard/'))
    : []
  const checklist = Array.isArray(value.checklist)
    ? value.checklist.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
    : []
  const headline = typeof value.headline === 'string' ? value.headline.trim() : ''
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  if (!headline && !description && !prioritizedHrefs.length && !checklist.length) return null
  return {
    headline: headline || 'Tu espacio ya está configurado',
    description: description || 'Ajustamos el inicio según las prioridades que indicaste.',
    prioritizedHrefs,
    allowedHrefs,
    checklist,
  }
}

export function resolveDashboardConfig(args: {
  dashboardConfig: unknown
  onboardingData: unknown
  businessType?: unknown
}): DashboardConfig | null {
  const parsed = parseDashboardConfig(args.dashboardConfig)
  if (parsed) return parsed
  if (!isBusinessType(args.businessType)) return null

  return buildCompanyPreset(resolveCompanyOnboardingData(args.onboardingData, args.businessType)).dashboard
}

export function buildCompanyPreset(data: CompanyOnboardingData): CompanyPreset {
  let modules = addIfMissing([...DEFAULT_MODULES], BUSINESS_TYPE_CORE_MODULES[data.businessType] ?? [])
  let allowedHrefs = [...COMMON_ALLOWED_HREFS, ...(BUSINESS_TYPE_ALLOWED_HREFS[data.businessType] ?? [])]
  const selectedGoals = data.primaryGoals.length ? data.primaryGoals : [data.primaryGoal]

  for (const addon of data.optionalAddons) {
    modules = addIfMissing(modules, ADDON_DEFINITIONS[addon].modules)
    allowedHrefs = [...allowedHrefs, ...(ADDON_ALLOWED_HREFS[addon] ?? [])]
  }

  const prioritizedHrefs = buildPrioritizedHrefs(data, modules)
  const dedupedAllowedHrefs = Array.from(new Set(allowedHrefs))

  return {
    modules: uniqueModules(modules),
    dashboard: {
      headline: `${getBusinessTypeLabel(data.businessType)} listo para comenzar`,
      description: `En 4 pasos armamos un inicio enfocado para ${formatGoalSummary(selectedGoals)} en un equipo ${getTeamSizeLabel(data.teamSize)}.`,
      prioritizedHrefs,
      allowedHrefs: dedupedAllowedHrefs,
      checklist: buildChecklist(data),
    },
  }
}

function buildPrioritizedHrefs(data: CompanyOnboardingData, modules: ModuleKey[]) {
  const basePriority = [...(BUSINESS_TYPE_PRIORITIES[data.businessType] ?? [])]
  const selectedGoals = data.primaryGoals.length ? data.primaryGoals : [data.primaryGoal]

  if (selectedGoals.includes('CUSTOMER_FOLLOWUP') && data.optionalAddons.includes('CRM')) {
    basePriority.unshift('/dashboard/crm', '/dashboard/crm/agenda')
  }
  if (selectedGoals.includes('FINANCIAL_CONTROL') && modules.includes('CONTABILIDAD')) {
    basePriority.unshift('/dashboard/contabilidad')
  }
  if (selectedGoals.includes('POINT_OF_SALE') && modules.includes('POS')) {
    basePriority.unshift('/dashboard/pos')
  }
  if (selectedGoals.includes('SALES_PIPELINE') && modules.includes('COTIZADOR')) {
    basePriority.unshift('/dashboard/cotizador', '/dashboard/cotizaciones')
  }
  if (data.workflowNeeds.includes('INVENTORY') && modules.includes('INVENTARIO')) {
    basePriority.push('/dashboard/inventario')
  }
  if (data.workflowNeeds.includes('ACCOUNTING') && modules.includes('CONTABILIDAD')) {
    basePriority.push('/dashboard/contabilidad', '/dashboard/nomina')
  }
  if (data.workflowNeeds.includes('APPOINTMENTS') && data.businessType === 'ODONTOLOGIA') {
    basePriority.unshift('/dashboard/odontologia')
  }

  const moduleHrefs = uniqueModules(modules)
    .map((moduleKey) => MODULE_DEFAULT_HREF[moduleKey])
    .filter((href): href is string => Boolean(href))

  return Array.from(new Set([...basePriority, ...moduleHrefs, '/dashboard']))
}

function buildChecklist(data: CompanyOnboardingData): string[] {
  const selectedGoals = data.primaryGoals.length ? data.primaryGoals : [data.primaryGoal]
  const checklist = [
    `Revisa el frente principal para ${formatGoalSummary(selectedGoals)}.`,
    data.salesModel === 'PRODUCTS'
      ? 'Carga catálogo, existencias y reglas base antes de operar.'
      : data.salesModel === 'SERVICES'
        ? 'Configura servicios, responsables y criterios de atención.'
        : 'Ajusta catálogo, servicios y reglas mixtas para arrancar.',
  ]

  if (data.workflowNeeds.includes('APPOINTMENTS')) checklist.push('Define agenda, responsables y tiempos de atención.')
  if (data.workflowNeeds.includes('INVENTORY')) checklist.push('Valida bodegas, proveedores y stock mínimo.')
  if (data.workflowNeeds.includes('ACCOUNTING')) checklist.push('Revisa cuentas, periodos y reglas contables antes de cerrar.')
  if (data.workflowNeeds.includes('PRODUCTION')) checklist.push('Conecta órdenes, escaneos y producción para tener trazabilidad.')
  if (data.optionalAddons.includes('CRM')) checklist.push('Activa y revisa el frente comercial ampliado con CRM.')
  if (data.optionalAddons.includes('CONTABILIDAD') || data.optionalAddons.includes('NOMINA')) checklist.push('Verifica el bloque financiero ampliado antes de cerrar el primer ciclo.')
  if (data.notes) checklist.push('Documenta tus reglas internas en configuración para el equipo.')

  return checklist.slice(0, 5)
}

function formatGoalSummary(goals: OnboardingGoal[]) {
  const labels = Array.from(new Set(goals.map((goal) => GOAL_LABELS[goal])))
  if (!labels.length) return GOAL_LABELS.SALES_PIPELINE
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

function getTeamSizeLabel(value: TeamSize) {
  switch (value) {
    case 'SOLO':
      return 'de una sola persona'
    case 'SMALL':
      return 'pequeño'
    case 'MEDIUM':
      return 'mediano'
    case 'LARGE':
      return 'grande'
  }
}