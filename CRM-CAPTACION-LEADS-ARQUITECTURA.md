# CRM ORDEx — Fase 1: Auditoría de Captación y Gestión de Leads

**Fecha de auditoría:** 2026-11-13
**Alcance:** módulo CRM (`cotizador-inteligente`), foco en captación (formularios web / lead magnets), contactos, conversaciones, pipelines y seguimiento.
**Documentos relacionados:** `CRM-ARQUITECTURA.md` (diseño original), `CRM-MADUREZ-ROADMAP.md` (madurez y fases), `CRM-FASE1-BACKLOG.md`, `CRM-INTEGRACIONES-BACKLOG.md`.
**Estado:** FASE 2–7 ejecutadas. Captación, bandeja de leads, scoring, asignación, secuencias y pipelines (API) implementados y verificados (§23).

---

## 0. Índice

1. Resumen ejecutivo
2. Stack y convenciones verificadas
3. Inventario actual del CRM
4. Traza real de una captura web (flujo actual)
5. Causa raíz del comportamiento reportado
6. Matriz de brechas frente al requerimiento
7. Arquitectura objetivo
8. Cambios de modelo de datos propuestos (delta Prisma)
9. Índices, unicidad y deduplicación
10. Migraciones: orden, SQL de referencia y compatibilidad
11. Backend: endpoints nuevos y ajustados
12. Frontend: bandeja de leads y ficha
13. RBAC y alcance por registro
14. Lead scoring
15. Reglas de asignación
16. Motor de secuencias (automatizaciones)
17. Historial unificado
18. Reutilización explícita (qué NO se duplica)
19. Plan de ejecución por fases
20. Pruebas y criterios de aceptación
21. Riesgos y decisiones que requieren aprobación
22. Siguiente paso
23. Estado de ejecución (incluye FASE 2–7)

---

## 1. Resumen ejecutivo

El CRM actual **no está en etapa CRUD**: ya tiene leads, contactos, oportunidades con etapas configurables, actividades, tareas con workspaces, agenda, conversaciones omnicanal (WhatsApp, Messenger, Instagram, chat web, correo), capturas con UTMs, chatbot studio, archivos y auditoría IA. La base es sólida y **no debe reconstruirse**.

El problema reportado —"los registros de formularios entran a Conversaciones"— **está confirmado y tiene una causa única y localizable**: la función `createInboundArtifacts()` (`src/lib/crm-omnichannel.ts:744`) crea **siempre** `lead + conversación + mensaje + actividad + captura` en una sola transacción. Los formularios web y las importaciones usan esa misma función, por lo que cada envío de formulario genera una conversación con un mensaje `FORM_SUBMISSION`, y el inbox omnicanal lo muestra como si fuera un chat real.

Hallazgos estructurales adicionales, derivados de la lectura del esquema Prisma y de las rutas existentes:

1. **`CrmLead` es la entidad central**, no `CrmContact`. El contacto es un satélite (`leadId` o `clienteId`), sin identidad propia por empresa y sin deduplicación. Esto contradice el requisito de "registro único por persona/empresa".
2. **No existe bandeja de leads**: `/dashboard/crm/leads` es un `redirect()` al pipeline (`src/app/dashboard/crm/leads/page.tsx:4`). La lista de leads vive dentro de `CrmDashboardClient` (2.825 líneas, pestañas `leads | opportunities | tasks`).
3. **No hay paginación ni filtros avanzados** en `GET /api/crm/leads`: devuelve todos los leads de la empresa con `findMany` sin `take/skip`, sin filtros por fuente, campaña, formulario, servicio, puntuación ni fecha.
4. **Estados de lead insuficientes**: el enum `CrmLeadStatus` solo tiene `NEW | CONTACTED | QUALIFIED | LOST | CONVERTED`; no existen "pendiente de clasificación", "en nutrición", "asignado a ventas", "descartado" ni "no contactar".
5. **No existe lead scoring** (ni tablas, ni campos, ni eventos; `grep` de `scoring` en `src/` = 0 resultados).
6. **No existe motor de secuencias/automatizaciones de marketing** (ni tablas, ni cron). Solo existe generación de tareas de seguimiento por inactividad (`src/lib/crm-follow-up.ts`) y el chatbot conversacional.
7. **No existen pipelines múltiples**: hay un único embudo cuyas etiquetas/colores se configuran por empresa en `CrmStageSetting` (clave = enum `CrmOpportunityStage`). El propio `CRM-ARQUITECTURA.md` (§4.3) recomendaba tablas configurables `CrmPipeline`/`CrmStage`; quedó implementado solo el MVP con enum.
8. **El RBAC declara alcance por registro pero no lo aplica**: `CAPTACION/LEADS` admite `OWN | ASSIGNED | TEAM | SEDE | EMPRESA` (`src/lib/rbac-v2-catalog.ts:62`), pero todas las rutas CRM invocan `requireCapabilityAccess({ scope: 'SEDE' })` y filtran únicamente por `empresaId` + `sedeId`. No hay filtrado por responsable/equipo.
9. **La conversión existente es "Lead → Cliente ERP"**, no "Lead → Oportunidad": `src/app/api/crm/leads/[id]/convert/route.ts` crea/reutiliza `Cliente` y marca `CONVERTED`. La creación de oportunidad solo existe desde el inbox: `src/app/api/crm/conversations/[id]/create-opportunity/route.ts`.
10. **El dedupe existe, pero a nivel de lead y sin normalización persistida**: `findMatchingLead()` (`src/lib/crm-omnichannel.ts:336-492`) compara documento exacto, email exacto, teléfono con sufijo de 10 dígitos y una heurística nombre+empresa/dominio en ventana de 45 días, con traza en `capture.normalizedDataJson.dedupe`. No hay columnas normalizadas ni índices únicos, por lo que la garantía es heurística y no estructural.

**Conclusión:** la evolución requerida es de **separación de responsabilidades y profundización de captación**, no de reescritura. Se logra con 7 migraciones aditivas (sin pérdida de datos), cambios quirúrgicos en 3 puntos de ingesta, un módulo de leads nuevo sobre tablas existentes y 4 subsistemas nuevos (contactos, scoring, asignación, secuencias).

---

## 2. Stack y convenciones verificadas

| Elemento | Verificado en | Nota para la implementación |
| --- | --- | --- |
| Next.js 16.2.1 (App Router, `runtime = 'nodejs'` en rutas CRM) | `package.json`, `src/app/api/crm/**` | Server Component delgado + Client Component interactivo |
| React 19 / TypeScript 5 | `package.json` | `npm run typecheck` (`tsc --noEmit`) como puerta de calidad |
| Prisma 7.6 + PostgreSQL | `prisma/schema.prisma`, `@prisma/adapter-pg` | 165 migraciones en `prisma/migrations/`; SQL generado + backfills manuales |
| Contrato API `{ success, data }` / `{ error }` | `src/app/api/crm/leads/route.ts` | Mantenerlo en todo endpoint nuevo |
| RBAC v2 por capacidades (`domain/subdomain/action`) + fallback legacy `ModuleKey` | `src/lib/api-rbac.ts`, `src/lib/rbac-v2-catalog.ts` | Nuevas rutas con `requireCapabilityAccess` y `allowLegacyFallback: false` |
| Scoping multiempresa/multisede | `assertCrmSedeAccess`, `assertCrmCapabilitySedeAccess` (`src/lib/crm.ts`) | Reutilizar; nunca consultar sin `empresaId` |
| i18n es/en en un único diccionario | `src/lib/i18n/messages.ts` (es ≈1823, en ≈4511) | `npm run i18n:check` valida paridad |
| Navegación declarativa | `src/lib/product-architecture.ts` (`DASHBOARD_NAV_CATALOG`) | Registrar toda ruta nueva en la sección "Captación" |
| Correo transaccional | `src/lib/email.ts` (Resend, `RESEND_API_KEY`) | Reutilizar `sendEmail` + `renderCrmResponseEmail` |
| Trabajos programados | `src/app/api/cron/account-retention/route.ts` (patrón `Bearer $CRON_SECRET`) | Mismo patrón para el planificador de secuencias |
| Colas | `src/lib/ocr-queue.ts` (bullmq, solo OCR) | No imprescindible para secuencias; el cron basta |
| Pruebas operativas | `package.json` (`test:crm-files-acl`, `test:dashboard-access-rbac`, `smoke:*`, `tsx`) | Añadir `scripts/test-crm-captacion.ts` con el mismo estilo |
| UI | Tailwind 4 + Radix + `lucide-react` + `sonner` + `src/components/ui/*` | Reutilizar `Card`, `Table`, `Select`, `Dialog`, `Badge`, `Tabs` |

**Nota de mantenimiento:** `crm-integrations-client.tsx` (7.616 líneas), `crm-chatbot-studio-client.tsx` (7.786) y `crm-task-workspaces-client.tsx` (7.519) son monolitos. El módulo de leads **no debe seguir ese patrón**: se compone en piezas pequeñas bajo `src/components/crm/crm-leads-*`.


---

## 3. Inventario actual del CRM

### 3.1 Modelo de datos existente (verificado en `prisma/schema.prisma`)

| Modelo | Línea | Rol actual | Observación |
| --- | --- | --- | --- |
| `CrmLead` | 2946 | Prospecto; entidad central de facto | `status` (5 valores), `source`, `tags String[]`, `ownerUserId`, `convertedClienteId`, `lastActivityAt`. Sin scoring, sin contacto, sin fuente detallada |
| `CrmContact` | 3017 | Satélite de `CrmLead` o `Cliente` | `nombre, email, telefono, celular, cargo, notes, isPrimary`. Sin `empresaNombre`, `documento`, `ciudad`, `pais`, `sitioWeb`, `tags`, `ownerUserId` |
| `CrmOpportunity` | 3055 | Negociación | `stage` (enum), `expectedValue`, `probabilityPct`, `leadId?`, `clienteId?`, `cotizacionId?`. Sin `pipelineId` |
| `CrmStageSetting` | 2998 | Etapas configurables | Único por `(empresaId, key)`; `key` es el enum → **un solo embudo** |
| `CrmActivity` | 3106 | Bitácora comercial | Vincula `leadId`, `opportunityId`, `clienteId`. Sin `contactId`, sin `conversationId`, sin idempotencia |
| `CrmTask` (+ workspaces, gantt, agenda) | 3143-3602 | Trabajo comercial | Reutilizable como "tarea de seguimiento" del lead |
| `CrmChannelConnection` | 3603 | Canal/integración (`WHATSAPP_CLOUD`, `WEB_FORM`, `WEB_CHATBOT`, `INSTAGRAM_DM`, …) | La configuración del formulario vive en `settingsJson`; **un formulario = una conexión `WEB_FORM`** |
| `CrmConversation` | 3914 | Hilo de conversación | `leadId?`, `clienteId?`, `opportunityId?`, `contactEmail/Phone`, UTMs |
| `CrmMessage` | 3970 | Mensaje del hilo | Tipos: `TEXT`, `FORM_SUBMISSION`, `EVENT`, … |
| `CrmLeadCapture` | 4005 | Evento de captación | `captureType`, `rawPayloadJson`, `normalizedDataJson`, UTMs, `gclid`, landing/referrer. Sin `formId`, `campaignId`, `serviceInterest`, `contactId` |
| `CrmMarketingConnection` + métricas | 3642-3763 | Google Ads/Analytics/SEO | Fuente de datos de campañas para enriquecer filtros |
| `Notification`, `Team`, `TeamMember` | 2700, 2179, 2195 | Notificaciones y equipos | Base para asignación por equipo y alertas |

Enums relevantes: `CrmLeadStatus` (2797), `CrmLeadSource` (2805), `CrmOpportunityStage` (2814), `CrmActivityType` (2823), `CrmChannelProvider` (2879), `CrmConversationStatus` (2897), `CrmLeadCaptureType` (2937).

### 3.2 API existente

- **Captación:** `POST /api/crm/captures/web-form`, `/captures/chatbot`, `/captures/booking`, `/captures/bridge`, `/channels/[id]/webhook`, `/channels/[id]/google-sheets/import`, `/webhooks/meta`.
- **Leads:** `GET|POST /api/crm/leads`, `GET|PATCH /api/crm/leads/[id]`, `POST /api/crm/leads/[id]/convert` (→ `Cliente` ERP).
- **Contactos:** `GET|POST /api/crm/contacts` y `/contacts/[id]` (siempre atados a `leadId` **o** `clienteId`; no existe directorio independiente).
- **Pipeline:** `GET|POST /api/crm/opportunities`, `/opportunities/[id]`, `GET/PUT /api/crm/stages`.
- **Conversaciones:** `/api/crm/conversations/**` (mensajes, asignación, resolución, IA, llamadas, `create-opportunity`).
- **Seguimiento:** `/api/crm/tasks`, `/api/crm/activities`, `/api/crm/timeline`, `POST /api/crm/follow-up/reconcile`, `GET /api/crm/kpis`.

### 3.3 UI existente (rutas)

- `/dashboard/crm` → redirect a `/dashboard/crm/negociaciones` → `CrmDashboardClient`.
- `/dashboard/crm/leads` → **redirect al pipeline** (deuda de producto).
- `/dashboard/crm/leads/[id]` → `CrmLeadDetailClient` (796 líneas; ya incluye oportunidades, contactos, timeline, tareas y archivos vinculados).
- `/dashboard/crm/conversations` → `CrmConversationsClient` (4.689 líneas) = inbox omnicanal.
- `/dashboard/crm/integraciones` → `crm-integrations-client` (formularios, chatbot, booking, Drive, métricas).
- `/dashboard/crm/tareas`, `/agenda`, `/archivos`, `/chatbot`, `/auditoria-ia`, `/oportunidades`, `/negociaciones/*`.

### 3.4 Automatizaciones existentes

1. **Tareas de seguimiento por inactividad** (`src/lib/crm-follow-up.ts`): `syncCrmLeadFollowUpTaskById`, `syncCrmOpportunityFollowUpTaskById`, `reconcileCrmFollowUpTasks` (reconciliación en lote vía `/api/crm/follow-up/reconcile`).
2. **Autoasignación básica de inbound** (`resolveInboundAssigneeUserId` en `crm-omnichannel.ts`) por sede y carga activa.
3. **Chatbot conversacional** (`src/lib/crm-chatbot-flow.ts`, `crm-chatbot-studio.ts`) con handoff a humano.
4. **Correo de respuesta automática** del formulario (`crm-response-email.ts`) y entrega del regalo (`crm-web-form-reward.ts`).
5. **Cron de retención de cuentas** (`/api/cron/account-retention`) como único patrón de job programado del sistema.


---

## 4. Traza real de una captura web (flujo actual)

`POST /api/crm/captures/web-form` (`src/app/api/crm/captures/web-form/route.ts`):

1. **Seguridad y validación** (líneas 93-98, 170-193): límite de tamaño, rate limit, honeypot, Turnstile, email válido, URL de origen segura, token de canal **o** dominio público habilitado.
2. **Configuración del propósito del formulario** (195-227): desde `channel.settingsJson.purpose` → regalo (reward), cupón, redirección de agradecimiento, y etiquetas derivadas (`formulario:incentive`, `cupon:xyz`).
3. **Normalización del payload** (229-263): `nombre, email, phone, empresaNombre, ciudad, document, product, messageText`, UTMs, `gclid`, `landingPageUrl`, `referrerUrl`, `customFields`, `variables`, `coupon`, `reward`.
4. **Transacción única** (265-308) → `createInboundArtifacts({...})`.
5. **Entrega del regalo** (320-375) y **correo de respuesta** (377-430), con traza en `capture.normalizedDataJson`.
6. **Respuesta** (432-452): `leadId`, `conversationId`, `messageId`, `captureId`, cupón, regalo, redirección.

`createInboundArtifacts()` (`src/lib/crm-omnichannel.ts:744-914`) hace, en orden:

| Paso | Línea | Efecto |
| --- | --- | --- |
| 1. Resolver responsable | 785-791 | `resolveInboundAssigneeUserId` (sede + carga) |
| 2. Upsert de lead | 793-810 | `upsertLeadFromInbound` → `findMatchingLead` (documento / email / teléfono con sufijo / heurística nombre+empresa o dominio, ventana 45 días) |
| 3. **Crear/reutilizar conversación** | 812-829 | `ensureConversation` → `CrmConversation` con `unreadCount: 1`, `status` de atención, `lastMessageAt` |
| 4. **Crear mensaje** | 839-857 | `CrmMessage` `direction=INBOUND`, `messageType=FORM_SUBMISSION` |
| 5. Crear actividad | 859-870 | `CrmActivity` "Ingreso desde Formulario web" |
| 6. Registrar captura | 872-891 | `CrmLeadCapture` con payload crudo, normalizado y traza de dedupe |
| 7. Notificar | 893-911 | `Notification` "Nuevo mensaje de {nombre}" con `actionUrl: /dashboard/crm` |

Consecuencia funcional: el inbox omnicanal (`/dashboard/crm/conversations`) recibe **una conversación por cada envío de formulario**, con contador de no leídos, SLA y notificación push. El asesor ve "una conversación" aunque el visitante nunca haya escrito por un canal conversacional.

### 4.1 Callers actuales de `createInboundArtifacts` y comportamiento deseado

| Caller | Naturaleza | ¿Debe crear conversación? |
| --- | --- | --- |
| `captures/web-form` | Captación (formulario/lead magnet) | **No** (solo lead + captura + actividad + scoring) |
| `channels/[id]/google-sheets/import` | Importación masiva | **No** |
| `captures/booking` | Agendamiento web | **Configurable** (por defecto no; el agendamiento ya crea `CrmTask` de reunión) |
| `captures/chatbot` | Chatbot iniciado por el visitante | **Sí** (hay interacción real) |
| `captures/bridge` | Gmail/Outlook vinculado | **Sí** |
| `channels/[id]/webhook`, `webhooks/meta` | WhatsApp / Messenger / Instagram | **Sí** |
| `conversations/simulate` | Simulador interno | Sí (solo en entorno de prueba) |

---

## 5. Causa raíz del comportamiento reportado

| ID | Causa | Evidencia | Impacto |
| --- | --- | --- | --- |
| R1 | **Acoplamiento captura↔conversación**: una sola función crea lead, conversación, mensaje y notificación | `crm-omnichannel.ts:812-911` | Formularios "inundan" el inbox; métricas de conversaciones contaminadas; SLAs falsos |
| R2 | **Identidad de origen incompleta**: la captura guarda UTMs y payload, pero no formulario, campaña ni servicio de interés como campos consultables | `CrmLeadCapture` (`schema.prisma:4005`) | Imposible filtrar por formulario/campaña/servicio; los filtros requeridos no son viables sin `JSON` costoso |
| R3 | **Contacto no central**: los datos personales viven en `CrmLead`; `CrmContact` es satélite y se duplica al convertir a cliente | `CrmContact` (`schema.prisma:3017`), `/api/crm/contacts` | Duplicidad de personas, historial fragmentado entre lead y cliente |
| R4 | **Estados y scoring ausentes**: 5 estados sin "nutrición", "descartado", "no contactar"; sin puntuación | `CrmLeadStatus` (`schema.prisma:2797`) | No se puede operar una bandeja de nutrición ni priorizar |
| R5 | **Ownership incorrecto en captación**: el formulario asigna `ownerUserId = channel.createdBy.id` | `captures/web-form/route.ts:271` | Leads quedan a nombre de quien configuró la integración, no del asesor |
| R6 | **Listado sin paginación ni filtros** | `GET /api/crm/leads` (`leads/route.ts:103-180`) | Degradación con volumen; no cumple "paginación desde backend" |
| R7 | **Conversión a oportunidad fuera de captación**: solo desde el inbox | `conversations/[id]/create-opportunity/route.ts` | El requisito "Convertir en oportunidad" desde la ficha del lead no existe |


---

## 6. Matriz de brechas frente al requerimiento

| # | Requisito | Estado actual | Brecha / acción |
| --- | --- | --- | --- |
| 1 | Contacto como entidad central y única | `CrmContact` satélite de lead/cliente | **Ascender** `CrmContact` a entidad de empresa con identidad propia (migración aditiva + backfill) |
| 2 | Evitar duplicados por email/teléfono | Dedupe heurístico en ingesta | Columnas normalizadas + índices únicos + merge auditado |
| 3 | Bandeja de leads independiente | `/dashboard/crm/leads` redirige al pipeline | Módulo nuevo (ruta + componentes + API paginada) |
| 4 | Filtros: fecha, fuente, campaña, formulario, servicio, estado, puntuación, responsable, última actividad | No existen | API con `where` dinámico + índices |
| 5 | 8 estados de lead | 5 estados | Nuevo campo `lifecycleStatus` (enum nuevo) sin romper `status` |
| 6 | Ficha de lead con origen, campaña, formulario, recurso, servicio, etiquetas, puntuación, historial | Parcial (`CrmLeadDetailClient`) | Extender ficha + endpoint de detalle enriquecido |
| 7 | Acciones: asignar, etiquetar, cambiar estado, tarea, conversación, correo, crear oportunidad, descartar | Parcial (editar, tarea, contacto) | Nuevos endpoints de acción + UI |
| 8 | Formularios **no** crean conversación | Crean conversación y mensaje | Separar `recordCapture` de `createInboundArtifacts` |
| 9 | Conversación solo con comunicación real | Contaminada por formularios | Reclasificar históricos y filtrar inbox |
| 10 | Vincular conversación al contacto existente | Por email/teléfono/lead | Añadir `contactId` a `CrmConversation` (nullable) |
| 11 | Convertir lead en oportunidad sin duplicar contacto | Solo desde inbox | `POST /api/crm/leads/[id]/convert-opportunity` transaccional |
| 12 | Pipelines múltiples | Un embudo (enum + etiquetas) | `CrmPipeline` + `pipelineId` en oportunidades y etapas |
| 13 | Historial cronológico unificado por contacto | `CrmActivity` + `/api/crm/timeline` (por lead/oportunidad) | `contactId` en actividad + lector unificado |
| 14 | Lead scoring configurable con eventos | Inexistente | Tablas `CrmScoringRule`/`CrmLeadScoreEvent` + servicio |
| 15 | Secuencias automáticas con paradas y registro | Inexistente (solo tareas por inactividad) | `CrmSequence*` + cron `CRON_SECRET` |
| 16 | Reglas de asignación por fuente/campaña/servicio/sede/puntuación | Autoasignación básica por sede/carga | `CrmAssignmentRule` + evaluador |
| 17 | Permisos por usuario y organización | Solo `empresaId` + `sedeId` | Resolver alcance declarado (OWN/ASSIGNED/TEAM/SEDE/EMPRESA) |
| 18 | Paginación desde backend | `findMany` sin límite | `page/pageSize/total` + `facets` |
| 19 | Índices para búsqueda y filtros | Insuficientes para los nuevos filtros | Índices compuestos por caso de uso |
| 20 | Compatibilidad con datos históricos | — | Migraciones **aditivas**, backfills idempotentes, sin `DROP` |
| 21 | UI coherente con módulos actuales | Sistema de diseño existente | Reutilizar `src/components/ui/*` y patrones de `crm-lead-detail-client` |
| 22 | No duplicar entidades existentes | — | Se reutilizan lead, contacto, oportunidad, actividad, tarea, conversación, canal, captura, notificación |

---

## 7. Arquitectura objetivo

### 7.1 Principio rector

**Una persona = un contacto. Muchas capturas. Muchas conversaciones. Muchas oportunidades.** El lead deja de ser "la persona" y pasa a ser **el registro de captación** (el interés concreto), mientras el contacto es la identidad.

```
                    ┌──────────────────────────────────────────┐
                    │  CrmContact  (identidad por empresa)     │
                    │  email/phone normalizados, owner, tags   │
                    └───────┬───────────┬────────────┬─────────┘
                            │           │            │
              N capturas    │           │ N hilos    │ N oportunidades
                    ┌───────▼──────┐ ┌──▼─────────┐ ┌▼──────────────┐
                    │  CrmLead     │ │CrmConversa-│ │CrmOpportunity │
                    │ (captación)  │ │tion (canal)│ │ (pipeline)    │
                    └───┬──────┬───┘ └──┬─────────┘ └───────┬───────┘
                        │      │        │                   │
            1..N        │      │        │ N mensajes        │ cotización ERP
        ┌───────────────▼──┐ ┌─▼────────▼───────┐  ┌────────▼────────┐
        │ CrmLeadCapture   │ │ CrmMessage        │  │ CrmActivity     │
        │ (origen/UTM/form)│ │ (FORM_SUBMISSION, │  │ (historial)     │
        └────────┬─────────┘ │  TEXT, …)         │  └─────────────────┘
                 │           └───────────────────┘
                 │ 1..N
        ┌────────▼─────────────┐   ┌────────────────────┐
        │ CrmLeadScoreEvent    │   │ CrmSequenceEnroll. │
        │ (puntos auditables)  │   │ (nutrición)        │
        └──────────────────────┘   └────────────────────┘
```

### 7.2 Invariantes de negocio (a validar en backend, no solo en UI)

1. Un formulario **nunca** crea `CrmConversation` ni `CrmMessage`.
2. Una captura **siempre** produce: contacto (creado o reutilizado) + lead (creado o reutilizado) + `CrmLeadCapture` + `CrmActivity` + evento(s) de scoring.
3. Un lead **siempre** tiene `contactId`; puede tener `ownerUserId` nulo (bandeja de nuevos).
4. Una oportunidad **siempre** referencia contacto y, opcionalmente, el lead que la originó; nunca se crea automáticamente por captura.
5. Una conversación **siempre** tiene canal y contacto; puede estar vinculada a lead y/u oportunidad.
6. Los eventos de scoring son **idempotentes** por `dedupeKey`; recalcular no duplica puntos.
7. Ninguna secuencia envía a contactos con `DO_NOT_CONTACT` o consentimiento revocado en ese canal.
8. Toda consulta filtra por `empresaId` y respeta el alcance del usuario.


---

## 8. Cambios de modelo de datos propuestos (delta Prisma)

> **Regla:** todo es **aditivo y nullable** (o con `DEFAULT`). No se elimina ni se renombra ninguna columna existente. Los enums existentes solo **reciben valores**; los estados nuevos viven en enums nuevos para no reinterpretar datos históricos.

### 8.1 Enums nuevos

```prisma
enum CrmLeadLifecycleStatus {
  NEW                // recién captado, sin clasificar
  PENDING_REVIEW     // pendiente de clasificación
  NURTURING          // en nutrición
  QUALIFIED          // calificado
  SALES_ASSIGNED     // asignado a ventas
  CONVERTED          // convertido en oportunidad
  DISCARDED          // descartado
  DO_NOT_CONTACT     // no contactar
}

enum CrmLeadScoreBand { COLD WARM HOT }

enum CrmContactStatus { ACTIVE INACTIVE DO_NOT_CONTACT }

enum CrmContactChannel { EMAIL WHATSAPP SMS PHONE META }

enum CrmConsentStatus { GRANTED REVOKED UNKNOWN }

enum CrmScoreEventType {
  DOCUMENT_DOWNLOAD
  EMAIL_OPEN
  LINK_CLICK
  SERVICE_PAGE_VISIT
  INFO_REQUEST
  QUOTE_REQUEST
  MEETING_BOOKED
  MANUAL_ADJUSTMENT
}

enum CrmSequenceStatus { DRAFT ACTIVE PAUSED ARCHIVED }

enum CrmEnrollmentStatus { ACTIVE PAUSED COMPLETED STOPPED_OPT_OUT STOPPED_CONVERTED FAILED }

enum CrmSequenceStepKind { EMAIL WHATSAPP TASK WAIT WEBHOOK }
```

Extensión de `CrmLeadSource` (valores nuevos, seguros en PostgreSQL): `GOOGLE_ADS`, `META_ADS`, `LANDING_PAGE`, `API`, `EVENTO`, `ORGANICO`.

### 8.2 `CrmContact` — identidad central (delta)

Se mantienen `leadId` y `clienteId` por compatibilidad, pero pasan a ser **referencias opcionales**; la identidad la da `empresaId + emailNormalized + phoneNormalized`.

```prisma
model CrmContact {
  // ... campos actuales se conservan ...

  apellido        String?
  empresaNombre   String?
  documento       String?
  ciudad          String?
  departamento    String?
  pais            String?
  sitioWeb        String?
  tags            String[] @default([])

  status          CrmContactStatus @default(ACTIVE)
  sourceKey       String?
  sourceLabel     String?

  ownerUserId     String?
  ownerUser       User?   @relation("CrmContactOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)

  emailNormalized String?          // minusculas + trim
  phoneNormalized String?          // solo digitos
  lastInteractionAt DateTime?

  mergedIntoId    String?
  mergedInto      CrmContact?  @relation("CrmContactMerge", fields: [mergedIntoId], references: [id], onDelete: SetNull)
  mergedFrom      CrmContact[] @relation("CrmContactMerge")

  leads           CrmLead[]
  captures        CrmLeadCapture[]
  conversations   CrmConversation[]
  opportunities   CrmOpportunity[]
  activities      CrmActivity[]
  consents        CrmContactConsent[]

  @@unique([empresaId, emailNormalized])
  @@index([empresaId, phoneNormalized])
  @@index([empresaId, status, lastInteractionAt])
  @@index([empresaId, ownerUserId, updatedAt])
  @@index([empresaId, nombre])
}
```

### 8.3 `CrmLead` — registro de captación (delta)

```prisma
model CrmLead {
  // ... campos actuales se conservan ...
  contactId String?
  contact   CrmContact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  lifecycleStatus   CrmLeadLifecycleStatus @default(NEW)
  nurtureStartedAt  DateTime?
  assignedAt        DateTime?
  assignedByUserId  String?
  discardedAt       DateTime?
  discardReason     String?  @db.Text
  noContactRequestedAt DateTime?

  score         Int              @default(0)
  scoreBand     CrmLeadScoreBand @default(COLD)
  scoreUpdatedAt DateTime?

  serviceInterest String?
  sourceKey       String?
  sourceLabel     String?
  campaignName    String?
  formId          String?   // = CrmChannelConnection.id del formulario (WEB_FORM)
  formName        String?

  firstTouchAt  DateTime?
  lastCaptureAt DateTime?

  scoreEvents CrmLeadScoreEvent[]

  @@index([empresaId, lifecycleStatus, createdAt])
  @@index([empresaId, ownerUserId, lifecycleStatus])
  @@index([empresaId, contactId, createdAt])
  @@index([empresaId, scoreBand, score])
  @@index([empresaId, formId, createdAt])
  @@index([empresaId, campaignName, createdAt])
  @@index([empresaId, serviceInterest, createdAt])
  @@index([empresaId, lastCaptureAt])
  @@index([empresaId, email])
  @@index([empresaId, telefono])
}
```


### 8.4 `CrmLeadCapture` — origen consultable (delta)

```prisma
model CrmLeadCapture {
  // ... campos actuales se conservan (raw/normalized, UTMs, gclid, URLs) ...

  contactId String?
  contact   CrmContact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  formId          String?
  formName        String?
  campaignId      String?
  campaignName    String?
  serviceInterest String?
  resourceLabel   String?   // recurso/lead magnet entregado

  isFirstTouch    Boolean @default(false)
  scoreDelta      Int     @default(0)
  dedupeStrategy  String?
  consentJson     Json    @default("{}")

  @@index([empresaId, contactId, createdAt])
  @@index([empresaId, formId, createdAt])
  @@index([empresaId, campaignName, createdAt])
  @@index([empresaId, serviceInterest, createdAt])
  @@index([empresaId, emailNormalized, createdAt]) // columna nueva emailNormalized en capture
}
```

### 8.5 Conversaciones y oportunidades (delta mínimo)

```prisma
model CrmConversation {
  contactId String?
  contact   CrmContact? @relation(fields: [contactId], references: [id], onDelete: SetNull)
  @@index([empresaId, contactId, lastMessageAt])
}

model CrmOpportunity {
  contactId String?
  contact   CrmContact? @relation(fields: [contactId], references: [id], onDelete: SetNull)
  pipelineId String?
  pipeline   CrmPipeline? @relation(fields: [pipelineId], references: [id], onDelete: SetNull)
  sourceLeadCaptureId String?
  sourceLeadCapture   CrmLeadCapture? @relation(fields: [sourceLeadCaptureId], references: [id], onDelete: SetNull)
  @@index([empresaId, pipelineId, stage, createdAt])
  @@index([empresaId, contactId, createdAt])
}
```

### 8.6 `CrmActivity` — historial idempotente (delta)

```prisma
model CrmActivity {
  contactId      String?
  contact        CrmContact? @relation(fields: [contactId], references: [id], onDelete: SetNull)
  conversationId String?
  conversation   CrmConversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  messageId      String?
  eventKey       String?   // idempotencia: "capture:<id>", "score:<eventId>", "stage:<id>"
  metadataJson   Json @default("{}")

  @@unique([empresaId, eventKey])
  @@index([empresaId, contactId, occurredAt])
  @@index([conversationId, occurredAt])
}
```
> No se crea una tabla "timeline" nueva: el historial se compone en lectura (ver §17) para no duplicar mensajes ni capturas.

### 8.7 Scoring

```prisma
model CrmScoringSettings {
  id        String @id @default(cuid())
  empresaId String @unique
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  warmThreshold Int @default(20)
  hotThreshold  Int @default(50)
  active        Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("crm_scoring_settings")
}

model CrmScoringRule {
  id        String @id @default(cuid())
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  eventType CrmScoreEventType
  points    Int     @default(0)
  active    Boolean @default(true)
  oncePerLead Boolean @default(true)
  dedupeWindowHours Int @default(0)
  maxPerLead Int?
  notes String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([empresaId, eventType])
  @@index([empresaId, active])
  @@map("crm_scoring_rules")
}

model CrmLeadScoreEvent {
  id         String @id @default(cuid())
  empresaId  String
  empresa    Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  leadId     String
  lead       CrmLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  contactId  String?
  captureId  String?
  eventType  CrmScoreEventType
  points     Int
  dedupeKey  String
  metadataJson Json @default("{}")
  occurredAt DateTime @default(now())
  createdById String?
  createdAt  DateTime @default(now())
  @@unique([leadId, dedupeKey])
  @@index([empresaId, occurredAt])
  @@index([leadId, occurredAt])
  @@map("crm_lead_score_events")
}
```

Valores iniciales de reglas (sembrado perezoso por empresa, igual que `ensureCrmStageSettings`): documento descargado +10, correo abierto +2, clic en enlace +5, visita a página de servicios +10, solicitud de información +20, solicitud de cotización +30, reunión agendada +30.

### 8.8 Asignación y consentimiento

```prisma
model CrmAssignmentRule {
  id        String @id @default(cuid())
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  name      String
  priority  Int     @default(100)
  active    Boolean @default(true)
  matchJson Json    @default("{}") // { sources, campaignNames, services, sedes, cities, scoreBands, minScore, formIds }
  assigneeUserId String?
  teamId   String?
  stopOnMatch Boolean @default(true)
  createdById String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([empresaId, active, priority])
  @@map("crm_assignment_rules")
}

model CrmContactConsent {
  id        String @id @default(cuid())
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  contactId String
  contact   CrmContact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel   CrmContactChannel
  status    CrmConsentStatus @default(UNKNOWN)
  source    String?
  grantedAt DateTime?
  revokedAt DateTime?
  evidenceJson Json @default("{}")
  updatedAt DateTime @updatedAt
  @@unique([contactId, channel])
  @@index([empresaId, channel, status])
  @@map("crm_contact_consents")
}
```


### 8.9 Pipelines múltiples

```prisma
model CrmPipeline {
  id          String @id @default(cuid())
  empresaId   String
  empresa     Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  name        String
  description String?
  isDefault   Boolean @default(false)
  active      Boolean @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  stages      CrmStageSetting[]
  opportunities CrmOpportunity[]
  @@unique([empresaId, name])
  @@index([empresaId, isDefault])
  @@map("crm_pipelines")
}

model CrmStageSetting {
  // ... campos actuales ...
  pipelineId String?
  pipeline   CrmPipeline? @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  @@index([pipelineId, sortOrder])
}
```
Se conserva `@@unique([empresaId, key])` para el embudo por defecto (`pipelineId = NULL`, compatibilidad total) y se añade un índice único **parcial** por SQL para pipelines nuevos: `CREATE UNIQUE INDEX ... ON crm_stage_settings("pipelineId","key") WHERE "pipelineId" IS NOT NULL`.

### 8.10 Secuencias de nutrición

```prisma
model CrmSequence {
  id        String @id @default(cuid())
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  name      String
  description String?
  status    CrmSequenceStatus @default(DRAFT)
  triggerJson Json @default("{}") // { sources, formIds, services, scoreBands }
  stopOnOpportunity Boolean @default(true)
  stopOnReply       Boolean @default(true)
  createdById String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  steps       CrmSequenceStep[]
  enrollments CrmSequenceEnrollment[]
  @@index([empresaId, status])
  @@map("crm_sequences")
}

model CrmSequenceStep {
  id         String @id @default(cuid())
  sequenceId String
  sequence   CrmSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  order      Int
  kind       CrmSequenceStepKind
  delayDays  Int @default(0)
  subject    String?
  bodyHtml   String? @db.Text
  templateKey String?
  taskTitle  String?
  metadataJson Json @default("{}")
  @@unique([sequenceId, order])
  @@map("crm_sequence_steps")
}

model CrmSequenceEnrollment {
  id        String @id @default(cuid())
  empresaId String
  empresa   Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  sequenceId String
  sequence   CrmSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  contactId String
  leadId    String?
  status    CrmEnrollmentStatus @default(ACTIVE)
  currentStepOrder Int @default(0)
  nextRunAt DateTime?
  startedAt DateTime @default(now())
  completedAt DateTime?
  stoppedReason String?
  updatedAt DateTime @updatedAt
  sends     CrmSequenceSend[]
  @@unique([sequenceId, leadId])
  @@index([empresaId, status, nextRunAt])
  @@index([contactId, status])
  @@map("crm_sequence_enrollments")
}

model CrmSequenceSend {
  id           String @id @default(cuid())
  empresaId    String
  enrollmentId String
  enrollment   CrmSequenceEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  stepId       String
  channel      String
  status       String  // SENT | FAILED | SKIPPED
  recipient    String
  providerMessageId String?
  errorMessage String?
  sentAt       DateTime @default(now())
  @@unique([enrollmentId, stepId])
  @@index([empresaId, sentAt])
  @@map("crm_sequence_sends")
}
```


---

## 9. Índices, unicidad y deduplicación

### 9.1 Unicidad de contacto

| Regla | Implementación | Justificación |
| --- | --- | --- |
| Email único por empresa | `@@unique([empresaId, emailNormalized])` | PostgreSQL admite múltiples `NULL`: los contactos sin email siguen siendo válidos |
| Teléfono | Índice no único `[empresaId, phoneNormalized]` + búsqueda por sufijo de 10 dígitos | Un teléfono corporativo puede repetirse legítimamente; la unicidad se confirma en aplicación |
| Documento fiscal | Índice `[empresaId, documento]` | Puede repetirse entre personas de una misma empresa |
| Fusión | `mergedIntoId` + actividad de auditoría | Nunca se borra: se marca y se redirige la lectura |

### 9.2 Orden de resolución de identidad

1. `documento` exacto (misma empresa).
2. `emailNormalized` exacto.
3. `phoneNormalized` exacto.
4. Sufijo de últimos 10 dígitos del teléfono.
5. Heurística: nombre normalizado + (empresa igual **o** dominio de correo igual) en ventana de 45 días (se conserva la lógica de `findMatchingLead`, ahora resolviendo `CrmContact`).
6. Ambigüedad: se crea contacto nuevo y se marca `possibleDuplicate` en `capture.normalizedDataJson` para revisión manual. **La heurística débil nunca fusiona automáticamente.**

### 9.3 Índices por caso de uso (bandeja de leads)

| Vista / filtro | Índice |
| --- | --- |
| Todos / orden por fecha | `crm_leads(empresaId, lifecycleStatus, createdAt)` |
| Mis leads / sin responsable | `crm_leads(empresaId, ownerUserId, lifecycleStatus)` |
| Por formulario | `crm_leads(empresaId, formId, createdAt)` |
| Por campaña | `crm_leads(empresaId, campaignName, createdAt)` |
| Por servicio de interés | `crm_leads(empresaId, serviceInterest, createdAt)` |
| Por puntuación | `crm_leads(empresaId, scoreBand, score)` |
| Aging / última captura | `crm_leads(empresaId, lastCaptureAt)` (más el existente sobre `lastActivityAt`) |
| Capturas por contacto | `crm_lead_captures(empresaId, contactId, createdAt)` |
| Eventos de score | `crm_lead_score_events(leadId, occurredAt)` |
| Envíos pendientes | `crm_sequence_enrollments(empresaId, status, nextRunAt)` |
| Inbox por contacto | `crm_conversations(empresaId, contactId, lastMessageAt)` |

### 9.4 Prevención de N+1

- **Listado de leads:** una sola consulta paginada con `select` acotado + `_count`. Se elimina el `include` de `conversations` por fila que hoy existe en `GET /api/crm/leads`; el origen se resuelve con campos denormalizados (`sourceKey`, `formName`, `campaignName`).
- **Detalle de lead:** consultas en paralelo (`Promise.all`) con `take` por bloque (capturas 20, actividades 50, conversaciones 10, score events 50).
- **Facets de la bandeja:** `groupBy` por `lifecycleStatus` y por `sourceKey`, con caché en memoria de 30 s por proceso.
- **Historial unificado:** ventana temporal (`take` + cursor `before`) en lugar de cargar todo.


---

## 10. Migraciones: orden, SQL de referencia y compatibilidad

Todas las migraciones son **aditivas** y se aplican con `prisma migrate deploy` en producción. Ninguna elimina columnas, tablas ni datos.

| # | Migración | Contenido | Riesgo | Rollback |
| --- | --- | --- | --- | --- |
| M1 | `crm_lead_lifecycle_and_scoring_columns` | Enums `CrmLeadLifecycleStatus`, `CrmLeadScoreBand`; columnas nuevas en `crm_leads` (`contactId`, `lifecycleStatus`, `score`, `scoreBand`, `serviceInterest`, `formId`, `formName`, `campaignName`, `firstTouchAt`, `lastCaptureAt`, `assignedAt`, `assignedByUserId`, `discardedAt`, `discardReason`, `noContactRequestedAt`, `nurtureStartedAt`) + índices | Bajo (defaults) | `DROP COLUMN` (columnas sin uso) |
| M2 | `crm_lead_capture_origin` | Columnas `formId`, `formName`, `campaignId`, `campaignName`, `serviceInterest`, `resourceLabel`, `contactId`, `isFirstTouch`, `scoreDelta`, `dedupeStrategy`, `consentJson`, `emailNormalized` en `crm_lead_captures` + índices | Bajo | `DROP COLUMN` |
| M3 | `crm_contact_identity` | Columnas nuevas en `crm_contacts` (`apellido`, `empresaNombre`, `documento`, `ciudad`, `departamento`, `pais`, `sitioWeb`, `tags`, `status`, `sourceKey`, `sourceLabel`, `ownerUserId`, `emailNormalized`, `phoneNormalized`, `lastInteractionAt`, `mergedIntoId`), `contactId` en `crm_conversations`, `crm_opportunities` y `crm_activities` + backfill e índices | Medio (backfill) | `DROP COLUMN` |
| M4 | `crm_contact_email_uniqueness` | Normalización previa, fusión de duplicados y `CREATE UNIQUE INDEX` sobre `(empresaId, emailNormalized)` | Medio (requiere dedupe) | `DROP INDEX` |
| M5 | `crm_lead_contact_backfill` | `crm_leads.contactId` ← contacto canónico; `contactId` en capturas, conversaciones y oportunidades | Medio | Repetible (idempotente) |
| M6 | `crm_scoring` | `crm_scoring_settings`, `crm_scoring_rules`, `crm_lead_score_events` | Bajo | `DROP TABLE` |
| M7 | `crm_assignment_and_consents` | `crm_assignment_rules`, `crm_contact_consents` | Bajo | `DROP TABLE` |
| M8 | `crm_sequences` | `crm_sequences`, `crm_sequence_steps`, `crm_sequence_enrollments`, `crm_sequence_sends` | Bajo | `DROP TABLE` |
| M9 | `crm_pipelines` | `crm_pipelines`; `pipelineId` en `crm_stage_settings` y `crm_opportunities`; `sourceLeadCaptureId` en oportunidades; backfill del embudo por defecto | Medio | `DROP COLUMN` |

> **Orden de despliegue:** M1→M2→M3 son independientes y seguros en caliente. M4 debe ejecutarse en ventana de mantenimiento corta (creación de índice único). M5 y M9 corren como scripts idempotentes (`scripts/backfill-crm-contacts.ts`, `scripts/backfill-crm-pipelines.ts`) invocables varias veces.

### 10.1 Backfill de contacto canónico (M5, idempotente)

```sql
-- 1) Un contacto por lead histórico (si aún no tiene)
INSERT INTO "crm_contacts" (
  "id", "empresaId", "sedeId", "leadId", "nombre", "email", "telefono", "celular",
  "emailNormalized", "phoneNormalized", "isPrimary", "createdById", "createdAt", "updatedAt"
)
SELECT
  'cbc_' || l."id", l."empresaId", l."sedeId", l."id", l."nombre", l."email", l."telefono", l."celular",
  NULLIF(lower(btrim(l."email")), ''),
  NULLIF(regexp_replace(coalesce(l."telefono", l."celular", ''), '\D', '', 'g'), ''),
  true, l."createdById", now(), now()
FROM "crm_leads" l
WHERE NOT EXISTS (
  SELECT 1 FROM "crm_contacts" c WHERE c."empresaId" = l."empresaId" AND c."leadId" = l."id"
);

-- 2) Enlazar lead -> contacto
UPDATE "crm_leads" l SET "contactId" = c."id"
FROM "crm_contacts" c
WHERE l."contactId" IS NULL AND c."leadId" = l."id";

-- 3) Propagación a capturas, conversaciones y oportunidades
UPDATE "crm_lead_captures" k SET "contactId" = l."contactId"
FROM "crm_leads" l WHERE k."leadId" = l."id" AND k."contactId" IS NULL;

UPDATE "crm_conversations" v SET "contactId" = l."contactId"
FROM "crm_leads" l WHERE v."leadId" = l."id" AND v."contactId" IS NULL;

UPDATE "crm_opportunities" o SET "contactId" = l."contactId"
FROM "crm_leads" l WHERE o."leadId" = l."id" AND o."contactId" IS NULL;
```

### 10.2 Backfill de estados (M1)

```sql
UPDATE "crm_leads" SET "lifecycleStatus" =
  CASE
    WHEN "convertedClienteId" IS NOT NULL OR "status" = 'CONVERTED' THEN 'CONVERTED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'QUALIFIED' THEN 'QUALIFIED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'LOST' THEN 'DISCARDED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'CONTACTED' THEN 'PENDING_REVIEW'::"CrmLeadLifecycleStatus"
    ELSE 'NEW'::"CrmLeadLifecycleStatus"
  END;
```


### 10.3 Backfill de origen (M2)

```sql
UPDATE "crm_lead_captures" k
SET "formName" = cc."name",
    "formId"   = cc."id"
FROM "crm_channel_connections" cc
WHERE k."channelConnectionId" = cc."id"
  AND cc."provider"::text IN ('WEB_FORM', 'WEB_CHATBOT');

UPDATE "crm_leads" l
SET "formId"   = c."formId",
    "formName" = c."formName"
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "formId", "formName"
  FROM "crm_lead_captures"
  WHERE "leadId" IS NOT NULL AND "formId" IS NOT NULL
  ORDER BY "leadId", "createdAt" DESC
) c
WHERE l."id" = c."leadId" AND l."formId" IS NULL;
```

### 10.4 Reclasificación de conversaciones históricas creadas por formularios

No se elimina nada; se marca el origen para que el inbox pueda filtrarlas:

```sql
UPDATE "crm_conversations" v
SET "source" = coalesce(v."source", 'FORM_SUBMISSION_LEGACY'),
    "status" = 'RESOLVED'
WHERE EXISTS (
  SELECT 1 FROM "crm_messages" m
  WHERE m."conversationId" = v."id" AND m."messageType" = 'FORM_SUBMISSION'
)
AND NOT EXISTS (
  SELECT 1 FROM "crm_messages" m2
  WHERE m2."conversationId" = v."id"
    AND m2."direction" = 'INBOUND'
    AND m2."messageType" <> 'FORM_SUBMISSION'
);
```

El inbox oculta por defecto `source = 'FORM_SUBMISSION_LEGACY'` y ofrece el interruptor "Mostrar captaciones históricas". Con esto se resuelve la contaminación visual **sin borrar historial**.

---

## 11. Backend: endpoints nuevos y ajustados

### 11.1 Núcleo de captación (refactor)

| Archivo | Cambio |
| --- | --- |
| `src/lib/crm-omnichannel.ts` | Extraer `recordLeadCapture()` (contacto + lead + captura + actividad + scoring + asignación + secuencias) y dejar `createInboundArtifacts()` como *wrapper* con `createConversation?: boolean` (default `true`) para no romper WhatsApp/Messenger/Instagram/bridge |
| `src/app/api/crm/captures/web-form/route.ts` | Usar `recordLeadCapture()` con `createConversation: false`; guardar `formId/formName/campaignName/serviceInterest/resourceLabel`; `ownerUserId` desde reglas de asignación (no desde `channel.createdBy.id`) |
| `src/app/api/crm/channels/[id]/google-sheets/import/route.ts` | `createConversation: false` |
| `src/app/api/crm/captures/booking/route.ts` | `createConversation` desde `settingsJson.capture.createConversation` (default `false`) |
| `src/lib/crm-contact-identity.ts` *(nuevo)* | `resolveOrCreateContact()`: normalización, orden de resolución, merge, `lastInteractionAt`, consentimiento |
| `src/lib/crm-lead-capture.ts` *(nuevo)* | Orquestador de captura: contacto → lead → captura → actividad → scoring → asignación → enrolamiento |
| `src/lib/crm-scoring.ts` *(nuevo)* | `applyScoreEvent()`, `recalculateLeadScore()`, `ensureScoringRules()` |
| `src/lib/crm-assignment.ts` *(nuevo)* | `resolveAssigneeByRules()`, `applyAssignmentRule()` |
| `src/lib/crm-sequences.ts` *(nuevo)* | `enrollLeadInSequences()`, `runDueSequenceSteps()`, `stopEnrollmentsForLead()` |
| `src/lib/crm-timeline.ts` *(nuevo)* | `loadContactTimeline()` / `loadLeadTimeline()`: fusiona actividades, capturas, mensajes, score events, oportunidades y tareas |
| `src/lib/crm-scope.ts` *(nuevo)* | `resolveCrmRecordScope()` → `{ userId, scope }` para aplicar OWN/ASSIGNED/TEAM/SEDE/EMPRESA en `where` |

### 11.2 Endpoints de leads

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/crm/leads` *(ajustado)* | Paginación (`page`, `pageSize` ≤ 100, `total`), `q`, `lifecycleStatus[]`, `status`, `source`, `sourceKey`, `formId`, `campaignName`, `serviceInterest`, `scoreBand`, `minScore`, `ownerUserId`, `unassigned`, `sedeId`, `createdFrom/To`, `lastActivityFrom/To`, `view` (`all/new/pending/nurturing/qualified/assigned/converted/discarded`), `sort`. Respuesta con `data`, `pagination`, `facets` |
| `POST /api/crm/leads` *(ajustado)* | Reutiliza contacto si existe (`dedupe` en respuesta), crea lead con `lifecycleStatus=NEW`, registra captura manual (`MANUAL_IMPORT`) y actividad |
| `GET /api/crm/leads/[id]` *(ajustado)* | Incluye contacto, últimas capturas, score events, oportunidades, conversaciones, tareas y `timeline` paginado |
| `PATCH /api/crm/leads/[id]` *(ajustado)* | Valida transiciones de `lifecycleStatus` (mapa §11.5), `serviceInterest`, `tags`, `ownerUserId` |
| `POST /api/crm/leads/[id]/assign` | Asigna responsable (capacidad `ASSIGN`), fija `assignedAt`, notifica y crea actividad `eventKey=assign:<ts>` |
| `POST /api/crm/leads/[id]/status` | Cambio de estado con motivo (descarte/nutrición/no contactar) y auditoría |
| `POST /api/crm/leads/[id]/convert-opportunity` | **Nuevo**: transacción que reutiliza contacto, crea `CrmOpportunity` (pipeline/etapa opcionales), copia origen, marca lead `SALES_ASSIGNED`/`CONVERTED`, detiene secuencias (`STOPPED_CONVERTED`) |
| `POST /api/crm/leads/[id]/do-not-contact` | Marca `DO_NOT_CONTACT` + consentimiento revocado + detiene secuencias |
| `POST /api/crm/leads/merge` | Fusiona dos leads del mismo contacto (opcional, fase 5) |


### 11.3 Endpoints de contactos

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/crm/contacts` *(ajustado)* | Directorio real: `q`, `status`, `ownerUserId`, `hasLead`, `sedeId`, paginación. `leadId`/`clienteId` pasan a filtros opcionales (compatibilidad) |
| `POST /api/crm/contacts` *(ajustado)* | Permite crear contacto **sin** `leadId`/`clienteId`; valida email único por empresa (409 con `duplicateContactId`) |
| `GET/PATCH /api/crm/contacts/[id]` | Incluye leads, capturas, conversaciones, oportunidades y timeline |
| `POST /api/crm/contacts/[id]/merge` | Fusiona duplicados con auditoría (`mergedIntoId`, actividad `MERGE`) |
| `GET/POST/PATCH /api/crm/contacts/[id]/consents` | Consentimiento por canal |

### 11.4 Endpoints de configuración

| Método y ruta | Descripción |
| --- | --- |
| `GET/PUT /api/crm/scoring/settings` | Umbrales frío/tibio/caliente y activación |
| `GET/PUT /api/crm/scoring/rules` | Reglas por `eventType` con puntos, `oncePerLead`, ventana y tope |
| `POST /api/crm/scoring/recalculate` | Recalcula puntuación de un lead o de un rango (idempotente, por lotes) |
| `GET/POST /api/crm/assignment-rules`, `PATCH/DELETE /api/crm/assignment-rules/[id]` | CRUD de reglas y simulación (`POST /api/crm/assignment-rules/preview`) |
| `GET/POST /api/crm/sequences`, `PATCH /api/crm/sequences/[id]` | CRUD de secuencias y pasos |
| `POST /api/crm/sequences/[id]/enroll` | Enrola un lead manualmente |
| `GET /api/cron/crm-sequences` *(nuevo)* | Procesa envíos vencidos; `Authorization: Bearer $CRON_SECRET` (mismo patrón que `account-retention`); parámetros `dryRun`, `limit` |
| `GET/POST /api/crm/pipelines`, `PATCH/DELETE /api/crm/pipelines/[id]` | Pipelines y etapas por pipeline |

### 11.5 Mapa de transiciones de `lifecycleStatus`

```
NEW ─────────────► PENDING_REVIEW ──► QUALIFIED ──► SALES_ASSIGNED ──► CONVERTED
 │                        │                │               │
 │                        ▼                ▼               ▼
 └──► NURTURING ──────────┘            DISCARDED ◄─────────┘
          │                                 ▲
          └──────────► DO_NOT_CONTACT ──────┘
```

Reglas de validación (backend, `POST /api/crm/leads/[id]/status`):

- `CONVERTED` solo se alcanza creando oportunidad (endpoint de conversión), nunca por cambio directo.
- `DO_NOT_CONTACT` es terminal para comunicaciones: bloquea secuencias, correos y WhatsApp saliente.
- `DISCARDED` exige `discardReason` (mínimo 10 caracteres).
- `NURTURING` exige que exista al menos una secuencia activa o se ofrece crearla.
- Cualquier transición registra `CrmActivity` con `eventKey = status:<leadId>:<timestamp>` y `type = OTHER` (se añadirá `STATUS_CHANGE` al enum existente si se aprueba, ver §21-D7).

---

## 12. Frontend: bandeja de leads y ficha

### 12.1 Ruta y navegación

- `src/app/dashboard/crm/leads/page.tsx`: **deja de redirigir**; renderiza `CrmLeadsInboxClient` (Server Component que resuelve `auth`, `resolveUserIdFromSession` y permisos, igual que `leads/[id]/page.tsx`).
- `src/app/dashboard/crm/leads/[id]/page.tsx`: se mantiene, pasando `canAccessAnyChat`.
- `src/app/dashboard/crm/contactos/page.tsx` *(nuevo)*: directorio de contactos (fase 3).
- `src/components/crm/sidebar`/`src/lib/product-architecture.ts`: registrar `nav.crmContacts` en la sección "Captación" y ajustar la etiqueta de `nav.crmLeads` a "Leads" (hoy dice "Captación").
- `src/lib/i18n/messages.ts`: nuevas claves en **ambos** bloques (es/en) para vistas, filtros, estados, acciones y errores. Validar con `npm run i18n:check`.

### 12.2 Composición de componentes (evitar monolitos)

```
src/components/crm/
├─ crm-leads-inbox-client.tsx        orquestador (estado, fetch, vistas)
├─ crm-leads-views-tabs.tsx          Todos | Nuevos | Sin gestionar | Nutrición | Calificados | Asignados | Convertidos | Descartados
├─ crm-leads-filters.tsx             búsqueda, fuente, campaña, formulario, servicio, estado, puntuación, responsable, fechas
├─ crm-leads-table.tsx               tabla responsive con columnas configurables + paginación
├─ crm-leads-score-badge.tsx         indicador visual frío/tibio/caliente
├─ crm-leads-row-actions.tsx         asignar, cambiar estado, crear tarea, abrir conversación, convertir, descartar
├─ crm-lead-detail-panel.tsx         panel lateral de detalle (sheet)
└─ crm-lead-timeline.tsx             historial cronológico unificado (reutilizable en la ficha)
```

Reutilización directa: `src/components/ui/{card,table,badge,select,dialog,tabs,sheet,input,textarea,button}`, `ErpBreadcrumbs`, `useI18n`, `formatCurrencyInput`-like helpers de `crm-dashboard-client`.

### 12.3 Diseño de la bandeja

- **Header:** título + contador por vista (facets del backend) + botón "Nuevo lead" + exportar (capacidad `EXPORT`).
- **Barra de filtros:** búsqueda instantánea (debounce 300 ms), chips de filtros activos, "limpiar".
- **Tabla:** Nombre/empresa · Contacto (email/tel) · Estado (badge) · Puntuación (badge + barra) · Fuente · Formulario · Servicio · Responsable · Capturado (fecha relativa) · Última actividad · Acciones.
- **Paginación:** `pageSize` 25/50/100, navegación server-side.
- **Responsive:** en `< md` la tabla se convierte en tarjetas; el panel de detalle pasa a pantalla completa.
- **Panel de detalle:** información de contacto, origen (fuente/campaña/formulario/recurso), etiquetas, puntuación con desglose de eventos, estado con acciones, responsable, historial, oportunidades y conversaciones relacionadas.

### 12.4 Ficha del lead (`crm-lead-detail-client.tsx`)

Se amplía (no se reescribe) con: bloque de origen y capturas, puntuación con desglose, consentimiento, botón **"Convertir en oportunidad"**, botón "Descartar" con motivo, "No contactar", "Asignar", y pestaña de historial unificado. Se conserva todo lo existente (oportunidades, contactos, timeline, tareas, archivos).


---

## 13. RBAC y alcance por registro

El catálogo ya declara los alcances (`src/lib/rbac-v2-catalog.ts:60-67`), pero ningún endpoint los aplica. Propuesta sin cambiar el motor RBAC:

1. **`src/lib/crm-scope.ts`** (nuevo): `resolveCrmRecordScope({ domain, subdomain, action })` devuelve `{ level: 'OWN' | 'ASSIGNED' | 'TEAM' | 'SEDE' | 'EMPRESA', userId, sedeIds, teamUserIds }`.
   - Reutiliza la evaluación de `canAccessCapability` para autorizar y, en la misma consulta, obtiene `UserCapabilityGrant.scopeType` y `PermissionProfile.capabilityLevels` (ya existen en el esquema) para derivar el alcance efectivo.
   - Si no hay alcance declarado (grants legacy), cae a `SEDE`, preservando el comportamiento actual.
2. **`where` derivado** para leads/contactos/oportunidades:
   - `OWN` → `createdById = userId`
   - `ASSIGNED` → `OR [{ ownerUserId: userId }, { assignedToUserId: userId }]`
   - `TEAM` → `ownerUserId IN (miembros de mis equipos)` (`Team`/`TeamMember`)
   - `SEDE` → `sedeId IN (sedes accesibles)` (comportamiento actual)
   - `EMPRESA` → solo `empresaId`
3. **Acciones sensibles** requieren capacidades específicas ya declaradas:
   - asignar → `CAPTACION/LEADS/ASSIGN`
   - exportar → `CAPTACION/LEADS/EXPORT`
   - configurar scoring/pipelines → `CONFIGURE`
   - descartar/no contactar → `UPDATE`
4. **Nunca** se confía en el `sedeId`/`ownerUserId` del body sin validar pertenencia a la empresa (patrón ya usado en `leads/route.ts:224-229`).

Criterio de aceptación 14 ("usuarios solo acceden a registros autorizados") queda cubierto por (1)-(4) con pruebas en `scripts/test-crm-captacion.ts` (matriz usuario × recurso).

---

## 14. Lead scoring

### 14.1 Modelo de ejecución

```
evento de negocio            regla vigente            evento de score            agregado
descarga de documento  ──►  DOCUMENT_DOWNLOAD +10 ──► CrmLeadScoreEvent ──► lead.score / scoreBand
solicitud de cotización ──► QUOTE_REQUEST +30 ──────► (dedupeKey único)
```

- `dedupeKey` propuesto: `<eventType>:<sourceId>` (p. ej. `DOCUMENT_DOWNLOAD:capture_123`). El índice único `(leadId, dedupeKey)` impide sumar dos veces el mismo hecho.
- `oncePerLead = true` genera `dedupeKey = <eventType>:lead`; `dedupeWindowHours > 0` genera `<eventType>:<ventana>` (p. ej. `EMAIL_OPEN:2026-11-13`).
- `applyScoreEvent()` (transacción): inserta el evento (si no existe), suma `points`, recalcula banda según `CrmScoringSettings` y registra `CrmActivity` con `eventKey = score:<eventId>`.
- `recalculateLeadScore()`: recalcula desde eventos (fuente de verdad), útil tras cambiar reglas. No se destruye historial: los eventos conservan los puntos aplicados en su momento y la diferencia se registra como `MANUAL_ADJUSTMENT`.
- Umbrales por defecto: frío `<20`, tibio `20-49`, caliente `≥50` (configurables).
- La puntuación **no** convierte leads ni los asigna automáticamente por sí sola; alimenta filtros, vistas y reglas de asignación.

### 14.2 Origen de cada evento

| Evento | Disparador técnico | Nota |
| --- | --- | --- |
| `DOCUMENT_DOWNLOAD` | Captura web con `purpose = INCENTIVE` o `resourceLabel` | Se emite en `recordLeadCapture` |
| `INFO_REQUEST` | Formulario con campo de mensaje/servicio | Heurística por `purpose` |
| `QUOTE_REQUEST` | Formulario con intención de cotización o creación de oportunidad | Regla configurable por formulario |
| `MEETING_BOOKED` | `captures/booking` satisfactorio | — |
| `LINK_CLICK` | Redirect firmado de enlaces de correo (`/api/public/crm-links`) | Fase 6; requiere tracking de clics |
| `EMAIL_OPEN` | Píxel de apertura en correos de secuencia | Fase 6; requiere consentimiento aplicable |
| `SERVICE_PAGE_VISIT` | Beacon del sitio del cliente (script público) | Fase 6; opcional |
| `MANUAL_ADJUSTMENT` | Acción del asesor desde la ficha | Auditoría con `createdById` |

---

## 15. Reglas de asignación

- `CrmAssignmentRule.matchJson`: `{ sources: [], formIds: [], campaignNames: [], services: [], sedes: [], cities: [], scoreBands: [], minScore }` — todos los criterios presentes deben cumplirse (AND); dentro de un criterio, cualquiera coincide (OR).
- Evaluación por `priority ASC`; con `stopOnMatch = true` se detiene en la primera regla que asigne.
- Destinos: `assigneeUserId` (persona) o `teamId` (reparto por carga dentro del equipo, reutilizando `Team`/`TeamMember` y el criterio de carga activa de `resolveInboundAssigneeUserId`).
- Si ninguna regla coincide: el lead queda **sin responsable** en la vista "Nuevos" (requisito explícito del usuario) y se notifica a los líderes comerciales (`Notification` con `actionUrl` a la bandeja filtrada).
- Toda asignación (manual o por regla) escribe `assignedAt`, `assignedByUserId`, actividad `eventKey = assign:<ts>` y notificación al asignado.


---

## 16. Motor de secuencias (automatizaciones)

### 16.1 Ejecución

- **Enrolamiento:** al registrar una captura, `enrollLeadInSequences()` evalúa `CrmSequence.triggerJson` (fuente, formulario, servicio, banda de score). El enrolamiento fija `nextRunAt = now + step[0].delayDays` (día 0 = inmediato).
- **Ejecución:** `GET /api/cron/crm-sequences` (Bearer `CRON_SECRET`) toma hasta `limit` enrolamientos `ACTIVE` con `nextRunAt <= now`, ejecuta **un** paso por corrida y programa el siguiente. Idempotencia garantizada por `@@unique([enrollmentId, stepId])` en `CrmSequenceSend`.
- **Canales:** `EMAIL` usa `sendEmail` + `renderCrmResponseEmail` (plantillas con variables). `WHATSAPP` usa la infraestructura existente de `crm-whatsapp.ts` y el canal `WHATSAPP_CLOUD` activo de la sede; si no hay canal activo, el paso queda `SKIPPED` con motivo. `TASK` crea `CrmTask` para el responsable. `WAIT` solo reprograma. `WEBHOOK` queda reservado para integraciones.
- **Registro:** cada envío crea `CrmSequenceSend` y una `CrmActivity` (`eventKey = sequence:<sendId>`), que alimenta el historial unificado.

### 16.2 Reglas de parada

| Condición | Efecto |
| --- | --- |
| `doNotContact` / consentimiento `REVOKED` en el canal | `status = STOPPED_OPT_OUT`, no se envía nada más |
| Lead pasa a `CONVERTED` / se crea oportunidad | `STOPPED_CONVERTED` si `stopOnOpportunity` |
| Respuesta inbound en conversación del contacto | `STOPPED_REPLY` (si `stopOnReply`; el estado se representará con `stoppedReason`) |
| Secuencia pausada/archivada | No se procesan sus pasos |
| Error de proveedor | `CrmSequenceSend.status = FAILED` + reintento con tope (3) y notificación |

### 16.3 Ejemplo del requerimiento (guía "Antes de contratar software…")

| Día | Paso | Implementación |
| --- | --- | --- |
| 0 | Entregar el documento + etiquetas `lead_magnet`, `interes_software` | Captura web (`purpose=INCENTIVE`) + `recordLeadCapture` (etiquetas ya derivadas en `leadTags`) |
| 2 | Contenido educativo | `CrmSequenceStep { kind: EMAIL, delayDays: 2 }` |
| 5 | Caso de éxito | `delayDays: 3` (acumulado 5) |
| 8 | Correo para identificar necesidades | `delayDays: 3` |
| 12 | Invitación a asesoría | `delayDays: 4` |

No se construye un motor de email marketing desde cero: se reutiliza Resend, el renderizador de correo del CRM y la infraestructura de WhatsApp ya existente.

---

## 17. Historial unificado

`src/lib/crm-timeline.ts` compone en lectura (sin tabla espejo):

| Fuente | Campos usados | Presentación |
| --- | --- | --- |
| `CrmLeadCapture` | `captureType`, `formName`, `campaignName`, `serviceInterest`, `createdAt` | "Formulario diligenciado" / "Documento descargado" |
| `CrmLeadScoreEvent` | `eventType`, `points`, `occurredAt` | "Puntuación +10 (descarga)" |
| `CrmActivity` | `type`, `summary`, `details`, `occurredAt` | Nota, llamada, correo, reunión, cambio de estado |
| `CrmConversation` + `CrmMessage` | `firstInboundAt`, `lastMessageAt`, `directionLastMessage`, `messageType` | "Conversación iniciada en WhatsApp" (referencia al hilo, sin duplicar mensajes) |
| `CrmOpportunity` | `stage`, `expectedValue`, `wonAt`, `lostAt` | "Oportunidad creada/ganada/perdida" |
| `CrmTask` | `title`, `status`, `dueAt`, `completedAt` | "Tarea creada/completada" |
| `CrmSequenceSend` | `channel`, `status`, `sentAt` | "Correo de secuencia enviado" |

Contrato: `{ id, kind, occurredAt, title, description, actor, channel, entity: { type, id }, metadata }`. Filtros por `kind` y ventana temporal. Se expone en `GET /api/crm/leads/[id]?include=timeline` y en `GET /api/crm/contacts/[id]`.

---

## 18. Reutilización explícita (qué NO se crea)

| Necesidad del requerimiento | Se resuelve con | No se crea |
| --- | --- | --- |
| Contactos | `CrmContact` (ampliado) | Segundo catálogo de contactos |
| Empresas | `Cliente`/`empresaNombre` en contacto y lead | Entidad "Company" paralela |
| Conversaciones y mensajes | `CrmConversation`, `CrmMessage` | Buzón nuevo |
| Canales WhatsApp/Instagram/Facebook | `CrmChannelConnection` + webhooks existentes | Nuevo gateway de canales |
| Oportunidades y etapas | `CrmOpportunity`, `CrmStageSetting`, `CrmPipeline` (nuevo, solo para múltiples embudos) | Pipeline paralelo |
| Tareas y recordatorios | `CrmTask`, `CrmAgendaCalendar`, `crm-follow-up.ts` | Motor de tareas nuevo |
| Historial | `CrmActivity` + `crm-timeline` | Tabla de eventos duplicada |
| Correo | `src/lib/email.ts`, `crm-response-email.ts` | Proveedor nuevo |
| Catálogos configurables (etiquetas, motivos de descarte) | `ConfigDropdown`/`ConfigDropdownItem` (key/label/meta) | Tablas de catálogo ad hoc |
| Formularios web | `CrmChannelConnection` (`WEB_FORM`) + `settingsJson.purpose` + `crm-web-form-*` | Constructor de formularios nuevo |
| Notificaciones internas | `Notification` + push existente | Sistema de alertas nuevo |
| Exportación | Patrón de exportaciones existente (`EXPORT` capability) | Servicio de reportes nuevo |


---

## 19. Plan de ejecución por fases

Cada fase termina con: `npm run typecheck`, `npm run lint` sobre archivos tocados y ejecución de pruebas de la fase. Nunca se avanza sin migraciones aplicadas en local y verificadas.

### FASE 2 — Modelo de datos (base)

**Archivos afectados**
- `prisma/schema.prisma` (enums + columnas + relaciones).
- `prisma/migrations/2026xxxx_crm_lead_lifecycle_and_scoring_columns/migration.sql` (M1).
- `prisma/migrations/2026xxxx_crm_lead_capture_origin/migration.sql` (M2).
- `prisma/migrations/2026xxxx_crm_contact_identity/migration.sql` (M3).
- `prisma/migrations/2026xxxx_crm_contact_email_uniqueness/migration.sql` (M4).
- `scripts/backfill-crm-contacts.ts` (M5, idempotente y con `--dry-run`).
- `src/lib/crm.ts` (constantes de nuevos enums + parsers).

**Salida:** esquema generado, backfills ejecutables, cero cambios de comportamiento visible.

### FASE 3 — Separación de captación y conversaciones

**Archivos afectados**
- `src/lib/crm-omnichannel.ts` (extraer `recordLeadCapture`, flag `createConversation`).
- `src/lib/crm-lead-capture.ts`, `src/lib/crm-contact-identity.ts` (nuevos).
- `src/app/api/crm/captures/web-form/route.ts`.
- `src/app/api/crm/channels/[id]/google-sheets/import/route.ts`.
- `src/app/api/crm/captures/booking/route.ts` (flag configurable).
- `src/lib/crm-web-form-purpose.ts` (exponer `resourceLabel`, servicio y etiquetas para scoring).
- `src/app/api/crm/conversations/route.ts` + `src/components/crm/crm-conversations-client.tsx` (filtro "ocultar captaciones históricas", contador honesto).

**Salida:** un formulario crea contacto + lead + captura + actividad, **sin** conversación ni mensaje. WhatsApp/Instagram/Messenger/correo siguen creando conversaciones.

> **Nota (nov-2026):** la separación se mantiene en el motor
> (`recordLeadCapture` siempre crea la captura sin conversación), pero el envío
> de formularios web vuelve al inbox omnicanal cuando el canal tiene
> `createSubmissionConversation` activo (por defecto **sí**). Se implementa con
> `attachCaptureConversation()` (`src/lib/crm-omnichannel.ts`), que reutiliza
> `ensureConversation()` + un mensaje `FORM_SUBMISSION` y vincula la captura
> (`crm_lead_captures.conversationId`). El interruptor vive en la sección
> "Finalidad del formulario" de CRM → Automatización → Formulario Web.

### FASE 4 — Módulo de Leads (bandeja y ficha)

**Archivos afectados**
- `src/app/api/crm/leads/route.ts` (paginación, filtros, facets).
- `src/app/api/crm/leads/[id]/route.ts` (detalle enriquecido, transiciones).
- `src/app/api/crm/leads/[id]/assign/route.ts`, `/status/route.ts`, `/convert-opportunity/route.ts`, `/do-not-contact/route.ts` (nuevos).
- `src/lib/crm-scope.ts` (nuevo) + aplicación en `leads`, `contacts`, `opportunities`.
- `src/app/dashboard/crm/leads/page.tsx` (deja de redirigir).
- `src/components/crm/crm-leads-inbox-client.tsx` y satélites (§12.2, nuevos).
- `src/components/crm/crm-lead-detail-client.tsx` (ampliación).
- `src/app/dashboard/crm/contactos/page.tsx` + `crm-contacts-client.tsx` (nuevos).
- `src/app/api/crm/contacts/route.ts`, `/contacts/[id]/route.ts` (directorio y merge).
- `src/lib/product-architecture.ts` + `src/lib/i18n/messages.ts` (navegación y textos).

**Salida:** bandeja operativa con vistas, filtros, paginación, acciones y conversión a oportunidad sin duplicar contacto.

### FASE 5 — Scoring y asignación

**Archivos afectados**
- `prisma/schema.prisma` + migraciones M6/M7.
- `src/lib/crm-scoring.ts`, `src/lib/crm-assignment.ts` (nuevos).
- `src/app/api/crm/scoring/**`, `src/app/api/crm/assignment-rules/**` (nuevos).
- `src/app/dashboard/crm/scoring/page.tsx` + `crm-scoring-client.tsx` (nuevos).
- Integración en `recordLeadCapture` y en `convert-opportunity`.

**Salida:** puntuación configurable, eventos auditables, asignación por reglas, recalculo idempotente.

### FASE 6 — Secuencias y automatizaciones

**Archivos afectados**
- Migración M8; `src/lib/crm-sequences.ts` (nuevo).
- `src/app/api/crm/sequences/**`, `src/app/api/cron/crm-sequences/route.ts` (nuevos).
- `src/app/dashboard/crm/secuencias/page.tsx` + `crm-sequences-client.tsx` (nuevos).
- `src/components/crm/crm-lead-detail-client.tsx` (bloque de secuencia activa).
- Documentación de variables de entorno (`CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`).

**Salida:** secuencias con paradas por opt-out/conversión, registro de cada envío y ejecución programada.

### FASE 7 — Pipelines múltiples, pruebas y cierre

**Archivos afectados**
- Migración M9; `src/app/api/crm/pipelines/**` (nuevos).
- `src/app/api/crm/stages/route.ts` y `src/components/crm/crm-dashboard-client.tsx` (selector de pipeline).
- `scripts/test-crm-captacion.ts` (nuevo) + scripts de smoke.
- Actualización de `CRM-MADUREZ-ROADMAP.md` y `CRM-FASE1-BACKLOG.md`.

**Salida:** múltiples embudos, batería de pruebas end-to-end y documentación actualizada.


---

## 20. Pruebas y criterios de aceptación

### 20.1 Mapa de criterios de aceptación → verificación

| # | Criterio | Cómo se verifica |
| --- | --- | --- |
| 1 | Un formulario crea lead **sin** crear conversación | `scripts/test-crm-captacion.ts`: POST `/api/crm/captures/web-form` con canal de prueba → `crm_leads +1`, `crm_lead_captures +1`, `crm_activities +1`, `crm_conversations +0`, `crm_messages +0` |
| 2 | El contacto se crea una sola vez | Dos capturas con el mismo email → un `CrmContact`, un lead reutilizado, dos capturas |
| 3 | Un contacto existente recibe nuevas capturas sin duplicarse | Captura A (formulario software) y B (formulario impresión) → mismo contacto, dos capturas, dos leads con `serviceInterest` propio |
| 4 | Bandeja independiente | `GET /api/crm/leads?view=new` devuelve solo leads; `/dashboard/crm/leads` renderiza la bandeja (no redirige) |
| 5 | Clasificación y asignación | `POST /leads/[id]/assign` + `POST /leads/[id]/status`; 403 sin capacidad `ASSIGN` |
| 6 | Origen y campaña registrados | `capture.formName/campaignName/serviceInterest` no nulos con UTMs de prueba |
| 7 | Historial con eventos | `GET /api/crm/leads/[id]?include=timeline` contiene captura, score, asignación y conversión |
| 8 | WhatsApp/Instagram/Facebook siguen funcionando | Simulación de webhook Meta (`/api/webhooks/meta`) → conversación + mensaje creados (regresión) |
| 9 | Conversaciones vinculadas al contacto existente | Inbound de WhatsApp con email/phone de un contacto existente → `conversation.contactId` = contacto previo |
| 10 | Lead → oportunidad sin duplicar contacto | `POST /convert-opportunity` → `opportunities +1`, `contacts +0`, `lead.lifecycleStatus = SALES_ASSIGNED` |
| 11 | La oportunidad conserva el origen | `opportunity.sourceLeadCaptureId` y `pipelineId` asignados |
| 12 | Leads sin interés permanecen en nutrición | `status = NURTURING` + enrolamiento activo; no aparecen en el pipeline |
| 13 | Automatizaciones respetan preferencias | Envío bloqueado con `DO_NOT_CONTACT` y consentimiento `REVOKED` (paso `SKIPPED`) |
| 14 | Acceso restringido por usuario | Matriz de alcance: `OWN` no ve leads de otros; `SEDE` no ve otra sede; `EMPRESA` ve todo |

### 20.2 Batería de pruebas (nuevo `scripts/test-crm-captacion.ts`)

1. Seguridad del formulario: token inválido → 403; honeypot → descartado; rate limit → 429.
2. Captura con regalo: se crea captura con `resourceLabel`, entrega de correo simulada, sin conversación.
3. Deduplicación: email igual con distinto casing/espacios → mismo contacto.
4. Deduplicación por teléfono: `+57 300 123 4567` vs `3001234567` → mismo contacto.
5. Scoring: dos descargas del mismo recurso → un solo evento (`dedupeKey`), puntos no duplicados.
6. Asignación: regla por `serviceInterest` → `ownerUserId` esperado; sin regla → `null`.
7. Conversión: contacto existente + oportunidad nueva → una sola fila en `crm_contacts`.
8. Secuencia: opt-out a mitad → `STOPPED_OPT_OUT`, sin envíos posteriores.
9. Historial: orden cronológico y ausencia de duplicados entre `capture` y `activity`.
10. Compatibilidad: un lead histórico (sin `contactId`) sigue visible y editable.

### 20.3 Pruebas de regresión obligatorias

- `npm run typecheck`, `npm run lint`.
- `npm run test:crm-files-acl`, `npm run test:dashboard-access-rbac`, `npm run i18n:check`.
- Inbox omnicanal: abrir conversación, responder, resolver, reabrir por inbound, crear oportunidad desde el hilo.
- Formulario público: dropdowns con espacios/comas (corrección previa), regalo firmado, correo de respuesta.


---

## 21. Riesgos y decisiones que requieren aprobación

### 21.1 Decisiones

| ID | Decisión | Opciones | Recomendación | Impacto si se elige distinto |
| --- | --- | --- | --- | --- |
| **D1** | Identidad del contacto | (a) ascender `CrmContact` con `emailNormalized` único; (b) mantener `CrmLead` como identidad y `CrmContact` como libreta | **(a)** | (b) deja el requisito "contacto único" sin garantía estructural |
| **D2** | Estados de lead | (a) nuevo campo `lifecycleStatus` con 8 estados; (b) ampliar `CrmLeadStatus`; (c) reutilizar `status` con nuevos valores | **(a)** | (b)/(c) reinterpretan datos históricos y rompen filtros existentes |
| **D3** | Múltiples pipelines | (a) `CrmPipeline` + `pipelineId` conservando el enum como clave de etapa; (b) etapas 100% dinámicas | **(a)** | (b) exige reescribir `CrmOpportunity.stage` y toda la UI del pipeline |
| **D4** | Formularios como entidad | (a) reutilizar `CrmChannelConnection` (`WEB_FORM`) y denormalizar `formId/formName`; (b) crear `CrmWebForm` | **(a)** | (b) duplica la configuración existente de integraciones |
| **D5** | Booking e importaciones | (a) captación sin conversación (configurable); (b) mantener conversación | **(a)** vía `settingsJson.capture.createConversation` | (b) mantiene la contaminación del inbox |
| **D6** | Directorio de contactos | (a) nueva ruta `/dashboard/crm/contactos`; (b) pestaña dentro de Clientes ERP | **(a)** | (b) mezcla identidad comercial con facturación |
| **D7** | Cambios de estado en historial | (a) `CrmActivity` con `type = OTHER` + `eventKey`; (b) añadir `STATUS_CHANGE` a `CrmActivityType` | **(b)**: el enum ya tiene `STAGE_CHANGE`; añadir un valor es seguro y mejora reportes | (a) pierde granularidad |
| **D8** | WhatsApp en secuencias | (a) solo correo en Fase 6, WhatsApp en Fase 7; (b) ambos desde el inicio | **(a)** | (b) aumenta riesgo operativo y de cumplimiento |

### 21.2 Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| El índice único de email falla por duplicados existentes | M4 precedida por script de dedupe con reporte y `--dry-run`; fusión auditada (`mergedIntoId`) en lugar de borrado |
| Datos históricos sin `contactId` | Backfill idempotente + lectura tolerante (`contactId` opcional, fallback al lead) |
| Regresión en webhooks de WhatsApp/Meta | `createConversation` por defecto `true` en `createInboundArtifacts`; pruebas de regresión de webhooks |
| Coste de `GET /api/crm/leads` con volumen alto | Paginación server-side obligatoria, `select` acotado, índices por caso de uso, sin `include` por fila |
| Duplicidad de lógica de dedupe (hoy en `crm-omnichannel.ts`) | Extraer a `crm-contact-identity.ts` y eliminar la copia local `findConflictingLead` de `leads/route.ts` y `leads/[id]/route.ts` |
| Correos de secuencia sin consentimiento | `CrmContactConsent` + `DO_NOT_CONTACT` verificados antes de cada envío; registro en `CrmSequenceSend` |
| Interpretación de los días del ejemplo (0/2/5/8/12) | `delayDays` acumulados desde el inicio de la secuencia, documentado en la UI de configuración |

### 21.3 Fuera de alcance de esta propuesta (fases posteriores)

- Tracking real de aperturas de correo y clics (requiere dominio de envío verificado y píxeles firmados).
- Visitas a páginas de servicio (requiere script público en el sitio del cliente).
- Sincronización bidireccional con Gmail/Outlook y Google Calendar (existe base en `captures/bridge`).
- Rediseño visual del CRM fuera de los componentes de leads/contactos.
- Motor de email marketing masivo con plantillas visuales; aquí solo secuencias transaccionales con plantillas del CRM.

---

## 22. Siguiente paso

Con aprobación de las decisiones D1-D8, la implementación comienza por **FASE 2 (modelo de datos)** y **FASE 3 (separación captura/conversación)**, que juntas resuelven el defecto reportado y habilitan el resto del módulo.

Cada fase se entregará con: archivos modificados, cambios de base de datos, pruebas ejecutadas y pendientes explícitos.

---

## 23. Estado de ejecución

### 23.1 FASE 2 — modelo de datos (completada)

Decisiones aprobadas: **D1-D8** (§21.1). Se implementó el delta aditivo de esquema y las migraciones M1-M4, más el script de backfill M5.

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Enums y columnas de ciclo de vida/scoring/origen en `CrmLead` | `prisma/schema.prisma` | Hecho |
| Identidad de contacto en `CrmContact` (+ `@@unique([empresaId, emailNormalized])`) | `prisma/schema.prisma` | Hecho |
| Origen y trazabilidad en `CrmLeadCapture` | `prisma/schema.prisma` | Hecho |
| `contactId` en conversaciones, oportunidades y actividades | `prisma/schema.prisma` | Hecho |
| M1 `20261113130000_crm_lead_lifecycle_and_scoring_columns` | `prisma/migrations/…/migration.sql` | Escrita y validada |
| M2 `20261113140000_crm_lead_capture_origin` | `prisma/migrations/…/migration.sql` | Escrita y validada |
| M3 `20261113150000_crm_contact_identity` | `prisma/migrations/…/migration.sql` | Escrita y validada |
| M4 `20261113160000_crm_contact_email_uniqueness` | `prisma/migrations/…/migration.sql` | Escrita y validada |
| M5 backfill de contacto canónico e idempotente | `scripts/backfill-crm-contacts.ts` + `npm run backfill:crm-contacts` | Escrito y validado (tipos/lint) |

Reglas respetadas:
- Ninguna migración elimina columnas, tablas ni datos; los enums existentes solo reciben valores nuevos.
- `lifecycleStatus` convive con `CrmLeadStatus` (histórico) para no reinterpretar datos.
- La heurística débil de deduplicación nunca fusiona: M4 solo fusiona coincidencias exactas de email normalizado, marcando `mergedIntoId` y conservando el email original.
- Las columnas normalizadas (`emailNormalized`, `phoneNormalized`) se rellenan en M3/M4 para los registros existentes.

Validaciones ejecutadas:
- `npx prisma validate` → esquema válido.
- `npx prisma generate` → cliente regenerado.
- `npx tsc --noEmit --incremental false` → sin errores.
- `npx eslint scripts/backfill-crm-contacts.ts` → sin errores.
- Ejecución real del SQL de M1→M4 dentro de `BEGIN … ROLLBACK` contra PostgreSQL 18 → sin errores y sin persistencia (0 columnas/índices residuales).

Pendiente operativo (no bloquea el código):
1. Aplicar migraciones: `npx prisma migrate deploy` (M4 conviene en ventana corta por la creación del índice único).
2. Ejecutar backfill: `npm run backfill:crm-contacts -- --dry-run` y luego sin `--dry-run`.

### 23.2 FASE 3 — separación de captación y conversaciones (completada)

Se extrajo el motor de captación a dos módulos sin dependencias de Next.js (importables desde scripts) y `createInboundArtifacts()` quedó como wrapper compatible con los webhooks existentes.

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Motor de identidad de contacto (`ensureContactIdentity`, `findContactBySignals`, `propagateContactToLeadChildren`, `touchContactInteraction`) | `src/lib/crm-contact-identity.ts` | Hecho |
| Orquestador de captura (`recordLeadCapture`, `ensureLeadCaptureIdentity`, `recordLeadCaptureEvent`) | `src/lib/crm-lead-capture.ts` | Hecho |
| `createInboundArtifacts()` como wrapper con `createConversation?: boolean` (default `true`) y re-exports compatibles | `src/lib/crm-omnichannel.ts` | Hecho |
| Web form sin conversación: `sourceKey = WEB_FORM`, `formId/formName`, campaña, `resourceLabel` y consentimiento | `src/app/api/crm/captures/web-form/route.ts` | Hecho |
| Importación Google Sheets sin conversación (`createConversation: false`); oportunidad ligada al lead | `src/app/api/crm/channels/[id]/google-sheets/import/route.ts` | Hecho |
| Agenda web con conversación configurable (`settingsJson.capture.createConversation`, default `false`) | `src/app/api/crm/captures/booking/route.ts` | Hecho |
| Backfill migrado al motor compartido (contacto canónico + propagación a hijos, excluye contactos fusionados) | `scripts/backfill-crm-contacts.ts` | Hecho |
| Tipos de resultado explícitos para webhooks que siempre abren conversación | `src/app/api/webhooks/meta/route.ts`, `src/app/api/crm/captures/chatbot/route.ts` | Hecho |

Reglas respetadas:
- WhatsApp/Meta/Instagram y los bridges siguen abriendo conversación (`createConversation` default `true`).
- La captura sin conversación registra `CrmLeadCapture` + `CrmActivity` con `conversationId: null` y no dispara notificación de inbox.
- La identidad de contacto no fusiona en runtime: `mergedIntoId` solo se usa para excluir contactos fusionados.
- La respuesta del web form mantiene `leadId`/`captureId` y suma `contactId`; `conversationId` y `messageId` son `null` por diseño.
- El backfill respeta `--dry-run` sin escribir nada (tampoco crea contactos): solo reporta los que faltarían.

Validaciones ejecutadas:
- `npx tsc --noEmit --incremental false` → sin errores.
- `npx eslint` sobre los archivos modificados → 0 errores (quedan 5 warnings preexistentes en `captures/chatbot/route.ts`).

Pendiente para fases siguientes (cubierto en §23.3–§23.6):
1. Asignación por reglas (`crm-assignment.ts`): ~~hoy el web form usa `channel.createdBy.id` como `ownerUserId` preferido~~ → el web form ya no preasigna; deciden las reglas (§23.4).
2. Scoring, secuencias y timeline (FASE 4 en adelante) → implementados en §23.4–§23.6.



### 23.3 FASE 4 — Módulo de Leads: bandeja, ficha y directorio (completada)

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Alcance por registro (`resolveCrmRecordScope`, `buildCrmScopeWhere`, `canAccessCrmRecord`) | `src/lib/crm-scope.ts` | Hecho |
| Historial unificado en lectura (`loadLeadTimeline`, `loadContactTimeline`) | `src/lib/crm-timeline.ts` | Hecho |
| Puerta única de acceso a lead (capability + empresa + alcance) | `src/lib/crm-lead-access.ts` | Hecho |
| `GET /api/crm/leads` con paginación (`page`, `pageSize` ≤ 100), `q`, vistas, filtros, `facets` y `sort` | `src/app/api/crm/leads/route.ts` | Hecho |
| `POST /api/crm/leads` con reutilización de contacto (`ensureLeadCaptureIdentity`) y captura opcional por canal | `src/app/api/crm/leads/route.ts` | Hecho |
| Detalle enriquecido (contacto, consentimientos, capturas, score, oportunidades, tareas, conversaciones, secuencias, timeline) | `src/app/api/crm/leads/[id]/route.ts` | Hecho |
| Transición por `PATCH` valida el mapa de estados y delega en la máquina de estados | `src/app/api/crm/leads/[id]/route.ts` | Hecho |
| `POST /assign`, `/status`, `/convert-opportunity`, `/do-not-contact` | `src/app/api/crm/leads/[id]/*/route.ts` | Hecho |
| Directorio real de contactos (paginación, `q`, estado, `hasLead`, alcance) + alta sin `leadId`/`clienteId` (409 con `duplicateContactId`) | `src/app/api/crm/contacts/route.ts` | Hecho |
| Detalle de contacto con leads, capturas, conversaciones, oportunidades y timeline | `src/app/api/crm/contacts/[id]/route.ts` | Hecho |
| Fusión de duplicados con auditoría (`mergedIntoId`, actividad `merge:<origen>:<destino>`) | `src/app/api/crm/contacts/[id]/merge/route.ts` | Hecho |
| Consentimiento por canal (`GET/POST/PATCH`; revocar arrastra a `DO_NOT_CONTACT`) | `src/app/api/crm/contacts/[id]/consents/route.ts` | Hecho |
| Bandeja operativa (`crm-leads-inbox-client` + vistas, filtros, tabla, panel de detalle, timeline) | `src/components/crm/crm-leads-*.tsx`, `src/app/dashboard/crm/leads/page.tsx` | Hecho |
| Directorio de contactos con ficha lateral y fusión | `src/components/crm/crm-contacts-client.tsx`, `src/app/dashboard/crm/contactos/page.tsx` | Hecho |
| Navegación (`nav.crmLeads` = “Leads”, `nav.crmContacts`, `nav.crmScoring`, `nav.crmSequences`) en es/en | `src/lib/product-architecture.ts`, `src/lib/i18n/messages.ts` | Hecho |

Reglas respetadas:
- La bandeja usa `facets` del backend; “Sin gestionar” = `NEW`/`PENDING_REVIEW` y la insignia de `unassigned`.
- Un lead sin regla de asignación **permanece sin responsable** y se ve en “Nuevos/Sin gestionar”.
- Todas las consultas filtran por `empresaId` y aplican alcance (`OWN`/`ASSIGNED`/`TEAM`/`SEDE`/`EMPRESA`).
- `TEAM` se resuelve con `Team`/`TeamMember`; si el usuario no tiene equipos, no ve registros.
- La máquina de estados (`crm-lifecycle.ts`) bloquea `CONVERTED` por cambio directo y exige motivo (≥10) al descartar.
- La conversión a oportunidad reutiliza el contacto, copia origen, detiene secuencias (`STOPPED_CONVERTED`) y emite `QUOTE_REQUEST`.
- “No contactar” revoca consentimientos, actualiza el contacto y detiene secuencias (`STOPPED_OPT_OUT`).



### 23.4 FASE 5 — Scoring y asignación por reglas (completada)

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Migración M6: `crm_scoring_settings`, `crm_scoring_rules`, `crm_lead_score_events`, `crm_assignment_rules`, `crm_contact_consents` | `prisma/migrations/20261113170000_crm_scoring_and_assignment` | Hecho |
| Migración M7: `CrmActivity.eventKey` + `metadataJson` e índice único `(empresaId, eventKey)` | `prisma/migrations/20261113165000_crm_activity_event_key` | Hecho |
| Sembrado perezoso de reglas por empresa y umbrales configurables | `src/lib/crm-scoring.ts` | Hecho |
| `applyScoreEvent` idempotente (pre-chequeo + `@@unique([leadId, dedupeKey])`), `oncePerLead`, ventana y tope | `src/lib/crm-scoring.ts` | Hecho |
| `recalculateLeadScore` con `MANUAL_ADJUSTMENT` para conservar trazabilidad | `src/lib/crm-scoring.ts` | Hecho |
| Heurística de eventos por captura (`inferCaptureScoreEvents`, `applyCaptureScoreEvents`) | `src/lib/crm-scoring.ts` | Hecho |
| Reglas de asignación (AND entre criterios, OR dentro de cada lista), prioridad y reparto por carga de equipo | `src/lib/crm-assignment.ts` | Hecho |
| `assignCrmLead` con `assignedAt`/`assignedByUserId`, actividad `assign:<leadId>:<ts>` y notificación | `src/lib/crm-assignment.ts` | Hecho |
| Aviso a líderes cuando ningún lead coincide con reglas | `notifyCrmLeadersOfUnassignedLead` | Hecho |
| Integración en captura (`recordLeadCapture`) y en inbound conversacional (`createInboundArtifacts`) | `src/lib/crm-lead-capture.ts`, `src/lib/crm-omnichannel.ts` | Hecho |
| Web form, agenda e importación dejan de preasignar al creador del canal | rutas de captura | Hecho |
| Agenda emite `MEETING_BOOKED` (`extraScoreEvents`) | `src/app/api/crm/captures/booking/route.ts` | Hecho |
| APIs `GET/PUT /api/crm/scoring/settings`, `GET/PUT /api/crm/scoring/rules`, `POST /api/crm/scoring/recalculate` | `src/app/api/crm/scoring/**` | Hecho |
| APIs `GET/POST /api/crm/assignment-rules`, `PATCH/DELETE /[id]`, `POST /preview` | `src/app/api/crm/assignment-rules/**` | Hecho |
| Pantalla de configuración (umbrales, reglas, simulación) | `src/components/crm/crm-scoring-client.tsx`, `src/app/dashboard/crm/scoring/page.tsx` | Hecho |

Reglas respetadas:
- La puntuación **no** asigna ni convierte por sí sola: alimenta filtros y reglas.
- Repetir la misma captura no duplica puntos del mismo `eventType` (clave `oncePerLead`).
- `recalculate` reconstruye desde eventos y no destruye historial.
- En captación sin conversación el responsable lo deciden las reglas; en inbound conversacional se conserva el reparto por carga.
- Los eventos de score escriben `CrmActivity` con `eventKey = score:<eventId>`.

Desviaciones documentadas:
- `CrmContactChannel` se implementó como `EMAIL | WHATSAPP | SMS | CALL` (el doc proponía `PHONE | META`); ambos cubren el mismo caso con nombres más explícitos.
- `CrmActivity` no recibe valor nuevo en el enum: el cambio de estado se registra como `OTHER` con `eventKey = status:<leadId>:<ts>` y `metadataJson {from,to}` (evita reinterpretar datos históricos).



### 23.5 FASE 6 — Secuencias y automatizaciones (completada)

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Migración M8: `crm_sequences`, `crm_sequence_steps`, `crm_sequence_enrollments`, `crm_sequence_sends` | `prisma/migrations/20261113180000_crm_sequences` | Hecho |
| Enrolamiento por trigger (fuente, formulario, servicio, banda, campaña) e idempotente por `(sequenceId, contactId)` | `src/lib/crm-sequences.ts` | Hecho |
| `runDueSequenceSteps`: un paso por corrida, `@@unique([enrollmentId, stepId])`, reprogramación del siguiente | `src/lib/crm-sequences.ts` | Hecho |
| Canales: `EMAIL` (Resend + variables `{{nombre}}`, `{{servicio}}`…), `WHATSAPP` (canal Cloud activo de la sede), `TASK` (crea `CrmTask`), `WAIT`; `WEBHOOK` reservado | `src/lib/crm-sequences.ts` | Hecho |
| Paradas: opt-out/consentimiento revocado, conversión y `DO_NOT_CONTACT` | `runDueSequenceSteps`, `stopEnrollmentsForLead` | Hecho |
| Ejecutor programado `GET/POST /api/cron/crm-sequences` con `Bearer $CRON_SECRET`, `dryRun`, `limit` y multiempresa | `src/app/api/cron/crm-sequences/route.ts` | Hecho |
| APIs de administración `GET/POST /api/crm/sequences`, `PATCH/DELETE /[id]`, `POST /[id]/enroll` | `src/app/api/crm/sequences/**` | Hecho |
| Pantalla de secuencias (alta con pasos, activar/pausar/archivar, enrolamiento manual) | `src/components/crm/crm-sequences-client.tsx`, `src/app/dashboard/crm/secuencias/page.tsx` | Hecho |
| Variables de entorno documentadas | `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` (sección 23.7) | Hecho |

Reglas respetadas:
- Un contacto con `DO_NOT_CONTACT` o consentimiento `REVOKED` en el canal no recibe envíos.
- La conversión en oportunidad detiene los enrolamientos (`STOPPED_CONVERTED`).
- Cada envío crea `CrmSequenceSend` y una `CrmActivity` (`sequence:<sendId>` visible en el timeline).
- Si no hay canal de WhatsApp activo, el paso queda `SKIPPED` con motivo (no falla la corrida).

### 23.6 FASE 7 — Pipelines, pruebas y cierre (parcial)

| Entregable | Archivo | Estado |
| --- | --- | --- |
| Migración M9: `crm_pipelines` + `CrmOpportunity.pipelineId` + índice `(empresaId, pipelineId, stage)` | `prisma/migrations/20261113190000_crm_pipelines` | Hecho |
| APIs `GET/POST /api/crm/pipelines`, `PATCH/DELETE /[id]` (protege el pipeline por defecto y reasigna oportunidades) | `src/app/api/crm/pipelines/**` | Hecho |
| `GET /api/crm/teams` para destinos de reglas por equipo | `src/app/api/crm/teams/route.ts` | Hecho |
| Batería end-to-end `npm run test:crm-captacion` (dedupe, scoring, asignación, transiciones, opt-out, secuencias, timeline, alcance) | `scripts/test-crm-captacion.ts` | Hecho |
| Documentación actualizada | este documento + `CRM-MADUREZ-ROADMAP.md` + `CRM-FASE1-BACKLOG.md` | Hecho |
| Selector visual de pipeline en dashboard de oportunidades | `crm-dashboard-client.tsx` | **Pendiente** |

Desviaciones documentadas:
- Las etapas de cada pipeline se guardan en `CrmPipeline.stagesJson` porque `CrmOpportunityStage` sigue siendo un **enum** (`NEW…LOST`) y no admite claves arbitrarias. `CrmStageSetting` continúa siendo el embudo por defecto (compatibilidad total).
- El selector de pipeline en la UI quedó fuera de esta iteración para no reescribir el dashboard de 145 KB; la API y el modelo ya están listos.



### 23.7 Validación ejecutada y operación

Validaciones de código (2026-11-13):

- `npx prisma validate` → esquema válido; `npx prisma generate` → cliente regenerado.
- `npx tsc --noEmit --incremental false` → **0 errores**.
- `npx eslint` sobre libs, rutas y componentes nuevos → **0 errores y 0 warnings** en los archivos tocados.
- `npx prisma migrate deploy` → aplicadas las 8 migraciones pendientes (M1–M4 de FASE 2 + M6/M7, M8 y M9).
- `npm run test:crm-captacion` → **Todo OK** (39 verificaciones; la empresa temporal se elimina al final).

Migraciones nuevas de esta iteración:

| Migración | Contenido |
| --- | --- |
| `20261113165000_crm_activity_event_key` | `CrmActivity.eventKey` + `metadataJson` + único `(empresaId, eventKey)` |
| `20261113170000_crm_scoring_and_assignment` | Scoring (settings, reglas, eventos), reglas de asignación y consentimientos |
| `20261113180000_crm_sequences` | Secuencias, pasos, enrolamientos y envíos |
| `20261113190000_crm_pipelines` | Pipelines y `pipelineId` en oportunidades |

Acciones operativas (fuera de código, runbook en `DEPLOY-KAMATERA.md`):

1. Backfill de contactos canónicos: `npm run backfill:crm-contacts -- --dry-run` y luego sin `--dry-run` (idempotente). En producción: `docker compose -f docker-compose.prod.yml exec -T app npm run backfill:crm-contacts -- --dry-run`.
2. Programar el cron de secuencias: `GET /api/cron/crm-sequences?dryRun=0&limit=25` con `Authorization: Bearer $CRON_SECRET` cada 15 min. `CRON_SECRET` ya se inyecta al contenedor `app` desde `docker-compose.prod.yml`; sin él el endpoint solo atiende a un Super Admin autenticado.
3. Configurar `RESEND_API_KEY` y `EMAIL_FROM` para envíos de correo; sin ellos los pasos de correo quedan `FAILED` con el motivo del proveedor.
4. Definir reglas de asignación y umbrales de scoring por empresa en `/dashboard/crm/scoring` (y crear la secuencia activa en `/dashboard/crm/secuencias`).
5. Verificar el flujo con una captura real: llegar desde un formulario público y comprobar en `/dashboard/crm/leads` el puntaje, el responsable asignado y el historial.

Siguiente frente recomendado:

1. Selector visual de pipeline en el dashboard de oportunidades (API lista).
2. Tracking de clics/aperturas (`LINK_CLICK`, `EMAIL_OPEN`) con enlaces firmados y píxel.
3. Pruebas de regresión de rutas HTTP (matriz usuario × recurso) sobre el alcance por registro.


