# RBAC v2 Design

Diseno objetivo de RBAC v2 para pasar del esquema actual por modulo y sede a un modelo por dominio, capacidad y scope.

Base actual observada:

- ModuleKey + AccessLevel como control principal
- SedeMembership como rol base por sede
- UserModuleAccess como override por usuario/sede/modulo
- EmpresaModuleOverride como feature toggle por empresa

Eso funciona para MVP, pero no para una plataforma SaaS empresarial por dominios.

## 1. Problemas del RBAC actual

- El permiso se asigna por modulo tecnico, no por capacidad de negocio.
- CRM concentra capacidades que deberian vivir en Captacion y Operaciones.
- No existe distincion formal entre ver, crear, aprobar, cerrar, exportar o auditar.
- El scope real se mezcla entre empresa, sede y rol local sin capa semantica clara.
- Feature enablement y autorizacion operativa conviven, pero son cosas distintas.

## 2. Objetivo de RBAC v2

Separar cuatro planos:

- Entitlement de producto: que dominios/capacidades tiene habilitada una empresa por plan.
- Membresia organizacional: donde pertenece un usuario y con que rol base.
- Permiso funcional: que puede hacer realmente dentro de un dominio.
- Scope de datos: sobre que empresa, sede, equipo o recursos puede actuar.

## 3. Estructura conceptual

### 3.1 Entitlement

Define si una empresa tiene acceso al dominio o capacidad.

Entidad conceptual:

- DomainEntitlement
- CapabilityEntitlement
- VerticalEntitlement

Ejemplos:

- empresa A tiene CAPTACION habilitado
- empresa A tiene IA_COMERCIAL habilitado
- empresa A no tiene NOMINA habilitada

### 3.2 Membership

Define la pertenencia organizacional.

Entidades:

- EmpresaMembership
- SedeMembership
- TeamMembership

Roles base sugeridos:

- OWNER
- ADMIN
- MANAGER
- LEAD
- ANALYST
- OPERATOR
- SELLER
- ACCOUNTANT
- VIEWER

### 3.3 Capability Permission

Define acciones sobre dominio/subdominio.

Estructura:

- domain
- subdomain
- capability
- effect

Ejemplo:

- CAPTACION.LEADS.READ
- CAPTACION.LEADS.WRITE
- CAPTACION.OPPORTUNITIES.CONVERT
- VENTAS.QUOTES.APPROVE
- OPERACIONES.WORK_ORDERS.EXECUTE
- RECURSOS.INVENTORY.ADJUST
- FINANZAS.ACCOUNTING.CLOSE
- ANALITICA.REPORTS.EXPORT
- IA.COMERCIAL.EXECUTE

### 3.4 Scope

Define el alcance del permiso.

Scopes sugeridos:

- GLOBAL_PLATFORM
- EMPRESA
- SEDE
- TEAM
- OWN
- ASSIGNED
- VERTICAL

Ejemplos:

- un asesor puede ver solo leads OWN o ASSIGNED
- un gerente puede aprobar cotizaciones en una SEDE
- un auditor puede ver auditorias de EMPRESA
- un jefe de equipo puede ver tareas de TEAM

## 4. Taxonomia propuesta

### Dominios

- CORE
- CAPTACION
- VENTAS
- OPERACIONES
- RECURSOS
- FINANZAS
- ANALITICA
- IA
- VERTICALES

### Subdominios sugeridos

#### CORE

- DASHBOARD
- PROFILE
- USERS
- ROLES
- EMPRESAS
- SEDES
- SETTINGS
- PLANS
- SUBSCRIPTIONS
- WEB_SERVICES
- API_KEYS
- GLOBAL_AUDIT

#### CAPTACION

- CRM
- INBOX
- LEADS
- OPPORTUNITIES
- AGENDA
- COMMERCIAL_TASKS
- FOLLOW_UPS
- PIPELINES

#### VENTAS

- QUOTER
- QUOTES
- SALES_ORDERS
- DELIVERY_NOTES
- POS
- CUSTOMERS
- BILLING

#### OPERACIONES

- WORK_ORDERS
- PRODUCTION
- LITOGRAFIA
- DOCUMENT_CAPTURE
- WORKSPACES
- PROJECTS
- OPERATIONAL_TASKS
- TEMPLATES

#### RECURSOS

- INVENTORY
- PRODUCTS
- MATERIALS
- WAREHOUSES
- PURCHASES
- SUPPLIERS
- TRANSFERS
- ADJUSTMENTS

#### FINANZAS

- INVOICING
- POS_FINANCE
- ACCOUNTING
- CHART_OF_ACCOUNTS
- VOUCHERS
- TAXES
- RECONCILIATIONS
- CLOSES
- PAYROLL

#### ANALITICA

- REPORTS
- KPI
- AUDITS
- TRACEABILITY
- BI

#### IA

- COMMERCIAL_AI
- OPERATIONAL_AI
- EXECUTIVE_AI
- CREATIVE_AI
- AI_AUDIT

## 5. Capacidades base por subdominio

Cada subdominio deberia tener capacidades estandarizadas:

- READ
- CREATE
- UPDATE
- DELETE
- ASSIGN
- APPROVE
- EXECUTE
- EXPORT
- AUDIT
- CONFIGURE

No todos los subdominios usan todas. Ejemplo:

- LEADS: READ, CREATE, UPDATE, ASSIGN, EXPORT
- QUOTES: READ, CREATE, UPDATE, APPROVE, EXPORT
- WORK_ORDERS: READ, CREATE, UPDATE, ASSIGN, EXECUTE, CLOSE
- ACCOUNTING: READ, CREATE, UPDATE, APPROVE, CLOSE, EXPORT
- AI_AUDIT: READ, EXPORT, AUDIT

## 6. Roles de referencia

### Owner empresa

- acceso de empresa completo
- administra dominios, suscripciones, integraciones, auditoria y configuracion

### Admin empresa

- opera todos los dominios habilitados
- no necesariamente administra billing de plataforma

### Manager comercial

- CAPTACION y VENTAS en scope EMPRESA o SEDE
- puede aprobar cotizaciones si se habilita

### Asesor comercial

- LEADS, OPPORTUNITIES, INBOX, COMMERCIAL_TASKS, QUOTES en OWN o ASSIGNED

### Coordinador operativo

- WORK_ORDERS, PRODUCTION, PROJECTS, OPERATIONAL_TASKS, DOCUMENT_CAPTURE en SEDE o TEAM

### Operador

- lectura y ejecucion operacional en ASSIGNED o TEAM

### Compras/abastecimiento

- PURCHASES, SUPPLIERS, INVENTORY, TRANSFERS, ADJUSTMENTS segun SEDE

### Contador

- INVOICING, ACCOUNTING, TAXES, RECONCILIATIONS, CLOSES, PAYROLL en EMPRESA o SEDE

### Auditor/analista

- REPORTS, KPI, AUDITS, TRACEABILITY, AI_AUDIT en EMPRESA

## 7. Modelo de datos conceptual RBAC v2

### Nuevas entidades sugeridas

- PermissionDomain
- PermissionCapability
- RoleTemplate
- RoleTemplatePermission
- UserPermissionGrant
- PermissionScopeGrant
- DomainEntitlement
- CapabilityEntitlement
- VerticalEntitlement
- AuditPolicy

### Reutilizacion de entidades existentes

- SedeMembership se mantiene como membership local
- Team y TeamMember se mantienen como scope TEAM
- EmpresaModuleOverride se migra progresivamente a DomainEntitlement/CapabilityEntitlement
- UserModuleAccess se migra a UserPermissionGrant

## 8. Compatibilidad con el sistema actual

### Fase puente

Mantener ModuleKey mientras se introduce el modelo nuevo.

Tabla de equivalencia inicial:

- CRM -> CAPTACION + parte de OPERACIONES
- COTIZADOR -> VENTAS + IA creativa + verticales
- MATERIALES -> RECURSOS
- POS -> VENTAS + FINANZAS
- CONTABILIDAD -> FINANZAS
- REPORTES -> ANALITICA
- CONFIG -> CORE

### Adaptador temporal

Crear un permission resolver que:

1. revise entitlements v2
2. revise grants v2
3. si no existe configuracion v2, haga fallback a ModuleKey/AccessLevel

Eso permite migracion gradual sin romper rutas existentes.

## 9. API de autorizacion objetivo

En vez de:

- requireApiAccess(ModuleKey.CRM, 'WRITE')

La meta es:

- requireCapability({ domain: 'CAPTACION', subdomain: 'INBOX', capability: 'UPDATE', scope: 'ASSIGNED' })

o:

- canUser({ domain: 'VENTAS', subdomain: 'QUOTES', capability: 'APPROVE', context: { sedeId, ownerId, assigneeId } })

## 10. Reglas clave de scope

- OWN: creador o responsable directo
- ASSIGNED: usuario asignado al recurso
- TEAM: recurso dentro del equipo del usuario
- SEDE: acceso a toda la sede
- EMPRESA: acceso cross-sede dentro de la empresa
- VERTICAL: acceso solo si la vertical esta habilitada

## 11. Implicaciones UI/UX

- El sidebar debe filtrarse por dominio y subdominio habilitado, no solo por modulo.
- El onboarding debe activar dominios y verticales, no solo hrefs.
- Los modales de permisos deben editar capacidades agrupadas por dominio.
- Las pantallas deben mostrar por que una accion esta denegada: plan, rol o scope.

## 12. Migracion recomendada

### Etapa 1

- Mantener ModuleKey + AccessLevel
- Introducir taxonomy v2 en paralelo
- Crear diccionario ModuleKey -> domain/subdomain/capability seed

### Etapa 2

- Introducir DomainEntitlement y CapabilityEntitlement
- Resolver navegacion y gating por dominio

### Etapa 3

- Introducir UserPermissionGrant y scopes
- Migrar rutas criticas: inbox, cotizaciones, ordenes, inventario, contabilidad

### Etapa 4

- Deprecar UserModuleAccess y reducir ModuleKey a capa de compatibilidad

## 13. Resultado esperado

RBAC v2 permite:

- vender por capacidades reales,
- activar dominios por plan,
- asignar permisos por proceso,
- soportar multiempresa, multisede y equipos,
- y separar acceso funcional de activacion comercial del producto.