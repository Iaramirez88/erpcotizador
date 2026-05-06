# CRM SGDigital - Madurez actual y roadmap operativo

**Fecha de referencia:** 2026-05-05
**Objetivo:** mapear con claridad lo que el CRM ya resuelve, qué está parcial y qué falta para convertirlo en un sistema que empuja ventas y no solo registra actividad.

Backlog técnico ejecutable de Fase 1: ver CRM-FASE1-BACKLOG.md.
Backlog técnico ejecutable del bloque puente de integraciones: ver CRM-INTEGRACIONES-BACKLOG.md.

---

## 1. Lectura de madurez actual

Hoy el CRM está en un nivel **intermedio-alto de construcción funcional**.

No está en etapa de CRUD básico. Ya existe una base real de operación comercial con:

- leads
- oportunidades
- tareas y actividades
- conversaciones omnicanal
- integraciones y captura
- dashboard comercial
- chatbot studio
- archivos y espacios de trabajo
- integración conceptual con ERP

La conclusión operativa es esta:

- **La base tecnológica está bien.**
- **La base funcional ya es amplia.**
- **El siguiente salto no es agregar más módulos sueltos.**
- **El siguiente salto es cerrar el loop comercial completo con disciplina, automatización y dirección ejecutiva.**

---

## 2. Estado actual por capacidad

### Leyenda

- **Hecho:** existe en producto y ya aporta valor operativo.
- **Parcial:** existe una parte importante, pero todavía no cierra el flujo completo.
- **Pendiente:** no está implementado o no está resuelto a nivel competitivo.

| Capacidad | Estado | Observación operativa |
| --- | --- | --- |
| Dashboard CRM | Parcial | Ya existe resumen comercial y se añadieron prioridades del día, pero falta capa ejecutiva de forecast, aging y rendimiento por asesor/canal/sede. |
| Leads | Hecho | Existe gestión de leads y seguimiento base. |
| Oportunidades | Parcial | Ya hay pipeline/listado y visibilidad reciente de score/riesgo en UI, pero falta persistencia y gobierno comercial más fuerte. |
| Tareas y actividades | Hecho | El CRM ya soporta trabajo comercial operativo sobre seguimiento. |
| Cola de seguimiento comercial | Parcial | Ya existe una cola visible para leads sin contacto, pero todavía no es una bandeja operacional completa por asesor/equipo. |
| Inbox omnicanal | Parcial | Ya existe bandeja de conversaciones con cola por equipo/mías/sin tomar, focos operativos, vista por asesor, estados de atención y SLA/prioridad visibles; la autoasignación básica ya respeta acceso CRM y sede, además prioriza continuidad por canal y actividad reciente, y el cierre/reapertura operativa del inbox ya quedó más homogéneo. Lo pendiente real es endurecer reglas de reparto y la noción de equipo. |
| SLA comercial | Parcial | Hoy es visible en UI para conversaciones, pero aún no está cerrado como motor de gestión y automatización. |
| Prioridad de atención | Parcial | Visible en conversaciones y señales de riesgo en oportunidades, pero todavía no forma parte de reglas y colas automáticas. |
| Integraciones y captura de leads | Hecho | Ya existe centro de integraciones/captura con readiness y studio de assets. |
| Chatbot / bot flows | Parcial | Existe chatbot studio y operación visual, pero falta handoff y automatización comercial profunda. |
| Timeline comercial | Hecho | La arquitectura y la operación CRM ya contemplan actividades y trazabilidad básica. |
| Integración lead -> cliente ERP | Parcial | Está contemplada en arquitectura CRM; se debe seguir validando y endureciendo el flujo de conversión en la operación real. |
| Integración oportunidad -> cotización ERP | Parcial | Está prevista en la arquitectura y es clave para diferenciación; debe consolidarse como flujo central. |
| Reportería comercial ejecutiva | Pendiente | Falta forecast, aging, win/loss reasons, performance por canal, asesor y sede. |
| Objetivos por asesor/equipo | Pendiente | No hay todavía una capa visible de meta, avance y cumplimiento comercial. |
| Automatizaciones no-code | Pendiente | No hay aún reglas comerciales configurables que orquesten seguimiento. |
| Secuencias comerciales | Pendiente | No existe motor de cadencias/secuencias para seguimiento automático. |
| Handoff bot -> humano | Pendiente | Falta cerrar el relevo operativo entre automatización y asesor. |
| Playbooks comerciales | Pendiente | No hay guía operativa por tipo de cliente, canal o etapa. |
| Recomendaciones por historial | Pendiente | Aún no existe capa de inteligencia aplicada sobre comportamiento previo. |
| Visibilidad completa lead -> orden/factura | Parcial | La dirección arquitectónica existe, pero todavía falta consolidarla como experiencia integral competitiva. |

---

## 3. Lo que ya existe y conviene proteger

Estas piezas ya representan ventaja interna y no deberían diluirse con más pantallas aisladas:

- base CRM integrada al ERP sin duplicar entidades core
- multiempresa, multisede y RBAC consistente
- leads, oportunidades, tareas, actividades y conversaciones como núcleo funcional
- dashboard comercial ya con prioridades visibles
- score/riesgo visible en oportunidades
- SLA y prioridad visibles en conversaciones omnicanal
- autoasignación inbound inicial filtrada por acceso CRM y sede
- ranking básico de reparto con continuidad por canal, actividad reciente y carga activa
- transición homogénea de estados de atención en inbox, incluyendo reaperturas inbound, espera de respuesta del cliente tras salida humana y reapertura coherente al crear oportunidad desde conversación
- lectura operativa por asesor usando responsables CRM elegibles y métricas básicas de carga
- cola inicial de seguimiento comercial para leads sin contacto
- follow-up automático inicial por evento para captación y pipeline usando tareas CRM existentes
- centro de integraciones y captura más chatbot studio

En términos de producto, esto significa que **la siguiente inversión debe priorizar orquestación comercial y visibilidad ejecutiva**, no expansión horizontal de módulos.

---

## 4. Roadmap recomendado

## Fase 1. Consolidación competitiva

**Objetivo:** que el CRM opere como centro real de atención y seguimiento comercial.

### Alcance

- inbox omnicanal unificado
- SLA operativo real
- deduplicación de leads/contactos/conversaciones
- asignación automática
- colas por asesor y por equipo
- follow-up tasks automáticas
- estado de atención visible y accionable

### Estado hoy

- **Parcialmente cubierto:**
  - bandeja de conversaciones
  - prioridad visible
  - SLA visible
  - cola inicial de seguimiento
  - autoasignación básica con elegibilidad por acceso CRM y sede
  - ranking inicial por actividad reciente, continuidad de canal y carga
  - recortes operativos del inbox para atención inmediata, nuevas sin tomar, bot a humano y espera de cliente
  - vista rápida por asesor con métricas básicas de conversaciones activas, urgentes y en espera
  - estados operativos del inbox ya más homogéneos en resolver, responder, reabrir por inbound y promover a oportunidad
  - follow-ups automáticos iniciales por inactividad en captación y pipeline
- **Falta para cerrar la fase:**
  - heurísticas más robustas de deduplicación
  - autoasignación por reglas más completas de canal, horario y carga
  - bandeja por equipo real y no solo lectura operativa por asesor

### Entregables sugeridos

- bandeja unificada con filtros por asesor, sede, canal y SLA
- reglas de autoasignación por canal, origen, sede, horario o carga
- deduplicación por documento, email, teléfono y heurísticas de coincidencia
- estado de atención estandarizado: nuevo, en gestión, esperando cliente, resuelto, sin respuesta
- generación automática de tarea cuando una conversación queda sin respuesta o una oportunidad no tiene actividad reciente, con cierre/actualización coherente al cambiar el estado comercial

### Criterio de salida

- ningún lead/conversación nueva queda sin responsable
- toda conversación tiene SLA y estado visible
- el equipo puede operar su cola diaria sin salir del CRM
- al cerrar la fase se ejecuta una batería de escenarios ficticios end-to-end para captación, inbox, pipeline y seguimiento, con registro explícito de fallos operativos

---

## Bloque puente antes de Fase 2. Integraciones comerciales de adopción

**Objetivo:** ampliar el valor comercial del CRM con integraciones de alta demanda y bajo tiempo de adopción, sin desordenar el núcleo operativo ya construido.

### Principio rector

- estas integraciones deben **alimentar o acelerar el CRM**, no reemplazarlo como fuente de verdad
- primero se priorizan integraciones que mejoran captación, inbox, coordinación interna y cierre
- después se retoma **Fase 2** con una base comercial más conectada al día a día real del mercado

### Orden recomendado

1. Google Sheets
2. Gmail / Outlook
3. Slack / Teams
4. Google Calendar / Microsoft 365 Calendar
5. Meta Lead Ads + formularios externos
6. Drive / OneDrive
7. pasarela de pago o link de pago

### Estado hoy

- **Base parcial disponible:**
  - ya existe centro de integraciones y captura
  - ya existe capture flow unificado hacia CRM
  - Gmail y Outlook ya tienen base documental y puente operativo inicial vía bridge
  - el inbox CRM ya tiene una base suficientemente seria para absorber más canales
  - ya existe soporte de payment link en el ecosistema del producto, útil como base para cierre comercial
- **Falta para cerrar este bloque:**
  - catálogo claro de integraciones comerciales soportadas oficialmente
  - onboarding y credenciales por integración desde experiencia CRM consistente
  - reglas de ownership, trazabilidad y fallback por integración
  - reporting básico por origen integrado
  - playbooks operativos mínimos para soporte comercial y handoff

### Roadmap por integración

#### 1. Google Sheets

**Motivo:** bajo costo, alta demanda, útil para importación, exportación, seguimiento liviano y reporting comercial rápido.

**Alcance sugerido:**

- importador de leads/oportunidades desde hoja
- exportación programable de pipeline, inbox o captación
- sincronización simple por pestaña para equipos que aún operan campañas en Sheets
- plantilla estándar SGDigital para seguimiento comercial

**Criterio de salida:**

- un equipo comercial puede subir leads desde Sheets y exportar pipeline sin romper la trazabilidad del CRM

#### 2. Gmail / Outlook

**Motivo:** convertir el CRM en inbox omnicanal real para equipos que venden por correo.

**Alcance sugerido:**

- consolidar bridges existentes como integración oficialmente soportada
- recepción de correos al inbox CRM con deduplicación/contacto/conversación
- respuesta o continuidad comercial con contexto desde CRM
- reglas mínimas de asignación y SLA para correo

**Criterio de salida:**

- el correo de prospectos entra al inbox CRM y se opera con responsable, estado y seguimiento visibles

#### 3. Slack / Teams

**Motivo:** acelerar coordinación interna, handoff y atención de oportunidades calientes.

**Alcance sugerido:**

- notificaciones de asignación de conversación
- alertas de lead calificado, oportunidad estancada o handoff bot -> humano
- resumen diario o digest para líderes comerciales

**Criterio de salida:**

- los eventos críticos del CRM llegan al canal interno correcto sin depender de revisar manualmente el dashboard

#### 4. Google Calendar / Microsoft 365 Calendar

**Motivo:** convertir leads en reuniones concretas y no dejar el seguimiento sólo en tarea interna.

**Alcance sugerido:**

- creación de cita desde lead, conversación u oportunidad
- sincronización de fecha/hora y responsable
- recordatorios y reprogramación básica
- trazabilidad de reunión completada o no-show dentro del CRM

**Criterio de salida:**

- una cita comercial creada desde CRM queda visible para asesor y prospecto con seguimiento trazable

#### 5. Meta Lead Ads + formularios externos

**Motivo:** fortalecer captación con origen más directo y escalable.

**Alcance sugerido:**

- ingestión de leads desde Meta Lead Ads
- conectores o webhooks genéricos para formularios externos
- deduplicación y promoción automática a seguimiento comercial
- visibilidad por origen, campaña y canal

**Criterio de salida:**

- la captación paga o externa cae al CRM con ownership, origen y reglas de seguimiento coherentes

#### 6. Drive / OneDrive

**Motivo:** soporte comercial y documental para propuestas, catálogos y archivos compartidos.

**Alcance sugerido:**

- adjuntar enlaces o documentos al lead, conversación y oportunidad
- compartir catálogos, propuestas y soportes desde CRM
- mantener relación clara entre archivo comercial y contexto del prospecto

**Criterio de salida:**

- el equipo comercial puede compartir y consultar material sin salir del flujo CRM ni perder contexto

#### 7. Pasarela de pago o payment link

**Motivo:** acercar el CRM al cierre comercial, especialmente en servicios, reservas o anticipos.

**Alcance sugerido:**

- generar payment links desde oportunidad o conversación
- registrar estado básico del pago en CRM
- dejar trazabilidad para cierre comercial y seguimiento postpago

**Criterio de salida:**

- un asesor puede enviar un link de pago desde contexto comercial y ver si el prospecto avanzó o no

### Criterio de salida del bloque puente

- el CRM ya no depende sólo de captura nativa y operación manual interna
- al menos tres integraciones de alta demanda ya están estables en producción o listas para despliegue repetible
- existe una base clara para retomar Fase 2 con mejor volumen, mejor trazabilidad y menos trabajo fuera del sistema

---

## Fase 2. Revenue engine

**Objetivo:** convertir el CRM en tablero de dirección comercial y no solo en repositorio operativo.

### Alcance

- forecast
- aging de oportunidades
- win/loss reasons
- score de oportunidad persistente
- objetivos por asesor
- reportes por canal
- rendimiento por sede

### Estado hoy

- **Base parcial disponible:**
  - dashboard CRM
  - oportunidades con score/riesgo visible en UI
- **Falta para cerrar la fase:**
  - métricas ejecutivas persistentes
  - score gobernado por reglas
  - razones de pérdida/ganancia normalizadas
  - metas por asesor y comparación real vs objetivo
  - vistas gerenciales por sede, canal y equipo

### Entregables sugeridos

- forecast por mes, asesor, sede y pipeline
- aging buckets por etapa y por tiempo sin movimiento
- taxonomía de win/loss reasons
- score persistente con factores transparentes
- dashboard de cumplimiento por asesor/equipo
- ranking de conversión por canal y sede

### Criterio de salida

- dirección comercial puede detectar fuga de pipeline, cuellos de botella y asesores subatendidos sin exportar datos fuera del sistema

---

## Fase 3. Automatización comercial

**Objetivo:** reducir dependencia de disciplina manual y empujar seguimiento consistente.

### Alcance

- reglas no-code
- secuencias
- handoff bot-humano
- disparos por etapa
- nudges de seguimiento

### Estado hoy

- **Base parcial disponible:**
  - chatbot studio
  - captura e integraciones
  - tareas/actividades/conversaciones
- **Falta para cerrar la fase:**
  - motor de reglas
  - secuencias reutilizables
  - handoff con contexto completo
  - automatización por cambio de etapa o inactividad
  - alertas/nudges orientados a revenue

### Entregables sugeridos

- constructor de reglas: si pasa X, ejecutar Y
- secuencias por tipo de lead, canal o producto
- handoff bot -> asesor con contexto, resumen y prioridad
- disparos por cambio de etapa, tiempo sin respuesta o score de riesgo
- nudges diarios para asesores y líderes

### Criterio de salida

- el CRM genera trabajo accionable de forma automática y reduce pérdidas por olvido o seguimiento tardío

---

## Fase 4. Diferenciación

**Objetivo:** conectar ventas, operación y contexto histórico para crear una ventaja difícil de copiar.

### Alcance

- cotización inteligente desde oportunidad
- recomendaciones por historial
- playbooks por tipo de cliente
- visibilidad total desde lead hasta orden/factura

### Estado hoy

- **Base parcial disponible:**
  - arquitectura CRM integrada al ERP
  - dirección funcional hacia lead -> cliente -> cotización -> orden
- **Falta para cerrar la fase:**
  - experiencia completa y visible de punta a punta
  - recomendación comercial contextual
  - playbooks operativos
  - trazabilidad comercial-financiera unificada

### Entregables sugeridos

- crear cotización desde oportunidad con contexto precargado
- sugerencias por historial de compras, canal y comportamiento previo
- playbooks por vertical, tipo de cliente o tamaño de negocio
- ficha 360 con lead, conversaciones, oportunidad, cotización, orden, factura y recaudo

### Criterio de salida

- el CRM deja de parecer un módulo separado y se convierte en el centro comercial del ERP

---

## 5. Prioridad sugerida de ejecución

1. Cerrar Fase 1 antes de abrir nuevos módulos comerciales.
2. Ejecutar el bloque puente de integraciones comerciales de adopción inmediatamente después de Fase 1.
3. Priorizar primero integraciones que mejoran captación, inbox, coordinación y cierre: Sheets, correo, Slack/Teams, calendario.
4. Retomar Fase 2 cuando el CRM ya concentre mejor el trabajo real del equipo y no dependa tanto de herramientas externas.
3. Construir Fase 3 sobre reglas simples primero, no sobre automatización excesiva.
4. Usar Fase 4 como diferenciación comercial real frente a CRM genéricos.

---

## 6. Backlog operativo inmediato

### Próximo bloque recomendado

- [x] consolidar inbox omnicanal en una sola cola operativa
- [x] definir y persistir estado de atención
- [x] implementar autoasignación básica por reglas
- [x] crear deduplicación inicial para leads y conversaciones
- [ ] cerrar bandeja por equipo real sobre la cola ya operativa por asesor
- [x] crear follow-up automático inicial por eventos en leads y oportunidades
- [ ] crear forecast básico y aging de oportunidades
- [ ] normalizar win/loss reasons
- [ ] persistir score comercial de oportunidad

### Bloque siguiente

- [ ] objetivos por asesor y tablero de cumplimiento
- [ ] reportes por canal, sede y asesor
- [ ] reglas no-code iniciales
- [ ] secuencias de seguimiento
- [ ] handoff bot-humano con contexto

### Bloque de diferenciación

- [ ] cotización iniciada desde oportunidad
- [ ] playbooks comerciales
- [ ] recomendaciones por historial
- [ ] vista 360 lead -> orden/factura

---

## 7. Criterio para actualizar este archivo

Actualizar este documento cada vez que ocurra uno de estos hitos:

- una capacidad pase de Pendiente a Parcial
- una capacidad pase de Parcial a Hecho
- se cierre una fase con criterios de salida verificables
- se abra una línea nueva que afecte revenue, automatización o integración CRM-ERP

La intención no es usar este archivo como lista infinita de ideas, sino como **mapa de madurez comercial del CRM**.
