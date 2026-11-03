export type ProductLayer =
  | 'Inicio'
  | 'Captación'
  | 'Ventas'
  | 'Operaciones'
  | 'Inventario'
  | 'Compras'
  | 'Finanzas'
  | 'Analítica'
  | 'IA'
  | 'Verticales'
  | 'Configuración'
  | 'Administración'

export type DashboardSectionTitle =
  | 'Inicio'
  | 'Captación'
  | 'Ventas'
  | 'Operaciones'
  | 'Inventario'
  | 'Compras'
  | 'Finanzas'
  | 'Analítica'
  | 'IA'
  | 'Verticales'
  | 'Configuración'
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
  'Compras',
  'Finanzas',
  'Analítica',
  'IA',
  'Verticales',
  'Administración',
  'Configuración',
  'Otros',
]

export const DASHBOARD_NAV_CATALOG: DashboardNavCatalogItem[] = [
  { href: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', section: 'Inicio', layer: 'Inicio', domain: 'Inicio', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/inteligencia', label: 'Inteligencia', labelKey: 'nav.intelligence', section: 'Analítica', layer: 'Analítica', domain: 'Motor de inteligencia empresarial', moduleKey: 'REPORTES' },
  { href: '/dashboard/rop', label: 'Red operativa', labelKey: 'nav.rop', section: 'Operaciones', layer: 'Operaciones', domain: 'ORDEX ROP', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/perfil', label: 'Mi perfil', labelKey: 'header.profile', section: 'Administración', layer: 'Administración', domain: 'Perfil de usuario', moduleKey: null },
  { href: '/dashboard/mapa-producto', label: 'Mapa de producto', labelKey: 'nav.productMap', section: 'Administración', layer: 'Administración', domain: 'Arquitectura de producto', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/plantillas', label: 'Plantillas', labelKey: 'nav.templates', section: 'Configuración', layer: 'Configuración', domain: 'Plantillas', moduleKey: 'DASHBOARD' },
  { href: '/dashboard/ayuda', label: 'Ayuda', labelKey: 'nav.help', section: 'Administración', layer: 'Administración', domain: 'Ayuda y documentación', moduleKey: null },

  { href: '/dashboard/crm', label: 'CRM', labelKey: 'nav.crm', section: 'Captación', layer: 'Captación', domain: 'CRM', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones', label: 'Oportunidades', labelKey: 'nav.crmOpportunities', section: 'Captación', layer: 'Captación', domain: 'Pipeline comercial', moduleKey: 'CRM' },
  { href: '/dashboard/crm/agenda', label: 'Calendario', labelKey: 'nav.crmCalendar', section: 'Captación', layer: 'Captación', domain: 'Agenda', moduleKey: 'CRM' },
  { href: '/dashboard/crm/chatbot', label: 'Chatbot', labelKey: 'nav.crmChatbot', section: 'Captación', layer: 'Captación', domain: 'Automatización conversacional', moduleKey: 'CRM' },
  { href: '/dashboard/crm/archivos', label: 'DRIVE', labelKey: 'nav.crmDrive', section: 'Captación', layer: 'Captación', domain: 'Drive comercial', moduleKey: 'CRM' },
  { href: '/dashboard/crm/integraciones', label: 'Automatización', labelKey: 'nav.crmAutomation', section: 'Captación', layer: 'Captación', domain: 'Automatización', moduleKey: 'CRM' },
  { href: '/dashboard/crm/leads', label: 'Captación', labelKey: 'nav.crmLeads', section: 'Captación', layer: 'Captación', domain: 'Leads', moduleKey: 'CRM' },
  { href: '/dashboard/crm/oportunidades', label: 'Pipeline', labelKey: 'nav.crmPipeline', section: 'Captación', layer: 'Captación', domain: 'Oportunidades', moduleKey: 'CRM' },
  { href: '/dashboard/crm/tareas', label: 'Actividades', labelKey: 'nav.crmActivities', section: 'Captación', layer: 'Captación', domain: 'Tareas comerciales', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/pipeline', label: 'Pipeline', labelKey: 'nav.crmPipeline', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/calendario', label: 'Calendario', labelKey: 'nav.crmCalendar', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },
  { href: '/dashboard/crm/negociaciones/actividades', label: 'Actividades', labelKey: 'nav.crmActivities', section: 'Captación', layer: 'Captación', domain: 'Negociaciones', moduleKey: 'CRM' },

  { href: '/dashboard/clientes', label: 'Clientes', labelKey: 'nav.clients', section: 'Ventas', layer: 'Ventas', domain: 'Clientes', moduleKey: 'CLIENTES' },
  { href: '/dashboard/cotizador', label: 'Cotizador', labelKey: 'nav.quote', section: 'Ventas', layer: 'Ventas', domain: 'Cotizador', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/cotizaciones', label: 'Cotizaciones', labelKey: 'nav.quotes', section: 'Ventas', layer: 'Ventas', domain: 'Cotizaciones', moduleKey: 'COTIZACIONES' },
  { href: '/dashboard/remisiones', label: 'Remisiones', labelKey: 'nav.deliveries', section: 'Ventas', layer: 'Ventas', domain: 'Remisiones', moduleKey: 'REMISIONES' },
  { href: '/dashboard/pos', label: 'Facturación', labelKey: 'nav.billing', section: 'Ventas', layer: 'Ventas', domain: 'Punto de venta', moduleKey: 'POS' },

  { href: '/dashboard/ordenes', label: 'Órdenes', labelKey: 'nav.orders', section: 'Operaciones', layer: 'Operaciones', domain: 'Órdenes de trabajo', moduleKey: 'ORDENES' },
  { href: '/dashboard/espacios-trabajo', label: 'Tareas y proyectos', labelKey: 'nav.workspace', section: 'Operaciones', layer: 'Operaciones', domain: 'Proyectos y trabajo', moduleKey: 'ORDENES' },
  { href: '/dashboard/mesa-ayuda', label: 'Mesa de Ayuda', labelKey: 'nav.helpDesk', section: 'Operaciones', layer: 'Operaciones', domain: 'Soporte y solicitudes', moduleKey: 'ORDENES' },
  { href: '/dashboard/chat', label: 'Conversaciones', labelKey: 'nav.conversations', section: 'Captación', layer: 'Captación', domain: 'Coordinación interna', moduleKey: 'ORDENES' },
  { href: '/dashboard/litografia', label: 'Costos', labelKey: 'nav.costs', section: 'Configuración', layer: 'Configuración', domain: 'Costos y producción especializada', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/escaneos', label: 'Escaneos', labelKey: 'nav.scans', section: 'Ventas', layer: 'Ventas', domain: 'Captura documental', moduleKey: 'ESCANEOS' },

  { href: '/dashboard/productos', label: 'Catálogo', labelKey: 'nav.catalog', section: 'Inventario', layer: 'Inventario', domain: 'Productos', moduleKey: 'MATERIALES' },
  { href: '/dashboard/materiales', label: 'Materiales', labelKey: 'nav.materials', section: 'Inventario', layer: 'Inventario', domain: 'Materiales', moduleKey: 'MATERIALES' },
  { href: '/dashboard/terminados', label: 'Terminados', labelKey: 'nav.finishes', section: 'Inventario', layer: 'Inventario', domain: 'Terminados', moduleKey: 'MATERIALES' },
  { href: '/dashboard/inventario', label: 'Existencias', labelKey: 'nav.stock', section: 'Inventario', layer: 'Inventario', domain: 'Inventario', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/inventario/movimientos', label: 'Movimientos', labelKey: 'nav.movements', section: 'Inventario', layer: 'Inventario', domain: 'Movimientos de inventario', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/inventario/traslados', label: 'Traslados', labelKey: 'nav.transfers', section: 'Inventario', layer: 'Inventario', domain: 'Traslados', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/bodegas', label: 'Bodegas', labelKey: 'nav.warehouses', section: 'Inventario', layer: 'Inventario', domain: 'Bodegas', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/inventario/abastecimiento', label: 'Solicitudes de compra', labelKey: 'nav.purchaseRequests', section: 'Compras', layer: 'Compras', domain: 'Abastecimiento', moduleKey: 'INVENTARIO' },
  { href: '/dashboard/compras', label: 'Recepciones', labelKey: 'nav.purchaseReceipts', section: 'Compras', layer: 'Compras', domain: 'Compras', moduleKey: 'COMPRAS' },
  { href: '/dashboard/proveedores', label: 'Proveedores', labelKey: 'nav.suppliers', section: 'Compras', layer: 'Compras', domain: 'Proveedores', moduleKey: 'PROVEEDORES' },
  { href: '/dashboard/configuracion/desperdicios', label: 'Desperdicios', labelKey: 'nav.waste', section: 'Inventario', layer: 'Inventario', domain: 'Reglas de consumo', moduleKey: 'CONFIG' },

  { href: '/dashboard/contabilidad', label: 'Contabilidad', labelKey: 'nav.accounting', section: 'Finanzas', layer: 'Finanzas', domain: 'Contabilidad', moduleKey: 'CONTABILIDAD' },
  { href: '/dashboard/nomina', label: 'Nómina', labelKey: 'nav.payroll', section: 'Finanzas', layer: 'Finanzas', domain: 'Nómina y RRHH', moduleKey: 'CONTABILIDAD' },
  { href: '/dashboard/nomina/portal-empleado', label: 'Mi portal laboral', labelKey: 'nav.myWorkPortal', section: 'Finanzas', layer: 'Finanzas', domain: 'Autoservicio del empleado', moduleKey: 'CONTABILIDAD' },

  { href: '/dashboard/reportes', label: 'Reportes', labelKey: 'nav.reports', section: 'Analítica', layer: 'Analítica', domain: 'Reportes y BI', moduleKey: 'REPORTES' },
  { href: '/dashboard/crm/auditoria-ia', label: 'Auditoría IA CRM', labelKey: 'nav.crmAiAudit', section: 'Analítica', layer: 'Analítica', domain: 'Auditoría IA comercial', moduleKey: 'CRM' },
  { href: '/dashboard/litografia/auditoria-ia', label: 'Auditoría IA', labelKey: 'nav.aiAudit', section: 'Analítica', layer: 'Analítica', domain: 'Auditoría IA operativa', moduleKey: 'COTIZADOR' },

  { href: '/dashboard/litografia/conocimiento-ia', label: 'Conocimiento IA', labelKey: 'nav.aiKnowledge', section: 'IA', layer: 'IA', domain: 'Conocimiento operativo', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/litografia/imagenes-ia', label: 'IA Litografía', labelKey: 'nav.printshopAi', section: 'IA', layer: 'IA', domain: 'IA creativa aplicada', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia', label: 'Hub IA imágenes', labelKey: 'nav.imagesHub', section: 'IA', layer: 'IA', domain: 'IA creativa', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia/generador', label: 'Generador de imágenes', labelKey: 'nav.imageGenerator', section: 'IA', layer: 'IA', domain: 'Generación visual', moduleKey: 'COTIZADOR' },
  { href: '/dashboard/imagenes-ia/vectorizador', label: 'Vectorizador de imágenes', labelKey: 'nav.imageVectorizer', section: 'IA', layer: 'IA', domain: 'Vectorización', moduleKey: 'COTIZADOR' },

  { href: '/dashboard/restaurante', label: 'Restaurante', labelKey: 'nav.restaurant', section: 'Verticales', layer: 'Verticales', domain: 'Restaurante', moduleKey: 'POS', onboardingScoped: true },
  { href: '/dashboard/odontologia', label: 'Odontología', labelKey: 'nav.dentistry', section: 'Verticales', layer: 'Verticales', domain: 'Odontología', moduleKey: 'CLIENTES', onboardingScoped: true },
  { href: '/dashboard/dotaciones', label: 'Dotaciones', labelKey: 'nav.supplies', section: 'Verticales', layer: 'Verticales', domain: 'Dotaciones', moduleKey: 'COTIZADOR', onboardingScoped: true },

  { href: '/dashboard/configuracion/empresa', label: 'Empresa', labelKey: 'nav.company', section: 'Administración', layer: 'Administración', domain: 'Empresa', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/sedes', label: 'Sedes', labelKey: 'nav.branches', section: 'Administración', layer: 'Administración', domain: 'Sedes', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/usuarios', label: 'Usuarios', labelKey: 'nav.users', section: 'Administración', layer: 'Administración', domain: 'Usuarios', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/respaldo', label: 'Respaldo', labelKey: 'nav.backup', section: 'Administración', layer: 'Administración', domain: 'Respaldo por empresa', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/notificaciones', label: 'Dispositivos', labelKey: 'nav.devices', section: 'Administración', layer: 'Administración', domain: 'Dispositivos y notificaciones push', moduleKey: null },
  { href: '/dashboard/configuracion/servicios-web', label: 'Sitios web', labelKey: 'nav.websites', section: 'Captación', layer: 'Captación', domain: 'Sitios web', moduleKey: null },
  { href: '/dashboard/configuracion/plan', label: 'Plan', labelKey: 'nav.plan', section: 'Administración', layer: 'Administración', domain: 'Plan y suscripción', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/empresas', label: 'Super Admin Empresas', labelKey: 'nav.superAdminCompanies', section: 'Administración', layer: 'Administración', domain: 'Tenant management', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/usuarios', label: 'Super Admin Usuarios', labelKey: 'nav.superAdminUsers', section: 'Administración', layer: 'Administración', domain: 'Tenant management', moduleKey: 'CONFIG' },
  { href: '/dashboard/configuracion/super-admin/modulos-por-plan', label: 'Super Admin', labelKey: 'nav.superAdmin', section: 'Administración', layer: 'Administración', domain: 'Packaging SaaS', moduleKey: 'CONFIG' },
]

export const DASHBOARD_PATH_MODULE_OVERRIDES: Array<{ prefix: string; moduleKey: string | null }> = [
  { prefix: '/dashboard/configuracion/servicios-web', moduleKey: null },
  { prefix: '/dashboard/configuracion/plan', moduleKey: null },
]