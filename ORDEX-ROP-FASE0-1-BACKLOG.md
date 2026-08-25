# ORDEX ROP - Fase 0 y Fase 1 Backlog Técnico

Fecha de referencia: 2026-08-20

Objetivo de estas fases: convertir la definición estratégica de ORDEX ROP en una base implementable, con contratos, datos, UX y primeras integraciones suficientes para activar la red operativa sin romper el ERP actual.

## Estado base ya resuelto

- Existe PRD maestro con visión, arquitectura, journey, algoritmo, Trust Score e integración invisible con el ERP.
- Existe checklist vivo de implementación con IDs por fase y disciplina.
- Está definido el dominio conceptual principal: empresas, servicios, capacidad, clusters, oportunidades, invitaciones, células y trust.
- Está definida la secuencia de activación correcta: perfil operativo -> cluster -> discovery -> necesidad -> matching -> invitación.

Esto deja resuelto el discovery principal. Lo que falta es bajar la definición a artefactos implementables y a la primera experiencia funcional dentro del producto.

## Fase 0. Fundaciones

### Objetivo

Cerrar las decisiones estructurales para que la primera implementación no introduzca deuda de dominio, deuda de datos ni acoplamiento innecesario con el ERP.

### Bloque 1. Producto y decisiones rectoras

#### Producto

- ROP-F0-PD-003: cerrar la decisión del modelo de tenant de ORDEX ROP con una recomendación explícita entre tenant por red, por holding o por empresa administradora.
- ROP-F0-PD-004: definir la política pública del Trust Score indicando si se expone como valor exacto, bandas o valor exacto + bandas.
- ROP-F0-PD-005: definir la política de exposición para empresas externas, incluyendo qué campos se ven por red, por cluster y solo por invitación.
- ROP-F0-PD-006: definir nomenclatura oficial de producto para UI, API y documentación: ORDEX ROP, Red Operativa, Célula Empresarial y Trust Score.

#### Entregables esperados

- nota de decisión de tenant,
- nota de visibilidad de Trust Score,
- matriz de visibilidad de datos públicos/privados,
- glosario corto de términos oficiales.

### Bloque 2. Arquitectura y contratos

#### Arquitectura

- ROP-F0-AR-004: convertir el modelo conceptual a Prisma real con naming, relaciones y constraints aterrizados.
- ROP-F0-AR-005: diseñar la migración inicial de tablas ROP con estrategia reversible.
- ROP-F0-AR-006: definir índices reales de PostgreSQL para discovery, matching, disponibilidad y trust.
- ROP-F0-AR-007: definir event bus y contratos iniciales para eventos de entrada y salida.
- ROP-F0-AR-008: definir read models iniciales para discovery y matching, diferenciando tabla fuente de vista optimizada.
- ROP-F0-AR-009: definir fronteras exactas entre dominio ROP y adaptadores ERP.
- ROP-F0-AR-010: decidir si la fase 1 vive como módulo interno desacoplado en el monolito Next.js o como servicio separado con gateway local.

#### APIs iniciales

- ROP-F0-API-001: definir contrato para crear/editar perfil operativo.
- ROP-F0-API-002: definir contrato para publicar capacidad.
- ROP-F0-API-003: definir contrato para listar recomendaciones de empresas.
- ROP-F0-API-004: definir contrato para publicar necesidad operativa.
- ROP-F0-API-005: definir contrato para invitar empresas.

#### Eventos iniciales

- ROP-F0-EV-001: definir `quote.requested_external_support`.
- ROP-F0-EV-002: definir `purchase.need_created`.
- ROP-F0-EV-003: definir `work_order.capacity_changed`.
- ROP-F0-EV-004: definir `rop.match_found`.
- ROP-F0-EV-005: definir `rop.invitation_sent`.
- ROP-F0-EV-006: definir `rop.business_cell_created`.

#### Entregables esperados

- propuesta concreta para `prisma/schema.prisma`,
- documento de contratos API v1,
- documento de contratos de eventos v1,
- decisión de despliegue de fase 1.

### Bloque 3. UX de base

#### UX

- ROP-F0-UX-003: convertir el user journey en mapa de pantallas navegable con entrypoints desde ERP y home ROP.
- ROP-F0-UX-004: definir componentes base de UI: hero contextual, carril, tarjeta inteligente, side panel y modal de invitación.
- ROP-F0-UX-005: definir sistema de copy contextual para acciones como Buscar aliado, Invitar empresas y Publicar necesidad.
- ROP-F0-UX-006: definir estados vacíos, loading, error y no-match para evitar sensación de directorio vacío.
- ROP-F0-UX-007: definir la navegación mínima de fase 1 sin crear un dashboard administrativo tradicional.

#### Entregables esperados

- mapa de pantallas,
- inventario de componentes,
- especificación de microcopy,
- flujo UX de entrada desde cotización y desde home ROP.

### Bloque 4. Seguridad y permisos base

#### Seguridad

- ROP-F0-SEC-001: definir scopes base de acceso para admin empresa, coordinador operativo, compras, comercial y empresa externa.
- ROP-F0-SEC-002: definir política de ACL por entidad compartida en futuras células.
- ROP-F0-SEC-003: definir qué identificadores del ERP deben proyectarse como alias públicos.
- ROP-F0-SEC-004: definir auditoría mínima obligatoria en perfil, invitaciones y visibilidad.

### Secuencia recomendada de ejecución de Fase 0

1. Cerrar tenant, visibilidad y Trust Score público.
2. Bajar modelo de datos a Prisma real.
3. Cerrar contratos API y eventos.
4. Cerrar UX base y componentes.
5. Cerrar permisos y límites de exposición.

### Criterio de salida de Fase 0

- El equipo tiene una versión implementable de `schema.prisma` para ROP.
- Las APIs y eventos iniciales están definidos con contratos estables.
- La UX inicial tiene mapa de pantallas y entrypoints claros.
- La exposición de datos a empresas externas está normada.
- La fase 1 puede arrancar sin volver a discutir fundamentos.

## Fase 1. Directorio operativo y activación de red

### Objetivo

Lanzar el primer slice funcional de ORDEX ROP para que una empresa pueda activar la red, completar su perfil operativo, entrar a su cluster y visualizar empresas/capacidad relevante sin salir del contexto del ERP.

### Bloque 1. Datos maestros y perfil operativo

#### Backend

- ROP-F1-BE-001: crear tablas `companies`, `categories`, `subcategories` y `service_catalog`.
- ROP-F1-BE-002: crear tabla `company_services` con cobertura, lead time y visibilidad.
- ROP-F1-BE-003: crear tablas `capacity_availability` y `availability_slots`.
- ROP-F1-BE-004: exponer API de perfil operativo de empresa con lectura y actualización.
- ROP-F1-BE-005: exponer API de publicación y consulta de capacidad.
- ROP-F1-BE-006: crear adaptador de prellenado desde ERP para ciudad, servicios inferidos y señales operativas.
- ROP-F1-BE-007: persistir estado de onboarding del perfil operativo.

#### Frontend

- ROP-F1-FE-001: crear pantalla Activar Red Operativa.
- ROP-F1-FE-002: crear onboarding de perfil operativo en pasos.
- ROP-F1-FE-003: mostrar barra de completitud y recomendaciones de completado.
- ROP-F1-FE-004: construir selector de categoría, subcategoría y servicios.
- ROP-F1-FE-005: construir editor de capacidad disponible y ventanas horarias.

#### Datos

- ROP-F1-DT-001: crear catálogo inicial de categorías, subcategorías y servicios prioritarios.
- ROP-F1-DT-002: definir estrategia de seed inicial por vertical o industria.
- ROP-F1-DT-003: medir tasa de perfil completo y tiempo a activación.

### Bloque 2. Asignación a cluster y home de red

#### Backend

- ROP-F1-BE-008: implementar asignación automática de cluster principal por nicho, ciudad y cobertura.
- ROP-F1-BE-009: soportar sugerencia de clusters secundarios por afinidad.
- ROP-F1-BE-010: exponer endpoint para leer home ROP con carriles iniciales.
- ROP-F1-BE-011: generar primer carril de empresas relevantes con heurística simple.
- ROP-F1-BE-012: generar carril de capacidad disponible hoy.

#### Frontend

- ROP-F1-FE-006: crear pantalla Tu red operativa hoy.
- ROP-F1-FE-007: crear hero contextual con CTA principal y secundario.
- ROP-F1-FE-008: crear carril Empresas recomendadas.
- ROP-F1-FE-009: crear carril Capacidad disponible hoy.
- ROP-F1-FE-010: crear carril Empresas cerca de ti o del cluster.
- ROP-F1-FE-011: crear detalle lateral de empresa recomendada.

#### UX

- ROP-F1-UX-001: explicar por qué el usuario fue asignado al cluster principal.
- ROP-F1-UX-002: permitir reclasificación asistida o revisión manual si el cluster no encaja.
- ROP-F1-UX-003: diseñar empty state cuando aún no hay suficientes empresas en el cluster.

### Bloque 3. Entry points invisibles desde ERP

#### ERP / Integración

- ROP-F1-ERP-001: exponer CTA pasivo para activar red desde cotización cuando exista señal compatible.
- ROP-F1-ERP-002: exponer CTA pasivo desde compras cuando se detecte necesidad de proveedor.
- ROP-F1-ERP-003: exponer CTA pasivo desde proyecto cuando aplique colaboración externa.
- ROP-F1-ERP-004: registrar origen del entrypoint para medir adopción por módulo.

#### Producto

- ROP-F1-PD-001: definir reglas para cuándo aparece el CTA y cuándo no.
- ROP-F1-PD-002: definir copy contextual por módulo de origen.

### Bloque 4. Validación funcional

#### QA

- ROP-F1-QA-001: validar flujo activar red -> completar perfil.
- ROP-F1-QA-002: validar asignación automática a cluster.
- ROP-F1-QA-003: validar publicación y lectura de capacidad.
- ROP-F1-QA-004: validar que el home ROP nunca se vea como tabla vacía o directorio plano.
- ROP-F1-QA-005: validar que un usuario pueda entrar desde cotización y volver sin perder contexto.

#### Métricas de salida

- ROP-F1-MT-001: medir porcentaje de activación de red sobre empresas expuestas al CTA.
- ROP-F1-MT-002: medir porcentaje de perfiles operativos completados.
- ROP-F1-MT-003: medir tiempo medio de completar onboarding.
- ROP-F1-MT-004: medir CTR por carril principal del home.

### Secuencia recomendada de ejecución de Fase 1

1. Construir primero datos maestros y perfil operativo.
2. Encima de eso habilitar capacidad y disponibilidad.
3. Después activar asignación de cluster y home ROP.
4. Luego insertar entrypoints invisibles desde ERP.
5. Cerrar con validación UX y métricas de activación.

### Criterio de salida de Fase 1

- Una empresa puede activar la red y completar su perfil sin salir del producto.
- El sistema puede asignar cluster principal y mostrar contexto relevante inicial.
- El home ROP ya muestra carriles accionables, no un directorio plano.
- El ERP ya tiene al menos un punto de entrada contextual funcional.
- Existen métricas básicas de activación, perfil completo y uso inicial del home.

## Dependencias críticas antes de pasar a Fase 2

- El catálogo de servicios debe estar suficientemente limpio para soportar matching.
- La capacidad disponible debe tener timestamps y estado confiable.
- El cluster principal no puede depender de reglas ambiguas o manuales en exceso.
- El home ROP debe devolver razones explicables mínimas para cada tarjeta mostrada.

## Decisión operativa recomendada

No intentar construir oportunidades, invitaciones y células en paralelo a la activación base. La secuencia correcta es:

1. identidad operativa,
2. capacidad visible,
3. cluster y home,
4. entrypoints ERP,
5. luego matching profundo y oportunidades.

Eso reduce retrabajo y evita diseñar interacción social antes de tener oferta operativa usable.