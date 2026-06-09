# Product Architecture Blueprint

Propuesta de reorganización funcional del ERP/CRM para convertir la base actual en una plataforma SaaS empresarial coherente, multiempresa, extensible por vertical y preparada para crecimiento de producto.

Esta propuesta no redefine solo el menú. Redefine la arquitectura funcional, la navegación, la asignación de permisos, la lectura de dependencias, la ubicación de reportes, las capas transversales y la forma de extender verticales sin duplicar dominio base.

## 1. Diagnóstico ejecutivo

El producto actual ya tiene una base potente, pero creció por agregación de módulos. Eso generó cuatro problemas estructurales:

- El flujo comercial está fragmentado entre CRM, cotizador, clientes, cotizaciones, remisiones y POS.
- La ejecución operativa está partida entre órdenes, tareas, espacios de trabajo, litografía y escaneos.
- La IA está organizada por herramienta o contexto técnico, no por propósito de negocio.
- Los verticales conviven cerca de módulos core, pero todavía no están modelados formalmente como extensiones sobre una base común.

El objetivo correcto no es “ordenar pantallas”. El objetivo es que la empresa vea el producto como un sistema empresarial compuesto por dominios con entradas, salidas, entidades y dependencias explícitas.

## 2. Principios de arquitectura

- Arquitectura por dominios de negocio, no por páginas.
- Navegación basada en proceso, no en histórico de desarrollo.
- Permisos por dominio, subdominio y capacidad, no solo por módulo técnico.
- Verticales como extensiones sobre dominios base, no como duplicados funcionales.
- Analítica e IA como capas transversales especializadas.
- Multiempresa y multisede como condición estructural, no como ajuste posterior.
- Onboarding y venta del producto basados en “capas activables” por plan, empresa e industria.

## 3. Nuevo mapa del producto

### Capa 1. Núcleo

Responsabilidad: gobierno, acceso, configuración y administración transversal.

Incluye:

- Dashboard
- Perfil
- Usuarios
- Roles y permisos
- Empresas
- Sedes
- Configuración general
- Servicios web
- Planes
- Suscripciones
- Integraciones de plataforma
- API Keys
- Auditoría global

### Capa 2. Captación

Responsabilidad: captar, calificar y convertir prospectos hasta el punto previo a la venta.

Incluye:

- CRM
- Inbox omnicanal
- Leads
- Oportunidades
- Agenda
- Tareas comerciales
- Seguimientos
- Embudos de ventas

Flujo principal:

Lead -> Oportunidad -> Cotización

### Capa 3. Ventas

Responsabilidad: formalizar la venta y convertir oportunidades en documentos y transacciones reales.

Incluye:

- Cotizador
- Cotizaciones
- Pedidos
- Remisiones
- POS
- Clientes
- Facturación comercial

Flujo principal:

Oportunidad -> Cotización -> Pedido -> Remisión -> Factura

### Capa 4. Operaciones

Responsabilidad: ejecutar lo vendido y coordinar equipos, producción y entregables.

Incluye:

- Órdenes de trabajo
- Producción
- Litografía
- Escaneos
- Espacios de trabajo
- Gestión de proyectos
- Tareas operativas
- Plantillas

Flujo principal:

Venta -> Orden de trabajo -> Producción -> Entrega

### Capa 5. Recursos

Responsabilidad: asegurar materiales, productos, stock y abastecimiento para ejecutar operación y venta.

Incluye:

- Inventario
- Productos
- Materiales
- Bodegas
- Compras
- Proveedores
- Traslados
- Ajustes de inventario

Flujo principal:

Compras -> Inventario -> Producción -> Consumo

### Capa 6. Finanzas

Responsabilidad: traducir la operación y la venta al lenguaje financiero y contable.

Incluye:

- Facturación
- POS
- Contabilidad
- Plan de cuentas
- Comprobantes
- Impuestos
- Conciliaciones
- Cierres
- Nómina

Flujo principal:

Venta -> Factura -> Contabilidad -> Impuestos

### Capa 7. Analítica

Responsabilidad: transformar datos operativos y transaccionales en decisión.

Incluye:

- Reportes
- KPI
- Indicadores
- Auditorías
- Trazabilidad
- Business Intelligence

### Capa 8. IA

Responsabilidad: asistir cada dominio con automatización, recomendación, análisis y generación.

No se organiza por tecnología, sino por propósito.

Subcapas:

- IA Comercial
- IA Operativa
- IA Ejecutiva
- IA Creativa

## 4. Nueva estructura del menú lateral

El menú debe ser la expresión navegable de la arquitectura, no un inventario de pantallas.

### Nivel 1

- Núcleo
- Captación
- Ventas
- Operaciones
- Recursos
- Finanzas
- Analítica
- IA
- Verticales

### Nivel 2 propuesto

#### Núcleo

- Dashboard
- Perfil
- Empresas
- Sedes
- Usuarios
- Roles y permisos
- Configuración general
- Planes y suscripciones
- Servicios web
- API Keys
- Auditoría global

#### Captación

- CRM
- Inbox omnicanal
- Leads
- Oportunidades
- Agenda
- Tareas comerciales
- Seguimientos
- Embudos

#### Ventas

- Cotizador
- Cotizaciones
- Pedidos
- Remisiones
- POS / Facturación
- Clientes

#### Operaciones

- Órdenes de trabajo
- Producción
- Litografía
- Escaneos
- Espacios de trabajo
- Proyectos
- Tareas operativas
- Plantillas

#### Recursos

- Inventario
- Productos
- Materiales
- Bodegas
- Compras
- Proveedores
- Traslados
- Ajustes

#### Finanzas

- Facturación
- POS financiero
- Contabilidad
- Plan de cuentas
- Comprobantes
- Impuestos
- Conciliaciones
- Cierres
- Nómina

#### Analítica

- Reportes
- KPI
- Auditorías
- Trazabilidad
- BI

#### IA

- IA Comercial
- IA Operativa
- IA Ejecutiva
- IA Creativa

#### Verticales

- Litografía
- Restaurantes
- Odontología
- Dotaciones
- Construcción
- Servicios profesionales

## 5. Mapa de dominios

### Núcleo

Dueño del gobierno y de las políticas del sistema.

Subdominios:

- Identidad y acceso
- Configuración empresarial
- Planes y billing de plataforma
- Integración de plataforma
- Auditoría transversal

### Captación

Dueño del pipeline previo a la venta.

Subdominios:

- Prospección
- Inbox y comunicaciones
- Calificación
- Conversión comercial
- Seguimiento

### Ventas

Dueño de la formalización comercial y documental.

Subdominios:

- Configuración comercial
- Cotización
- Pedido
- Entrega documental
- Punto de venta
- Gestión de clientes

### Operaciones

Dueño de la ejecución del servicio o producto vendido.

Subdominios:

- Órdenes
- Producción
- Planeación interna
- Gestión de trabajo
- Tareas operativas
- Plantillas de ejecución

### Recursos

Dueño del suministro y disponibilidad.

Subdominios:

- Catálogo
- Stock
- Abastecimiento
- Bodegas y movimientos
- Consumo de recursos

### Finanzas

Dueño del control financiero y contable.

Subdominios:

- Facturación
- Asientos y comprobantes
- Impuestos
- Conciliación
- Cierres
- Nómina

### Analítica

Dueño de indicadores, lectura de negocio y trazabilidad.

### IA

Dueño de capacidades inteligentes transversales según propósito.

### Verticales

Dueño de especializaciones sectoriales sobre la base común.

## 6. Mapa de dependencias

### Dependencias directas

- Captación -> Ventas
- Ventas -> Operaciones
- Ventas -> Finanzas
- Operaciones -> Recursos
- Recursos -> Operaciones
- Todos -> Analítica
- Todos -> IA

### Dependencias reales del producto actual

- Inbox CRM crea tareas y oportunidades.
- Oportunidades alimentan el Cotizador mediante prefill comercial.
- Cotizador y Cotizaciones consumen clientes, productos, materiales y precios.
- Remisiones y POS afectan inventario y trazabilidad de documentos.
- Compras y Proveedores alimentan inventario.
- Órdenes de trabajo se conectan con tareas y seguimiento.
- Litografía depende de materiales, cotizador y capacidades IA creativas.
- Escaneos y OCR alimentan captura documental y procesos operativos.
- Contabilidad recibe eventos de POS, compras y otros movimientos transaccionales.

## 7. Jerarquía de navegación

La navegación debe modelarse en 3 niveles.

### L1. Dominio

Dominios mayores del producto.

### L2. Subdominio

Agrupa procesos relacionados.

Ejemplos:

- Captación / Conversaciones
- Captación / Pipeline
- Ventas / Documentos
- Operaciones / Producción
- Recursos / Abastecimiento
- Finanzas / Contabilidad
- IA / Comercial

### L3. Vista o herramienta

Pantalla concreta.

Ejemplos:

- Inbox omnicanal
- Leads
- Oportunidades
- Cotizaciones
- Remisiones
- Comprobantes
- Vectorizador

## 8. Entidades principales por dominio

### Núcleo

- Empresa
- Sede
- User
- Role
- Permission
- Plan
- Subscription
- ApiKey
- AuditEvent

### Captación

- CrmLead
- CrmOpportunity
- CrmConversation
- CrmMessage
- CrmTask
- CrmActivity
- CrmLeadCapture

### Ventas

- Cliente
- Cotizacion
- CotizacionItem
- Pedido
- Remision
- PosInvoice
- PosInvoiceItem

### Operaciones

- OrdenTrabajo
- ProductionOrder
- Workspace
- Project
- OperationalTask
- ScanDocument
- Template
- LitografiaQuote

### Recursos

- Producto
- Material
- Bodega
- InventoryMovement
- InventoryTransfer
- Compra
- CompraItem
- CompraPago
- Proveedor

### Finanzas

- AccountingAccount
- AccountingVoucher
- AccountingVoucherLine
- AccountingJournalEntry
- AccountingJournalLine
- AccountingRule
- AccountingPeriod
- PayrollEmployee
- PayrollNovelty
- PayrollSettlement

### Analítica

- KpiSnapshot
- ReportDefinition
- AuditProjection
- TraceEvent

### IA

- AiSuggestion
- AiAuditEntry
- AiWorkflow
- AiPrediction
- AiPromptProfile
- AiActionRecommendation

## 9. Relaciones entre entidades

### Captación

- CrmLead 1:N CrmConversation
- CrmLead 1:N CrmOpportunity
- CrmConversation 1:N CrmMessage
- CrmConversation 1:N CrmTask
- CrmOpportunity N:1 Cliente opcional

### Ventas

- CrmOpportunity 1:N Cotizacion
- Cotizacion 1:N CotizacionItem
- Cotizacion 0:1 Pedido
- Pedido 0:1 Remision
- Pedido o Remision 0:N PosInvoice
- Cliente 1:N Cotizacion / Pedido / Remision / Factura

### Operaciones

- Venta confirmada 1:N OrdenTrabajo
- OrdenTrabajo 1:N OperationalTask
- OrdenTrabajo N:1 Workspace o Project opcional
- LitografiaQuote puede nacer desde Cotizacion u OrdenTrabajo

### Recursos

- Compra 1:N CompraItem
- Compra N:1 Proveedor
- Producto y Material 1:N InventoryMovement
- Bodega 1:N InventoryMovement
- InventoryTransfer mueve inventario entre bodegas
- OrdenTrabajo / Produccion consume Material o Producto

### Finanzas

- PosInvoice 1:N PosInvoiceItem
- PosInvoice / Compra disparan AccountingVoucher o AccountingJournalEntry
- AccountingVoucher 1:N AccountingVoucherLine
- AccountingJournalEntry 1:N AccountingJournalLine
- Nómina dispara vouchers, comprobantes y pasivos laborales

### IA

- AiSuggestion pertenece a un contexto de negocio: lead, opportunity, conversation, order, document o inventory event
- AiAuditEntry registra entrada, salida, usuario, proveedor, costo, acción sugerida y acción ejecutada
- AiWorkflow puede generar CrmTask, alertas o recomendaciones ejecutivas

## 10. Propuesta de base de datos conceptual

La base conceptual debe organizarse por bounded contexts, no solo por acumulación de modelos.

### CoreContext

- Empresa
- Sede
- User
- Role
- Permission
- Plan
- Subscription
- ApiKey
- GlobalAuditEvent
- UiPreference

### CaptureContext

- Lead
- LeadSource
- LeadCapture
- Conversation
- Message
- Opportunity
- FollowUpTask
- Activity
- PipelineStage

### SalesContext

- Customer
- Quotation
- QuotationItem
- SalesOrder
- DeliveryNote
- Invoice
- InvoiceItem
- Payment

### OperationsContext

- WorkOrder
- ProductionBatch
- Workspace
- Project
- OperationalTask
- ScanDocument
- ScanField
- Template
- ExecutionLog

### ResourceContext

- Product
- Material
- Warehouse
- InventoryMovement
- InventoryTransfer
- Purchase
- PurchaseItem
- Supplier
- ResourceConsumption

### FinanceContext

- Account
- Voucher
- VoucherLine
- JournalEntry
- JournalLine
- TaxRule
- Period
- Reconciliation
- PayrollEmployee
- PayrollRun
- PayrollEntry

### AnalyticsContext

- ReportDefinition
- KpiDefinition
- KpiSnapshot
- AuditProjection
- TraceEvent
- BiDataset

### AiContext

- AiProviderConfig
- AiPromptProfile
- AiSuggestion
- AiAuditEntry
- AiPrediction
- AiWorkflow
- AiUsageMeter

### VerticalExtensionContext

- VerticalFeature
- VerticalConfig
- VerticalRule
- DomainExtensionBinding

## 11. Permisos propuestos

Los permisos deben modelarse por dominio y capacidad.

### Estructura

- Dominio
- Subdominio
- Capacidad
- Scope

Ejemplo:

- CAPTACION.LEADS.READ
- CAPTACION.INBOX.WRITE
- VENTAS.COTIZACIONES.APPROVE
- OPERACIONES.ORDENES.EXECUTE
- RECURSOS.INVENTARIO.ADJUST
- FINANZAS.CONTABILIDAD.CLOSE
- IA.COMERCIAL.EXECUTE
- ANALITICA.REPORTES.EXPORT

### Scopes

- Empresa
- Sede
- Equipo
- Propietario
- Vertical

## 12. Qué debe ser capa transversal y qué debe quedar como módulo principal

### Debe ser transversal

- IA
- Auditoría
- Reportes y trazabilidad
- Notificaciones
- Integraciones de plataforma
- API Keys
- Billing / suscripciones
- Servicios web

### Debe permanecer como módulo principal

- Captación
- Ventas
- Operaciones
- Recursos
- Finanzas
- Verticales

## 13. Módulos redundantes o mal ubicados hoy

### Mal ubicados

- POS aparece hoy como parte de Comercial, pero conceptualmente debe vivir entre Ventas y Finanzas.
- Tareas CRM convive con espacios de trabajo y chat en una lógica de productividad; debe separarse en tareas comerciales y tareas operativas.
- Productos aparece cerca de Operaciones, pero pertenece a Recursos.
- Litografía mezcla vertical, operación y capacidades IA creativas en un mismo bloque.
- Auditorías IA aparecen por vertical o dominio, pero deben además proyectarse a Analítica/Auditoría transversal.

### Redundancias conceptuales

- CRM y Comercial se superponen en la lectura actual del producto.
- IA de imágenes y litografía IA están organizadas por herramienta, no por propósito.
- Verticales como odontología y dotaciones se apoyan en módulos core, pero su posición puede inducir que sean módulos base y no extensiones.

## 14. Modelo de verticales

Las verticales no deben copiar CRM, ventas, operaciones, recursos y finanzas. Deben extenderlos.

### Regla de diseño

Vertical = Base común + configuración + flujos + entidades específicas de industria

### Ejemplos

#### Litografía

- Usa Captación, Ventas, Operaciones, Recursos y Finanzas
- Agrega: imposición, papel, acabados, cotización técnica, vectorización, diseño asistido

#### Restaurantes

- Usa Núcleo, Ventas, Recursos y Finanzas
- Agrega: mesas, comandas, cocina, recetas, consumo rápido

#### Odontología

- Usa Captación, Ventas, Operaciones y Finanzas
- Agrega: pacientes, planes de tratamiento, procedimientos, historias clínicas

#### Dotaciones

- Usa Ventas, Recursos y Operaciones
- Agrega: tallas, kits, entregas por colaborador, reposiciones

## 15. Roadmap de evolución a 3 años

### Año 1. Reorganización estructural

Objetivo: alinear arquitectura funcional y navegación con dominio real.

- Formalizar capas de producto en navegación, permisos y onboarding
- Separar Captación, Ventas y Operaciones
- Modelar Recursos como dominio autónomo
- Separar IA por propósito
- Crear auditoría global y catálogo de trazabilidad
- Introducir SalesOrder/Pedido como entidad formal entre cotización y remisión/factura
- Separar tareas comerciales y operativas

### Año 2. Platformización

Objetivo: convertir módulos en una plataforma configurable por plan, empresa y vertical.

- Activación por dominio y subdominio
- Feature flags por industria
- API Keys y webhooks como capacidad core
- Marketplace de integraciones
- Catálogo de automatizaciones por dominio
- KPI y BI por dominio
- Modelado de contratos, suscripciones y billing empresarial

### Año 3. Inteligencia empresarial

Objetivo: convertir el producto en ERP + CRM + IA asistida por dominio.

- IA Comercial: scoring, seguimiento automático, forecast de conversión
- IA Operativa: auditoría automática, anomalías, recomendaciones de ejecución
- IA Ejecutiva: predicción de demanda, riesgo, alertas y recomendación de decisiones
- IA Creativa: diseño, imagen, vectorización y asistentes de producción
- Data mart empresarial por dominio
- Copiloto ejecutivo con vista cross-domain

## 16. Implicaciones para onboarding y venta SaaS

El producto no debe venderse como “muchos módulos”. Debe venderse como una plataforma por capas activables.

### Mensaje comercial recomendado

ERP + CRM + IA para empresas de servicios, producción y comercio.

### Traducción de producto

- Núcleo: gobierno y control
- Captación: convierta prospectos en oportunidades
- Ventas: formalice y cierre ventas
- Operaciones: ejecute y entregue
- Recursos: asegure disponibilidad
- Finanzas: controle el dinero
- Analítica: mida y decida
- IA: acelere cada dominio

## 17. Recomendación final

La reestructuración correcta no consiste en mover entradas del sidebar. Consiste en:

- redefinir dominios oficiales del producto,
- reetiquetar permisos y scopes,
- introducir entidades intermedias faltantes como Pedido,
- separar tareas comerciales de operativas,
- mover recursos fuera de operaciones,
- tratar IA y analítica como capas transversales,
- y formalizar verticales como extensiones sobre una base común.

Si se ejecuta así, el sistema deja de verse como un conjunto de herramientas agregadas y pasa a verse como una plataforma empresarial escalable.

## 18. Próximos pasos recomendados

1. Aprobación de la taxonomía oficial de dominios y subdominios.
2. Matriz de mapeo actual -> nuevo dominio por cada ruta, modelo y permiso.
3. Diseño de RBAC v2 por dominio/capacidad/scope.
4. Diseño del modelo SalesOrder/Pedido y separación de task types.
5. Redefinición de dashboard, onboarding y planes con la nueva arquitectura.