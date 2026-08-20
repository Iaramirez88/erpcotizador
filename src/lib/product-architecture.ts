export type ProductLayer =
  | 'Inicio'
  | 'Captación'
  | 'Ventas'
  | 'Operaciones'
  | 'Inventario'
  | 'Finanzas'
  | 'Analítica'
  | 'IA'
  | 'Verticales'
  | 'Administración'

export type DashboardSectionTitle =
  | 'Inicio'
  | 'Captación'
  | 'Ventas'
  | 'Operaciones'
  | 'Inventario'
  | 'Finanzas'
  | 'Analítica'
  | 'IA'
  | 'Verticales'
  | 'Administración'
  | 'Otros'

export type DashboardNavCatalogItem = {
  href: string
  label: string
  labelKey?: string
  section: DashboardSectionTitle
  layer: ProductLayer
  domain: string
  moduleKey: string | null
  onboardingScoped?: boolean
}

export const DASHBOARD_SECTION_ORDER: DashboardSectionTitle[] = [
  'Inicio',
  'Captación',
  'Ventas',
  'Operaciones',
  'Inventario',
  'Finanzas',
  'Analítica',
  'IA',
  'Verticales',
  'Administración',
  'Otros',
]

export const DASHBOARD_NAV_CATALOG: DashboardNavCatalogItem[] = [
  { href: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', section: 'Inicio', layer: 'Inicio', domain: 'Inicio', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/inteligencia', label: 'Inteligencia', section: 'Inicio', layer: 'Inicio', domain: 'Motor de inteligencia empresarial', moduleKey: 'REPORTES' },
  { href: '/dashboard/perfil', label: 'Mi perfil', labelKey: 'header.profile', section: 'Inicio', layer: 'Inicio', domain: 'Perfil de usuario', moduleKey: null },
  { href: '/dashboard/mapa-producto', label: 'Mapa de producto', section: 'Inicio', layer: 'Inicio', domain: 'Arquitectura de producto', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/plantillas', label: 'Plantillas', labelKey: 'nav.templates', section: 'Inicio', layer: 'Inicio', domain: 'Plantillas', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/notificaciones', label: 'Notificaciones', section: 'Administración', layer: 'Administración', domain: 'Mensajería transversal', moduleKey: 'NOTIFICACIONES' },
  { href: '/dashboard/notificaciones/crear', label: 'Crear notificación', section: 'Administración', layer: 'Administración', domain: 'Mensajería transversal', moduleKey: 'NOTIFICACIONES' },
  { href: '/dashboard/ayuda', label: 'Ayuda', section: 'Inicio', layer: 'Inicio', domain: 'Ayuda y documentación', moduleKey: null },

  { href: '/dashboard/crm', label: 'Frente comercial', section: 'Captación', layer: 'Captación', domain: 'CRM', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones', label: 'Negociaciones', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },
  { href: '/dashboard/crm/agenda', label: 'Calendario', section: 'Captación', layer: 'Captación', domain: 'Agenda', moduleKey: 'CRM' },
  { href: '/dashboard/crm/chatbot', label: 'Chatbot', section: 'Captación', layer: 'Captación', domain: 'Automatización conversacional', moduleKey: 'CRM' },
  { href: '/dashboard/crm/archivos', label: 'DRIVE', section: 'Captación', layer: 'Captación', domain: 'Drive comercial', moduleKey: 'CRM' },
  { href: '/dashboard/crm/integraciones', label: 'Canales e integraciones', section: 'Captación', layer: 'Captación', domain: 'Canales', moduleKey: 'CRM' },
  { href: '/dashboard/crm/leads', label: 'Captación', section: 'Captación', layer: 'Captación', domain: 'Leads', moduleKey: 'CRM' },
  { href: '/dashboard/crm/oportunidades', label: 'Pipeline', section: 'Captación', layer: 'Captación', domain: 'Oportunidades', moduleKey: 'CRM' },
  { href: '/dashboard/crm/tareas', label: 'Actividades', section: 'Captación', layer: 'Captación', domain: 'Tareas comerciales', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/pipeline', label: 'Pipeline', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/calendario', label: 'Calendario', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/actividades', label: 'Actividades', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },

  { href: '/dashboard/clientes', label: 'Clientes', labelKey: 'nav.clients', section: 'Ventas', layer: 'Ventas', domain: 'Clientes', moduleKey: 'CLIENTES' },
  { href: '/dashboard/cotizador', label: 'Cotizador', labelKey: 'nav.quote', section: 'Ventas', layer: 'Ventas', domain: 'Cotizador', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/cotizaciones', label: 'Cotizaciones', labelKey: 'nav.quotes', section: 'Ventas', layer: 'Ventas', domain: 'Cotizaciones', moduleKey: 'COTIZACIONES' },
  { href: '/dashboard/remisiones', label: 'Remisiones', labelKey: 'nav.deliveries', section: 'Ventas', layer: 'Ventas', domain: 'Remisiones', moduleKey: 'REMISIONES' },
  { href: '/dashboard/pos', label: 'Facturación', labelKey: 'nav.billing', section: 'Ventas', layer: 'Ventas', domain: 'Punto de venta', moduleKey: 'POS' },

  { href: '/dashboard/ordenes', label: 'Órdenes', labelKey: 'nav.orders', section: 'Operaciones', layer: 'Operaciones', domain: 'Órdenes de trabajo', moduleKey: 'ORDENES' },
  { href: '/dashboard/espacios-trabajo', label: 'Tareas y proyectos', section: 'Operaciones', layer: 'Operaciones', domain: 'Proyectos y trabajo', moduleKey: 'ORDENES' },
  { href: '/dashboard/chat', label: 'Conversaciones', section: 'Operaciones', layer: 'Operaciones', domain: 'Coordinación interna', moduleKey: 'ORDENES' },
  { href: '/dashboard/litografia', label: 'Litografía', labelKey: 'nav.printshop', section: 'Operaciones', layer: 'Operaciones', domain: 'Producción especializada', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/escaneos', label: 'Escaneos', labelKey: 'nav.scans', section: 'Operaciones', layer: 'Operaciones', domain: 'Captura documental', moduleKey: 'ESCANEOS' },

  { href: '/dashboard/productos', label: 'Productos', labelKey: 'nav.products', section: 'Inventario', layer: 'Inventario', domain: 'Productos', moduleKey: 'MATERIALES' },
  { href: '/dashboard/materiales', label: 'Materiales', section: 'Inventario', layer: 'Inventario', domain: 'Materiales', moduleKey: 'MATERIALES' },
  { href: '/dashboard/terminados', label: 'Terminados', section: 'Inventario', layer: 'Inventario', domain: 'Terminados', moduleKey: 'MATERIALES' },
  { href: '/dashboard/inventario', label: 'Inventario', labelKey: 'nav.inventory', section: 'Inventario', layer: 'Inventario', domain: 'Inventario', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/inventario/traslados', label: 'Traslados', labelKey: 'nav.transfers', section: 'Inventario', layer: 'Inventario', domain: 'Traslados', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/bodegas', label: 'Bodegas', section: 'Inventario', layer: 'Inventario', domain: 'Bodegas', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/compras', label: 'Compras', labelKey: 'nav.purchases', section: 'Inventario', layer: 'Inventario', domain: 'Compras', moduleKey: 'COMPRAS' },
  { href: '/dashboard/proveedores', label: 'Proveedores', labelKey: 'nav.suppliers', section: 'Inventario', layer: 'Inventario', domain: 'Proveedores', moduleKey: 'PROVEEDORES' },
  { href: '/dashboard/configuracion/desperdicios', label: 'Desperdicios', labelKey: 'nav.waste', section: 'Inventario', layer: 'Inventario', domain: 'Reglas de consumo', moduleKey: 'CONFIG' },

  { href: '/dashboard/contabilidad', label: 'Contabilidad', labelKey: 'nav.accounting', section: 'Finanzas', layer: 'Finanzas', domain: 'Contabilidad', moduleKey: 'CONTABILIDAD' },
  { href: '/dashboard/nomina', label: 'Nómina', section: 'Finanzas', layer: 'Finanzas', domain: 'Nómina y RRHH', moduleKey: 'CONTABILIDAD' },
  { href: '/dashboard/nomina/portal-empleado', label: 'Mi portal laboral', section: 'Finanzas', layer: 'Finanzas', domain: 'Autoservicio del empleado', moduleKey: 'CONTABILIDAD' },

  { href: '/dashboard/reportes', label: 'Reportes', labelKey: 'nav.reports', section: 'Analítica', layer: 'Analítica', domain: 'Reportes y BI', moduleKey: 'REPORTES' },
  { href: '/dashboard/crm/auditoria-ia', label: 'Auditoría IA CRM', section: 'Analítica', layer: 'Analítica', domain: 'Auditoría IA comercial', moduleKey: 'CRM' },
  { href: '/dashboard/litografia/auditoria-ia', label: 'Auditoría IA', section: 'Analítica', layer: 'Analítica', domain: 'Auditoría IA operativa', moduleKey: 'COTIZADOR' },

  { href: '/dashboard/litografia/conocimiento-ia', label: 'Conocimiento IA', section: 'IA', layer: 'IA', domain: 'Conocimiento operativo', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/litografia/imagenes-ia', label: 'IA Litografía', section: 'IA', layer: 'IA', domain: 'IA creativa aplicada', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia', label: 'Hub IA imágenes', section: 'IA', layer: 'IA', domain: 'IA creativa', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia/generador', label: 'Generador de imágenes', section: 'IA', layer: 'IA', domain: 'Generación visual', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia/vectorizador', label: 'Vectorizador de imágenes', section: 'IA', layer: 'IA', domain: 'Vectorización', moduleKey: 'COTIZADOR' },

  { href: '/dashboard/restaurante', label: 'Restaurante', section: 'Verticales', layer: 'Verticales', domain: 'Restaurante', moduleKey: 'POS', onboardingScoped: true },
  { href: '/dashboard/odontologia', label: 'Odontología', section: 'Verticales', layer: 'Verticales', domain: 'Odontología', moduleKey: 'CLIENTES', onboardingScoped: true },
  { href: '/dashboard/dotaciones', label: 'Dotaciones', section: 'Verticales', layer: 'Verticales', domain: 'Dotaciones', moduleKey: 'COTIZADOR', onboardingScoped: true },

  { href: '/dashboard/configuracion/empresa', label: 'Empresa', labelKey: 'nav.company', section: 'Administración', layer: 'Administración', domain: 'Empresa', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/sedes', label: 'Sedes', labelKey: 'nav.branches', section: 'Administración', layer: 'Administración', domain: 'Sedes', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/usuarios', label: 'Usuarios', labelKey: 'nav.users', section: 'Administración', layer: 'Administración', domain: 'Usuarios', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/respaldo', label: 'Respaldo', section: 'Administración', layer: 'Administración', domain: 'Respaldo por empresa', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/notificaciones', label: 'Dispositivos', section: 'Administración', layer: 'Administración', domain: 'Dispositivos y notificaciones push', moduleKey: null },
  { href: '/dashboard/configuracion/servicios-web', label: 'Servicios web', section: 'Administración', layer: 'Administración', domain: 'Servicios web', moduleKey: null },
  { href: '/dashboard/configuracion/plan', label: 'Plan', labelKey: 'nav.plan', section: 'Administración', layer: 'Administración', domain: 'Plan y suscripción', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/empresas', label: 'Super Admin Empresas', section: 'Administración', layer: 'Administración', domain: 'Tenant management', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/usuarios', label: 'Super Admin Usuarios', section: 'Administración', layer: 'Administración', domain: 'Tenant management', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/modulos-por-plan', label: 'Super Admin', section: 'Administración', layer: 'Administración', domain: 'Packaging SaaS', moduleKey: 'CONFIG' },
]

export const DASHBOARD_PATH_MODULE_OVERRIDES: Array<{ prefix: string; moduleKey: string | null }> = [
  { prefix: '/dashboard/configuracion/servicios-web', moduleKey: null },
  { prefix: '/dashboard/configuracion/plan', moduleKey: null },
]