import { ModuleKey } from '@prisma/client'
import { DASHBOARD_NAV_CATALOG } from '@/lib/product-architecture'
import type { RbacV2Domain } from '@/lib/rbac-v2-catalog'

type CapabilityRef = {
  domain: RbacV2Domain
  subdomain: string
}

export type DashboardPermissionRule = {
  key: string
  moduleKey: ModuleKey
  section: string
  label: string
  hrefs: string[]
  capabilities: CapabilityRef[]
}

type BuildPermissionEntriesArgs = {
  t?: ((key: string) => string) | null
}

export const DASHBOARD_PERMISSION_RULES: DashboardPermissionRule[] = [
  {
    key: 'CORE.DASHBOARD',
    moduleKey: ModuleKey.DASHBOARD,
    section: 'Inicio',
    label: 'Dashboard',
    hrefs: ['/dashboard', '/dashboard/mapa-producto', '/dashboard/plantillas'],
    capabilities: [{ domain: 'CORE', subdomain: 'DASHBOARD' }],
  },
  {
    key: 'CORE.NOTIFICATIONS',
    moduleKey: ModuleKey.NOTIFICACIONES,
    section: 'Inicio',
    label: 'Notificaciones',
    hrefs: ['/dashboard/notificaciones', '/dashboard/notificaciones/crear'],
    capabilities: [{ domain: 'CORE', subdomain: 'DASHBOARD' }],
  },
  {
    key: 'CAPTACION.OPPORTUNITIES',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Frente comercial',
    hrefs: ['/dashboard/crm', '/dashboard/crm/oportunidades'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'OPPORTUNITIES' }],
  },
  {
    key: 'CAPTACION.INBOX',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Inbox omnicanal',
    hrefs: ['/dashboard/crm/conversations'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'INBOX' }],
  },
  {
    key: 'CAPTACION.AGENDA',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Agenda CRM',
    hrefs: ['/dashboard/crm/agenda'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'AGENDA' }],
  },
  {
    key: 'IA.COMMERCIAL_AI',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Chatbot e IA comercial',
    hrefs: ['/dashboard/crm/chatbot', '/dashboard/crm/auditoria-ia'],
    capabilities: [{ domain: 'IA', subdomain: 'COMMERCIAL_AI' }],
  },
  {
    key: 'OPERACIONES.FILES',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Administrador de archivos',
    hrefs: ['/dashboard/crm/archivos'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'FILES' }],
  },
  {
    key: 'CAPTACION.CHANNELS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Canales e integraciones',
    hrefs: ['/dashboard/crm/integraciones'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'CHANNELS' }],
  },
  {
    key: 'CAPTACION.LEADS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Captación',
    hrefs: ['/dashboard/crm/leads'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'LEADS' }],
  },
  {
    key: 'CAPTACION.COMMERCIAL_TASKS',
    moduleKey: ModuleKey.CRM,
    section: 'Captación',
    label: 'Tareas',
    hrefs: ['/dashboard/crm/tareas'],
    capabilities: [{ domain: 'CAPTACION', subdomain: 'COMMERCIAL_TASKS' }],
  },
  {
    key: 'VENTAS.CUSTOMERS',
    moduleKey: ModuleKey.CLIENTES,
    section: 'Ventas',
    label: 'Clientes',
    hrefs: ['/dashboard/clientes'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'CUSTOMERS' }],
  },
  {
    key: 'VENTAS.QUOTER',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'Ventas',
    label: 'Cotizador',
    hrefs: ['/dashboard/cotizador'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'QUOTER' }],
  },
  {
    key: 'VENTAS.QUOTES',
    moduleKey: ModuleKey.COTIZACIONES,
    section: 'Ventas',
    label: 'Cotizaciones',
    hrefs: ['/dashboard/cotizaciones'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'QUOTES' }],
  },
  {
    key: 'VENTAS.DELIVERY_NOTES',
    moduleKey: ModuleKey.REMISIONES,
    section: 'Ventas',
    label: 'Remisiones',
    hrefs: ['/dashboard/remisiones'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'DELIVERY_NOTES' }],
  },
  {
    key: 'VENTAS.POS',
    moduleKey: ModuleKey.POS,
    section: 'Ventas',
    label: 'Facturación POS',
    hrefs: ['/dashboard/pos'],
    capabilities: [{ domain: 'VENTAS', subdomain: 'POS' }],
  },
  {
    key: 'OPERACIONES.WORK_ORDERS',
    moduleKey: ModuleKey.ORDENES,
    section: 'Operaciones',
    label: 'Órdenes de trabajo',
    hrefs: ['/dashboard/ordenes', '/dashboard/litografia'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'WORK_ORDERS' }],
  },
  {
    key: 'OPERACIONES.TASK_WORKSPACES',
    moduleKey: ModuleKey.ORDENES,
    section: 'Operaciones',
    label: 'Espacios de trabajo',
    hrefs: ['/dashboard/espacios-trabajo'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'TASK_WORKSPACES' }],
  },
  {
    key: 'OPERACIONES.INTERNAL_CHAT',
    moduleKey: ModuleKey.ORDENES,
    section: 'Operaciones',
    label: 'Chat global',
    hrefs: ['/dashboard/chat'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'INTERNAL_CHAT' }],
  },
  {
    key: 'OPERACIONES.DOCUMENT_CAPTURE',
    moduleKey: ModuleKey.ESCANEOS,
    section: 'Operaciones',
    label: 'Escaneos',
    hrefs: ['/dashboard/escaneos'],
    capabilities: [{ domain: 'OPERACIONES', subdomain: 'DOCUMENT_CAPTURE' }],
  },
  {
    key: 'RECURSOS.PRODUCTS',
    moduleKey: ModuleKey.MATERIALES,
    section: 'Recursos',
    label: 'Productos',
    hrefs: ['/dashboard/productos'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'PRODUCTS' }],
  },
  {
    key: 'RECURSOS.MATERIALS',
    moduleKey: ModuleKey.MATERIALES,
    section: 'Recursos',
    label: 'Materiales',
    hrefs: ['/dashboard/materiales', '/dashboard/terminados'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'MATERIALS' }],
  },
  {
    key: 'RECURSOS.INVENTORY',
    moduleKey: ModuleKey.INVENTARIO,
    section: 'Recursos',
    label: 'Inventario',
    hrefs: ['/dashboard/inventario', '/dashboard/bodegas'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'INVENTORY' }],
  },
  {
    key: 'RECURSOS.TRANSFERS',
    moduleKey: ModuleKey.INVENTARIO,
    section: 'Recursos',
    label: 'Traslados',
    hrefs: ['/dashboard/inventario/traslados'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'TRANSFERS' }],
  },
  {
    key: 'RECURSOS.PURCHASES',
    moduleKey: ModuleKey.COMPRAS,
    section: 'Recursos',
    label: 'Compras',
    hrefs: ['/dashboard/compras'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'PURCHASES' }],
  },
  {
    key: 'RECURSOS.SUPPLIERS',
    moduleKey: ModuleKey.PROVEEDORES,
    section: 'Recursos',
    label: 'Proveedores',
    hrefs: ['/dashboard/proveedores'],
    capabilities: [{ domain: 'RECURSOS', subdomain: 'SUPPLIERS' }],
  },
  {
    key: 'FINANZAS.ACCOUNTING',
    moduleKey: ModuleKey.CONTABILIDAD,
    section: 'Finanzas',
    label: 'Contabilidad',
    hrefs: ['/dashboard/contabilidad'],
    capabilities: [{ domain: 'FINANZAS', subdomain: 'ACCOUNTING' }],
  },
  {
    key: 'FINANZAS.PAYROLL',
    moduleKey: ModuleKey.CONTABILIDAD,
    section: 'Finanzas',
    label: 'Nómina',
    hrefs: ['/dashboard/contabilidad/nomina'],
    capabilities: [{ domain: 'FINANZAS', subdomain: 'PAYROLL' }],
  },
  {
    key: 'ANALITICA.REPORTS',
    moduleKey: ModuleKey.REPORTES,
    section: 'Analítica',
    label: 'Reportes',
    hrefs: ['/dashboard/reportes'],
    capabilities: [{ domain: 'ANALITICA', subdomain: 'REPORTS' }],
  },
  {
    key: 'ANALITICA.AUDITS',
    moduleKey: ModuleKey.REPORTES,
    section: 'Analítica',
    label: 'Auditorías',
    hrefs: ['/dashboard/litografia/auditoria-ia'],
    capabilities: [{ domain: 'ANALITICA', subdomain: 'AUDITS' }],
  },
  {
    key: 'IA.OPERATIONAL_AI',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'IA',
    label: 'Conocimiento IA',
    hrefs: ['/dashboard/litografia/conocimiento-ia'],
    capabilities: [{ domain: 'IA', subdomain: 'OPERATIONAL_AI' }],
  },
  {
    key: 'IA.CREATIVE_AI',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'IA',
    label: 'IA creativa',
    hrefs: ['/dashboard/litografia/imagenes-ia', '/dashboard/imagenes-ia', '/dashboard/imagenes-ia/generador', '/dashboard/imagenes-ia/vectorizador'],
    capabilities: [{ domain: 'IA', subdomain: 'CREATIVE_AI' }],
  },
  {
    key: 'VERTICALES.RESTAURANTE',
    moduleKey: ModuleKey.POS,
    section: 'Verticales',
    label: 'Restaurante',
    hrefs: ['/dashboard/restaurante'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'RESTAURANTE' }],
  },
  {
    key: 'VERTICALES.ODONTOLOGIA',
    moduleKey: ModuleKey.CLIENTES,
    section: 'Verticales',
    label: 'Odontología',
    hrefs: ['/dashboard/odontologia'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'ODONTOLOGIA' }],
  },
  {
    key: 'VERTICALES.DOTACIONES',
    moduleKey: ModuleKey.COTIZADOR,
    section: 'Verticales',
    label: 'Dotaciones',
    hrefs: ['/dashboard/dotaciones'],
    capabilities: [{ domain: 'VERTICALES', subdomain: 'DOTACIONES' }],
  },
  {
    key: 'CORE.COMPANY',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Empresa y sedes',
    hrefs: ['/dashboard/configuracion/empresa', '/dashboard/configuracion/sedes'],
    capabilities: [{ domain: 'CORE', subdomain: 'COMPANY' }],
  },
  {
    key: 'CORE.USERS',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Usuarios',
    hrefs: ['/dashboard/configuracion/usuarios'],
    capabilities: [{ domain: 'CORE', subdomain: 'USERS' }],
  },
  {
    key: 'CORE.WEB_SERVICES',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Servicios web',
    hrefs: ['/dashboard/configuracion/servicios-web'],
    capabilities: [{ domain: 'CORE', subdomain: 'WEB_SERVICES' }],
  },
  {
    key: 'CORE.PLANS',
    moduleKey: ModuleKey.CONFIG,
    section: 'Plataforma',
    label: 'Plan',
    hrefs: ['/dashboard/configuracion/plan'],
    capabilities: [{ domain: 'CORE', subdomain: 'PLANS' }],
  },
]

export function buildDashboardPermissionEntries(args: BuildPermissionEntriesArgs = {}) {
  const labelByHref = new Map(
    DASHBOARD_NAV_CATALOG.map((item) => [item.href, args.t && item.labelKey ? args.t(item.labelKey) : item.label])
  )

  return DASHBOARD_PERMISSION_RULES.map((rule) => ({
    ...rule,
    includeLabels: rule.hrefs.map((href) => labelByHref.get(href) ?? href),
  }))
}