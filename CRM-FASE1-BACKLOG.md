# CRM SGDigital - Fase 1 Backlog Tecnico

Fecha de referencia: 2026-05-05

Objetivo de la fase: convertir el frente comercial en una cola operativa real para captar, atender, asignar y mover prospectos sin fugas entre inbox, leads y pipeline.

## Estado base ya implementado

- Dedupe inicial en ingesta omnicanal para leads y conversaciones reutilizando documento, email y telefono con normalizacion basica.
- Autoasignacion basica para inbound nuevo con criterio inicial de sede y carga activa.
- Estado de atencion visible y editable desde la bandeja omnicanal reutilizando el status de conversacion.
- Reconciliacion automatica inicial de tareas de seguimiento por inactividad en captacion y pipeline, evitando duplicados basicos por relacion.
- Validacion tecnica completada con typecheck.

Esto deja una base operativa. La fase no esta cerrada: falta volverla gobernable, medible y consistente por reglas.

## Bloque 1. Omnicanal operativo

### Backend

- CRM-F1-BE-001: endurecer deduplicacion de inbound con heuristicas por nombre, ultimos digitos, hilo externo y ventana temporal.
- CRM-F1-BE-002: persistir trazabilidad de dedupe indicando por que lead o conversacion fue reutilizada.
- CRM-F1-BE-003: formalizar reglas de autoasignacion por sede, canal, origen, horario y carga maxima.
- CRM-F1-BE-004: separar estados operativos del inbox en transiciones permitidas y auditar cada cambio en actividades.
- CRM-F1-BE-005: crear endpoint de cola por asesor/equipo con filtros de SLA, prioridad, estado de atencion y canal.

### Frontend

- CRM-F1-FE-001: convertir la bandeja omnicanal en cola operacional con vistas Mis conversaciones, Equipo y Sin tomar.
- CRM-F1-FE-002: mostrar razon de prioridad y razon de SLA junto al estado de atencion.
- CRM-F1-FE-003: agregar acciones rapidas tomar, liberar, pasar a esperando cliente, marcar spam y resolver sin abrir tanto detalle.
- CRM-F1-FE-004: añadir indicadores de posible duplicado en la ficha de conversacion y en captacion.
- CRM-F1-FE-005: conectar el inbox con acceso directo a crear o abrir lead, oportunidad y tarea de seguimiento.

### Datos

- CRM-F1-DT-001: definir metricas de cola: tiempo a primera toma, tiempo a primera respuesta, conversaciones sin responsable y resolucion por asesor.
- CRM-F1-DT-002: agregar tablero base por asesor, sede y canal para medir carga y cumplimiento de SLA.
- CRM-F1-DT-003: registrar catalogo de estados operativos homologados y mapa de transiciones validas.

## Bloque 2. Captacion disciplinada

### Backend

- CRM-F1-BE-006: crear conversion controlada lead -> oportunidad evitando duplicados abiertos para el mismo prospecto.
- CRM-F1-BE-007: disparar tarea automatica cuando un lead nuevo no tenga contacto dentro de la ventana objetivo.
- CRM-F1-BE-008: disparar tarea automatica cuando un lead calificado no haya sido promovido a oportunidad en el tiempo esperado.

### Frontend

- CRM-F1-FE-006: reforzar la vista de Captacion con estados orientados a pre-calificacion y accion recomendada.
- CRM-F1-FE-007: mostrar si el lead ya tiene conversacion activa, oportunidad abierta o cliente convertido.
- CRM-F1-FE-008: añadir CTA explicita Promover a pipeline con contexto sugerido para titulo del deal, valor y proximo paso.

### Datos

- CRM-F1-DT-004: definir aging de leads por estado y dias sin movimiento.
- CRM-F1-DT-005: medir conversion desde captacion a oportunidad por origen, canal y asesor.

## Bloque 3. Seguimiento automatizado

### Backend

- CRM-F1-BE-009: generar tareas automáticas por inactividad de oportunidad y por conversaciones en esperando cliente fuera de SLA.
- CRM-F1-BE-010: crear reglas iniciales configurables para prioridad y asignacion por canal o sede.
- CRM-F1-BE-011: emitir notificaciones internas resumidas para cola personal del asesor y alertas del lider comercial.

### Frontend

- CRM-F1-FE-009: unificar Seguimiento con filtros por origen del trabajo: captacion, pipeline o inbox.
- CRM-F1-FE-010: mostrar nudges operativos en Frente comercial con CTA al item exacto que requiere accion.

### Datos

- CRM-F1-DT-006: medir tareas automaticas generadas, completadas y vencidas por bloque del embudo.
- CRM-F1-DT-007: medir recuperacion de leads y oportunidades gracias a automatizacion.

## Secuencia recomendada de ejecucion

1. Cerrar primero la cola omnicanal por asesor y equipo.
2. Endurecer luego la conversion de captacion a pipeline.
3. Encima de eso activar tareas y nudges automaticos.

## Criterio de salida de Fase 1

- Ningun inbound nuevo queda sin responsable ni sin estado visible.
- Captacion no compite con pipeline y cada vista muestra solo lo suyo.
- El equipo comercial opera su trabajo diario desde Frente comercial e Inbox omnicanal sin depender de seguimiento manual disperso.