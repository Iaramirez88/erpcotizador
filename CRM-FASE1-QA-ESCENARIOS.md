# CRM Fase 1 - Escenarios ficticios de validación

Objetivo: ejecutar casos end-to-end cuando Fase 1 quede cerrada para detectar errores operativos reales en captación, inbox omnicanal, pipeline y seguimiento.

## Cómo usar este documento

- Correr los escenarios en un ambiente de prueba con datos ficticios.
- No validar solo respuesta técnica; validar también narrativa operativa y fricción comercial.
- Registrar por escenario:
  - resultado esperado
  - resultado real
  - error detectado
  - si el error es de lógica, UI, permisos, automatización o trazabilidad

---

## Escenario 1. Formulario web nuevo sin asesor previo

**Caso ficticio:**

- Canal: Formulario web
- Nombre: Laura Méndez
- Empresa: Eventos Brisa SAS
- Email: laura@brisa.test
- Teléfono: 3001112233
- Ciudad: Bogotá
- Mensaje: Necesito 200 agendas corporativas con logo para entrega este mes.

**Debe validar:**

- creación de lead
- creación o reutilización de conversación
- autoasignación a asesor elegible
- prioridad visible en inbox
- SLA visible
- posibilidad de tomar o reasignar la conversación

**Errores a buscar:**

- lead creado sin responsable
- conversación sin relación a lead
- autoasignación a usuario sin acceso CRM
- filtros del inbox no muestran el caso donde corresponde

---

## Escenario 2. Duplicado potencial por teléfono

**Caso ficticio:**

- Ya existe lead: Carlos Ruiz, teléfono 573001112233
- Nuevo inbound: Carlos R., teléfono 3001112233, mismo interés comercial

**Debe validar:**

- deduplicación inicial en captación
- reutilización del lead correcto
- continuidad de conversación o vínculo coherente
- no creación de doble lead exacto

**Errores a buscar:**

- duplicado silencioso
- lead correcto pero conversación nueva sin trazabilidad
- datos sobrescritos incorrectamente

---

## Escenario 3. Chatbot con handoff humano

**Caso ficticio:**

- Canal: Chatbot web
- Nombre: Andrés Molina
- Empresa: Comercializadora Nova
- Mensaje inicial: Quiero saber precio y stock de cajas plegadizas.
- El bot recoge contexto y deja el caso en BOT_ACTIVE.

**Debe validar:**

- conversación visible con estado de bot
- prioridad y SLA correctos
- foco operativo para handoff bot a humano
- toma manual del hilo por un asesor
- cambio de estado a atención humana

**Errores a buscar:**

- handoff sin contexto
- hilo en bot pero perdido en la cola
- transición manual rompe SLA o asignación

---

## Escenario 4. Conversación sin tomar que vence SLA

**Caso ficticio:**

- Inbound nuevo sin responsable
- pasan suficientes minutos para caer en riesgo y luego vencerse

**Debe validar:**

- orden de prioridad en cola
- foco de atención inmediata
- visibilidad en cola sin tomar
- acción Tomar conversación

**Errores a buscar:**

- conversación vieja enterrada abajo en la lista
- SLA visual pero sin impacto en orden
- acción Tomar no actualiza vista o detalle

---

## Escenario 5. Lead promovido a pipeline

**Caso ficticio:**

- Lead: Mariana Pardo
- Interés: 500 cajas impresas para campaña nacional
- Desde edición del lead se promueve a pipeline

**Debe validar:**

- señales de duplicado antes de promover
- creación de oportunidad con stage/probability/expectedValue sugeridos
- relación lead -> oportunidad visible
- posibilidad de abrir cotizador desde el flujo CRM

**Errores a buscar:**

- promoción crea oportunidad huérfana
- sugerencias no llegan al pipeline
- lead queda editable pero sin coherencia con la oportunidad creada

---

## Escenario 6. Oportunidad sin actividad reciente

**Caso ficticio:**

- Oportunidad: Renovación catálogo temporada escolar
- Se deja sin movimiento más de lo permitido

**Debe validar:**

- creación automática de tarea de seguimiento
- asignación al responsable actual
- historial de tarea creado
- cola o dashboard refleja necesidad de acción

**Errores a buscar:**

- tarea duplicada por cada refresco
- tarea creada sin responsable
- tarea no se cierra al sacar la oportunidad de condición automática

---

## Escenario 7. Lead que sale de captación

**Caso ficticio:**

- Lead con tarea automática por inactividad
- luego pasa a CONVERTED o LOST

**Debe validar:**

- cierre de tarea automática abierta
- historial de cambio
- no quedan tareas operativas huérfanas

**Errores a buscar:**

- tarea sigue abierta aunque el lead ya no requiere seguimiento
- cierres inconsistentes entre lead y task

---

## Escenario 8. Interés comercial con stock

**Caso ficticio:**

- Conversación activa con cliente preguntando por material o producto
- Se busca stock y se consigna interés desde el inbox

**Debe validar:**

- búsqueda de producto
- visualización de stock/precio de referencia
- registro de actividad comercial en lead/oportunidad/cliente correcto

**Errores a buscar:**

- actividad se guarda en entidad incorrecta
- datos de producto no quedan trazables
- inbox pierde contexto al guardar

---

## Escenario 9. Reasignación manual a otro asesor

**Caso ficticio:**

- Conversación asignada a asesor A
- líder comercial la reasigna a asesor B

**Debe validar:**

- bloqueo si asesor B no tiene acceso CRM suficiente
- cambio de responsable y estado registrados
- conversación aparece en Mis conversaciones del nuevo asesor

**Errores a buscar:**

- reasignación a usuario inválido
- detalle actualizado pero cola no
- actividad no deja rastro de la reasignación

---

## Escenario 10. Cierre completo del hilo

**Caso ficticio:**

- Conversación atendida, cotizada o descartada
- el asesor la resuelve

**Debe validar:**

- estado final correcto
- unreadCount reseteado si aplica
- SLA pausado
- no reaparece mal posicionada en la cola activa

**Errores a buscar:**

- conversación resuelta sigue contando como activa
- cierre rompe el detalle o la navegación
- reapertura posterior no conserva trazabilidad

---

## Criterio de salida de QA Fase 1

- Los 10 escenarios pueden ejecutarse sin datos manuales extra fuera del flujo normal del CRM.
- No aparecen leads, conversaciones, oportunidades o tareas huérfanas.
- La cola omnicanal muestra correctamente qué atender primero.
- La promoción de captación a pipeline mantiene continuidad.
- Las automatizaciones de seguimiento no duplican ni dejan tareas abiertas por error.