# ORDEX ROP - Checklist de Implementación

Fecha de referencia: 2026-08-20

Objetivo: llevar control vivo de lo ya definido, lo que está en implementación y lo que ya quedó validado para no repetir discovery, diseño ni ejecución técnica.

## Estado actual

### Ya resuelto a nivel documental

- [x] ROP-PRD-001: visión de producto definida.
- [x] ROP-PRD-002: objetivos, no objetivos y usuarios objetivo definidos.
- [x] ROP-PRD-003: casos de uso prioritarios definidos.
- [x] ROP-PRD-004: North Star Metric y métricas clave definidas.
- [x] ROP-PRD-005: arquitectura funcional definida.
- [x] ROP-PRD-006: arquitectura técnica por servicios definida.
- [x] ROP-PRD-007: estrategia de desacoplamiento del ERP definida.
- [x] ROP-PRD-008: modelo de datos normalizado definido.
- [x] ROP-PRD-009: user journey completo definido.
- [x] ROP-PRD-010: sistema de interfaz tipo carriles definido.
- [x] ROP-PRD-011: algoritmo MVP de recomendaciones definido.
- [x] ROP-PRD-012: funcionalidad de Células Empresariales definida.
- [x] ROP-PRD-013: sistema ORDEX Trust Score definido.
- [x] ROP-PRD-014: integración invisible con el ERP definida.

### Pendiente de bajar a implementación

- [x] ROP-IMP-001: traducir el PRD a épicas ejecutables. Ver ORDEX-ROP-FASE0-1-BACKLOG.md.
- [x] ROP-IMP-002: traducir el modelo de datos a schema Prisma real. Ver prisma/ordex-rop-v1.prisma.
- [x] ROP-IMP-003: definir contratos API iniciales. Ver ORDEX-ROP-CONTRATOS-V1.md.
- [x] ROP-IMP-004: definir contratos de eventos de entrada y salida. Ver ORDEX-ROP-CONTRATOS-V1.md.
- [x] ROP-IMP-005: definir permisos y scopes de ROP. Ver ORDEX-ROP-PERMISOS-SCOPES.md.
- [x] ROP-IMP-006: diseñar primera UI navegable del home ROP. Ver ORDEX-ROP-UX-MAPA.md.

## Fase 0. Fundaciones

### Producto

- [x] ROP-F0-PD-001: crear PRD maestro.
- [x] ROP-F0-PD-002: definir roadmap macro del producto.
- [ ] ROP-F0-PD-003: cerrar decisiones abiertas del tenant.
- [ ] ROP-F0-PD-004: cerrar política pública del Trust Score.
- [ ] ROP-F0-PD-005: cerrar política de exposición para empresas externas.

### Datos y arquitectura

- [x] ROP-F0-AR-001: definir bounded contexts principales.
- [x] ROP-F0-AR-002: definir servicios mínimos: Empresas, Clusters, Matching, Trust, Oportunidades, Células, Notificaciones.
- [x] ROP-F0-AR-003: definir modelo de datos conceptual y normalizado.
- [x] ROP-F0-AR-004: convertir el modelo a Prisma real. 2026-08-20.
- [ ] ROP-F0-AR-005: diseñar migración inicial de tablas ROP.
- [ ] ROP-F0-AR-006: definir estrategia de índices reales en PostgreSQL.
- [ ] ROP-F0-AR-007: definir event bus y contratos iniciales.
- [ ] ROP-F0-AR-008: definir read models para discovery y matching.

### UX

- [x] ROP-F0-UX-001: definir user journey completo.
- [x] ROP-F0-UX-002: definir patrón de interfaz tipo carriles.
- [x] ROP-F0-UX-003: convertir el journey en mapa de pantallas navegable.
- [x] ROP-F0-UX-004: definir componentes base de tarjeta, carril y side panel.
- [x] ROP-F0-UX-005: definir copy system para acciones contextuales.

## Fase 1. Directorio operativo y activación de red

### Backend

- [x] ROP-F1-BE-001: crear tablas companies, categories, subcategories y service_catalog. 2026-08-20.
- [x] ROP-F1-BE-002: crear tabla company_services. 2026-08-20.
- [x] ROP-F1-BE-003: crear tablas capacity_availability y availability_slots. 2026-08-20.
- [x] ROP-F1-BE-004: exponer API de perfil operativo de empresa. 2026-08-20.
- [x] ROP-F1-BE-005: exponer API de publicación y consulta de capacidad. 2026-08-20.
- [ ] ROP-F1-BE-006: crear adaptador de prellenado desde ERP.

### Frontend

- [ ] ROP-F1-FE-001: crear pantalla Activar Red Operativa.
- [x] ROP-F1-FE-002: crear onboarding de perfil operativo. 2026-08-20.
- [x] ROP-F1-FE-003: crear pantalla Tu red operativa hoy. 2026-08-20.
- [x] ROP-F1-FE-004: crear carriles iniciales del home ROP. 2026-08-20.
- [ ] ROP-F1-FE-005: crear detalle lateral de empresa recomendada.

### Validación

- [ ] ROP-F1-QA-001: validar flujo activar red -> completar perfil.
- [ ] ROP-F1-QA-002: validar asignación automática a cluster.
- [ ] ROP-F1-QA-003: validar publicación y lectura de capacidad.

## Fase 2. Clusters y matching inicial

### Backend

- [ ] ROP-F2-BE-001: crear tablas clusters y cluster_memberships.
- [ ] ROP-F2-BE-002: implementar elegibilidad básica para matching.
- [ ] ROP-F2-BE-003: implementar score heurístico MVP.
- [ ] ROP-F2-BE-004: persistir opportunity_matches o read model equivalente.
- [ ] ROP-F2-BE-005: exponer explicabilidad de recomendaciones.

### Frontend

- [ ] ROP-F2-FE-001: crear vista Empresas para tu operación.
- [x] ROP-F2-FE-001: crear vista Empresas para tu operación. 2026-08-20.
- [ ] ROP-F2-FE-002: crear carril Empresas recomendadas.
- [ ] ROP-F2-FE-003: crear carril Empresas cerca de ti.
- [x] ROP-F2-FE-004: crear filtros ligeros persistentes. 2026-08-20.
- [ ] ROP-F2-FE-005: mostrar razón de recomendación por tarjeta.

## Notas de implementación recientes

- 2026-08-20: script de seed agregado en scripts/seed-rop-catalog.ts y comando npm run seed:rop-catalog.

### Validación

- [ ] ROP-F2-QA-001: probar ranking con casos de mismo nicho y misma ciudad.
- [ ] ROP-F2-QA-002: probar penalizaciones por baja disponibilidad.
- [ ] ROP-F2-QA-003: probar regla de diversidad del top recomendado.

## Fase 3. Oportunidades e invitaciones

### Backend

- [ ] ROP-F3-BE-001: crear tabla opportunities.
- [ ] ROP-F3-BE-002: crear tabla invitations.
- [~] ROP-F3-BE-003: implementar publicación de necesidad. 2026-08-20: publicación manual lista; faltan orígenes ERP.
- [~] ROP-F3-BE-004: implementar shortlist/recomendaciones persistidas por necesidad. 2026-08-20: heurística inicial y persistencia en rop_opportunity_matches listas; faltan invitaciones.
- [x] ROP-F3-BE-004: implementar invitación individual y múltiple. 2026-08-20.
- [ ] ROP-F3-BE-005: emitir eventos rop.invitation_sent y rop.opportunity_created.

### Frontend

- [x] ROP-F3-FE-001: crear pantalla Publicar necesidad operativa. 2026-08-20.
- [x] ROP-F3-FE-002: crear vista Aliados recomendados para esta necesidad. 2026-08-20.
- [x] ROP-F3-FE-003: crear modal/side panel Enviar invitación operativa. 2026-08-20.
- [ ] ROP-F3-FE-004: crear carril Oportunidades para ti.

### Integración ERP

- [ ] ROP-F3-ERP-001: insertar CTA Buscar aliado en cotizaciones.
- [ ] ROP-F3-ERP-002: insertar proveedores sugeridos en órdenes de compra.
- [ ] ROP-F3-ERP-003: insertar CTA Invitar empresas en proyectos.

## Fase 4. Células Empresariales

### Backend

- [ ] ROP-F4-BE-001: crear tablas business_cells y members.
- [ ] ROP-F4-BE-002: crear entidades de timeline, tareas, hitos y aprobaciones.
- [ ] ROP-F4-BE-003: crear policy layer de visibilidad por audiencia.
- [ ] ROP-F4-BE-004: integrar archivos compartidos con ACL.
- [ ] ROP-F4-BE-005: integrar chat contextual enlazado por entidad.
- [ ] ROP-F4-BE-006: crear auditoría inmutable de eventos críticos.

### Frontend

- [ ] ROP-F4-FE-001: crear wizard Crear célula para ejecutar este proyecto.
- [ ] ROP-F4-FE-002: crear vista resumen de célula.
- [ ] ROP-F4-FE-003: crear timeline de célula.
- [ ] ROP-F4-FE-004: crear módulo de tareas e hitos.
- [ ] ROP-F4-FE-005: crear módulo de aprobaciones.
- [ ] ROP-F4-FE-006: crear módulo de archivos compartidos.
- [ ] ROP-F4-FE-007: crear chat contextual.

### Seguridad

- [ ] ROP-F4-SEC-001: ocultar referencias internas del ERP para empresas externas.
- [ ] ROP-F4-SEC-002: auditar acceso a archivos sensibles.
- [ ] ROP-F4-SEC-003: validar ACL por tarea, archivo e hito.

## Fase 5. Trust Score y reputación operativa

### Backend

- [ ] ROP-F5-BE-001: crear tablas trust_scores y trust_score_snapshots.
- [ ] ROP-F5-BE-002: crear tabla collaboration_history.
- [ ] ROP-F5-BE-003: crear tabla ratings.
- [ ] ROP-F5-BE-004: implementar cálculo inicial de Trust Score.
- [ ] ROP-F5-BE-005: implementar recalculo automático al cierre.
- [ ] ROP-F5-BE-006: implementar disputas y moderación básica.

### Frontend

- [ ] ROP-F5-FE-001: mostrar score y tendencia en tarjetas y perfiles.
- [ ] ROP-F5-FE-002: mostrar delta explicable al finalizar colaboración.
- [ ] ROP-F5-FE-003: mostrar acciones sugeridas para mejorar score.

### Validación

- [ ] ROP-F5-QA-001: validar que un cierre exitoso mejora score.
- [ ] ROP-F5-QA-002: validar penalización por cancelación o disputa.
- [ ] ROP-F5-QA-003: validar que no existan autoevaluaciones o loops falsos.

## Fase 6. Apertura externa

### Plataforma

- [ ] ROP-F6-PL-001: definir onboarding self-serve para empresa externa.
- [ ] ROP-F6-PL-002: soportar autenticación externa u OAuth2.
- [ ] ROP-F6-PL-003: exponer API keys y webhooks para partners.
- [ ] ROP-F6-PL-004: separar footprint externo del ERP interno.

### UX

- [ ] ROP-F6-UX-001: diseñar portal liviano para externos.
- [ ] ROP-F6-UX-002: diseñar políticas de visibilidad por invitación.
- [ ] ROP-F6-UX-003: diseñar aceptación de invitación sin navegar el ERP completo.

## Integraciones invisibles prioritarias

- [ ] ROP-ERP-001: Buscar aliado en cotización.
- [ ] ROP-ERP-002: Proveedores sugeridos en compra.
- [ ] ROP-ERP-003: Invitar empresas en proyecto.
- [ ] ROP-ERP-004: Aliados por capacidad en órdenes de trabajo.
- [ ] ROP-ERP-005: Recalculo Trust Score al cierre de orden/célula.

## Reglas de mantenimiento del checklist

- [ ] Marcar solo como hecho cuando exista validación mínima, no solo diseño.
- [ ] Añadir fecha al lado del item cuando pase a hecho en implementación real.
- [ ] Si un ítem se reemplaza, no borrarlo: moverlo a obsoleto con nota.
- [ ] Si aparece nuevo alcance, agregar ID nuevo y no reusar IDs anteriores.
- [ ] Cada cierre de sesión importante debe actualizar este documento.

## Obsoletos / reemplazados

- Ninguno todavía.