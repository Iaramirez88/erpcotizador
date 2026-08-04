# Motor de Inteligencia Empresarial de ORDEX

Documento rector para evolucionar ORDEX desde un ERP/CRM transaccional hacia un sistema que interpreta la operación, recomienda decisiones y entrega contexto ejecutivo accionable.

Este documento no propone “otro dashboard”. Propone una capacidad transversal desacoplada que usa la arquitectura vigente del producto y evita meter inteligencia repetida dentro de cada módulo.

## 1. Objetivo

ORDEX debe responder de forma consistente estas cuatro preguntas en cualquier dominio:

1. ¿Qué está ocurriendo?
2. ¿Por qué está ocurriendo?
3. ¿Qué puede ocurrir después?
4. ¿Qué debería hacer el gerente?

La inteligencia no debe vivir dentro de cada pantalla como lógica aislada. Debe concentrarse en un motor reusable.

## 2. Nombre oficial y posición arquitectónica

Nombre recomendado de la capacidad:

- Motor de Inteligencia Empresarial

Alias válidos a nivel técnico y de producto:

- Decision Engine
- Business Intelligence Engine
- COREBA, solo como nombre comercial o narrativo si luego se formaliza la marca de la experiencia ejecutiva

Ubicación dentro de la arquitectura vigente:

- La recolección de datos se conecta a Captación, Ventas, Operaciones, Recursos, Finanzas, IA y Verticales.
- El cálculo y la orquestación viven en Analítica con apoyo de IA Ejecutiva.
- La experiencia final se proyecta en Inicio como cockpit ejecutivo y en Analítica como vista profunda.

Conclusión estructural:

- No crear un módulo aislado paralelo a Reportes.
- No meter reglas en page.tsx de cada módulo.
- No acoplar el motor a componentes visuales.

## 3. Encaje con la arquitectura actual del repo

Este motor debe respetar la línea ya definida en estos artefactos:

- PRODUCT-ARCHITECTURE-BLUEPRINT.md
- PRODUCT-ARCHITECTURE-MATRIX.md
- PRODUCT-MAP.md
- RBAC-V2-DESIGN.md
- src/lib/product-architecture.ts

La arquitectura actual ya separa:

- Inicio
- Captación
- Ventas
- Operaciones
- Recursos
- Finanzas
- Analítica
- IA
- Verticales
- Plataforma

Eso significa que el motor no nace desde cero. Nace encima de una taxonomía ya definida.

## 4. Filosofía operativa

ORDEX no debe limitarse a mostrar métricas crudas. Debe producir interpretación.

Eso obliga a separar cinco cosas:

1. Recolección de hechos
2. KPIs y métricas derivadas
3. Reglas y evaluaciones
4. Predicción y priorización
5. Narrativa ejecutiva

Si esas cinco piezas se mezclan, aparece código espagueti. Si se separan, cualquier módulo puede reutilizar el motor.

## 5. Arquitectura objetivo por niveles

### Nivel 1. Recolección de datos

Responsabilidad:

- Leer datos operativos y transaccionales de cada dominio.
- Traducirlos a contratos normalizados.
- No emitir recomendaciones ni textos ejecutivos.

Entradas esperadas:

- CRM: leads, oportunidades, actividades, tareas, conversaciones.
- Ventas: cotizaciones, remisiones, POS, clientes, conversiones.
- Compras: órdenes de compra, proveedores, condiciones, costos.
- Inventario: existencias, movimientos, rotación, faltantes, sobrantes.
- Producción y operaciones: órdenes, tiempos, cuellos, retrasos.
- Finanzas: cartera, flujo, gastos, rentabilidad, utilidad, nómina.
- IA y OCR: auditorías, clasificación documental, señales asistidas.

Regla clave:

- Cada colector retorna hechos normalizados. No JSX. No strings de UI. No toasts. No decisiones finales.

### Nivel 2. Motor de análisis

Responsabilidad:

- Convertir hechos en KPIs, alertas, riesgos, oportunidades, recomendaciones, predicciones y acciones.
- Componer reglas por dominio sin modificar el núcleo.
- Mantener trazabilidad del porqué de cada conclusión.

Salidas mínimas del motor:

```ts
type DecisionEngineResult = {
  healthScore: number
  healthStatus: 'EXCELENTE' | 'BUENO' | 'ATENCION' | 'CRITICO'
  executiveSummary: string
  alerts: DecisionInsight[]
  opportunities: DecisionInsight[]
  recommendations: DecisionAction[]
  predictions: DecisionPrediction[]
  risks: DecisionInsight[]
  kpis: DecisionKpi[]
  trends: DecisionTrend[]
  actions: DecisionAction[]
  explainability: DecisionExplanation[]
}
```

Patrones requeridos:

- Strategy para analizadores por dominio.
- Plugin Registry para registrar nuevos analizadores sin tocar el core.
- Pipeline explícito para score, reglas, predicción y narrativa.

### Nivel 3. Dashboard ejecutivo

Responsabilidad:

- Presentar el resultado como informe ejecutivo, no como rejilla de tarjetas.
- Dar contexto, prioridades e impacto probable.
- Mantener Reportes como vista analítica opcional y más profunda.

Experiencia recomendada:

- Pantalla principal ejecutiva separada del dashboard actual o integrada como modo ejecutivo.
- El dashboard actual puede mantenerse como inicio operativo.
- Reportes sigue vivo como herramienta analítica detallada.

## 6. Contrato del núcleo técnico

Estructura sugerida:

```ts
type DecisionAnalysisTarget =
  | 'crm'
  | 'sales'
  | 'inventory'
  | 'purchases'
  | 'operations'
  | 'finance'
  | 'company'

type DecisionEngineContext = {
  empresaId: string
  sedeId?: string | null
  from?: Date
  to?: Date
  actorUserId?: string | null
  locale?: string
}

interface DecisionAnalyzerPlugin<TFacts = unknown> {
  key: DecisionAnalysisTarget
  collect: (context: DecisionEngineContext) => Promise<TFacts>
  analyze: (facts: TFacts, context: DecisionEngineContext) => Promise<Partial<DecisionEngineResult>>
}

interface DecisionEngine {
  analyze: (target: DecisionAnalysisTarget, context: DecisionEngineContext) => Promise<DecisionEngineResult>
  analyzeCompany: (context: DecisionEngineContext) => Promise<DecisionEngineResult>
}
```

Principio:

- El motor expone API estable; cada plugin puede crecer internamente sin romper a los consumidores.

## 7. Estructura de carpetas recomendada

```txt
src/
  lib/
    decision-engine/
      contracts.ts
      engine.ts
      registry.ts
      health-score.ts
      explainability.ts
      analyzers/
        crm-analyzer.ts
        sales-analyzer.ts
        inventory-analyzer.ts
        purchases-analyzer.ts
        operations-analyzer.ts
        finance-analyzer.ts
        company-analyzer.ts
      collectors/
        crm-collector.ts
        sales-collector.ts
        inventory-collector.ts
        purchases-collector.ts
        operations-collector.ts
        finance-collector.ts
      predictors/
        sales-forecast.ts
        cashflow-forecast.ts
        inventory-demand-forecast.ts
      summarizers/
        executive-summary.ts
      snapshots/
        snapshot-service.ts
      tests/
        fixtures/

  app/
    api/
      decision-engine/
        company/route.ts
        crm/route.ts
        sales/route.ts
        inventory/route.ts
        finance/route.ts

    dashboard/
      inteligencia/
        page.tsx
      reportes/
        page.tsx
```

## 8. Qué ya existe y sí debemos reutilizar

Checklist del estado actual del repo:

- [x] Arquitectura funcional por capas y dominios ya definida en PRODUCT-ARCHITECTURE-BLUEPRINT.md.
- [x] Matriz ruta -> dominio futuro ya documentada en PRODUCT-ARCHITECTURE-MATRIX.md.
- [x] Catálogo de navegación por capa en src/lib/product-architecture.ts.
- [x] Separación conceptual de Analítica e IA ya presente en RBAC-V2-DESIGN.md.
- [x] Pantalla de inicio actual desacoplada del módulo Reportes en src/app/dashboard/page.tsx.
- [x] Módulo de Reportes ya existente en src/app/dashboard/reportes/page.tsx.
- [x] CRM ya expone señales analíticas parciales como score, riesgo y probabilidad en src/components/crm/crm-dashboard-client.tsx.
- [x] Vertical restaurante ya muestra alertas y sugerencias operativas puntuales en src/app/dashboard/restaurante/restaurante-client.tsx.
- [x] Sistema transversal de notificaciones ya existe y puede usarse para alertas priorizadas.
- [x] Hay dominios con trazabilidad rica en CRM, POS, compras, inventario, órdenes, OCR e IA.

Conclusión:

- La base no está vacía.
- Ya existen piezas de inteligencia local.
- El problema actual no es falta total de analítica, sino dispersión y falta de un motor canónico.

## 9. Qué falta para que el motor exista de verdad

Checklist de brechas reales:

- [ ] Contrato canónico DecisionEngineResult.
- [ ] Registro oficial de plugins por dominio.
- [ ] Colectores normalizados por dominio.
- [ ] Catálogo unificado de KPIs con definiciones y fórmulas.
- [ ] Health score empresarial con pesos, reglas y explicación.
- [ ] Capa de explainability para justificar cada alerta o recomendación.
- [ ] Predictores base para ventas, demanda, flujo de caja y cierre comercial.
- [ ] API reusable para análisis por dominio y análisis compañía.
- [ ] Pantalla ejecutiva narrativa separada del reporte tradicional.
- [ ] Persistencia de snapshots analíticos para evitar recalcular todo en cada vista.
- [ ] Jobs programados para recomputación periódica.
- [ ] Suite de pruebas con fixtures por dominio.

## 10. Regla de coherencia para no romper la arquitectura

Cada nueva pieza debe responder esta secuencia antes de implementarse:

1. ¿Este dato pertenece a un dominio existente?
2. ¿El dato se extrae en un collector o estoy metiendo Prisma directo en UI?
3. ¿La fórmula vive en un calculator o estoy repitiendo reglas en la ruta?
4. ¿La recomendación vive en un analyzer o la estoy codificando dentro de la página?
5. ¿La narrativa vive en un summarizer o la estoy escribiendo en JSX?

Si la respuesta cae en la segunda opción de cada punto, la implementación se está desviando.

## 11. Anti espagueti: reglas obligatorias

### Regla 1

- Ninguna page.tsx debe consultar varias tablas para inventar lógica ejecutiva ad hoc.

### Regla 2

- Ningún componente visual debe calcular KPIs de negocio canónicos.

### Regla 3

- Ningún analyzer debe conocer detalles de renderizado.

### Regla 4

- Ningún plugin debe modificar el núcleo del motor para registrarse.

### Regla 5

- Ninguna recomendación debe salir sin explicación trazable.

### Regla 6

- Ninguna predicción debe presentarse sin rango de confianza o al menos sin aclarar que es heurística.

### Regla 7

- Todo insight nuevo debe tener prueba de fixture o caso reproducible.

## 12. Modelo de salida explicable

Tipos sugeridos:

```ts
type DecisionInsight = {
  id: string
  kind: 'ALERT' | 'OPPORTUNITY' | 'RISK'
  title: string
  summary: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  domain: string
  subdomain?: string | null
  entityRefs?: Array<{ type: string; id: string; label?: string }>
  reasons: string[]
  evidence: string[]
  impact?: {
    label: string
    amount?: number | null
    currency?: 'COP' | null
  }
}

type DecisionAction = {
  id: string
  title: string
  description: string
  priority: 'NOW' | 'THIS_WEEK' | 'THIS_MONTH'
  owner: 'SALES' | 'CRM' | 'OPERATIONS' | 'PURCHASES' | 'FINANCE' | 'MANAGEMENT'
  expectedImpact?: string
  href?: string | null
}

type DecisionPrediction = {
  id: string
  title: string
  metric: string
  value: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  basis: string[]
}
```

## 13. Motor por dominios

### CRM

Debe responder:

- oportunidades estancadas
- leads sin seguimiento
- clientes con riesgo de pérdida
- siguiente acción sugerida
- deals con mayor potencial

### Ventas

Debe responder:

- servicios más vendidos y menos vendidos
- clientes frecuentes y clientes caídos
- cotizaciones con mayor probabilidad de cierre
- vendedores con mejor y peor rendimiento
- tendencia comercial por sede, zona o segmento

### Compras

Debe responder:

- proveedores con alzas de precio
- materiales con sobrecosto
- compras urgentes vs aplazables
- mejores condiciones por proveedor

### Inventario y recursos

Debe responder:

- riesgo de ruptura
- sobrestock
- baja rotación
- demanda estimada
- materiales críticos para producción

### Operaciones y producción

Debe responder:

- órdenes retrasadas
- cuellos de botella
- recursos saturados
- productividad por equipo o responsable

### Finanzas

Debe responder:

- salud del flujo de caja
- utilidad proyectada
- crecimiento anormal de gastos
- riesgo de cartera
- ingresos comprometidos

### Gerencia

Debe consolidar:

- tres problemas principales
- tres oportunidades principales
- decisiones prioritarias del día
- impacto económico estimado
- salud general de la empresa

## 14. Experiencia ejecutiva recomendada

La experiencia correcta no es una colección de widgets.

La pantalla ejecutiva debe abrir así:

- saludo contextual
- resumen ejecutivo en lenguaje natural
- bloque de riesgos prioritarios
- bloque de oportunidades
- bloque de acciones recomendadas
- salud empresarial con explicación
- acceso secundario a KPIs y reportes detallados

Texto de referencia de producto:

> Buenos días. Analicé los últimos 90 días de operación. Encontré 3 riesgos, 5 oportunidades y 7 acciones prioritarias que podrían mejorar el resultado esperado. ¿Quieres revisar el análisis ejecutivo?

## 15. Relación entre Dashboard, Reportes y Motor

Decisión recomendada:

- Dashboard actual: se mantiene como inicio operativo.
- Reportes actual: se mantiene como analítica detallada tradicional.
- Nueva pantalla ejecutiva: consume el motor y se centra en interpretación.

Eso evita destruir lo que ya funciona y evita confundir operación con dirección.

## 16. Plan de implementación por fases

### Fase 0. Fundación

Objetivo:

- crear el núcleo sin tocar todavía todas las pantallas

Entregables:

- contracts.ts
- registry.ts
- engine.ts
- primer company-analyzer
- ruta API company
- fixtures base

Checklist:

- [ ] Crear src/lib/decision-engine/contracts.ts
- [ ] Crear src/lib/decision-engine/registry.ts
- [ ] Crear src/lib/decision-engine/engine.ts
- [ ] Definir DecisionEngineResult y tipos auxiliares
- [ ] Crear análisis company con datos mínimos existentes
- [ ] Exponer GET /api/decision-engine/company
- [x] Crear src/lib/decision-engine/contracts.ts
- [x] Crear src/lib/decision-engine/registry.ts
- [x] Crear src/lib/decision-engine/engine.ts
- [x] Definir DecisionEngineResult y tipos auxiliares
- [x] Crear análisis company con datos mínimos existentes
- [x] Exponer GET /api/decision-engine/company
- [x] Crear fixture base en src/lib/decision-engine/tests/fixtures/company-facts.ts

### Fase 1. Comercial

Objetivo:

- consolidar CRM + Ventas como primera fuente de decisiones visibles

Entregables:

- crm-collector.ts
- sales-collector.ts
- crm-analyzer.ts
- sales-analyzer.ts
- primera versión de health score comercial

Checklist:

- [x] Detectar leads sin seguimiento
- [x] Detectar oportunidades estancadas
- [x] Detectar cotizaciones próximas a vencer
- [x] Detectar clientes listos para recompra
- [x] Detectar caídas de conversión
- [x] Priorizar acciones comerciales por impacto

### Fase 2. Recursos y operaciones

Objetivo:

- conectar inventario, compras y órdenes al mismo marco analítico

Checklist:

- [x] Detectar inventario crítico
- [x] Detectar sobrestock
- [x] Detectar materiales con incremento de costo
- [x] Detectar compras urgentes
- [x] Detectar órdenes retrasadas
- [x] Detectar cuellos operativos

### Fase 3. Finanzas y salud empresarial

Objetivo:

- elevar el motor a lectura gerencial real

Checklist:

- [x] Calcular flujo de caja resumido
- [x] Calcular utilidad estimada
- [x] Detectar cartera riesgosa
- [x] Integrar score global con pesos explicables
- [x] Emitir executiveSummary consolidado

### Fase 4. Predicción y snapshots

Objetivo:

- pasar de analítica reactiva a orientación prospectiva

Checklist:

- [x] Pronóstico de ventas
- [x] Pronóstico de demanda
- [x] Pronóstico de flujo de caja
- [x] Persistencia de snapshots
- [x] Recomputación programada
- [x] Comparación entre periodos

### Fase 5. Cockpit ejecutivo

Objetivo:

- construir la experiencia diferencial del producto

Checklist:

- [x] Crear /dashboard/inteligencia
- [x] Diseñar lectura narrativa primero
- [x] Dejar KPIs como soporte, no como protagonista
- [x] Enlazar acciones hacia módulos existentes
- [x] Medir adopción y uso de recomendaciones

## 17. Validaciones obligatorias en cada fase

Antes de cerrar una fase:

1. Validar contratos TypeScript.
2. Validar prueba de fixtures del analyzer agregado con npm run test:decision-engine.
3. Validar que la UI no consulte Prisma directo para inteligencia.
4. Validar que cada recomendación tenga razón y evidencia.
5. Validar que el motor responda sin depender de una sola pantalla.

## 19. Persistencia inicial de snapshots

Estado actual:

- Se agregó persistencia consolidada en base de datos para snapshots del Decision Engine.
- Cada snapshot guarda company, crm, finance, inventory, operations, purchases y sales en un payload JSON trazable.
- Se expuso GET/POST en /api/decision-engine/snapshots para listar y capturar manualmente.
- Se agregó el script manual npm run decision-engine:snapshot -- --empresa=<id> [--sede=<id>] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD].
- Se agregó el script batch npm run decision-engine:schedule-snapshots para ejecutar recomputación por empresa y sedes desde cron externo.
- La captura ya es idempotente por empresa, sede, ventana y versión del motor, salvo que se fuerce con --force.

Pendiente deliberado:

- El cockpit ya compara snapshots recientes por slice y expone lectura temporal corta con bundles persistidos.
- El scheduler real ya puede montarse directamente en Docker Compose con el servicio `decision-engine-scheduler`.

Adición de Fase 5:

- El cockpit ya muestra pronósticos explícitos de ventas, demanda y flujo de caja.
- La adopción inicial de recomendaciones se mide por aperturas de acciones desde el cockpit y se persiste por usuario en preferencias de UI.

## 18. Checklist maestro de estado

### Base arquitectónica

- [x] Capas de producto definidas
- [x] Navegación por capa existente
- [x] Reportes desacoplados del inicio
- [x] RBAC v2 por dominios encaminado
- [x] Catálogo de capacidades BI oficial

### Núcleo del motor

- [x] Contratos del motor
- [x] Registry de plugins
- [x] Company analyzer
- [x] Explainability común
- [x] Health score común

### Fuentes por dominio

- [x] CRM collector
- [x] Sales collector
- [x] Inventory collector
- [x] Purchases collector
- [x] Operations collector
- [x] Finance collector

### Capa analítica

- [x] KPIs canónicos iniciales para CRM, Ventas e Inventario
- [x] Reglas por dominio iniciales para CRM, Ventas e Inventario
- [x] Recomendaciones priorizadas iniciales
- [x] Riesgos iniciales en CRM, Ventas, Inventario y Compras
- [x] Oportunidades iniciales en CRM, Ventas, Inventario y Compras
- [x] Predicciones heurísticas iniciales en CRM, Ventas, Inventario, Compras y Finanzas
- [x] Síntesis ejecutiva company con señales de recursos y operaciones
- [x] Slice financiero inicial con resultado, flujo y cartera

### Capa de entrega

- [x] API /api/decision-engine/company
- [x] API por dominio inicial para CRM, Ventas, Finanzas, Inventario, Compras y Operaciones
- [x] Snapshots persistidos
- [x] Notificaciones ejecutivas priorizadas
- [x] Pantalla /dashboard/inteligencia mínima

## 19. Paso a paso para mantener coherencia cuando se implemente

Secuencia operativa recomendada para cada incremento:

1. Elegir un dominio y una sola pregunta de negocio.
2. Definir el hecho mínimo que responde esa pregunta.
3. Crear o ampliar el collector del dominio.
4. Convertir el hecho en KPI o señal intermedia.
5. Escribir el analyzer con una sola responsabilidad.
6. Agregar explicación y evidencia.
7. Exponer el resultado en la API del motor.
8. Recién después proyectarlo en UI o notificaciones.
9. Validar con fixture y caso real.
10. Registrar la decisión en este documento si cambió el contrato o el patrón.

Regla práctica:

- Primero dominio.
- Luego contrato.
- Luego análisis.
- Luego UX.

Nunca al revés.

## 20. Prompt maestro operativo para Copilot

Usar este prompt cuando se implemente cada fase:

```md
Quiero evolucionar ORDEX hacia un Motor de Inteligencia Empresarial desacoplado, reusable y alineado con la arquitectura vigente por capas: Inicio, Captación, Ventas, Operaciones, Recursos, Finanzas, Analítica, IA y Verticales.

Reglas obligatorias:

- No poner lógica ejecutiva dentro de page.tsx.
- No calcular KPIs canónicos dentro del frontend.
- Usar patrón Strategy o Plugin para que cada dominio registre su analyzer sin tocar el núcleo.
- Separar recolección de datos, KPIs, reglas, predicciones, narrativa y render.
- Mantener el dashboard actual como inicio operativo y reportes como vista analítica opcional.
- La nueva inteligencia debe vivir en un Decision Engine reusable por API.
- Cada insight debe incluir explicación, evidencia y acción sugerida cuando aplique.
- No introducir código espagueti, duplicación de fórmulas ni acceso a Prisma desde UI para construir inteligencia.

Objetivo del incremento actual:

- [describir aquí el dominio y la pregunta exacta]

Entregables esperados:

- collector o ajuste de collector
- analyzer o ajuste de analyzer
- contrato estable si aplica
- prueba o fixture
- endpoint o integración mínima
- documentación de checklist actualizada
```

## 21. Decisión final de producto

La solución correcta para ORDEX no es “poner más tarjetas”.

La solución correcta es:

- conservar el dashboard actual como entrada operativa,
- conservar reportes como análisis tradicional,
- construir encima un Motor de Inteligencia Empresarial transversal,
- y exponer una experiencia ejecutiva narrativa que convierta datos en decisiones.

Ese es el camino limpio, escalable y coherente con la arquitectura ya impuesta en el producto.