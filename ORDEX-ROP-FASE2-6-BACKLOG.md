# ORDEX ROP - Fase 2 a Fase 6 Backlog Técnico

Fecha de referencia: 2026-08-20

Objetivo: desglosar las fases posteriores de ORDEX ROP para que la construcción pueda avanzar por slices claros después de cerrar Fase 0 y Fase 1.

## Fase 2. Clusters y matching inicial

### Objetivo

Pasar de directorio operativo a discovery accionable con ranking, explicabilidad y primeros read models.

### Backend

- ROP-F2-BE-001: crear tablas `rop_clusters` y `rop_cluster_memberships`.
- ROP-F2-BE-002: implementar asignación inicial a cluster basada en nicho, ciudad y cobertura.
- ROP-F2-BE-003: implementar elegibilidad dura para candidatos.
- ROP-F2-BE-004: implementar fórmula heurística MVP de matching.
- ROP-F2-BE-005: persistir `rop_opportunity_matches` o read model equivalente.
- ROP-F2-BE-006: exponer explicabilidad por factores positivos y restrictivos.
- ROP-F2-BE-007: aplicar regla de diversidad al top recomendado.

### Frontend

- ROP-F2-FE-001: construir vista Empresas para tu operación.
- ROP-F2-FE-002: construir carril Empresas recomendadas.
- ROP-F2-FE-003: construir carril Empresas cerca de ti.
- ROP-F2-FE-004: construir filtros persistentes.
- ROP-F2-FE-005: mostrar score, trust y razón de recomendación.

### Validación

- ROP-F2-QA-001: probar ranking con dataset de mismo nicho / misma ciudad.
- ROP-F2-QA-002: probar degradación por baja disponibilidad y capacidad stale.
- ROP-F2-QA-003: probar diversidad para evitar top estático.

### Criterio de salida

- El sistema devuelve recomendaciones priorizadas y explicables.
- El usuario ya puede descubrir empresas por valor operativo, no por búsqueda plana.

## Fase 3. Oportunidades e invitaciones

### Objetivo

Convertir discovery en interacción real entre empresas.

### Backend

- ROP-F3-BE-001: crear tabla `rop_opportunities`.
- ROP-F3-BE-002: crear tabla `rop_invitations`.
- ROP-F3-BE-003: implementar publicación de necesidad manual y desde eventos ERP.
- ROP-F3-BE-004: implementar invitaciones individuales y masivas.
- ROP-F3-BE-005: emitir eventos `rop.opportunity_created` y `rop.invitation_sent`.
- ROP-F3-BE-006: registrar estados de aceptación, rechazo y expiración.

### Frontend

- ROP-F3-FE-001: construir pantalla Publicar necesidad operativa.
- ROP-F3-FE-002: construir vista de recomendaciones para necesidad.
- ROP-F3-FE-003: construir modal o side panel de invitación.
- ROP-F3-FE-004: construir carril Oportunidades para ti.

### ERP

- ROP-F3-ERP-001: activar CTA Buscar aliado en cotizaciones.
- ROP-F3-ERP-002: activar proveedores sugeridos en compras.
- ROP-F3-ERP-003: activar CTA Invitar empresas en proyectos.

### Criterio de salida

- Una necesidad ya puede terminar en invitaciones enviadas y trazables.

## Fase 4. Células Empresariales

### Objetivo

Mover la colaboración aceptada a ejecución real, trazable y segura.

### Backend

- ROP-F4-BE-001: crear tablas `rop_business_cells` y `rop_members`.
- ROP-F4-BE-002: modelar timeline, tareas, hitos, aprobaciones y archivos compartidos.
- ROP-F4-BE-003: implementar ACL por audiencia y visibilidad.
- ROP-F4-BE-004: enlazar célula con oportunidad, proyecto u orden vía `externalRef`.
- ROP-F4-BE-005: registrar auditoría inmutable de eventos críticos.
- ROP-F4-BE-006: integrar chat contextual por tarea/hito/archivo.

### Frontend

- ROP-F4-FE-001: construir wizard Crear célula.
- ROP-F4-FE-002: construir vista resumen.
- ROP-F4-FE-003: construir timeline.
- ROP-F4-FE-004: construir tareas e hitos.
- ROP-F4-FE-005: construir aprobaciones.
- ROP-F4-FE-006: construir archivos compartidos.
- ROP-F4-FE-007: construir chat contextual.
- ROP-F4-FE-008: construir vista de auditoría para roles autorizados.

### Seguridad

- ROP-F4-SEC-001: ocultar referencias internas del ERP a externos.
- ROP-F4-SEC-002: auditar accesos a archivos sensibles.
- ROP-F4-SEC-003: limitar presupuesto y datos financieros por policy.

### Criterio de salida

- Dos o más empresas pueden ejecutar un trabajo compartido con trazabilidad y visibilidad controlada.

## Fase 5. Trust Score y reputación operativa

### Objetivo

Cerrar el loop de aprendizaje y reputación usando evidencia real de colaboración.

### Backend

- ROP-F5-BE-001: crear tablas `rop_trust_scores` y `rop_trust_score_snapshots`.
- ROP-F5-BE-002: crear tabla `rop_collaboration_history`.
- ROP-F5-BE-003: crear tabla `rop_ratings`.
- ROP-F5-BE-004: implementar cálculo base del Trust Score.
- ROP-F5-BE-005: implementar recalculo automático al cerrar colaboración.
- ROP-F5-BE-006: implementar flujo de disputa y moderación básica.
- ROP-F5-BE-007: emitir evento `rop.trust_score_recomputed`.

### Frontend

- ROP-F5-FE-001: mostrar Trust Score y tendencia en perfil y tarjetas.
- ROP-F5-FE-002: mostrar delta explicable al cierre.
- ROP-F5-FE-003: mostrar fortalezas, alertas y acciones sugeridas.

### Validación

- ROP-F5-QA-001: validar mejora por cierre exitoso.
- ROP-F5-QA-002: validar castigo por cancelación, disputa o abandono.
- ROP-F5-QA-003: validar anti gaming en pares repetidos.

### Criterio de salida

- La reputación ya influye el matching y se recalcula con trazabilidad.

## Fase 6. Apertura externa

### Objetivo

Permitir que empresas no usuarias del ERP completo entren a la red con un footprint controlado.

### Plataforma

- ROP-F6-PL-001: diseñar onboarding self-serve para empresas externas.
- ROP-F6-PL-002: habilitar autenticación externa u OAuth2.
- ROP-F6-PL-003: emitir API keys y webhooks por partner.
- ROP-F6-PL-004: separar footprint externo del ERP interno.
- ROP-F6-PL-005: crear políticas de rate limiting por actor externo.

### Frontend / UX

- ROP-F6-UX-001: construir portal liviano para empresa externa.
- ROP-F6-UX-002: construir aceptación de invitación sin navegar el ERP completo.
- ROP-F6-UX-003: construir vista limitada de perfil, oportunidad y célula.

### Seguridad

- ROP-F6-SEC-001: segmentar claramente lo visible por invitación.
- ROP-F6-SEC-002: auditar cada acceso sensible de actor externo.
- ROP-F6-SEC-003: bloquear navegación lateral a módulos del ERP.

### Criterio de salida

- Una empresa externa puede participar en invitaciones y células sin convertirse en usuario completo del ERP.

## Dependencias entre fases

- Fase 2 depende de catálogo y capacidad confiable de Fase 1.
- Fase 3 depende de matching explicable de Fase 2.
- Fase 4 depende de invitación/aceptación trazable de Fase 3.
- Fase 5 depende de historial real de colaboraciones de Fase 4.
- Fase 6 depende de policies y ACL maduras de Fase 4 y Fase 5.

## Orden real recomendado de construcción

1. Fase 0,
2. Fase 1,
3. Fase 2,
4. Fase 3,
5. Fase 4,
6. Fase 5,
7. Fase 6.

La razón es simple: no se debe abrir colaboración, reputación ni externos antes de tener identidad operativa, capacidad confiable y matching explicable.