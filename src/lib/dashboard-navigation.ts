export type DashboardNavDefinition = {
  name: string
  href: string
}

const ONBOARDING_SCOPED_HREFS = new Set([
  '/dashboard/restaurante',
  '/dashboard/odontologia',
  '/dashboard/dotaciones',
])

export function isOnboardingScopedDashboardHref(href: string): boolean {
  return ONBOARDING_SCOPED_HREFS.has(href)
}

export function sectionForDashboardHref(href: string): string {
  switch (href) {
    case '/dashboard':
    case '/dashboard/mapa-producto':
    case '/dashboard/reportes':
    case '/dashboard/plantillas':
      return 'Centro de Control'
    case '/dashboard/contabilidad':
      return 'Contabilidad'
    case '/dashboard/contabilidad/nomina':
      return 'Nomina'
    case '/dashboard/cotizador':
    case '/dashboard/cotizaciones':
    case '/dashboard/remisiones':
    case '/dashboard/pos':
    case '/dashboard/clientes':
    case '/dashboard/crm':
    case '/dashboard/crm/conversations':
    case '/dashboard/crm/agenda':
    case '/dashboard/crm/auditoria-ia':
    case '/dashboard/crm/archivos':
    case '/dashboard/crm/chatbot':
    case '/dashboard/crm/integraciones':
    case '/dashboard/crm/leads':
    case '/dashboard/crm/oportunidades':
    case '/dashboard/crm/tareas':
      return 'Comercial'
    case '/dashboard/restaurante':
    case '/dashboard/odontologia':
    case '/dashboard/dotaciones':
      return 'Verticales'
    case '/dashboard/ordenes':
    case '/dashboard/espacios-trabajo':
    case '/dashboard/chat':
    case '/dashboard/litografia':
    case '/dashboard/escaneos':
    case '/dashboard/productos':
      return 'Operaciones'
    case '/dashboard/litografia/auditoria-ia':
    case '/dashboard/litografia/conocimiento-ia':
    case '/dashboard/litografia/imagenes-ia':
    case '/dashboard/imagenes-ia':
    case '/dashboard/imagenes-ia/generador':
    case '/dashboard/imagenes-ia/vectorizador':
      return 'IA'
    case '/dashboard/inventario':
    case '/dashboard/inventario/traslados':
      return 'Inventario'
    case '/dashboard/compras':
    case '/dashboard/proveedores':
    case '/dashboard/configuracion/desperdicios':
      return 'Logistica'
    case '/dashboard/configuracion/sedes':
    case '/dashboard/configuracion/usuarios':
    case '/dashboard/configuracion/permisos':
    case '/dashboard/configuracion/empresa':
    case '/dashboard/configuracion/servicios-web':
    case '/dashboard/configuracion/plan':
      return 'Gestion'
    case '/dashboard/configuracion/super-admin/empresas':
    case '/dashboard/configuracion/super-admin/usuarios':
    case '/dashboard/configuracion/super-admin/modulos-por-plan':
      return 'Super Admin'
    default:
      return 'Otros'
  }
}

export function moduleForDashboardHref(href: string): string | null {
  switch (href) {
    case '/dashboard/configuracion/servicios-web':
      return null
    case '/dashboard':
    case '/dashboard/mapa-producto':
      return 'DASHBOARD'
    case '/dashboard/reportes':
      return 'REPORTES'
    case '/dashboard/plantillas':
      return 'DASHBOARD'
    case '/dashboard/contabilidad':
    case '/dashboard/contabilidad/comprobantes':
    case '/dashboard/contabilidad/libros':
    case '/dashboard/contabilidad/conciliaciones':
    case '/dashboard/contabilidad/impuestos':
    case '/dashboard/contabilidad/cierres':
    case '/dashboard/contabilidad/nomina':
    case '/dashboard/contabilidad/nomina/empleados':
    case '/dashboard/contabilidad/nomina/periodos':
    case '/dashboard/contabilidad/nomina/novedades':
    case '/dashboard/contabilidad/nomina/liquidaciones':
    case '/dashboard/contabilidad/nomina/reportes':
    case '/dashboard/contabilidad/plan-de-cuentas':
    case '/dashboard/contabilidad/centros-de-costo':
    case '/dashboard/contabilidad/reglas':
    case '/dashboard/contabilidad/asientos':
    case '/dashboard/contabilidad/tesoreria':
      return 'CONTABILIDAD'
    case '/dashboard/cotizador':
    case '/dashboard/dotaciones':
      return 'COTIZADOR'
    case '/dashboard/cotizaciones':
      return 'COTIZACIONES'
    case '/dashboard/remisiones':
      return 'REMISIONES'
    case '/dashboard/restaurante':
    case '/dashboard/pos':
      return 'POS'
    case '/dashboard/clientes':
    case '/dashboard/odontologia':
      return 'CLIENTES'
    case '/dashboard/crm':
    case '/dashboard/crm/conversations':
    case '/dashboard/crm/agenda':
    case '/dashboard/crm/auditoria-ia':
    case '/dashboard/crm/archivos':
    case '/dashboard/crm/chatbot':
    case '/dashboard/crm/integraciones':
    case '/dashboard/crm/leads':
    case '/dashboard/crm/oportunidades':
    case '/dashboard/crm/tareas':
    case '/dashboard/chat':
    case '/dashboard/espacios-trabajo':
      return 'CRM'
    case '/dashboard/ordenes':
      return 'ORDENES'
    case '/dashboard/litografia':
    case '/dashboard/litografia/auditoria-ia':
    case '/dashboard/litografia/imagenes-ia':
    case '/dashboard/imagenes-ia':
    case '/dashboard/imagenes-ia/generador':
    case '/dashboard/imagenes-ia/vectorizador':
      return 'COTIZADOR'
    case '/dashboard/escaneos':
      return 'ESCANEOS'
    case '/dashboard/materiales':
    case '/dashboard/productos':
    case '/dashboard/terminados':
      return 'MATERIALES'
    case '/dashboard/inventario':
    case '/dashboard/inventario/traslados':
    case '/dashboard/bodegas':
      return 'INVENTARIO'
    case '/dashboard/compras':
      return 'COMPRAS'
    case '/dashboard/proveedores':
      return 'PROVEEDORES'
    case '/dashboard/configuracion/sedes':
    case '/dashboard/configuracion/usuarios':
    case '/dashboard/configuracion/permisos':
    case '/dashboard/configuracion/empresa':
    case '/dashboard/configuracion/plan':
    case '/dashboard/configuracion/desperdicios':
    case '/dashboard/configuracion/super-admin/modulos-por-plan':
    case '/dashboard/configuracion/super-admin/empresas':
    case '/dashboard/configuracion/super-admin/usuarios':
      return 'CONFIG'
    default:
      return null
  }
}

export function moduleForDashboardPath(pathname: string): string | null {
  if (pathname.startsWith('/dashboard/configuracion/servicios-web')) return null
  if (pathname.startsWith('/dashboard/configuracion/plan')) return null
  if (pathname === '/dashboard') return 'DASHBOARD'
  if (pathname.startsWith('/dashboard/mapa-producto')) return 'DASHBOARD'
  if (pathname.startsWith('/dashboard/plantillas')) return 'DASHBOARD'
  if (pathname.startsWith('/dashboard/reportes')) return 'REPORTES'
  if (pathname.startsWith('/dashboard/contabilidad')) return 'CONTABILIDAD'
  if (pathname.startsWith('/dashboard/cotizador')) return 'COTIZADOR'
  if (pathname.startsWith('/dashboard/dotaciones')) return 'COTIZADOR'
  if (pathname.startsWith('/dashboard/cotizaciones')) return 'COTIZACIONES'
  if (pathname.startsWith('/dashboard/clientes')) return 'CLIENTES'
  if (pathname.startsWith('/dashboard/odontologia')) return 'CLIENTES'
  if (pathname.startsWith('/dashboard/remisiones')) return 'REMISIONES'
  if (pathname.startsWith('/dashboard/restaurante')) return 'POS'
  if (pathname.startsWith('/dashboard/pos')) return 'POS'
  if (pathname.startsWith('/dashboard/ordenes')) return 'ORDENES'
  if (pathname.startsWith('/dashboard/litografia')) return 'COTIZADOR'
  if (pathname.startsWith('/dashboard/imagenes-ia')) return 'COTIZADOR'
  if (pathname.startsWith('/dashboard/escaneos')) return 'ESCANEOS'
  if (
    pathname.startsWith('/dashboard/materiales') ||
    pathname.startsWith('/dashboard/productos') ||
    pathname.startsWith('/dashboard/terminados')
  ) return 'MATERIALES'
  if (pathname.startsWith('/dashboard/inventario') || pathname.startsWith('/dashboard/bodegas')) return 'INVENTARIO'
  if (pathname.startsWith('/dashboard/compras')) return 'COMPRAS'
  if (pathname.startsWith('/dashboard/proveedores')) return 'PROVEEDORES'
  if (
    pathname.startsWith('/dashboard/crm') ||
    pathname.startsWith('/dashboard/chat') ||
    pathname.startsWith('/dashboard/espacios-trabajo')
  ) {
    return 'CRM'
  }
  if (pathname.startsWith('/dashboard/configuracion')) return 'CONFIG'
  return null
}

export function buildDashboardNavDefinitions(t: (key: string) => string): DashboardNavDefinition[] {
  return [
    { name: t('nav.dashboard'), href: '/dashboard' },
    { name: 'Mapa de producto', href: '/dashboard/mapa-producto' },
    { name: t('nav.reports'), href: '/dashboard/reportes' },
    { name: t('nav.templates'), href: '/dashboard/plantillas' },
    { name: t('nav.accounting'), href: '/dashboard/contabilidad' },
    { name: 'Nómina', href: '/dashboard/contabilidad/nomina' },
    { name: t('nav.quote'), href: '/dashboard/cotizador' },
    { name: 'Dotaciones', href: '/dashboard/dotaciones' },
    { name: t('nav.quotes'), href: '/dashboard/cotizaciones' },
    { name: t('nav.deliveries'), href: '/dashboard/remisiones' },
    { name: 'Restaurante', href: '/dashboard/restaurante' },
    { name: t('nav.billing'), href: '/dashboard/pos' },
    { name: t('nav.clients'), href: '/dashboard/clientes' },
    { name: 'Odontología', href: '/dashboard/odontologia' },
    { name: 'Frente comercial', href: '/dashboard/crm' },
    { name: 'Inbox omnicanal', href: '/dashboard/crm/conversations' },
    { name: 'Agenda CRM', href: '/dashboard/crm/agenda' },
    { name: 'Auditoría IA CRM', href: '/dashboard/crm/auditoria-ia' },
    { name: 'Administrador de archivos', href: '/dashboard/crm/archivos' },
    { name: 'Chatbot', href: '/dashboard/crm/chatbot' },
    { name: 'Canales e integraciones', href: '/dashboard/crm/integraciones' },
    { name: 'Captación', href: '/dashboard/crm/leads' },
    { name: 'Pipeline', href: '/dashboard/crm/oportunidades' },
    { name: 'Tareas', href: '/dashboard/crm/tareas' },
    { name: 'Espacios de trabajo', href: '/dashboard/espacios-trabajo' },
    { name: 'Chat global', href: '/dashboard/chat' },
    { name: t('nav.orders'), href: '/dashboard/ordenes' },
    { name: t('nav.printshop'), href: '/dashboard/litografia' },
    { name: 'Conocimiento IA', href: '/dashboard/litografia/conocimiento-ia' },
    { name: 'Auditoría IA', href: '/dashboard/litografia/auditoria-ia' },
    { name: 'Generador de imágenes', href: '/dashboard/imagenes-ia/generador' },
    { name: 'Vectorizador de imágenes', href: '/dashboard/imagenes-ia/vectorizador' },
    { name: t('nav.scans'), href: '/dashboard/escaneos' },
    { name: t('nav.products'), href: '/dashboard/productos' },
    { name: t('nav.inventory'), href: '/dashboard/inventario' },
    { name: t('nav.transfers'), href: '/dashboard/inventario/traslados' },
    { name: t('nav.purchases'), href: '/dashboard/compras' },
    { name: t('nav.suppliers'), href: '/dashboard/proveedores' },
    { name: t('nav.waste'), href: '/dashboard/configuracion/desperdicios' },
    { name: t('nav.branches'), href: '/dashboard/configuracion/sedes' },
    { name: t('nav.users'), href: '/dashboard/configuracion/usuarios' },
    { name: t('nav.permissions'), href: '/dashboard/configuracion/permisos' },
    { name: t('nav.company'), href: '/dashboard/configuracion/empresa' },
    { name: 'Servicios web', href: '/dashboard/configuracion/servicios-web' },
    { name: t('nav.plan'), href: '/dashboard/configuracion/plan' },
    { name: 'Super Admin', href: '/dashboard/configuracion/super-admin/modulos-por-plan' },
  ]
}