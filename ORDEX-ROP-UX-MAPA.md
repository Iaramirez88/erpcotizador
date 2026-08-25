# ORDEX ROP - Mapa UX Navegable

Fecha de referencia: 2026-08-20

Objetivo: convertir el journey y la interfaz definida en una primera UI navegable de producto, lista para desglosarse luego en componentes y pantallas reales.

## 1. Principio de navegación

ORDEX ROP no entra al usuario por menú administrativo. Entra por contexto operativo, recomendaciones y side panels sobre trabajo real.

## 2. Rutas o entrypoints principales

### Home ROP

- ruta sugerida: `/dashboard/rop`
- propósito: superficie editorial y operativa de la red.

### Activación y onboarding

- `/dashboard/rop/activar`
- `/dashboard/rop/perfil`

### Discovery

- `/dashboard/rop/empresas`
- `/dashboard/rop/oportunidades`

### Necesidades e invitaciones

- `/dashboard/rop/necesidades/nueva`
- `/dashboard/rop/necesidades/[id]`
- `/dashboard/rop/necesidades/[id]/invitaciones`

### Células

- `/dashboard/rop/celulas/[id]`

## 3. Home ROP

### Zonas

- hero contextual,
- carril de acción inmediata,
- carril de empresas recomendadas,
- carril de oportunidades para ti,
- carril de capacidad disponible hoy,
- carril de aliados frecuentes,
- carril de empresas cerca de ti,
- carril de proyectos compartidos,
- panel lateral de filtros y actividad reciente.

### Acciones desde home

- publicar necesidad,
- ver recomendaciones,
- completar perfil,
- abrir empresa recomendada,
- entrar a célula,
- postularse a oportunidad.

## 4. Pantallas y side panels

### 4.1 Activar Red Operativa

Componentes:

- hero de valor,
- preview de beneficios por contexto,
- CTA activar,
- link a política de visibilidad.

### 4.2 Perfil operativo

Componentes:

- stepper de 5 pasos,
- selector de categoría/subcategoría/servicio,
- editor de cobertura,
- editor de capacidad,
- panel de visibilidad,
- barra de completitud.

### 4.3 Empresas para tu operación

Componentes:

- filtros persistentes,
- carriles o grid editorial,
- tarjeta de empresa,
- comparador simple,
- side panel de detalle.

### 4.4 Publicar necesidad

Componentes:

- formulario principal,
- selector de origen si viene desde ERP,
- selector de visibilidad,
- toggle de crear célula al aceptar,
- resumen lateral.

### 4.5 Recomendaciones para necesidad

Componentes:

- shortlist con score,
- razones positivas,
- restricciones,
- CTA invitar,
- acción de expandir candidatos secundarios.

### 4.6 Enviar invitación operativa

Componentes:

- modal o side panel,
- lista de empresas seleccionadas,
- editor de mensaje,
- toggles de compartición,
- expiración,
- confirmación de envío.

### 4.7 Célula Empresarial

Tabs o vistas:

- resumen,
- timeline,
- tareas,
- hitos,
- aprobaciones,
- archivos,
- chat contextual,
- auditoría.

## 5. Componentes base a construir

### RopHero

- mensaje contextual,
- CTA primario,
- CTA secundario,
- estado operativo.

### RopRail

- título,
- subtítulo opcional,
- lista horizontal,
- acción ver más.

### RopSmartCard

- badge superior,
- título,
- métrica principal,
- Trust Score o señal de confianza,
- razón de aparición,
- CTA principal,
- CTA secundaria.

### RopCompanyPanel

- perfil resumido,
- servicios,
- capacidad,
- Trust Score,
- historial,
- acciones.

### RopFiltersBar

- ciudad,
- servicio,
- cobertura,
- disponibilidad,
- Trust Score mínimo.

## 6. Entry points invisibles desde ERP

### Cotizaciones

- ubicación: side panel o CTA inline `Buscar aliado`.
- resultado esperado: abrir panel con recomendaciones y acción de invitar.

### Compras

- ubicación: bloque contextual `Proveedores sugeridos`.
- resultado esperado: shortlist accionable sin salir de compra.

### Proyectos

- ubicación: CTA `Invitar empresas`.
- resultado esperado: crear necesidad o célula desde contexto.

### Órdenes de trabajo

- ubicación: alerta contextual por saturación.
- resultado esperado: sugerir aliados por capacidad.

## 7. Estados vacíos mínimos

### Home sin red activada

- CTA activar red.

### Perfil incompleto

- CTA completar perfil.

### Cluster sin suficiente densidad

- sugerir ampliar cobertura, activar cluster vecino o publicar primera necesidad.

### Sin recomendaciones válidas

- explicar causa principal y sugerir ajustar filtros o publicar necesidad manual.

## 8. Flujo navegable mínimo de fase 1

1. usuario entra por CTA desde cotización o por `/dashboard/rop`,
2. activa la red,
3. completa perfil,
4. ve home contextual,
5. abre una empresa recomendada,
6. vuelve al home sin perder contexto,
7. publica necesidad o guarda aliado.

## 9. Criterio de salida

- El equipo de frontend ya tiene mapa claro de pantallas, entrypoints y componentes.
- El home ROP puede construirse sin inventar navegación durante implementación.
- Los entrypoints invisibles con ERP quedan definidos desde UX y no solo desde backend.