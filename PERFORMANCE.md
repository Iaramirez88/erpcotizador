# 📊 Guía de Optimización de Rendimiento

## 🎯 Objetivo

Este documento explica cómo diagnosticar y resolver problemas de rendimiento en el sistema SGDigital.

## 🛠️ Herramientas Disponibles

### 1. Benchmark de Queries (`npm run perf:benchmark`)

**Qué hace:**
- Mide tiempos de ejecución de queries críticas
- Compara diferentes estrategias (include vs select)
- Detecta problemas N+1
- Simula carga del dashboard

**Cuándo usar:**
- Cuando sientas que las consultas son lentas
- Antes y después de optimizaciones
- Para comparar diferentes estrategias de queries

**Ejemplo de uso:**
```bash
npm run perf:benchmark
```

**Salida esperada:**
```
✅ User findFirst (básico): 12.45ms (1 queries)
✅ Dashboard: Últimas 6 cotizaciones (con includes): 245.67ms (15 queries)
✅ Dashboard: Últimas 6 cotizaciones (solo select): 89.23ms (7 queries)

🐌 Queries más lentas:
1. Dashboard completo (todas las queries en paralelo): 456.78ms (42 queries)
2. Query compleja: Orden con todas las relaciones: 234.56ms (8 queries)
```

### 2. Analizador de Queries Lentas (`npm run perf:analyze`)

**Qué hace:**
- Intercepta TODAS las queries en tiempo real
- Identifica automáticamente queries lentas (>50ms)
- Genera reporte con recomendaciones específicas
- Detecta patrones problemáticos (N+1, SELECT *, etc.)

**Cuándo usar:**
- Para descubrir queries lentas que no conocías
- Cuando el dashboard tarda en cargar
- Para validar optimizaciones

**Ejemplo de uso:**
```bash
npm run perf:analyze
```

### 3. Análisis de Arranque (`npm run perf:startup`)

**Qué hace:**
- Mide tiempo de importación de módulos
- Analiza inicialización de Prisma y Pool de conexiones
- Detecta cuellos de botella en el arranque

**Cuándo usar:**
- Cuando el servidor tarda en iniciar
- En ambientes serverless donde el cold start importa
- Para optimizar el tiempo de primera respuesta

**Ejemplo de uso:**
```bash
npm run perf:startup
```

**Salida esperada:**
```
✅ Importación de módulos: 45.23ms
✅ Creación de Pool: 2.34ms
✅ Primera conexión: 178.56ms
⏱️  Tiempo total: 456.78ms
```

### 4. Verificador de Índices (`npm run perf:indexes`)

**Qué hace:**
- Lista todos los índices existentes
- Identifica tablas críticas sin índices
- Genera SQL para crear índices recomendados
- Analiza estadísticas de uso

**Cuándo usar:**
- Antes de optimizar rendimiento (paso fundamental)
- Después de agregar nuevas tablas
- Cuando queries de búsqueda son lentas

**Ejemplo de uso:**
```bash
npm run perf:indexes
```

## 📈 Proceso de Optimización Recomendado

### Paso 1: Diagnóstico Inicial

```bash
# Ejecutar todos los análisis
npm run perf:startup     # ¿El arranque es lento?
npm run perf:benchmark   # ¿Qué queries son lentas?
npm run perf:analyze     # ¿Hay queries ocultas lentas?
npm run perf:indexes     # ¿Faltan índices?
```

### Paso 2: Identificar Problemas

**Problemas comunes:**

#### 🐌 Queries Lentas (>100ms)

**Síntomas:**
- Dashboard tarda en cargar
- Listados lentos
- Búsquedas tardan

**Causas comunes:**
- Falta de índices
- Uso excesivo de `include`
- Queries N+1
- SELECT * innecesarios

**Solución:**
1. Revisar índices con `npm run perf:indexes`
2. Usar `select` en lugar de `include`
3. Ejecutar queries en paralelo con `Promise.all()`

#### 🚀 Arranque Lento (>1s)

**Síntomas:**
- Primera petición tarda mucho
- Cold starts lentos en serverless

**Causas comunes:**
- Muchas importaciones síncronas
- Pool de conexiones sin reutilizar
- Módulos pesados cargados de entrada

**Solución:**
1. Implementar lazy loading
2. Reutilizar pool de conexiones
3. Usar dynamic imports para módulos pesados

#### 🔄 Problema N+1

**Síntomas:**
- Muchas queries para un mismo resultado
- Tiempo proporcional a número de items

**Detección:**
```typescript
// ❌ MAL - Genera N+1
const cotizaciones = await prisma.cotizacion.findMany()
for (const cot of cotizaciones) {
  const items = await prisma.itemCotizacion.findMany({
    where: { cotizacionId: cot.id }
  })
}

// ✅ BIEN - Una sola query
const cotizaciones = await prisma.cotizacion.findMany({
  include: {
    items: true
  }
})
```

### Paso 3: Aplicar Optimizaciones

#### Optimización 1: Agregar Índices

```bash
# 1. Verificar índices faltantes
npm run perf:indexes

# 2. Crear migración
npx prisma migrate dev --name add_performance_indexes

# 3. Agregar índices al schema.prisma
```

Ejemplo en `schema.prisma`:
```prisma
model Cotizacion {
  // ...
  
  @@index([sedeId, estado])
  @@index([sedeId, createdAt])
  @@index([clienteId])
}
```

#### Optimización 2: Usar Select en lugar de Include

```typescript
// ❌ LENTO - Trae todos los campos
const cotizaciones = await prisma.cotizacion.findMany({
  include: {
    cliente: true,
    items: {
      include: {
        material: true
      }
    },
    vendedor: true
  }
})

// ✅ RÁPIDO - Solo campos necesarios
const cotizaciones = await prisma.cotizacion.findMany({
  select: {
    id: true,
    numero: true,
    total: true,
    estado: true,
    createdAt: true,
    cliente: { select: { nombre: true } }
  }
})
```

#### Optimización 3: Paralelizar Queries Independientes

```typescript
// ❌ LENTO - Queries en secuencia
const totalCotizaciones = await prisma.cotizacion.count()
const totalOrdenes = await prisma.ordenTrabajo.count()
const totalClientes = await prisma.cliente.count()

// ✅ RÁPIDO - Queries en paralelo
const [totalCotizaciones, totalOrdenes, totalClientes] = await Promise.all([
  prisma.cotizacion.count(),
  prisma.ordenTrabajo.count(),
  prisma.cliente.count()
])
```

#### Optimización 4: Implementar Paginación

```typescript
// ❌ MAL - Trae todos los registros
const materiales = await prisma.material.findMany()

// ✅ BIEN - Paginación
const page = 1
const pageSize = 50
const materiales = await prisma.material.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize
})
```

### Paso 4: Medir Mejoras

```bash
# Ejecutar benchmarks antes y después
npm run perf:benchmark > antes.txt
# ... aplicar optimizaciones ...
npm run perf:benchmark > despues.txt

# Comparar resultados
diff antes.txt despues.txt
```

## 🎯 Optimizaciones Específicas por Componente

### Dashboard Principal

**Problema:** Carga lenta al abrir

**Solución:**
```typescript
// En src/app/dashboard/page.tsx

// Ejecutar queries en paralelo
const [
  totalCotizaciones,
  cotizacionesEnviadas,
  totalOrdenes,
  recentCotizaciones,
  recentOrdenes
] = await Promise.all([
  prisma.cotizacion.count({ where: sedeScope }),
  prisma.cotizacion.count({ where: { ...sedeScope, estado: 'ENVIADA' } }),
  prisma.ordenTrabajo.count({ where: sedeScope }),
  prisma.cotizacion.findMany({
    where: sedeScope,
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { /* solo campos necesarios */ }
  }),
  prisma.ordenTrabajo.findMany({
    where: sedeScope,
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { /* solo campos necesarios */ }
  })
])
```

### Listados con Búsqueda

**Problema:** Búsqueda lenta con LIKE

**Solución:**
```sql
-- Agregar índices GIN para búsqueda de texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_clientes_nombre_gin ON clientes USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_clientes_email_gin ON clientes USING gin(email gin_trgm_ops);
```

### Conexión a Base de Datos

**Problema:** Muchas conexiones abiertas

**Solución en `src/lib/prisma.ts`:**
```typescript
// Configurar pool correctamente
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo de conexiones
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

## 📊 Métricas de Referencia

### Tiempos Aceptables

| Operación | Bueno | Aceptable | Lento |
|-----------|-------|-----------|-------|
| Query simple | <10ms | <50ms | >100ms |
| Query con JOINs | <50ms | <100ms | >200ms |
| Carga de dashboard | <500ms | <1s | >2s |
| Arranque | <300ms | <800ms | >1.5s |
| Búsqueda | <100ms | <300ms | >500ms |

### Contadores de Queries

| Operación | Ideal | Aceptable | Problema |
|-----------|-------|-----------|----------|
| Dashboard completo | <20 | <50 | >100 |
| Listado simple | 1-2 | <5 | >10 |
| Detalle con relaciones | 1 | <3 | >5 |

## 🚨 Problemas Comunes y Soluciones

### "El dashboard tarda 3-5 segundos en cargar"

**Diagnóstico:**
```bash
npm run perf:analyze
```

**Soluciones:**
1. Agregar índices en `sedeId`, `empresaId`, `createdAt`
2. Paralelizar queries del dashboard
3. Usar `select` en lugar de `include`
4. Implementar caché de Redis para contadores

### "Primera petición siempre lenta"

**Diagnóstico:**
```bash
npm run perf:startup
```

**Soluciones:**
1. Precalentar conexiones en producción
2. Usar connection pooling persistente
3. Implementar keep-alive de base de datos

### "Búsquedas muy lentas"

**Diagnóstico:**
```bash
npm run perf:indexes
```

**Soluciones:**
1. Crear índices GIN para búsqueda de texto
2. Usar paginación siempre
3. Implementar debounce en el frontend
4. Considerar Elasticsearch para búsqueda avanzada

## 📚 Recursos Adicionales

- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/performance-tips.html)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)

## ✅ Checklist de Optimización

- [ ] Ejecutar `npm run perf:indexes` y agregar índices faltantes
- [ ] Revisar queries del dashboard con `npm run perf:analyze`
- [ ] Cambiar `include` a `select` donde sea posible
- [ ] Paralelizar queries independientes con `Promise.all()`
- [ ] Implementar paginación en todos los listados
- [ ] Configurar pool de conexiones apropiadamente
- [ ] Agregar índices compuestos para queries frecuentes
- [ ] Considerar caché para datos estáticos
- [ ] Medir mejoras con `npm run perf:benchmark`

---

💡 **Recuerda:** La optimización prematura es la raíz de todos los males. Siempre mide primero, optimiza después.
