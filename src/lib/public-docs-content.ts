export const publicDocsLastUpdated = '18 de agosto de 2026'

export const platformPrinciples = [
  'Arquitectura modular orientada a dominios de negocio.',
  'Multiempresa y multisede como base estructural del producto.',
  'Gobierno de acceso, trazabilidad y continuidad operativa como capacidades transversales.',
  'Integraciones empresariales conectadas sin fragmentar la operacion.',
] as const

export const reliabilityPillars = [
  {
    title: 'Infraestructura escalable',
    summary:
      'La plataforma esta preparada para crecer con la operacion de la empresa sin depender de una sola pieza critica.',
    bullets: ['Escalabilidad horizontal para acompanar crecimiento operativo.', 'Servicios distribuidos para mejorar rendimiento y continuidad.', 'Capa segura de entrada HTTPS para proteger el trafico.'],
  },
  {
    title: 'Respaldo y recuperacion',
    summary:
      'La operacion cuenta con politicas de respaldo y recuperacion documentadas para reducir riesgo y proteger la continuidad del negocio.',
    bullets: ['Respaldos automaticos.', 'Continuidad operativa documentada.', 'Recuperacion preparada ante incidentes.'],
  },
  {
    title: 'Seguridad empresarial',
    summary:
      'La plataforma incorpora autenticacion segura, controles por rol y separacion operativa entre empresas, sedes y equipos.',
    bullets: ['Permisos por roles y responsabilidades.', 'Aislamiento por empresa y sede.', 'Controles de acceso centralizados.'],
  },
  {
    title: 'Monitoreo y continuidad',
    summary:
      'La plataforma opera con politicas de monitoreo, mantenimiento y respuesta para sostener disponibilidad y confianza en el servicio.',
    bullets: ['Monitoreo continuo de la plataforma.', 'Procedimientos de mantenimiento documentados.', 'Disponibilidad orientada a operacion empresarial.'],
  },
] as const

export const stackLayers = [
  {
    title: 'Aplicacion empresarial',
    items: ['Experiencia web moderna', 'Acceso seguro', 'Operacion multiempresa', 'Operacion multisede'],
  },
  {
    title: 'Arquitectura modular',
    items: ['ERP y CRM conectados', 'Ventas y operaciones', 'Inventario y finanzas', 'Verticales por industria'],
  },
  {
    title: 'Datos y trazabilidad',
    items: ['Datos transaccionales', 'Historial operativo', 'Trazabilidad por proceso', 'Lectura ejecutiva'],
  },
  {
    title: 'Infraestructura y continuidad',
    items: ['Servicios distribuidos', 'Alta disponibilidad', 'Escalabilidad', 'Respaldo y recuperacion'],
  },
  {
    title: 'Integraciones empresariales',
    items: ['WhatsApp y Meta', 'Google', 'DIAN', 'Canales y automatizaciones'],
  },
] as const

export type PublicDomainDoc = {
  id: string
  slug: string
  name: string
  tagline: string
  stage: 'OPERATIVO' | 'PARCIAL' | 'EN EXPANSION'
  audience: string
  summary: string
  businessValue: string
  includes: string[]
  flows: string[]
  routes: string[]
  integrations: string[]
  dependencies: string[]
  outcomes: string[]
}

export type PublicPermissionSpec = {
  title: string
  requirement: string
  scope: string
  notes: string
}

export type PublicEndpointGroup = {
  title: string
  purpose: string
  access: string
  endpoints: string[]
}

export type PublicIntegrationSpec = {
  name: string
  summary: string
  touchpoints: string[]
}

export type PublicPlaybookSpec = {
  title: string
  trigger: string
  steps: string[]
  outcome: string
}

export type PublicDeepDomainDoc = {
  slug: string
  overview: string
  entities: string[]
  permissions: PublicPermissionSpec[]
  endpointGroups: PublicEndpointGroup[]
  integrations: PublicIntegrationSpec[]
  playbooks: PublicPlaybookSpec[]
  kpis: string[]
}

export type PublicArchitectureMapNode = {
  id: string
  label: string
  subtitle: string
  slug: string
  x: number
  y: number
  tone: 'sky' | 'teal' | 'amber'
}

export type PublicArchitectureMapEdge = {
  from: string
  to: string
  label: string
}

export const publicDomainDocs: PublicDomainDoc[] = [
  {
    id: 'nucleo',
    slug: 'nucleo',
    name: 'Nucleo y gobierno',
    tagline: 'Gobierno, acceso y base operativa de toda la suite.',
    stage: 'OPERATIVO',
    audience: 'Admins de plataforma, soporte y liderazgo operativo.',
    summary:
      'Agrupa acceso, perfil, empresas, sedes, configuracion base, planes, usuarios y gobierno del producto.',
    businessValue: 'Permite controlar identidades, sedes, permisos y activacion de capacidades sin dispersar la administracion del sistema.',
    includes: ['Dashboard', 'Perfil', 'Usuarios', 'Sedes', 'Notificaciones', 'Plan y activacion'],
    flows: ['Ingreso y control de acceso', 'Configuracion de empresa y sede', 'Gobierno de permisos y perfiles'],
    routes: ['/dashboard', '/dashboard/perfil', '/dashboard/notificaciones'],
    integrations: ['Autenticacion segura', 'Permisos por roles', 'Gobierno por empresa y sede'],
    dependencies: ['Todos los dominios operan sobre esta capa de identidad y gobierno.'],
    outcomes: ['Control centralizado por empresa y sede', 'Menor riesgo operativo por permisos mal asignados', 'Base estable para crecimiento por modulos'],
  },
  {
    id: 'captacion',
    slug: 'crm',
    name: 'Captacion y CRM',
    tagline: 'Desde el lead hasta la conversacion y la oportunidad.',
    stage: 'OPERATIVO',
    audience: 'Equipos comerciales, asesores y canales de atencion.',
    summary:
      'Centraliza leads, conversaciones, agenda, tareas y seguimiento comercial con foco omnicanal y trazable.',
    businessValue: 'Reduce la fragmentacion comercial y concentra contexto, SLA, prioridad y continuidad de atencion dentro del mismo sistema.',
    includes: ['CRM', 'Inbox omnicanal', 'Leads', 'Oportunidades', 'Agenda CRM', 'Tareas CRM'],
    flows: ['Lead -> conversacion -> oportunidad', 'Seguimiento por asesor, sede y SLA', 'Conversacion -> cliente ERP'],
    routes: ['/dashboard/crm'],
    integrations: ['WhatsApp y Meta', 'Google', 'Canales digitales', 'Seguimiento comercial'],
    dependencies: ['Se conecta con Ventas para cotizar y cerrar.', 'Comparte trazabilidad con IA, notificaciones y reportes.'],
    outcomes: ['Mejor tiempo de respuesta comercial', 'Historial omnicanal unificado', 'Conversion hacia clientes y ventas sin reingresar datos'],
  },
  {
    id: 'ventas',
    slug: 'ventas',
    name: 'Ventas y documentos',
    tagline: 'Formalizacion comercial con cotizacion, remision, POS y documentos.',
    stage: 'OPERATIVO',
    audience: 'Equipos de venta, facturacion y atencion al cliente.',
    summary:
      'Convierte oportunidades en cotizaciones, remisiones, ventas POS y documentos compartibles hacia el cliente.',
    businessValue: 'Evita que el cierre comercial quede fuera del ERP y conecta el momento de venta con documentos reales, cobro y operacion.',
    includes: ['Cotizador', 'Cotizaciones', 'Clientes', 'Remisiones', 'POS'],
    flows: ['Oportunidad -> cotizacion', 'Cotizacion -> remision o venta', 'Venta -> factura y control de pago'],
    routes: ['/dashboard/cotizaciones', '/dashboard/clientes', '/dashboard/remisiones', '/dashboard/pos'],
    integrations: ['Documentos comerciales', 'Cobro y facturacion', 'Seguimiento de cierre'],
    dependencies: ['Consume catalogo e inventario.', 'Empuja datos hacia operaciones y finanzas.'],
    outcomes: ['Cierre comercial trazable', 'Documentos consistentes hacia cliente', 'Paso directo hacia operacion y contabilidad'],
  },
  {
    id: 'operaciones',
    slug: 'operaciones',
    name: 'Operaciones y ejecucion',
    tagline: 'Ordenes, trabajo interno y entrega de lo vendido.',
    stage: 'OPERATIVO',
    audience: 'Produccion, coordinacion interna y seguimiento operativo.',
    summary:
      'Ejecuta lo vendido con ordenes, tareas, espacios de trabajo, escaneos y verticales operativos.',
    businessValue: 'Aterriza la venta en ejecucion real, con ordenes, seguimiento interno, conversion desde escaneos y soporte a produccion.',
    includes: ['Ordenes de trabajo', 'Plantillas', 'Escaneos', 'Tareas y proyectos', 'Litografia'],
    flows: ['Venta -> orden de trabajo', 'Escaneo -> aprobacion -> conversion', 'Plantilla -> ejecucion recurrente'],
    routes: ['/dashboard/ordenes', '/dashboard/plantillas', '/dashboard/litografia'],
    integrations: ['Automatizacion documental', 'Flujos de aprobacion', 'Trazabilidad operativa'],
    dependencies: ['Recibe demanda desde ventas.', 'Consulta inventario y catalogo para ejecutar.'],
    outcomes: ['Menos perdida de contexto entre venta y entrega', 'Mayor trazabilidad de produccion', 'Base reusable para verticales operativos'],
  },
  {
    id: 'recursos',
    slug: 'inventario',
    name: 'Inventario y abastecimiento',
    tagline: 'Catalogo, stock, materiales, abastecimiento y proveedores.',
    stage: 'OPERATIVO',
    audience: 'Inventario, compras, bodega y soporte a ventas.',
    summary:
      'Controla catalogo, materiales, productos, stock, abastecimiento, bodegas y proveedores.',
    businessValue: 'Entrega la base fisica y economica que usan ventas y operaciones para prometer y ejecutar con datos reales.',
    includes: ['Inventario', 'Productos', 'Materiales', 'Bodegas', 'Proveedores', 'Traslados'],
    flows: ['Compra -> inventario', 'Inventario -> cotizacion y produccion', 'Traslado entre sedes y bodegas'],
    routes: ['/dashboard/inventario', '/dashboard/productos', '/dashboard/materiales', '/dashboard/proveedores'],
    integrations: ['Abastecimiento', 'Control de stock', 'Movimientos entre sedes'],
    dependencies: ['Abastece ventas, operaciones y reportes.', 'Entrega datos para costos y control financiero.'],
    outcomes: ['Stock mas confiable', 'Menos rupturas por informacion incompleta', 'Mayor control de materiales y traslados'],
  },
  {
    id: 'finanzas',
    slug: 'finanzas',
    name: 'Finanzas, DIAN y nomina',
    tagline: 'Traduccion financiera, contable y regulatoria de la operacion.',
    stage: 'EN EXPANSION',
    audience: 'Contabilidad, administracion y liderazgo financiero.',
    summary:
      'Une facturacion, registros contables, documentos DIAN, conciliacion y nomina dentro de una misma base operativa.',
    businessValue: 'Lleva la operacion a lenguaje contable y regulatorio sin partir los datos entre sistemas inconexos.',
    includes: ['Contabilidad', 'Plan de cuentas', 'Comprobantes', 'Libros', 'DIAN', 'Nomina'],
    flows: ['Venta -> factura -> contabilidad', 'Documento DIAN -> estado -> recepcion', 'Gestion de colaboradores y periodos'],
    routes: ['/dashboard/contabilidad', '/dashboard/nomina'],
    integrations: ['DIAN', 'Documentos regulatorios', 'Control financiero'],
    dependencies: ['Recibe eventos desde ventas.', 'Comparte base de personas, empresas y sedes con nucleo.'],
    outcomes: ['Mayor coherencia financiera', 'Trazabilidad documental y fiscal', 'Menor reproceso administrativo'],
  },
  {
    id: 'ia',
    slug: 'ia',
    name: 'IA aplicada',
    tagline: 'Asistencia, generacion, auditoria y lectura ejecutiva del negocio.',
    stage: 'EN EXPANSION',
    audience: 'Equipos comerciales, creativos, operativos y direccion.',
    summary:
      'Agrupa capacidades de generacion, vectorizacion, asistencia y auditoria que ya se conectan con dominios reales del negocio.',
    businessValue: 'La IA se ubica como capa utilitaria de negocio, no como demo aislada, y se conecta con CRM, litografia, OCR y analitica.',
    includes: ['Generador de imagenes', 'Vectorizador', 'Litografia IA', 'Auditorias IA', 'Decision Engine'],
    flows: ['Solicitud -> generacion o vectorizacion', 'Operacion -> analisis -> snapshot', 'CRM -> apoyo conversacional y operativo'],
    routes: ['/dashboard/imagenes-ia', '/dashboard/reportes'],
    integrations: ['Asistencia inteligente', 'Analitica aplicada', 'Automatizacion por dominio'],
    dependencies: ['Cruza comercial, operaciones y analitica.', 'Depende de datos historicos y eventos reales del ERP.'],
    outcomes: ['Aceleracion operativa y creativa', 'Mejor lectura ejecutiva', 'Automatizacion especializada por dominio'],
  },
  {
    id: 'verticales',
    slug: 'verticales',
    name: 'Verticales y analitica',
    tagline: 'Extensiones por industria y lectura transversal del negocio.',
    stage: 'PARCIAL',
    audience: 'Direccion, consultoria y empresas con necesidades sectoriales.',
    summary:
      'Extiende la base comun hacia verticales como restaurante, odontologia y dotaciones, y cruza esa operacion con reportes y lectura ejecutiva.',
    businessValue: 'Permite crecer por industria sin romper el nucleo del sistema y deja visible la promesa SaaS de capas activables sobre una base comun.',
    includes: ['Reportes', 'Restaurante', 'Odontologia', 'Dotaciones', 'Mapa de producto'],
    flows: ['Operacion sectorial sobre base comun', 'Lectura ejecutiva por dominio', 'Expansion por industria sin duplicar nucleo'],
    routes: ['/dashboard/reportes', '/dashboard/restaurante', '/dashboard/odontologia', '/dashboard/dotaciones'],
    integrations: ['Lectura ejecutiva', 'Capas sectoriales', 'Trazabilidad transversal'],
    dependencies: ['Se apoya en nucleo, operaciones, ventas y recursos.', 'Conecta con reportes y decision engine.'],
    outcomes: ['Escalabilidad por vertical', 'Mejor discurso de producto por industria', 'Lectura ejecutiva transversal'],
  },
]

export const integrationCatalog = [
  {
    title: 'Canales comerciales',
    items: ['WhatsApp y Meta', 'Google', 'Canales digitales', 'Captacion e interaccion'],
  },
  {
    title: 'Documentos y cumplimiento',
    items: ['Documentos comerciales', 'Facturacion', 'DIAN', 'Trazabilidad documental'],
  },
  {
    title: 'Operacion extendida',
    items: ['Automatizacion documental', 'Movilidad operativa', 'Notificaciones', 'Continuidad de servicio'],
  },
] as const

export const platformFlowDiagram = [
  {
    title: 'Captacion -> Ventas',
    description: 'Leads, conversaciones y oportunidades alimentan cotizacion, clientes, remisiones y POS.',
    nodes: ['Leads', 'Conversaciones', 'Oportunidades', 'Cotizaciones', 'Clientes', 'POS'],
  },
  {
    title: 'Ventas -> Operaciones',
    description: 'La venta aprobada dispara ejecucion con ordenes, plantillas, escaneos y coordinacion interna.',
    nodes: ['Cotizacion aprobada', 'Ordenes', 'Plantillas', 'Escaneos', 'Produccion'],
  },
  {
    title: 'Recursos -> Ejecucion',
    description: 'Catalogo, materiales y stock sostienen la promesa comercial y la operacion real.',
    nodes: ['Productos', 'Materiales', 'Bodegas', 'Stock', 'Abastecimiento'],
  },
  {
    title: 'Operacion -> Finanzas',
    description: 'Los documentos y eventos del negocio terminan en facturacion, DIAN, libros y nomina.',
    nodes: ['Factura', 'DIAN', 'Comprobantes', 'Libros', 'Nomina'],
  },
] as const

export const trustMetrics = [
  { value: '8', label: 'dominios visibles', hint: 'Documentacion publica organizada por capa' },
  { value: '5', label: 'capas tecnicas', hint: 'Aplicacion, negocio, datos, infraestructura e integracion' },
  { value: '4', label: 'pilares de confiabilidad', hint: 'Operacion, backups, seguridad y observabilidad' },
] as const

export const publicDeepDomainDocs: PublicDeepDomainDoc[] = [
  {
    slug: 'crm',
    overview:
      'El CRM ya no opera como libreta de contactos. La base actual gobierna captacion, inbox omnicanal, oportunidades, actividades y canales conectados con reglas de sede, prioridad y conversion hacia ventas.',
    entities: ['CrmLead', 'CrmConversation', 'CrmOpportunity', 'CrmChannelConnection', 'CrmActivity', 'CrmTaskWorkspace'],
    permissions: [
      {
        title: 'Captacion / Leads',
        requirement: 'RBAC v2: CAPTACION / LEADS con acciones READ y CREATE',
        scope: 'SEDE',
        notes: 'Leads y oportunidades usan capability access con allowLegacyFallback false en endpoints clave para endurecer el modelo nuevo.',
      },
      {
        title: 'Captacion / Oportunidades',
        requirement: 'RBAC v2: CAPTACION / OPPORTUNITIES con acciones READ, CREATE y UPDATE',
        scope: 'SEDE',
        notes: 'La validacion cruza empresa, sede y ownership de entidades antes de crear o editar pipeline.',
      },
      {
        title: 'Captacion / Inbox y canales',
        requirement: 'RBAC v2: CAPTACION / INBOX, CHANNELS, CONTACTS, ACTIVITIES, FILES, TASK_WORKSPACES, INTERNAL_CHAT',
        scope: 'SEDE o EMPRESA segun endpoint',
        notes: 'El inbox soporta lectura y actualizacion por sede; configuraciones de canales e integraciones elevan el scope cuando el recurso es transversal.',
      },
    ],
    endpointGroups: [
      {
        title: 'Captura y gestion de leads',
        purpose: 'Registrar prospectos, listarlos, evitar duplicados y convertirlos a cliente u oportunidad.',
        access: 'Capability access CAPTACION / LEADS',
        endpoints: ['/api/crm/leads', '/api/crm/leads/[id]', '/api/crm/leads/[id]/convert'],
      },
      {
        title: 'Pipeline comercial',
        purpose: 'Administrar oportunidades, etapas, valor esperado, responsable y relacion con cotizacion.',
        access: 'Capability access CAPTACION / OPPORTUNITIES',
        endpoints: ['/api/crm/opportunities', '/api/crm/opportunities/[id]', '/api/crm/stages'],
      },
      {
        title: 'Inbox omnicanal y seguimiento',
        purpose: 'Operar conversaciones, mensajes, asignacion, resolucion, llamadas y creacion de oportunidad desde el hilo.',
        access: 'Capability access CAPTACION / INBOX',
        endpoints: ['/api/crm/conversations', '/api/crm/conversations/[id]', '/api/crm/conversations/[id]/assign', '/api/crm/conversations/[id]/messages', '/api/crm/conversations/[id]/resolve', '/api/crm/conversations/[id]/create-opportunity', '/api/crm/conversations/[id]/call', '/api/crm/conversations/[id]/ai'],
      },
      {
        title: 'Canales e integraciones de entrada',
        purpose: 'Conectar Meta, WhatsApp, Google Sheets y otros bridges con el CRM operativo.',
        access: 'Capability access CAPTACION / CHANNELS',
        endpoints: ['/api/crm/channels', '/api/crm/channels/[id]', '/api/crm/channels/[id]/meta/connect', '/api/crm/channels/[id]/meta/sync', '/api/crm/channels/[id]/meta/disconnect', '/api/crm/channels/[id]/google-sheets/import', '/api/crm/channels/[id]/google-sheets/export', '/api/crm/channels/[id]/google-sheets/preview'],
      },
    ],
    integrations: [
      {
        name: 'Meta y WhatsApp Cloud API',
        summary: 'Captura leads, recibe conversaciones y abre flujos de atencion comercial desde canales sociales y mensajeria.',
        touchpoints: ['Canales CRM', 'Inbox', 'Webhook Meta', 'Despacho saliente de WhatsApp'],
      },
      {
        name: 'Google Sheets y formularios/bridges',
        summary: 'Permite importar, exportar o alimentar demanda desde hojas e integraciones simples sin montar otro CRM paralelo.',
        touchpoints: ['Import preview/export por canal', 'Captures bridge', 'Captures web-form', 'Booking'],
      },
      {
        name: 'IA comercial y archivos',
        summary: 'Asistencia de respuesta, contexto conversacional y capa de archivos compartidos para el trabajo comercial diario.',
        touchpoints: ['Conversation AI', 'CRM files', 'External storage', 'Timeline y activities'],
      },
    ],
    playbooks: [
      {
        title: 'Lead inbound a oportunidad real',
        trigger: 'Entra un lead desde formulario, chatbot, WhatsApp o importacion.',
        steps: ['Revisar origen y datos minimos en leads.', 'Asignar responsable y sede operativa.', 'Calificar el lead y abrir oportunidad cuando ya existe contexto comercial.', 'Conectar la oportunidad con cotizacion cuando pasa a propuesta.'],
        outcome: 'El lead queda medido desde canal hasta revenue potencial, sin perder trazabilidad.',
      },
      {
        title: 'Conversacion omnicanal a cierre comercial',
        trigger: 'Un prospecto escribe por WhatsApp o canal social y necesita atencion del equipo.',
        steps: ['Tomar el hilo sin responsable o reasignarlo.', 'Responder y cambiar estado de atencion.', 'Crear oportunidad desde la conversacion.', 'Escalar a cotizacion y cliente si el negocio madura.'],
        outcome: 'La demanda conversacional deja de vivir suelta y se vuelve pipeline operable.',
      },
    ],
    kpis: ['Tiempo de primera respuesta', 'Leads por canal', 'Conversion lead -> oportunidad', 'Oportunidades con cotizacion', 'SLA y prioridad por conversacion'],
  },
  {
    slug: 'ventas',
    overview:
      'Ventas es la capa donde el pipeline deja de ser promesa y se convierte en documentos, cliente, cobro y salida operativa. Aqui viven cotizaciones, clientes, remisiones, POS y los pasos que conectan la venta con inventario y finanzas.',
    entities: ['Cotizacion', 'CotizacionItem', 'Cliente', 'Remision', 'RemisionItem', 'Factura/POS draft'],
    permissions: [
      {
        title: 'Cotizaciones',
        requirement: 'Modulo legacy COTIZACIONES con READ o WRITE',
        scope: 'SEDE',
        notes: 'La mayoria de endpoints de cotizacion dependen de requireApiAccess por modulo y heredan el scope de la sede activa.',
      },
      {
        title: 'Clientes',
        requirement: 'RBAC v2: VENTAS / CUSTOMERS con READ y WRITE',
        scope: 'EMPRESA',
        notes: 'Clientes ya usa capability access y valida sede cuando un administrador fuerza filtros por sucursal.',
      },
      {
        title: 'Remisiones y POS',
        requirement: 'Modulos legacy REMISIONES y POS con WRITE cuando aplica facturacion o salida de inventario',
        scope: 'SEDE',
        notes: 'Facturar una cotizacion exige permisos de COTIZACIONES y POS; remisiones consume acceso del modulo propio.',
      },
    ],
    endpointGroups: [
      {
        title: 'Cotizaciones y aprobacion comercial',
        purpose: 'Crear, listar, actualizar, aprobar, compartir, exportar y auditar propuestas comerciales.',
        access: 'Module access COTIZACIONES',
        endpoints: ['/api/cotizaciones', '/api/cotizaciones/export', '/api/cotizaciones/[id]', '/api/cotizaciones/[id]/aprobar', '/api/cotizaciones/[id]/assign', '/api/cotizaciones/[id]/audit', '/api/cotizaciones/[id]/enviar', '/api/cotizaciones/[id]/pdf', '/api/cotizaciones/[id]/share', '/api/cotizaciones/[id]/venta-realizada', '/api/cotizaciones/[id]/facturar'],
      },
      {
        title: 'Base de clientes',
        purpose: 'Administrar clientes, filtros comerciales y exportaciones de cartera de relacion.',
        access: 'Capability access VENTAS / CUSTOMERS',
        endpoints: ['/api/clientes', '/api/clientes/export', '/api/clientes/[id]'],
      },
      {
        title: 'Remisiones y salida operativa',
        purpose: 'Generar salida de materiales o productos con trazabilidad a movimientos de inventario.',
        access: 'Module access REMISIONES',
        endpoints: ['/api/remisiones', '/api/remisiones/export', '/api/remisiones/template', '/api/remisiones/[id]', '/api/remisiones/[id]/assign', '/api/remisiones/[id]/enviar', '/api/remisiones/[id]/pdf'],
      },
    ],
    integrations: [
      {
        name: 'Bold checkout y facturacion',
        summary: 'La venta puede avanzar a link de pago o a flujo de factura/POS sin salir del ecosistema.',
        touchpoints: ['Cotizacion -> facturar', 'POS', 'Billing Bold'],
      },
      {
        name: 'PDF y canales de envio',
        summary: 'Las cotizaciones y remisiones se convierten en documentos compartibles y verificables.',
        touchpoints: ['PDF de cotizacion', 'Share', 'Enviar por correo o WhatsApp', 'PDF de remision'],
      },
      {
        name: 'CRM e inventario',
        summary: 'La venta se alimenta desde oportunidades CRM y dispara salida de inventario o continuidad operativa.',
        touchpoints: ['Opportunity stage automation', 'Clientes', 'Remisiones', 'Inventario'],
      },
    ],
    playbooks: [
      {
        title: 'Oportunidad a cotizacion aprobada',
        trigger: 'Una oportunidad ya tiene alcance y valor listos para propuesta.',
        steps: ['Crear o vincular la cotizacion desde el flujo comercial.', 'Ajustar items, margenes y condiciones.', 'Enviar PDF o link compartible al cliente.', 'Aprobar y marcar venta realizada cuando el negocio avanza.'],
        outcome: 'La propuesta queda trazable y lista para saltar a remision, POS o facturacion.',
      },
      {
        title: 'Venta con salida de inventario',
        trigger: 'Se necesita despachar material o producto al cliente.',
        steps: ['Crear remision desde la sede activa.', 'Seleccionar bodega y items con cantidad valida.', 'Registrar movimiento de inventario y documento de salida.', 'Entregar PDF o evidencia al cliente/equipo.'],
        outcome: 'La venta deja soporte documental y afecta stock con trazabilidad.',
      },
    ],
    kpis: ['Cotizaciones creadas/aprobadas', 'Tiempo de conversion a venta', 'Clientes activos por sede', 'Remisiones emitidas', 'Cobro o facturacion originada desde venta'],
  },
  {
    slug: 'operaciones',
    overview:
      'Operaciones aterriza la venta en ejecucion real. En el estado actual del producto, la puerta mas rica y verificable es Escaneos: OCR, aprobacion, destino y conversion hacia orden, cotizacion o compra.',
    entities: ['DocumentScan', 'OrdenTrabajo', 'OCR queue job', 'Workflow target', 'Structured semantic extraction'],
    permissions: [
      {
        title: 'Escaneos',
        requirement: 'Modulo legacy ESCANEOS con READ y WRITE',
        scope: 'SEDE y usuario actual',
        notes: 'La lista de escaneos hoy filtra por userId y sede activa; editar campos, aprobar y convertir exige WRITE.',
      },
      {
        title: 'Conversiones cruzadas',
        requirement: 'Modulos ORDENES, COTIZACIONES o COMPRAS segun destino final',
        scope: 'SEDE',
        notes: 'Crear una orden desde escaneo exige acceso dual: ESCANEOS WRITE + ORDENES WRITE. Lo mismo aplica para compra o cotizacion.',
      },
    ],
    endpointGroups: [
      {
        title: 'Ingreso y consulta de escaneos',
        purpose: 'Subir documentos, encolarlos a OCR/IA y consultar el historial de procesamiento.',
        access: 'Module access ESCANEOS',
        endpoints: ['/api/escaneos', '/api/escaneos/[id]'],
      },
      {
        title: 'Correccion, aprobacion y destino',
        purpose: 'Editar campos detectados, aprobar la captura y definir si el documento va a venta, compra u operacion.',
        access: 'Module access ESCANEOS',
        endpoints: ['/api/escaneos/[id]/fields', '/api/escaneos/[id]/fields/bulk', '/api/escaneos/[id]/approve', '/api/escaneos/[id]/destino', '/api/escaneos/feedback/export'],
      },
      {
        title: 'Conversiones operativas',
        purpose: 'Transformar un escaneo aprobado en orden, cotizacion o compra segun el workflow elegido.',
        access: 'Cross-module: ESCANEOS + destino final',
        endpoints: ['/api/escaneos/[id]/to-orden', '/api/escaneos/[id]/to-cotizacion', '/api/escaneos/[id]/to-compra'],
      },
    ],
    integrations: [
      {
        name: 'OCR queue y procesamiento local',
        summary: 'El documento puede entrar por cola con Redis/worker o procesarse en fallback sincrono en entornos locales.',
        touchpoints: ['enqueueOcr', 'OCR worker', 'Document scan provider'],
      },
      {
        name: 'Storage de archivos',
        summary: 'Cada escaneo persiste archivo, URL publica o storage key antes de iniciar el workflow semantico.',
        touchpoints: ['saveScanObject', 'deleteScanObject', 'scan-storage'],
      },
      {
        name: 'ERP destino',
        summary: 'El resultado del OCR no se queda como lectura. Se proyecta hacia ordenes, cotizaciones o compras segun el target.',
        touchpoints: ['to-orden', 'to-cotizacion', 'to-compra'],
      },
    ],
    playbooks: [
      {
        title: 'Factura o documento a orden de trabajo',
        trigger: 'Se sube un documento comercial que debe terminar en ejecucion operativa.',
        steps: ['Subir archivo en escaneos.', 'Esperar OCR/IA y revisar campos.', 'Aprobar la captura.', 'Definir destino VENTA y ejecutar conversion a orden.'],
        outcome: 'Se crea una orden de trabajo con cliente y montos base sin redigitar todo el documento.',
      },
      {
        title: 'Escaneo a cotizacion o compra',
        trigger: 'El documento detectado no debe ir a orden sino a propuesta o abastecimiento.',
        steps: ['Corregir campos relevantes.', 'Elegir destino correcto.', 'Usar la conversion correspondiente.', 'Validar el registro creado en ventas o compras.'],
        outcome: 'OCR y operacion se vuelven un mismo flujo y no un archivo muerto en bandeja.',
      },
    ],
    kpis: ['Documentos procesados', 'Tasa de aprobacion', 'Tiempo de captura a conversion', 'Conversiones a orden/cotizacion/compra', 'Feedback exportado para mejorar OCR'],
  },
  {
    slug: 'inventario',
    overview:
      'Inventario gobierna movimientos, traslados y abastecimiento con control por empresa, sede y bodega. El diseño actual ya deja trazabilidad de stock antes/despues y soporte a operaciones multi-sede.',
    entities: ['InventoryMovement', 'InventoryStock', 'InventoryWarehouse', 'InventoryTransfer', 'Supply request'],
    permissions: [
      {
        title: 'Movimientos y ajustes',
        requirement: 'Modulo legacy INVENTARIO con READ y WRITE',
        scope: 'SEDE o empresa segun bodega',
        notes: 'Los movimientos validan acceso a la bodega y a la sede; el sistema incluso crea bodega default cuando falta en despliegues multi-sede.',
      },
      {
        title: 'Traslados entre sedes',
        requirement: 'RBAC v2: RECURSOS / TRANSFERS con READ y CREATE',
        scope: 'EMPRESA',
        notes: 'Los traslados ya usan capability access, no solo modulo legacy, y registran movimientos OUT e IN con sourceType TRANSFER.',
      },
    ],
    endpointGroups: [
      {
        title: 'Movimientos y consulta de stock',
        purpose: 'Consultar movimientos, filtrar por material o bodega y aplicar ingresos, salidas o ajustes.',
        access: 'Module access INVENTARIO',
        endpoints: ['/api/inventario', '/api/inventario/by-code', '/api/inventario/export'],
      },
      {
        title: 'Abastecimiento',
        purpose: 'Levantar necesidades de suministro y marcarlas como cumplidas dentro del ciclo operativo.',
        access: 'Module access INVENTARIO',
        endpoints: ['/api/inventario/abastecimiento', '/api/inventario/abastecimiento/[id]/fulfill'],
      },
      {
        title: 'Traslados multi-sede',
        purpose: 'Mover material entre bodegas/sedes conservando numero, estado y movimientos espejo.',
        access: 'Capability access RECURSOS / TRANSFERS',
        endpoints: ['/api/inventario/traslados'],
      },
    ],
    integrations: [
      {
        name: 'Ventas y remisiones',
        summary: 'Las salidas comerciales consumen stock y dejan trazabilidad que luego se lee desde inventario.',
        touchpoints: ['Remisiones', 'POS/venta', 'Cotizacion con disponibilidad'],
      },
      {
        name: 'Operaciones y abastecimiento',
        summary: 'La ejecucion y las compras disparan necesidades de materiales, ajustes y cumplimiento de suministro.',
        touchpoints: ['Abastecimiento', 'Compras', 'Ordenes y produccion'],
      },
      {
        name: 'Bodegas y sedes',
        summary: 'La lectura multi-sede se valida en acceso y en la topologia de bodegas por empresa.',
        touchpoints: ['inventoryWarehouse', 'requireSedeAccess', 'transfers'],
      },
    ],
    playbooks: [
      {
        title: 'Ajuste o movimiento manual controlado',
        trigger: 'Un material debe registrar entrada, salida o ajuste por diferencia real.',
        steps: ['Elegir material y bodega objetivo.', 'Aplicar tipo IN, OUT o ADJUST.', 'Registrar nota operativa.', 'Verificar stock before/after en el movimiento.'],
        outcome: 'El inventario queda actualizado con rastro completo de quien movio y donde.',
      },
      {
        title: 'Traslado entre sedes',
        trigger: 'Una sede necesita material desde otra bodega de la misma empresa.',
        steps: ['Crear traslado con origen, destino, material y cantidad.', 'Validar stock suficiente en origen.', 'Aplicar salida en origen e ingreso en destino en la misma transaccion.', 'Consultar el historial del traslado por estado y responsables.'],
        outcome: 'La operacion entre sedes queda sincronizada y auditable.',
      },
    ],
    kpis: ['Movimientos por sede/bodega', 'Rotacion de materiales', 'Traslados completados', 'Solicitudes de abastecimiento cumplidas', 'Diferencias por ajustes'],
  },
] as const

export const publicArchitectureMapNodes: PublicArchitectureMapNode[] = [
  { id: 'nucleo', label: 'Nucleo', subtitle: 'Acceso y gobierno', slug: 'nucleo', x: 120, y: 120, tone: 'sky' },
  { id: 'crm', label: 'CRM', subtitle: 'Captacion e inbox', slug: 'crm', x: 360, y: 120, tone: 'teal' },
  { id: 'ventas', label: 'Ventas', subtitle: 'Cotizaciones y clientes', slug: 'ventas', x: 620, y: 120, tone: 'amber' },
  { id: 'inventario', label: 'Inventario', subtitle: 'Stock y traslados', slug: 'inventario', x: 880, y: 120, tone: 'sky' },
  { id: 'operaciones', label: 'Operaciones', subtitle: 'Ordenes y escaneos', slug: 'operaciones', x: 620, y: 320, tone: 'amber' },
  { id: 'finanzas', label: 'Finanzas', subtitle: 'Contabilidad y DIAN', slug: 'finanzas', x: 880, y: 320, tone: 'sky' },
  { id: 'ia', label: 'IA', subtitle: 'Asistencia y analitica', slug: 'ia', x: 360, y: 320, tone: 'teal' },
  { id: 'verticales', label: 'Verticales', subtitle: 'Industria y reportes', slug: 'verticales', x: 120, y: 320, tone: 'amber' },
] as const

export const publicArchitectureMapEdges: PublicArchitectureMapEdge[] = [
  { from: 'nucleo', to: 'crm', label: 'Identidad y permisos' },
  { from: 'nucleo', to: 'ventas', label: 'Sedes y usuarios' },
  { from: 'nucleo', to: 'inventario', label: 'Empresas y bodegas' },
  { from: 'crm', to: 'ventas', label: 'Lead a cotizacion' },
  { from: 'ventas', to: 'operaciones', label: 'Venta a ejecucion' },
  { from: 'inventario', to: 'ventas', label: 'Disponibilidad y catalogo' },
  { from: 'inventario', to: 'operaciones', label: 'Materiales y abastecimiento' },
  { from: 'ventas', to: 'finanzas', label: 'Factura y recaudo' },
  { from: 'ia', to: 'crm', label: 'Asistencia comercial' },
  { from: 'ia', to: 'operaciones', label: 'OCR y analisis' },
  { from: 'verticales', to: 'operaciones', label: 'Capas especializadas' },
  { from: 'verticales', to: 'finanzas', label: 'Lectura ejecutiva' },
] as const

export function getPublicDomainDocBySlug(slug: string) {
  return publicDomainDocs.find((domain) => domain.slug === slug)
}

export function getPublicDeepDomainDocBySlug(slug: string) {
  return publicDeepDomainDocs.find((domain) => domain.slug === slug)
}