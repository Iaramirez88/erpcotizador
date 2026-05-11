# CRM SGDigital - Backlog Tecnico de Integraciones Comerciales

Fecha de referencia: 2026-05-05

Objetivo del bloque: conectar el CRM con herramientas externas de alta demanda comercial sin romper el ownership del dato ni dispersar la operación fuera del sistema.

## Principios del bloque

- El CRM sigue siendo la fuente de verdad comercial.
- Las integraciones deben alimentar captación, inbox, seguimiento, coordinación o cierre.
- Primero se priorizan integraciones de adopción rápida y alto impacto operativo.
- Cada integración debe tener owner técnico, fallback operativo, trazabilidad y criterios de salida medibles.

## Estado base ya disponible

- Centro de integraciones y captura ya operativo en CRM.
- Ingesta unificada inbound hacia leads, conversaciones y actividades CRM.
- Base documental y puente operativo inicial para Gmail y Outlook.
- Inbox CRM ya suficientemente maduro para absorber más canales y eventos internos.
- Soporte de payment link en el ecosistema del producto, reutilizable para cierre comercial.
- Chatbot, captación y handoff ya tienen base suficiente para explotar integraciones sin recrear subsistemas.

Esto deja una base útil. El bloque no está cerrado: falta convertir las integraciones en capacidades oficialmente soportadas, medibles y desplegables por cliente o sede.

## Bloque 1. Google Sheets

### Backend

- CRM-INT-GS-BE-001: crear contrato de conexión para Google Sheets con credenciales, hoja origen, pestaña y modo de sincronización.
- CRM-INT-GS-BE-002: implementar importador de leads y oportunidades desde Sheets con validación de columnas obligatorias.
- CRM-INT-GS-BE-003: reutilizar deduplicación CRM en la importación para evitar crear leads y conversaciones paralelas.
- CRM-INT-GS-BE-004: implementar exportación de pipeline, captación o inbox a una hoja destino con formato estable.
- CRM-INT-GS-BE-005: registrar auditoría por corrida: filas leídas, creadas, actualizadas, rechazadas y motivo.

### Frontend

- CRM-INT-GS-FE-001: crear wizard de conexión de Google Sheets en el centro de integraciones.
- CRM-INT-GS-FE-002: permitir mapear columnas de hoja a campos CRM reutilizando campos estándar de lead, conversación y oportunidad.
- CRM-INT-GS-FE-003: mostrar previsualización antes de importar y reporte posterior de resultados.
- CRM-INT-GS-FE-004: permitir lanzar exportación manual de captación, pipeline o inbox con plantilla SGDigital.

### Datos y operación

- CRM-INT-GS-DT-001: definir plantilla oficial de columnas para leads, oportunidades y seguimiento comercial.
- CRM-INT-GS-DT-002: medir cantidad de filas importadas, porcentaje deduplicado y tasa de error por integración.
- CRM-INT-GS-DT-003: definir política de frecuencia inicial: manual, programada o bajo demanda por cliente.

## Bloque 2. Gmail y Outlook

### Backend

- CRM-INT-EM-BE-001: formalizar bridges de Gmail y Outlook como integraciones soportadas dentro del catálogo CRM.
- CRM-INT-EM-BE-002: endurecer normalización de remitente, hilo y asunto para deduplicar conversación de correo.
- CRM-INT-EM-BE-003: estandarizar asignación, prioridad y SLA inicial para correos de prospectos.
- CRM-INT-EM-BE-004: registrar direction, bridgeKind, threadId y trazabilidad de handoff en mensajes CRM de correo.

### Frontend

- CRM-INT-EM-FE-001: exponer onboarding guiado para Gmail Apps Script y Outlook Power Automate desde el centro de integraciones.
- CRM-INT-EM-FE-002: mostrar claramente origen correo, hilo y última sincronización dentro del inbox CRM.
- CRM-INT-EM-FE-003: permitir responder o continuar gestión de correo desde la misma vista operacional del inbox.

### Datos y operación

- CRM-INT-EM-DT-001: medir tiempo a primera respuesta por correo y porcentaje de correos sin responsable.
- CRM-INT-EM-DT-002: definir playbook de fallback cuando la automatización externa falle o se atrase.

## Bloque 3. Agenda embebida web por iframe/API

### Backend

- CRM-INT-BKG-BE-001: crear contrato de integración para agenda embebida en sitio web mediante iframe o widget externo con identificador de sede, canal y origen.
- CRM-INT-BKG-BE-002: exponer endpoint/API para consumir citas agendadas desde el iframe y convertirlas en lead, actividad y cita comercial trazable dentro del CRM.
- CRM-INT-BKG-BE-003: validar payload, deduplicar por correo, teléfono y franja horaria para evitar citas duplicadas o prospectos paralelos.
- CRM-INT-BKG-BE-004: persistir datos mínimos de la cita: fecha, hora, servicio, origen web, página, responsable, estado y metadatos de captación.
- CRM-INT-BKG-BE-005: disparar flujo opcional de notificación al usuario por WhatsApp y/o correo al crear, reprogramar o cancelar la cita.
- CRM-INT-BKG-BE-006: registrar auditoría por evento de agenda: recibido, aceptado, rechazado, notificado, fallido y motivo.

### Frontend

- CRM-INT-BKG-FE-001: crear configuración de integración de agenda web dentro del centro de integraciones con parámetros de iframe, sitio, sede y asignación.
- CRM-INT-BKG-FE-002: permitir definir qué campos captura el formulario embebido y cómo se mapean a lead, contacto, oportunidad y cita CRM.
- CRM-INT-BKG-FE-003: exponer opciones por evento para habilitar notificación al usuario por WhatsApp, correo o ambos.
- CRM-INT-BKG-FE-004: mostrar historial de citas recibidas desde la web, estado de consumo API y estado de notificaciones enviadas.

### Datos y operación

- CRM-INT-BKG-DT-001: definir payload oficial para citas web y plantilla mínima de campos obligatorios para el iframe.
- CRM-INT-BKG-DT-002: medir citas recibidas, aceptadas, deduplicadas, reprogramadas, canceladas y notificadas por canal.
- CRM-INT-BKG-DT-003: definir fallback operativo cuando falle el consumo API o cuando no se pueda enviar WhatsApp o correo.

## Bloque 4. Slack y Teams

### Backend

- CRM-INT-NT-BE-001: crear proveedor de notificaciones salientes para Slack y Teams reutilizando eventos CRM existentes.
- CRM-INT-NT-BE-002: emitir alertas por asignación de conversación, lead calificado, oportunidad estancada y handoff bot -> humano.
- CRM-INT-NT-BE-003: permitir destinos por usuario, canal, sede o equipo comercial.

### Frontend

- CRM-INT-NT-FE-001: crear configuración de destinos y eventos dentro del centro de integraciones.
- CRM-INT-NT-FE-002: permitir probar una notificación y validar formato antes de activar.

### Datos y operación

- CRM-INT-NT-DT-001: medir eventos emitidos, entregados y fallidos por integración.
- CRM-INT-NT-DT-002: definir mensajes estándar de alta prioridad para no saturar los canales internos.

## Bloque 5. Google Calendar y Microsoft 365 Calendar

### Backend

- CRM-INT-CAL-BE-001: crear contrato de calendario para agendar citas desde lead, conversación u oportunidad.
- CRM-INT-CAL-BE-002: sincronizar fecha, responsable y estado de reunión con tareas/actividades CRM.
- CRM-INT-CAL-BE-003: registrar no-show, reprogramación o reunión completada como actividad comercial trazable.

### Frontend

- CRM-INT-CAL-FE-001: agregar CTA para agendar reunión desde lead, oportunidad e inbox.
- CRM-INT-CAL-FE-002: mostrar próxima reunión y estado dentro de la ficha comercial.

### Datos y operación

- CRM-INT-CAL-DT-001: medir reuniones creadas, completadas, reprogramadas y no-show.
- CRM-INT-CAL-DT-002: definir plantillas mínimas de tipo de reunión y duración por flujo comercial.

## Bloque 6. Meta Lead Ads y formularios externos

### Backend

- CRM-INT-CAP-BE-001: conectar Meta Lead Ads al flujo unificado de captación CRM.
- CRM-INT-CAP-BE-002: crear conector genérico para formularios externos vía webhook o payload firmado.
- CRM-INT-CAP-BE-003: reutilizar deduplicación, autoasignación y tareas iniciales sobre estos orígenes.
- CRM-INT-CAP-BE-004: persistir campaña, formulario, anuncio y contexto mínimo de captación.

### Frontend

- CRM-INT-CAP-FE-001: exponer plantillas oficiales de integración para Lead Ads y formularios externos.
- CRM-INT-CAP-FE-002: mostrar readiness, errores recientes y última captura por conector.

### Datos y operación

- CRM-INT-CAP-DT-001: medir captación por origen, campaña, tasa de deduplicación y promoción a pipeline.
- CRM-INT-CAP-DT-002: definir checklist QA para validar que un lead pago cae con owner y seguimiento correctos.

## Bloque 7. Drive y OneDrive

### Backend

- CRM-INT-DOC-BE-001: crear contrato de archivos enlazados por lead, conversación y oportunidad.
- CRM-INT-DOC-BE-002: persistir metadatos mínimos del archivo compartido: origen, URL, nombre, tipo y contexto comercial.
- CRM-INT-DOC-BE-003: permitir compartir catálogos, propuestas o soportes desde contexto CRM.

### Frontend

- CRM-INT-DOC-FE-001: agregar selector o vínculo de documento externo dentro de la ficha comercial.
- CRM-INT-DOC-FE-002: mostrar historial de archivos compartidos por prospecto u oportunidad.

### Datos y operación

- CRM-INT-DOC-DT-001: medir cantidad de archivos enlazados por flujo comercial y uso por asesor.

## Bloque 8. Payment links y pasarela de pago

### Backend

- CRM-INT-PAY-BE-001: conectar opportunity o conversation con generación de payment link reutilizando la base ya existente del producto.
- CRM-INT-PAY-BE-002: persistir estado mínimo del cobro comercial: enviado, abierto, pagado, vencido o fallido.
- CRM-INT-PAY-BE-003: registrar actividad y evento comercial cuando el prospecto avanza o no avanza en el pago.

### Frontend

- CRM-INT-PAY-FE-001: añadir CTA para generar y copiar payment link desde oportunidad o conversación.
- CRM-INT-PAY-FE-002: mostrar estado del pago dentro del contexto comercial sin sacar al asesor del CRM.

### Datos y operación

- CRM-INT-PAY-DT-001: medir payment links creados, abiertos, pagados y no convertidos.
- CRM-INT-PAY-DT-002: definir política de uso inicial: anticipos, reservas, servicios o cierres rápidos.

## Secuencia recomendada de ejecución

1. Google Sheets.
2. Gmail y Outlook.
3. Agenda embebida web por iframe/API.
4. Slack y Teams.
5. Google Calendar y Microsoft 365 Calendar.
6. Meta Lead Ads y formularios externos.
7. Drive y OneDrive.
8. Payment links y pasarela.

## Secuencia recomendada dentro del primer slice

1. Arrancar por Google Sheets con importación manual, mapping y auditoría.
2. Encima de eso formalizar Gmail y Outlook dentro del catálogo soportado del CRM.
3. Después habilitar agenda embebida web por iframe/API con consumo de citas y notificación al usuario por WhatsApp/correo.
4. Luego activar notificaciones Slack/Teams para acelerar la operación interna.

## Criterio de salida del bloque

- Existen al menos tres integraciones comerciales de alta demanda con onboarding repetible.
- Cada integración tiene trazabilidad, owner técnico y fallback operativo claro.
- El CRM absorbe más trabajo comercial real sin perder ownership del dato.
- Al cerrar el bloque se continúa con Fase 2 del roadmap de madurez.