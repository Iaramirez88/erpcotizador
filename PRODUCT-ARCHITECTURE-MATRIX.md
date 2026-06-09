# Product Architecture Matrix

Matriz de transición desde la estructura actual del producto hacia la arquitectura futura por capas y dominios. Este documento sirve para alinear navegación, permisos, ownership de datos, reporting y roadmap de migración.

## 1. Lectura de la matriz

Columnas usadas:

- Ruta actual: ruta real existente en dashboard.
- Estado actual: dónde vive hoy funcionalmente.
- ModuleKey actual: módulo que hoy gobierna gating o acceso.
- Capa futura: capa objetivo del modelo nuevo.
- Dominio / subdominio futuro: ubicación final de negocio.
- Acción: conservar, mover, separar, fusionar o extender.
- Notas: impacto principal.

## 2. Matriz de ModuleKey actual -> futuro

| ModuleKey actual | Uso actual | Capa futura | Dominio futuro | Acción | Notas |
|---|---|---|---|---|---|
| DASHBOARD | Dashboard general y vistas base | Núcleo | Gobierno / Inicio | Mantener | Debe agrupar inicio, mapa de producto y cockpit ejecutivo. |
| CONFIG | Configuración general | Núcleo | Gobierno / Configuración | Mantener y expandir | Debe absorber empresas, roles, planes, suscripciones, API keys y auditoría global. |
| CRM | CRM, tareas, agenda, inbox, integraciones, chat interno | Captación | Captación / Conversión | Separar | Hoy mezcla captación, seguimiento, tareas y chat interno. |
| COTIZADOR | Cotizador, litografía e IA creativa derivada | Ventas | Cotización | Separar | Debe quedarse en Ventas; Litografía e IA creativa deben salir a Operaciones e IA. |
| COTIZACIONES | Gestión de cotizaciones | Ventas | Cotizaciones | Mantener | Queda como subdominio formal. |
| REMISIONES | Remisiones | Ventas | Despacho / Entrega | Mantener | Debe convivir con Pedidos y Facturación. |
| POS | POS y facturación rápida | Ventas + Finanzas | Punto de venta / Facturación | Duplicar lectura | Operativamente pertenece a Ventas, contablemente a Finanzas. |
| CLIENTES | Clientes | Ventas | Clientes | Mantener | Puede recibir relación con contratos y cuentas. |
| ORDENES | Órdenes de trabajo | Operaciones | Ejecución | Mantener | Debe volverse centro de ejecución de venta. |
| MATERIALES | Materiales, productos y terminados | Recursos | Catálogo / Recursos | Separar | Hoy concentra Materiales, Productos y Terminados; debe partirse por subdominio. |
| INVENTARIO | Inventario y traslados | Recursos | Stock / Movimientos | Mantener | Debe sumar ajustes y consumo operativo. |
| COMPRAS | Compras | Recursos | Abastecimiento | Mantener | Debe conectarse mejor con stock y finanzas. |
| PROVEEDORES | Proveedores | Recursos | Abastecimiento / Proveedores | Mantener | Subdominio propio dentro de Recursos. |
| CONTABILIDAD | Contabilidad y nómina | Finanzas | Contabilidad / Nómina | Separar | Nómina debe quedar como subdominio dentro de Finanzas. |
| REPORTES | Reportes | Analítica | Reportes / BI | Expandir | Debe evolucionar a KPI, trazabilidad y BI. |
| ESCANEOS | Escaneos y OCR | Operaciones | Captura documental | Mantener | Debe integrarse como apoyo operativo y de IA. |
| NOTIFICACIONES | Notificaciones | Núcleo | Comunicación transversal | Mantener transversal | No debe leerse como módulo aislado, sino como capacidad cross-domain. |

## 3. Matriz de rutas actuales -> arquitectura futura

### Núcleo

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard | Inicio general | DASHBOARD | Núcleo | Inicio / Cockpit | Mantener | Debe convertirse en cockpit por dominio, plan y vertical. |
| /dashboard/mapa-producto | Nueva página interna | DASHBOARD | Núcleo | Gobierno / Arquitectura de producto | Mantener | Artefacto interno de alineación. |
| /dashboard/perfil | Perfil | DASHBOARD | Núcleo | Identidad / Perfil | Mantener | Debe convivir con preferencias y scopes. |
| /dashboard/notificaciones | Notificaciones | NOTIFICACIONES | Núcleo | Comunicación transversal | Reubicar conceptualmente | Capacidad transversal, no destino principal de navegación de negocio. |
| /dashboard/notificaciones/crear | Creación de notificaciones | NOTIFICACIONES | Núcleo | Comunicación transversal / Admin | Mantener restringido | Debe gobernarse por permisos administrativos. |
| /dashboard/ayuda | Ayuda | DASHBOARD | Núcleo | Adopción / Soporte | Mantener | Puede ser parte de onboarding y enablement. |
| /dashboard/onboarding | Onboarding | DASHBOARD | Núcleo | Adopción / Onboarding | Mantener | Debe activar capas, no módulos aislados. |
| /dashboard/configuracion/empresa | Configuración empresa | CONFIG | Núcleo | Gobierno / Empresa | Mantener | |
| /dashboard/configuracion/sedes | Sedes | CONFIG | Núcleo | Gobierno / Sedes | Mantener | |
| /dashboard/configuracion/usuarios | Usuarios | CONFIG | Núcleo | Gobierno / Usuarios | Mantener | |
| /dashboard/configuracion/permisos | Permisos | CONFIG | Núcleo | Gobierno / Roles y permisos | Reestructurar | Debe migrar a RBAC v2 por dominio/capacidad/scope. |
| /dashboard/configuracion/plan | Plan | CONFIG | Núcleo | Gobierno / Planes y suscripciones | Expandir | Debe incluir billing y suscripción real. |
| /dashboard/configuracion/servicios-web | Servicios web | CONFIG | Núcleo | Plataforma / Servicios web | Mantener | |
| /dashboard/configuracion/servicios-web/plantillas | Plantillas servicios web | CONFIG | Núcleo | Plataforma / Servicios web | Mantener | |
| /dashboard/configuracion/cotizaciones | Config cotizaciones | CONFIG | Ventas | Ventas / Configuración comercial | Mover | No debe quedar en Núcleo. |
| /dashboard/configuracion/desperdicios | Desperdicios | CONFIG | Recursos | Recursos / Reglas de consumo | Mover | Deja de ser “configuración general”. |
| /dashboard/configuracion/super-admin/empresas | Super admin empresas | CONFIG | Núcleo | Plataforma / Tenant management | Mantener | Vista de plataforma. |
| /dashboard/configuracion/super-admin/usuarios | Super admin usuarios | CONFIG | Núcleo | Plataforma / Tenant management | Mantener | |
| /dashboard/configuracion/super-admin/modulos-por-plan | Módulos por plan | CONFIG | Núcleo | Plataforma / Packaging SaaS | Reestructurar | Debe evolucionar a activación por capa/subdominio. |

### Captación

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/crm | Frente comercial | CRM | Captación | Captación / Cockpit comercial | Mantener | Debe quedar como cockpit de captación, no como bolsa de todo Comercial. |
| /dashboard/crm/conversations | Inbox omnicanal | CRM | Captación | Captación / Inbox omnicanal | Mantener | Centro de conversaciones, IA comercial y asignación. |
| /dashboard/crm/leads | Leads | CRM | Captación | Captación / Leads | Mantener | |
| /dashboard/crm/leads/[id] | Detalle lead | CRM | Captación | Captación / Lead detail | Mantener | |
| /dashboard/crm/oportunidades | Oportunidades | CRM | Captación | Captación / Oportunidades | Mantener | Salida natural hacia Ventas. |
| /dashboard/crm/agenda | Agenda | CRM | Captación | Captación / Agenda | Mantener | |
| /dashboard/crm/tareas | Tareas CRM | CRM | Captación | Captación / Tareas comerciales | Separar | Debe diferenciarse de tareas operativas. |
| /dashboard/crm/chatbot | Chatbot | CRM | Captación | Captación / Automatización conversacional | Mantener | |
| /dashboard/crm/integraciones | Integraciones CRM | CRM | Núcleo o Captación | Plataforma / Integraciones o Captación / Canales | Separar | Doble lectura: configuración de canal vs operación comercial. |
| /dashboard/crm/archivos | Archivos CRM | CRM | Captación | Captación / Documentos comerciales | Mantener | Puede luego repartirse por contexto. |
| /dashboard/crm/auditoria-ia | Auditoría IA CRM | CRM | IA + Analítica | IA Comercial / Auditoría | Reubicar conceptualmente | Debe aparecer bajo IA y proyectarse en Analítica. |

### Ventas

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/clientes | Clientes | CLIENTES | Ventas | Ventas / Clientes | Mantener | |
| /dashboard/cotizador | Cotizador | COTIZADOR | Ventas | Ventas / Cotizador | Mantener | Recibe datos desde Oportunidades. |
| /dashboard/cotizaciones | Cotizaciones | COTIZACIONES | Ventas | Ventas / Cotizaciones | Mantener | |
| /dashboard/cotizaciones/plantilla | Plantilla cotización | COTIZACIONES | Ventas | Ventas / Plantillas documentales | Mantener | |
| /dashboard/remisiones | Remisiones | REMISIONES | Ventas | Ventas / Remisiones | Mantener | |
| /dashboard/remisiones/plantilla | Plantilla remisión | REMISIONES | Ventas | Ventas / Plantillas documentales | Mantener | |
| /dashboard/pos | POS | POS | Ventas + Finanzas | Ventas / Punto de venta | Mantener con doble proyección | Debe proyectarse también a Finanzas. |
| /dashboard/pos/venta-rapida | Venta rápida | POS | Ventas | Ventas / Punto de venta | Mantener | |
| /dashboard/pos/plantilla | Plantilla POS/factura | POS | Finanzas | Finanzas / Facturación | Mover conceptualmente | La plantilla final pertenece a facturación. |

### Operaciones

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/ordenes | Órdenes de trabajo | ORDENES | Operaciones | Operaciones / Órdenes | Mantener | Debe volverse centro operativo posventa. |
| /dashboard/espacios-trabajo | Espacios de trabajo | CRM | Operaciones | Operaciones / Gestión de proyectos | Mover | Hoy cuelga de CRM; debe independizarse. |
| /dashboard/chat | Chat global | CRM | Operaciones | Operaciones / Coordinación interna | Mover | No es captación; es coordinación interna. |
| /dashboard/litografia | Litografía | COTIZADOR | Operaciones + Vertical | Operaciones / Producción especializada | Separar | Debe quedar como vertical operativa con hooks a IA Creativa. |
| /dashboard/plantillas | Plantillas | DASHBOARD | Operaciones | Operaciones / Plantillas | Reubicar | Plantillas de ejecución y plantillas documentales deben separarse. |
| /dashboard/escaneos | Escaneos | ESCANEOS | Operaciones | Operaciones / Captura documental | Mantener | |

### Recursos

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/inventario | Inventario | INVENTARIO | Recursos | Recursos / Stock | Mantener | |
| /dashboard/inventario/traslados | Traslados | INVENTARIO | Recursos | Recursos / Movimientos | Mantener | |
| /dashboard/productos | Productos | MATERIALES | Recursos | Recursos / Productos | Mover | Hoy queda cerca de Operaciones; debe salir a Recursos. |
| /dashboard/materiales | Materiales | MATERIALES | Recursos | Recursos / Materiales | Mantener | |
| /dashboard/terminados | Terminados | MATERIALES | Recursos | Recursos / Catálogo terminado | Mantener | |
| /dashboard/bodegas | Bodegas | INVENTARIO | Recursos | Recursos / Bodegas | Mantener | |
| /dashboard/compras | Compras | COMPRAS | Recursos | Recursos / Compras | Mantener | |
| /dashboard/compras/plantilla | Plantilla compra | COMPRAS | Recursos | Recursos / Plantillas de abastecimiento | Mantener | |
| /dashboard/proveedores | Proveedores | PROVEEDORES | Recursos | Recursos / Proveedores | Mantener | |

### Finanzas

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/contabilidad | Contabilidad | CONTABILIDAD | Finanzas | Finanzas / Contabilidad | Mantener | |
| /dashboard/contabilidad/plan-de-cuentas | Plan de cuentas | CONTABILIDAD | Finanzas | Finanzas / Catálogo contable | Mantener | |
| /dashboard/contabilidad/comprobantes | Comprobantes | CONTABILIDAD | Finanzas | Finanzas / Comprobantes | Mantener | |
| /dashboard/contabilidad/libros | Libros | CONTABILIDAD | Finanzas | Finanzas / Libros | Mantener | |
| /dashboard/contabilidad/conciliaciones | Conciliaciones | CONTABILIDAD | Finanzas | Finanzas / Conciliaciones | Mantener | |
| /dashboard/contabilidad/impuestos | Impuestos | CONTABILIDAD | Finanzas | Finanzas / Impuestos | Mantener | |
| /dashboard/contabilidad/cierres | Cierres | CONTABILIDAD | Finanzas | Finanzas / Cierres | Mantener | |
| /dashboard/contabilidad/centros-de-costo | Centros de costo | CONTABILIDAD | Finanzas | Finanzas / Costeo | Mantener | |
| /dashboard/contabilidad/reglas | Reglas automáticas | CONTABILIDAD | Finanzas | Finanzas / Automatización contable | Mantener | |
| /dashboard/contabilidad/nomina | Nómina | CONTABILIDAD | Finanzas | Finanzas / Nómina | Mantener | |
| /dashboard/contabilidad/nomina/empleados | Empleados nómina | CONTABILIDAD | Finanzas | Finanzas / Nómina / Empleados | Mantener | |
| /dashboard/contabilidad/nomina/periodos | Periodos nómina | CONTABILIDAD | Finanzas | Finanzas / Nómina / Periodos | Mantener | |
| /dashboard/contabilidad/nomina/novedades | Novedades nómina | CONTABILIDAD | Finanzas | Finanzas / Nómina / Novedades | Mantener | |
| /dashboard/contabilidad/nomina/liquidaciones | Liquidaciones nómina | CONTABILIDAD | Finanzas | Finanzas / Nómina / Liquidaciones | Mantener | |
| /dashboard/contabilidad/nomina/reportes | Reportes nómina | CONTABILIDAD | Finanzas + Analítica | Finanzas / Nómina / Reportes | Mantener con proyección analítica | |

### Analítica

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/reportes | Reportes | REPORTES | Analítica | Analítica / Reportes | Expandir | Debe evolucionar a KPI, auditorías, trazabilidad y BI. |

### IA

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/imagenes-ia | Hub IA imágenes | COTIZADOR | IA | IA Creativa / Hub visual | Separar | No debe depender de COTIZADOR en la arquitectura futura. |
| /dashboard/imagenes-ia/generador | Generador de imágenes | COTIZADOR | IA | IA Creativa / Generación | Mantener | |
| /dashboard/imagenes-ia/vectorizador | Vectorizador | COTIZADOR | IA | IA Creativa / Vectorización | Mantener | |
| /dashboard/litografia/conocimiento-ia | Conocimiento IA litografía | COTIZADOR | IA | IA Operativa / Conocimiento especializado | Reubicar | Puede seguir vinculado a la vertical, pero bajo capa IA. |
| /dashboard/litografia/auditoria-ia | Auditoría IA litografía | COTIZADOR | IA + Analítica | IA Operativa / Auditoría | Reubicar conceptualmente | Igual que CRM IA: debe proyectarse también en Analítica. |
| /dashboard/litografia/imagenes-ia | Litografía IA imágenes | COTIZADOR | IA | IA Creativa / Producción gráfica | Reubicar | |

### Verticales

| Ruta actual | Estado actual | ModuleKey actual | Capa futura | Dominio / subdominio futuro | Acción | Notas |
|---|---|---|---|---|---|---|
| /dashboard/restaurante | Vertical restaurante | POS | Verticales | Vertical / Restaurante | Mantener como extensión | Debe heredar Ventas, Recursos y Finanzas. |
| /dashboard/odontologia | Vertical odontología | CLIENTES | Verticales | Vertical / Odontología | Mantener como extensión | Debe heredar Captación, Ventas, Operaciones y Finanzas. |
| /dashboard/dotaciones | Vertical dotaciones | COTIZADOR | Verticales | Vertical / Dotaciones | Mantener como extensión | Debe heredar Ventas, Recursos y Operaciones. |

## 4. Módulos o capacidades futuras faltantes en la estructura actual

Estos no existen todavía como módulo formal, pero deben aparecer en la arquitectura futura:

| Capacidad futura | Capa futura | Dominio futuro | Estado | Notas |
|---|---|---|---|---|
| Pedidos | Ventas | Ventas / Pedidos | Nuevo | Debe ubicarse entre cotización y remisión/factura. |
| Seguimientos | Captación | Captación / Follow-ups | Parcial | Hoy se dispersa entre tareas, actividades y agenda. |
| Embudos | Captación | Captación / Pipeline management | Parcial | Hoy vive implícito en oportunidades. |
| Producción | Operaciones | Operaciones / Producción | Parcial | Hoy se deduce desde órdenes y litografía. |
| Gestión de proyectos | Operaciones | Operaciones / Proyectos | Parcial | Hoy aparece como espacios de trabajo. |
| Tareas operativas | Operaciones | Operaciones / Task management | Nuevo separado | Deben separarse de CrmTask. |
| Ajustes de inventario | Recursos | Recursos / Stock control | Parcial | Hoy se infiere desde InventoryMovement. |
| Facturación | Finanzas | Finanzas / Invoicing | Parcial | POS cubre parte; falta dominio explícito. |
| KPI / BI | Analítica | Analítica / Intelligence | Nuevo | Reportes no cubre todavía capa ejecutiva. |
| IA Comercial / Operativa / Ejecutiva | IA | IA por propósito | Parcial | Hoy existen piezas aisladas. |
| API Keys | Núcleo | Plataforma / Access | Nuevo | No existe todavía como módulo dedicado. |
| Auditoría global | Núcleo + Analítica | Governance / Audit | Nuevo | Hoy la auditoría es por dominios específicos. |

## 5. Decisiones de transición recomendadas

- Separar inmediatamente Captación de Ventas en navegación, reporting y permisos.
- Separar tareas comerciales de tareas operativas a nivel conceptual y de datos.
- Reasignar Productos y Materiales desde la lectura operativa a Recursos.
- Reubicar IA por propósito, no por herramienta ni por vertical técnica.
- Mantener Verticales como extensiones y no como módulos base paralelos.

## 6. Uso de esta matriz

Este documento debe usarse como fuente para:

1. rediseño del sidebar y del dashboard,
2. mapeo de permisos y scopes,
3. reetiquetado de reportes,
4. diseño de migraciones de datos,
5. refactor de ownership por dominio.
| /dashboard/configuracion/cotizaciones | CONFIG | Config local | Ventas | Configuracion comercial | Reubicar |
| /dashboard/configuracion/desperdicios | CONFIG | Config operativa | Recursos | Parametros de inventario/consumo | Reubicar |
| /dashboard/configuracion/super-admin/empresas | CONFIG | Super admin | Nucleo | Gobierno multiempresa | Mantener |
| /dashboard/configuracion/super-admin/usuarios | CONFIG | Super admin | Nucleo | Gobierno multiempresa | Mantener |
| /dashboard/configuracion/super-admin/modulos-por-plan | CONFIG | Super admin | Nucleo | Catalogo de capacidades por plan | Mantener |
| /dashboard/crm | CRM | Frente comercial | Captacion | CRM y pipeline | Reubicar |
| /dashboard/crm/conversations | CRM | Inbox | Captacion | Inbox omnicanal | Mantener |
| /dashboard/crm/leads | CRM | Captacion | Captacion | Leads | Mantener |
| /dashboard/crm/leads/[id] | CRM | Captacion detalle | Captacion | Lead workspace | Mantener |
| /dashboard/crm/oportunidades | CRM | Pipeline | Captacion | Oportunidades | Mantener |
| /dashboard/crm/agenda | CRM | Agenda | Captacion | Agenda comercial | Mantener |
| /dashboard/crm/tareas | CRM | Tareas mezcladas | Captacion + Operaciones | Tareas comerciales / tareas operativas | Partir |
| /dashboard/crm/chatbot | CRM | Herramienta CRM | Captacion | Automatizacion conversacional | Reubicar |
| /dashboard/crm/integraciones | CRM | Integraciones del CRM | Captacion | Integraciones de canales | Reubicar |
| /dashboard/crm/archivos | CRM | Archivos CRM | Captacion | Documentos comerciales | Reubicar |
| /dashboard/crm/auditoria-ia | CRM | Auditoria CRM IA | IA + Analitica | IA comercial / trazabilidad IA | Partir |
| /dashboard/clientes | CLIENTES | Comercial | Ventas | Clientes y cuentas | Mantener |
| /dashboard/cotizador | COTIZADOR | Comercial | Ventas | Cotizador | Mantener |
| /dashboard/cotizaciones | COTIZACIONES | Comercial | Ventas | Cotizaciones | Mantener |
| /dashboard/cotizaciones/plantilla | COTIZACIONES | Documento | Ventas | Plantillas de cotizacion | Mantener |
| /dashboard/remisiones | REMISIONES | Comercial | Ventas | Remisiones | Mantener |
| /dashboard/remisiones/plantilla | REMISIONES | Documento | Ventas | Plantillas de remision | Mantener |
| /dashboard/pos | POS | Comercial/financiero | Ventas + Finanzas | POS comercial / facturacion | Partir |
| /dashboard/pos/venta-rapida | POS | Comercial/financiero | Ventas + Finanzas | POS comercial / facturacion | Partir |
| /dashboard/pos/plantilla | POS | Documento | Finanzas | Plantillas fiscales/comerciales | Reubicar |
| /dashboard/ordenes | ORDENES | Operaciones | Operaciones | Ordenes de trabajo | Mantener |
| /dashboard/espacios-trabajo | CRM | Productividad | Operaciones | Gestion de proyectos y trabajo | Reubicar |
| /dashboard/chat | CRM | Productividad | Operaciones | Coordinacion interna | Reubicar |
| /dashboard/litografia | COTIZADOR | Vertical + operacion + IA | Operaciones + Verticales + IA | Produccion litografica | Partir |
| /dashboard/litografia/imagenes-ia | COTIZADOR | Capacidad tecnica | IA | IA creativa aplicada a litografia | Reubicar |
| /dashboard/litografia/conocimiento-ia | COTIZADOR | Base IA | IA | Conocimiento IA operativo | Reubicar |
| /dashboard/litografia/auditoria-ia | COTIZADOR | Auditoria IA | IA + Analitica | IA operativa / auditoria | Partir |
| /dashboard/escaneos | ESCANEOS | Operaciones | Operaciones | Captura documental | Mantener |
| /dashboard/plantillas | DASHBOARD | Centro de control | Operaciones | Plantillas operativas y documentales | Reubicar |
| /dashboard/inventario | INVENTARIO | Inventario | Recursos | Inventario | Mantener |
| /dashboard/inventario/traslados | INVENTARIO | Inventario | Recursos | Traslados | Mantener |
| /dashboard/productos | MATERIALES | Operaciones | Recursos | Productos | Reubicar |
| /dashboard/materiales | MATERIALES | Recursos | Recursos | Materiales | Mantener |
| /dashboard/terminados | MATERIALES | Catalogo | Recursos | Terminados | Mantener |
| /dashboard/bodegas | INVENTARIO | Recurso logistico | Recursos | Bodegas | Mantener |
| /dashboard/compras | COMPRAS | Logistica | Recursos | Compras | Mantener |
| /dashboard/compras/plantilla | COMPRAS | Documento | Recursos | Plantillas de compra | Mantener |
| /dashboard/proveedores | PROVEEDORES | Logistica | Recursos | Proveedores | Mantener |
| /dashboard/contabilidad | CONTABILIDAD | Financiero | Finanzas | Contabilidad | Mantener |
| /dashboard/contabilidad/plan-de-cuentas | CONTABILIDAD | Financiero | Finanzas | Plan de cuentas | Mantener |
| /dashboard/contabilidad/comprobantes | CONTABILIDAD | Financiero | Finanzas | Comprobantes | Mantener |
| /dashboard/contabilidad/libros | CONTABILIDAD | Financiero | Finanzas | Libros | Mantener |
| /dashboard/contabilidad/conciliaciones | CONTABILIDAD | Financiero | Finanzas | Conciliaciones | Mantener |
| /dashboard/contabilidad/impuestos | CONTABILIDAD | Financiero | Finanzas | Impuestos | Mantener |
| /dashboard/contabilidad/cierres | CONTABILIDAD | Financiero | Finanzas | Cierres | Mantener |
| /dashboard/contabilidad/centros-de-costo | CONTABILIDAD | Financiero | Finanzas | Centros de costo | Mantener |
| /dashboard/contabilidad/reglas | CONTABILIDAD | Financiero | Finanzas | Reglas contables | Mantener |
| /dashboard/contabilidad/nomina | CONTABILIDAD | Financiero | Finanzas | Nomina | Mantener |
| /dashboard/contabilidad/nomina/empleados | CONTABILIDAD | Financiero | Finanzas | Nomina empleados | Mantener |
| /dashboard/contabilidad/nomina/periodos | CONTABILIDAD | Financiero | Finanzas | Nomina periodos | Mantener |
| /dashboard/contabilidad/nomina/novedades | CONTABILIDAD | Financiero | Finanzas | Nomina novedades | Mantener |
| /dashboard/contabilidad/nomina/liquidaciones | CONTABILIDAD | Financiero | Finanzas | Nomina liquidaciones | Mantener |
| /dashboard/contabilidad/nomina/reportes | CONTABILIDAD | Financiero | Analitica | Analitica de nomina | Reubicar |
| /dashboard/reportes | REPORTES | Reportes | Analitica | Reportes y BI | Mantener |
| /dashboard/imagenes-ia | COTIZADOR | Modulo IA por herramienta | IA | IA creativa | Reubicar |
| /dashboard/imagenes-ia/generador | COTIZADOR | Modulo IA por herramienta | IA | IA creativa / generacion | Reubicar |
| /dashboard/imagenes-ia/vectorizador | COTIZADOR | Modulo IA por herramienta | IA | IA creativa / vectorizacion | Reubicar |
| /dashboard/restaurante | POS | Vertical | Verticales | Restaurante | Extender |
| /dashboard/odontologia | CLIENTES | Vertical | Verticales | Odontologia | Extender |
| /dashboard/dotaciones | COTIZADOR | Vertical | Verticales | Dotaciones | Extender |

## 4. Matriz actual -> futuro por modulo gateado

| ModuleKey actual | Cobertura hoy | Problema | Dominio futuro dominante | Estado futuro |
| --- | --- | --- | --- | --- |
| DASHBOARD | Dashboard, plantillas, utilidades varias | Mezcla cockpit con utilidades y arquitectura | Nucleo | Mantener y depurar |
| COTIZADOR | Cotizador, dotaciones, litografia, imagenes IA | Mezcla ventas, vertical, operacion e IA | Ventas / IA / Verticales | Partir |
| COTIZACIONES | Cotizaciones | Correcto pero incompleto sin Pedido | Ventas | Mantener y extender |
| CLIENTES | Clientes, odontologia | Mezcla base comercial con vertical | Ventas / Verticales | Partir |
| CRM | CRM, inbox, leads, oportunidades, agenda, tareas, chat, espacios | Mezcla captacion, operaciones y productividad | Captacion / Operaciones | Partir |
| MATERIALES | Productos, materiales, terminados | Nombre tecnico no refleja Recursos | Recursos | Renombrar y ampliar |
| INVENTARIO | Inventario, traslados, bodegas | Correcto pero incompleto sin ajustes/consumo | Recursos | Mantener y ampliar |
| REMISIONES | Remisiones | Correcto | Ventas | Mantener |
| POS | POS, restaurante | Mezcla venta financiera con vertical | Ventas + Finanzas + Verticales | Partir |
| PROVEEDORES | Proveedores | Correcto | Recursos | Mantener |
| COMPRAS | Compras | Correcto | Recursos | Mantener |
| ORDENES | Ordenes | Correcto pero requiere produccion | Operaciones | Mantener y ampliar |
| ESCANEOS | Escaneos | Correcto, pero deberia conectarse con operaciones/IA | Operaciones | Mantener |
| REPORTES | Reportes | Correcto, pero falta BI/KPI/auditoria transversal | Analitica | Mantener y ampliar |
| CONTABILIDAD | Contabilidad y nomina | Correcto, pero POS/facturacion deben depender aqui tambien | Finanzas | Mantener y ampliar |
| NOTIFICACIONES | Alertas | Correcto, debe elevarse como transversal | Nucleo transversal | Elevar |
| CONFIG | Configuracion | Mezcla gobierno, ventas, recursos y super admin | Nucleo + configuraciones por dominio | Partir |

## 5. Capacidades nuevas requeridas para cerrar la matriz

- SalesOrder o Pedido como entidad intermedia entre cotizacion y remision/factura.
- OperationalTask separada de CrmTask.
- GlobalAuditEvent y AuditProjection por dominio.
- ApiKey y suscripcion como entidades core oficiales.
- KPI y BI como capa analitica, no solo reportes.
- Catalogo de automatizaciones IA por dominio.

## 6. Decisiones estructurales derivadas

- Captacion debe quedar separada de Ventas aunque ambas vivan cerca en la UX.
- CRM deja de ser el paraguas de trabajo interno y se concentra en captacion.
- Recursos absorbe productos, materiales, inventario, compras, proveedores y bodegas.
- Operaciones absorbe ordenes, produccion, proyectos, plantillas, coordinacion y trabajo interno.
- POS se modela como puente entre Ventas y Finanzas, no como modulo totalmente aislado.
- IA y Analitica dejan de organizarse por herramienta y pasan a organizarse por propósito.

## 7. Resultado esperado

Cuando esta matriz se implemente, cada ruta, permiso y entidad tendrá una posicion oficial dentro del producto. Eso reduce ambiguedad, simplifica onboarding, mejora venta SaaS por capas y permite escalar verticales sin copiar funcionalidad base.