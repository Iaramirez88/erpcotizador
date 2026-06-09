# Product Implementation Phases

Plan tecnico de implementacion para bajar la arquitectura propuesta a cambios reales de navegacion, datos, permisos y migraciones.

## 1. Objetivo del plan

Implementar la nueva arquitectura sin congelar el negocio ni romper compatibilidad con clientes, empresas o verticales actuales.

La estrategia correcta es migracion por capas, con adaptadores temporales y entregables visibles por fase.

## 2. Premisas tecnicas

- No romper rutas existentes en la primera ola.
- Mantener ModuleKey/AccessLevel mientras se introduce RBAC v2.
- Introducir nuevos conceptos de dominio sin obligar migracion inmediata de todos los datos.
- Hacer migraciones incrementales y reversibles.
- Separar refactor funcional, refactor de permisos y refactor de datos.

## 3. Fases

### Fase 0. Preparacion y diccionario de dominio

Objetivo: crear la capa de traduccion entre producto actual y futuro.

Entregables:

- Matriz actual -> futuro aprobada
- Taxonomia oficial de dominios y subdominios
- Diccionario ModuleKey -> Domain/Subdomain
- Definicion oficial de scopes
- Lista de entidades faltantes

Cambios tecnicos:

- agregar catalogo de dominios en src/lib/product-architecture.ts
- agregar catalogo de permisos v2 en src/lib/rbac-v2-catalog.ts
- agregar mapping actual -> futuro para rutas y modulos

Migraciones:

- ninguna todavia

### Fase 1. Navegacion y arquitectura visible

Objetivo: alinear la UX con el modelo de producto.

Entregables:

- sidebar por capas oficiales
- dashboard por dominios
- product map interno enlazado
- onboarding por dominios y verticales

Cambios tecnicos:

- refactor de src/lib/dashboard-navigation.ts para usar domain definitions
- refactor de src/components/dashboard/sidebar.tsx para render por capa/subdominio
- refactor de start cards y dashboard home para usar domains
- exponer verticales como extensiones, no como modulos base mezclados

Migraciones:

- ninguna de datos, solo ajustes de configuracion UI si hace falta

Riesgos:

- confundir usuarios existentes si desaparecen entradas conocidas

Mitigacion:

- mantener redirects y aliases de navegacion

### Fase 2. RBAC v2 puente

Objetivo: introducir autorizacion por dominio/capacidad/scope sin romper el control actual.

Entregables:

- resolver de permisos v2 en paralelo al actual
- entitlements por dominio/capacidad
- grants por usuario/rol/scope

Cambios tecnicos:

- crear nuevas tablas conceptuales:
  - permission_domains
  - permission_capabilities
  - role_templates
  - role_template_permissions
  - user_permission_grants
  - permission_scope_grants
  - domain_entitlements
  - capability_entitlements
- crear service layer:
  - src/lib/rbac-v2.ts
  - src/lib/entitlements.ts
  - src/lib/permission-resolver.ts
- adaptar plan-module-gate para consultar domains además de modules

Migraciones:

- migracion prisma para tablas nuevas
- seed inicial de dominios/capacidades/role templates

Compatibilidad:

- fallback a ModuleKey/AccessLevel cuando no exista grant v2

### Fase 3. Particion funcional de dominios

Objetivo: separar donde hoy hay mezcla conceptual.

Entregables:

- Captacion separada de Ventas
- Recursos separado de Operaciones
- IA separada por propósito

Cambios tecnicos:

- introducir category metadata por ruta y modulo
- partir CRM tasking en dos conceptos:
  - commercial tasks
  - operational tasks
- mover productos definitivamente a Recursos
- reubicar auditorias IA como lectura dual: IA + Analitica

Migraciones:

- si se crean nuevas tablas OperationalTask o TaskType, migrar desde CrmTask con rule-based mapping

### Fase 4. Modelo de ventas formal

Objetivo: cerrar el hueco entre cotizacion y entrega/facturacion.

Entregables:

- entidad SalesOrder / Pedido
- estados comerciales consistentes
- trazabilidad quote -> order -> remision -> invoice

Cambios tecnicos:

- agregar modelo SalesOrder
- agregar SalesOrderItem
- conectar CrmOpportunity -> Quote -> SalesOrder -> Delivery/Invoice
- actualizar cotizador, cotizaciones, remisiones y POS

Migraciones:

- migracion prisma para SalesOrder y SalesOrderItem
- scripts de backfill para remisiones/facturas originadas desde cotizaciones historicas

### Fase 5. Operaciones y produccion

Objetivo: formalizar ejecucion operativa mas alla de ordenes aisladas.

Entregables:

- work order lifecycle
- projects/workspaces coherentes
- operational tasks dedicadas
- produccion como subdominio real

Cambios tecnicos:

- extender OrdenTrabajo o introducir ProductionOrder
- conectar work orders a sales orders y resource consumption
- crear vistas por cola operativa, equipo y SLA interno

Migraciones:

- columnas de referencia orderId/salesOrderId/projectId donde falten

### Fase 6. Recursos y consumo

Objetivo: cerrar el flujo compras -> inventario -> operacion -> consumo.

Entregables:

- ajustes de inventario formales
- consumo por orden o produccion
- costo real por trabajo

Cambios tecnicos:

- agregar InventoryAdjustment
- agregar ResourceConsumption
- conectar consumo a WorkOrder/ProductionOrder
- exponer costo real vs costo estimado

Migraciones:

- migracion prisma de ajustes y consumos
- backfill opcional de consumo desde movimientos historicos tipificados

### Fase 7. Finanzas integradas

Objetivo: conectar ventas, compras y nomina a contabilidad con mas trazabilidad.

Entregables:

- facturacion formal separada de POS operativo
- journal/audit linkage por documento de origen
- cierres y conciliaciones mas automáticas

Cambios tecnicos:

- reforzar relation sourceType/sourceId en comprobantes y asientos
- separar vistas POS operativo vs POS financiero
- elevar reportes fiscales a Finanzas

Migraciones:

- columnas de origen en vouchers/journal entries si faltan

### Fase 8. Analitica e IA transversal

Objetivo: dejar de ver reportes e IA como herramientas sueltas.

Entregables:

- capa de KPI por dominio
- auditoria transversal
- catalogo de automatizaciones IA
- costeo y uso IA por empresa/usuario/dominio

Cambios tecnicos:

- tablas de kpi definitions / snapshots
- projection tables para audit y traceability
- ai usage metering y ai workflow catalog
- dashboards ejecutivos cross-domain

Migraciones:

- nuevas tablas analiticas y de IA

## 4. Cambios de navegacion por fase

### Ola 1

- sidebar por dominios
- product map visible
- inbox expuesto en Captacion

### Ola 2

- Captacion y Ventas separados en home y onboarding
- Verticales visibles como extensiones

### Ola 3

- Analitica e IA como capas transversales navegables

## 5. Cambios de modelo de datos prioritarios

### Alta prioridad

- SalesOrder
- UserPermissionGrant / DomainEntitlement / CapabilityEntitlement
- Task split o TaskType
- GlobalAuditEvent / AuditProjection

### Media prioridad

- ProductionOrder
- ResourceConsumption
- InventoryAdjustment
- KpiSnapshot
- AiUsageMeter

### Baja prioridad

- ApiKey core dedicada
- Subscription/Plan billing refinado
- DomainExtensionBinding para verticales complejas

## 6. Orden sugerido de migraciones Prisma

1. tablas RBAC v2 y entitlements
2. tablas de audit/trazabilidad transversal
3. SalesOrder / SalesOrderItem
4. columnas de referencia quoteId/orderId en remisiones/ordenes/facturas
5. Task split o task type
6. tablas operativas nuevas: ProductionOrder, ResourceConsumption, InventoryAdjustment
7. tablas analiticas e IA

## 7. Cambios de codigo esperados

### Librerias nuevas

- src/lib/product-architecture.ts
- src/lib/rbac-v2.ts
- src/lib/permission-resolver.ts
- src/lib/domain-navigation.ts
- src/lib/domain-entitlements.ts

### Refactors criticos

- src/lib/dashboard-navigation.ts
- src/components/dashboard/sidebar.tsx
- src/components/dashboard/start-cards-grid.tsx
- src/components/dashboard/onboarding-gate.tsx
- src/components/rbac/user-permissions-modal.tsx
- src/lib/api-rbac.ts

### APIs a migrar primero

- CRM inbox
- cotizaciones
- ordenes
- inventario
- contabilidad
- reportes

## 8. Secuencia de rollout recomendada

- primero navegacion y taxonomia
- luego permisos y compatibilidad
- luego datos faltantes de ventas
- luego operaciones/recursos
- luego finanzas integradas
- al final analitica e IA transversal

## 9. Criterios de exito

- cualquier ruta puede ubicarse claramente en una capa de producto
- cualquier accion puede expresarse como domain + subdomain + capability + scope
- cualquier empresa puede encender dominios y verticales sin hacks por href
- cualquier usuario puede entender el producto por proceso de negocio y no por historial de desarrollo
- el sistema puede venderse como ERP + CRM + IA por capas activables

## 10. Recomendacion operativa inmediata

Las siguientes tres tareas deberian iniciar primero:

1. crear catalogo oficial de dominios/subdominios/capacidades
2. implementar adapter de permisos v2 con fallback al modelo actual
3. modelar SalesOrder y separacion de task types

Esas tres piezas habilitan el resto del roadmap sin rehacer todo el sistema de una sola vez.