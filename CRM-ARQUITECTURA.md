# Arquitectura CRM integrada al ERP (SGDigital)

**Fecha:** 2026-03-13  
**Objetivo:** agregar un CRM **sin duplicar** entidades del ERP (clientes/usuarios/cotizaciones/órdenes/facturación), reutilizando el multitenancy por `empresaId`, el enfoque multi-sede (`sedeId`) y el RBAC existente por `ModuleKey` + `AccessLevel`.

---

## 1) Alcance (MVP)

El CRM debe cubrir:

- **Prospección:** Leads (potenciales) + contactos + fuente + etiquetas.
- **Pipeline de ventas:** Oportunidades (de un lead o de un cliente existente) con etapas, valor esperado, probabilidad y fecha estimada de cierre.
- **Gestión comercial:** actividades (llamada, WhatsApp, email, visita) + notas + tareas + recordatorios.
- **Conversión / Integración ERP:**
  - Lead → Cliente (ERP) **sin duplicar información**: se crea `Cliente` (si aplica) y se marca conversión en CRM.
  - Oportunidad → Cotización (ERP): vincular `Cotizacion` existente o creada.
  - Cotización → Orden (ERP): ya existe relación en el ERP; el CRM solo referencia.

Fuera de alcance del MVP (puede venir después): automatizaciones, campañas masivas, scoring avanzado, integración WhatsApp oficial, sincronización email.

---

## 2) Principios de diseño

1) **No duplicar ERP**
- `Cliente` sigue siendo el “account” real del negocio.
- El CRM agrega entidades **comerciales**: `CrmLead`, `CrmOpportunity`, `CrmActivity`, `CrmTask`, etc.

2) **Multi-tenant primero**
- Todas las tablas CRM tienen `empresaId` obligatorio.

3) **Compatibilidad multi-sede (sin fragmentar)**
- En CRM, `sedeId` es opcional:
  - Si existe: el registro se considera de una sede.
  - Si es `null`: registro global de la empresa (visible según permisos globales).

4) **RBAC consistente con el sistema**
- Usar `requireApiAccess(ModuleKey.CRM, <nivel>)`.
- Respetar `sedeId` target cuando el recurso pertenece a una sede concreta (similar a `src/app/api/clientes/route.ts`).

5) **Auditabilidad mínima**
- `createdAt/updatedAt` en todo.
- `createdById` en entidades clave (lead/oportunidad/actividad).

---

## 3) Cambios mínimos necesarios en RBAC

### 3.1 Prisma enum
Agregar una llave de módulo:

- `ModuleKey.CRM`

**Notas de implementación:**
- Actualizar `ModuleKey` en `prisma/schema.prisma`.
- Actualizar listas hardcodeadas donde validan módulos (por ejemplo el set en `src/app/api/sedes/[id]/permisos/route.ts`).
- Actualizar `NAV_MODULES` en `src/lib/rbac.ts` si quieres que aparezca en navegación.

---

## 4) Modelo de datos propuesto (Prisma)

### 4.1 CRM Lead (prospecto)
Representa un potencial cliente **aún no convertido**.

Campos sugeridos:
- `id`, `empresaId`, `sedeId?`
- `status`: `NEW | CONTACTED | QUALIFIED | LOST | CONVERTED`
- Datos base: `nombre`, `empresaNombre?`, `documento?`, `email?`, `telefono?`, `celular?`, `direccion?`, `ciudad?`
- `source`: `WEB | REFERIDO | WHATSAPP | LLAMADA | IMPORT | OTRO`
- `tags: String[]` (MVP) o tabla normalizada (post-MVP)
- `ownerUserId?` (responsable comercial)
- `convertedAt?`, `convertedClienteId?` (relación a `Cliente`)
- `lastActivityAt?` (derivado en app o persistido)

Relaciones:
- 0..N oportunidades (`CrmOpportunity`)
- 0..N actividades (`CrmActivity`)
- 0..N tareas (`CrmTask`)

### 4.2 CRM Contacto (opcional, recomendado)
El ERP hoy tiene 1 contacto “principal” dentro de `Cliente`. CRM típicamente necesita múltiples contactos.

Opción A (más limpia):
- `CrmContact` con relación opcional a `CrmLead` o a `Cliente`.

Campos:
- `id`, `empresaId`, `sedeId?`
- `leadId?`, `clienteId?` (validación en app: exactamente uno)
- `nombre`, `email?`, `telefono?`, `cargo?`, `isPrimary` (por entidad)

### 4.3 Pipeline / Etapas
Para no hardcodear, se sugiere configuración por empresa:

- `CrmPipeline` (empresa)
- `CrmStage` (etapas ordenadas)

MVP alternativo si se quiere simple: stages fijas en enum. Pero lo recomendado es tablas configurables.

### 4.4 CRM Opportunity (oportunidad)
Representa un “posible negocio” asociado a un lead o a un cliente.

Campos:
- `id`, `empresaId`, `sedeId?`
- `title`, `description?`
- `leadId?` o `clienteId?`
- `stageId` (o enum si MVP ultra simple)
- `expectedValue` (Float), `probabilityPct` (0..100), `expectedCloseAt?`
- `assignedToUserId?`, `createdById?`
- `lostReason?`, `wonAt?`, `lostAt?`
- `cotizacionId?` (relación a `Cotizacion` si se generó)

Integración:
- Si se crea cotización desde oportunidad, guardar `cotizacionId`.
- Para win/loss, se puede automatizar: si `Cotizacion.ventaRealizadaAt` se setea, marcar oportunidad como WON (post-MVP: job/trigger lógico).

### 4.5 Actividades / Timeline
Registrar interacción comercial y construir “línea de tiempo”.

- `CrmActivity`:
  - `type`: `NOTE | CALL | EMAIL | WHATSAPP | MEETING | TASK_DONE | STAGE_CHANGE | QUOTE_SENT | OTHER`
  - `leadId?`, `opportunityId?`, `clienteId?`
  - `occurredAt` (fecha real), `createdAt` (registro)
  - `summary`, `details?`
  - `createdById`

### 4.6 Tareas
- `CrmTask`:
  - `status`: `OPEN | DONE | CANCELED`
  - `dueAt?`, `priority`: `LOW | NORMAL | HIGH`
  - `assignedToUserId?`, `createdById`
  - `leadId?`, `opportunityId?`, `clienteId?`

---

## 5) Reglas de consistencia (sin duplicar ERP)

### 5.1 Lead → Cliente
- Si un lead se convierte:
  - Crear `Cliente` (ERP) si no existe.
  - Guardar `convertedClienteId` y `convertedAt`.
  - Marcar `status = CONVERTED`.

Regla de deduplicación recomendada:
- Si `documento` del lead existe, buscar `Cliente.documento` (es `@unique`) antes de crear.
- Si no hay documento, buscar por email + nombre (heurístico).

### 5.2 Oportunidad asociada a Cliente existente
- Permitir crear oportunidades directamente sobre `Cliente` (sin lead).

### 5.3 Oportunidad → Cotización (ERP)
- Crear cotización en `Cotizacion` y vincular.
- Las actividades del CRM registran eventos como `QUOTE_SENT`, `QUOTE_APPROVED`, etc. (aunque el estado real viva en ERP).

---

## 6) API (App Router) propuesta

Convención existente:
- Autorización central con `requireApiAccess(ModuleKey.<...>, 'READ'|'WRITE'|'ADMIN')`.
- Cuando llega `sedeId` por query/body, validar que pertenece a la empresa y llamar a `requireSedeAccess`.

### 6.1 Rutas (MVP)

- `GET /api/crm/leads?search=&status=&sedeId=`
- `POST /api/crm/leads`
- `GET /api/crm/leads/:id`
- `PATCH /api/crm/leads/:id`

- `POST /api/crm/leads/:id/convert` → crea/vincula `Cliente`

- `GET /api/crm/opportunities?search=&stageId=&assignedToUserId=&sedeId=`
- `POST /api/crm/opportunities`
- `PATCH /api/crm/opportunities/:id`

- `POST /api/crm/activities` (crear actividad; la lista puede colgar de lead/oportunidad)
- `GET /api/crm/timeline?leadId=&opportunityId=&clienteId=`

- `POST /api/crm/tasks`
- `PATCH /api/crm/tasks/:id`

Respuesta/Errores:
- Reutilizar patrón de `{ error: '...' }` y códigos 400/401/403/404.

---

## 7) UI (propuesta de rutas)

**Nota:** esto es diseño; no implica construir todo de una.

- `/dashboard/crm` (resumen)
- `/dashboard/crm/leads` (lista)
- `/dashboard/crm/leads/[id]` (detalle + timeline + tareas)
- `/dashboard/crm/oportunidades` (pipeline kanban opcional post-MVP)

MVP sugerido de UI: listas + detalle (sin kanban inicialmente).

---

## 8) Índices y performance

Recomendaciones:
- Índices por `empresaId` + `createdAt` para listas.
- Índices por `empresaId` + `sedeId` cuando aplique.
- Índices por `assignedToUserId` para colas de trabajo.
- Índice por `lastActivityAt` si se persiste y se ordena por ahí.

---

## 9) Plan de implementación por fases

**Fase A (DB + RBAC):**
- Agregar `ModuleKey.CRM`.
- Crear modelos CRM mínimos: `CrmLead`, `CrmOpportunity`, `CrmActivity`, `CrmTask`.

**Fase B (API mínima):**
- CRUD básico de leads.
- Convert lead → cliente.
- Crear oportunidades.
- Registrar actividades y tareas.

**Fase C (UI mínima):**
- Listado leads + formulario.
- Detalle lead con timeline y tareas.
- Listado oportunidades.

**Fase D (Integración ERP):**
- Crear cotización desde oportunidad y guardar vínculo.
- Timeline con eventos del ERP (enviado/aprobado/venta realizada).

---

## 10) Decisiones abiertas (para confirmar)

1) ¿El CRM se maneja **por sede** (default) o más global por empresa? (recomendación: `sedeId` opcional con filtro por sede por defecto).
2) ¿Necesitamos múltiples contactos por cliente en MVP? (recomendación: sí, con `CrmContact`, pero se puede postergar).
3) ¿Pipeline configurable por empresa desde el inicio, o etapas fijas? (recomendación: configurable por empresa).

---

## 11) Omnicanalidad pendiente: WhatsApp, Facebook, Messenger, chatbot y formularios

El CRM actual ya cubre bien el núcleo comercial interno:

- lead
- oportunidad
- actividad
- tarea
- timeline ERP + CRM

Lo que todavía **no está contemplado formalmente** es la capa de adquisición y conversación omnicanal tipo Kommo:

- captura de leads desde formularios web
- inbound desde WhatsApp
- inbound desde Facebook / Messenger
- chatbot inicial de calificación
- bandeja unificada de conversaciones
- reglas de asignación y automatización por funnel

La recomendación es **no mezclar esto directamente dentro de `CrmLead` y `CrmActivity`**. Conviene agregar una capa intermedia de canales y conversaciones, para no acoplar el funnel a un proveedor específico.

---

## 12) Objetivo funcional tipo Kommo

Flujo objetivo recomendado:

1. Un visitante entra por un canal:
  - formulario web
  - botón de WhatsApp
  - anuncio/meta lead ad
  - Messenger / Facebook
  - chatbot embebido
2. El sistema crea o actualiza una **conversación**.
3. El sistema intenta hacer matching con un lead existente usando:
  - teléfono
  - email
  - documento
  - combinación heurística nombre + canal
4. Si no existe lead, crea uno con su `source` y metadatos de campaña.
5. El bot o el asesor realiza la **calificación inicial**.
6. Cuando hay intención comercial real, se crea o actualiza una **oportunidad**.
7. Desde la oportunidad se dispara el flujo actual del ERP:
  - cotización
  - aprobación
  - orden
  - venta
8. Toda interacción relevante queda en timeline.

Eso permite un funnel real tipo Kommo sin duplicar la parte operativa del ERP.

---

## 13) Capa de datos recomendada para omnicanalidad

### 13.1 Nuevas entidades sugeridas

#### CrmChannelConnection
Representa una conexión configurada por empresa a un canal externo.

Campos sugeridos:
- `id`, `empresaId`, `sedeId?`
- `provider`: `WHATSAPP_CLOUD | WHATSAPP_PROXY | FACEBOOK_PAGE | MESSENGER | WEB_FORM | WEB_CHATBOT | INSTAGRAM_DM`
- `name`
- `status`: `DRAFT | TESTING | ACTIVE | DISABLED | ERROR`
- `externalAccountId?`
- `externalPageId?`
- `externalPhoneNumberId?`
- `verifyToken?`
- `accessTokenEncrypted?`
- `webhookSecretEncrypted?`
- `settingsJson`
- `lastSyncAt?`, `lastWebhookAt?`, `lastErrorAt?`, `lastErrorMessage?`
- `createdById?`

#### CrmConversation
Es el hilo principal tipo inbox.

Campos sugeridos:
- `id`, `empresaId`, `sedeId?`
- `channelConnectionId`
- `leadId?`, `clienteId?`, `opportunityId?`
- `status`: `OPEN | PENDING | BOT_ACTIVE | HUMAN_ACTIVE | RESOLVED | SPAM`
- `directionLastMessage`: `INBOUND | OUTBOUND`
- `externalThreadId?`
- `contactDisplayName?`
- `contactPhone?`, `contactEmail?`
- `assignedToUserId?`
- `lastMessageAt`, `firstInboundAt?`, `resolvedAt?`
- `unreadCount`
- `source`, `sourceCampaign`, `sourceMedium`, `sourceContent`

#### CrmMessage
Cada mensaje inbound/outbound del hilo.

Campos sugeridos:
- `id`, `empresaId`, `sedeId?`
- `conversationId`
- `providerMessageId?`
- `direction`: `INBOUND | OUTBOUND | SYSTEM`
- `messageType`: `TEXT | IMAGE | AUDIO | DOCUMENT | TEMPLATE | FORM_SUBMISSION | EVENT`
- `status`: `RECEIVED | QUEUED | SENT | DELIVERED | READ | FAILED`
- `bodyText?`
- `payloadJson`
- `attachmentsJson?`
- `sentByUserId?`
- `botFlowId?`
- `occurredAt`

#### CrmLeadCapture
Registro técnico del ingreso del lead, separado del lead comercial.

Campos sugeridos:
- `id`, `empresaId`, `sedeId?`
- `channelConnectionId`
- `leadId?`
- `conversationId?`
- `providerLeadId?`
- `captureType`: `WEB_FORM | META_LEAD_AD | WHATSAPP_INBOUND | MESSENGER_INBOUND | CHATBOT_START | MANUAL_IMPORT`
- `rawPayloadJson`
- `normalizedDataJson`
- `utmSource?`, `utmMedium?`, `utmCampaign?`, `utmContent?`, `utmTerm?`
- `landingPageUrl?`
- `referrerUrl?`
- `createdAt`

#### CrmAutomationRule
Reglas simples de asignación y automatización.

Campos sugeridos:
- `id`, `empresaId`
- `name`
- `enabled`
- `triggerType`: `LEAD_CREATED | MESSAGE_RECEIVED | STAGE_CHANGED | TASK_OVERDUE | QUOTE_SENT`
- `conditionsJson`
- `actionsJson`
- `lastExecutedAt?`

#### CrmBotFlow
Flujos de bot básicos para pruebas y precalificación.

Campos sugeridos:
- `id`, `empresaId`
- `name`
- `channelScope`: `WHATSAPP | MESSENGER | WEB_CHAT`
- `enabled`
- `definitionJson`
- `handoffStageKey?`

### 13.2 Por qué separar esta capa

Separar conversación/mensaje/canal del lead evita varios problemas:

- un mismo lead puede escribir por más de un canal
- una conversación puede existir antes de que el lead quede calificado
- Facebook/Messenger/WhatsApp tienen payloads muy distintos
- el bot puede intervenir sin contaminar el modelo comercial principal
- se puede cambiar de proveedor sin romper el CRM base

---

## 14) Funnel recomendado para leads omnicanal

Estados recomendados del funnel de captura antes del pipeline de ventas:

1. `NEW_INBOUND`
2. `PENDING_CLASSIFICATION`
3. `BOT_QUALIFYING`
4. `READY_FOR_AGENT`
5. `CONTACTED`
6. `QUALIFIED`
7. `DISQUALIFIED`
8. `CONVERTED_TO_OPPORTUNITY`

Luego entra al pipeline comercial ya existente de oportunidades.

La recomendación práctica es:

- no usar `CrmLead.status` para modelar todos los estados conversacionales
- usar `CrmConversation.status` para la operación del inbox
- usar `CrmLead.status` para el estado comercial
- usar `CrmOpportunity.stageId` para el negocio activo

---

## 15) Integraciones recomendadas por canal

### 15.1 WhatsApp

Recomendación:

- corto plazo / pruebas: webhook propio o proxy existente
- mediano plazo / producción: WhatsApp Cloud API oficial de Meta

En este repo ya existe una base simple en `src/lib/whatsapp.ts`, pero hoy sirve más como envío puntual que como bandeja omnicanal. Para el CRM tipo Kommo hace falta completar:

- webhook inbound
- persistencia de conversación y mensajes
- estados de entrega/lectura
- plantillas aprobadas para primer contacto fuera de ventana
- asignación asesor / handoff bot -> humano

### 15.2 Facebook / Messenger

Recomendación:

- integrar vía Graph API + Webhooks de Meta
- tratar Messenger como otro `provider`, no como excepción de negocio

Esto permite que Facebook Page, Messenger y eventualmente Instagram DM compartan la misma base conceptual.

### 15.3 Formularios web

Recomendación:

- crear endpoint propio de captura, por ejemplo `POST /api/crm/captures/web-form`
- guardar payload crudo + versión normalizada
- deduplicar antes de crear lead nuevo
- registrar UTM y landing page

Esto debe ser el primer canal a implementar porque es el más barato, simple y controlable.

### 15.4 Chatbot

Recomendación:

- no empezar con IA abierta completa
- empezar con bot de árbol guiado por preguntas estructuradas
- usar IA solo para clasificación o resumen, no para control completo del funnel

Preguntas mínimas sugeridas:

- nombre
- empresa
- teléfono / WhatsApp
- email
- producto o servicio de interés
- volumen estimado / cantidades
- ciudad o sede
- plazo requerido

Luego el bot debe:

- actualizar lead
- crear actividad
- marcar conversación como `READY_FOR_AGENT` si detecta intención alta

---

## 16) Recomendación de producto: qué es lo mejor

Si la meta es algo parecido a Kommo, lo mejor no es arrancar por todos los canales a la vez. La secuencia más sana sería:

### Fase 1: base propia controlada
- formularios web
- inbox WhatsApp en modo prueba
- timeline y asignación de asesor
- reglas simples de deduplicación

### Fase 2: omnicanal real
- Messenger / Facebook
- chatbot web
- handoff bot -> humano
- automatizaciones por SLA y falta de respuesta

### Fase 3: marketing + performance
- campañas y UTM completas
- lead ads de Meta
- scoring
- attribution básica
- tableros de conversión por fuente

La razón es simple:

- WhatsApp y formularios generan valor inmediato
- Messenger y chatbot agregan complejidad operativa
- ads y attribution tienen sentido cuando el funnel base ya responde bien

---

## 17) Modo pruebas recomendado

La idea de dejarlo en modo pruebas es correcta. Recomendación:

### 17.1 Objetivo del modo pruebas

Permitir validar:

- captura de leads
- creación de conversaciones
- asignación a asesor
- disparo de oportunidades
- trazabilidad del timeline

Sin depender todavía de integración oficial completa en producción.

### 17.2 Cómo operarlo

- `CrmChannelConnection.status = TESTING`
- feature flag por empresa: `crmOmnichannelTesting = true`
- endpoints sandbox separados para webhooks
- mensajes outbound marcados como prueba
- opción de “simular inbound” desde UI interna

### 17.3 Qué sí debería quedar en pruebas

- webhook receptor de mensajes
- persistencia de `CrmConversation` y `CrmMessage`
- ingestión de formularios web
- bot guiado básico
- asignación manual y automática
- timeline unificado CRM + ERP + conversaciones

### 17.4 Qué no meter todavía

- campañas masivas
- IA autónoma respondiendo sin supervisión
- automatizaciones complejas multi-canal
- sincronización bidireccional avanzada con Meta ads

---

## 18) Reglas mínimas del flujo omnicanal

1. Todo mensaje inbound debe caer primero en `CrmConversation`.
2. Crear `CrmLead` solo cuando haya identidad mínima o intención comercial.
3. Si ya existe `Cliente`, la conversación puede vincularse directo al cliente.
4. Solo crear `CrmOpportunity` cuando exista negocio potencial concreto.
5. Toda acción automática debe crear `CrmActivity` de auditoría.
6. Si el bot entrega el caso a humano, debe registrarse el evento.
7. Si se genera cotización desde el hilo, debe persistirse el vínculo conversación -> oportunidad -> cotización.

---

## 19) API sugerida para el siguiente paso

Rutas mínimas recomendadas para modo pruebas:

- `POST /api/crm/captures/web-form`
- `POST /api/crm/channels/:id/webhook`
- `GET /api/crm/conversations`
- `GET /api/crm/conversations/:id`
- `POST /api/crm/conversations/:id/messages`
- `POST /api/crm/conversations/:id/assign`
- `POST /api/crm/conversations/:id/create-opportunity`
- `POST /api/crm/conversations/:id/link-lead`
- `POST /api/crm/conversations/:id/resolve`

Esto ya permitiría una primera operación tipo inbox + funnel sin tener que construir todavía todo Kommo.

---

## 20) Recomendación final

La mejor estrategia para SGDigital es:

- mantener el CRM actual como núcleo comercial
- agregar una capa omnicanal separada de conversaciones y mensajes
- arrancar con formularios web + WhatsApp en modo pruebas
- dejar Facebook/Messenger/chatbot como segunda ola
- usar el ERP existente como destino natural de la conversión

En otras palabras: **primero inbox y captura, luego automatización, luego marketing**.

Ese orden reduce riesgo, acelera validación y deja una base mucho más sólida para crecer después.

---

## 21) Estado implementado en modo pruebas

Ya quedó montada una base técnica inicial para pruebas en el proyecto:

- modelos Prisma para:
  - `CrmChannelConnection`
  - `CrmConversation`
  - `CrmMessage`
  - `CrmLeadCapture`
- endpoint autenticado para crear/listar conexiones:
  - `GET /api/crm/channels`
  - `POST /api/crm/channels`
- endpoint sandbox de formularios:
  - `POST /api/crm/captures/web-form`
- endpoint sandbox de webhook por canal:
  - `GET /api/crm/channels/:id/webhook`
  - `POST /api/crm/channels/:id/webhook`

### 21.1 Qué hace este primer corte

- crea o actualiza lead por deduplicación básica
- crea conversación inbound
- registra mensaje inbound
- crea captura técnica del origen
- registra actividad CRM de auditoría
- deja el canal en estado `TESTING` o `ACTIVE`

### 21.2 Qué falta todavía

- UI inbox de conversaciones
- responder mensajes desde la plataforma
- asignación visual de conversaciones
- convertir conversación a oportunidad desde interfaz
- bot guiado
- estados de entrega / lectura reales de Meta

### 21.3 Ejemplo de creación de canal de pruebas

`POST /api/crm/channels`

Body ejemplo:

```json
{
  "provider": "WEB_FORM",
  "name": "Formulario principal landing",
  "status": "TESTING",
  "verifyToken": "sgd-test-form-001",
  "settingsJson": {
    "testingToken": "sgd-test-form-001"
  }
}
```

Para WhatsApp sandbox:

```json
{
  "provider": "WHATSAPP_SANDBOX",
  "name": "WhatsApp pruebas comercial",
  "status": "TESTING",
  "verifyToken": "sgd-test-wa-001",
  "settingsJson": {
    "testingToken": "sgd-test-wa-001"
  }
}
```

### 21.4 Ejemplo de captura desde formulario web

`POST /api/crm/captures/web-form`

Header:

- `x-crm-channel-token: sgd-test-form-001`

Body ejemplo:

```json
{
  "channelId": "<crmChannelConnectionId>",
  "nombre": "Carlos Ramirez",
  "email": "carlos@cliente.com",
  "telefono": "573001112233",
  "empresaNombre": "Impresos Ramirez",
  "mensaje": "Necesito cotizar 500 flyers y 200 carpetas.",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "campana-flyers",
  "landingPageUrl": "https://tusitio.com/flyers"
}
```

### 21.5 Ejemplo de webhook sandbox para WhatsApp / Messenger

`POST /api/crm/channels/:id/webhook`

Header:

- `x-crm-webhook-token: sgd-test-wa-001`

Body ejemplo:

```json
{
  "externalThreadId": "wa-573001112233",
  "providerMessageId": "wamid-001",
  "nombre": "Carlos Ramirez",
  "telefono": "573001112233",
  "message": "Hola, quiero una cotización de stickers.",
  "metadata": {
    "campaign": "whatsapp-boton-home",
    "medium": "whatsapp",
    "content": "boton-home"
  }
}
```

### 21.6 Siguiente fase recomendada sobre esta base

1. construir `/dashboard/crm/conversations`
2. permitir asignar conversación a asesor
3. permitir crear oportunidad desde conversación
4. agregar simulador interno de inbound para QA
