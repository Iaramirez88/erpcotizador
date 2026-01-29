# 🚀 ROADMAP - Sistema SGDigital

## 📋 Proyecto: Cotizador Inteligente + Sistema de Órdenes de Trabajo

**Stack Tecnológico Seleccionado:**
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Backend:** Next.js API Routes (App Router)
- **Base de Datos:** PostgreSQL + Prisma ORM
- **Autenticación:** NextAuth.js v5 (Auth.js)
- **UI:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Validación:** Zod
- **Fechas:** date-fns

---

## 🔥 Peticiones recientes (Ene 2026) — Estado y Prioridad

> Objetivo: mantener el hilo de lo pedido por negocio y avanzar con validaciones cortas.

### ✅ Ya implementado

- [x] (1) Formas de pago + captura de link de Bold (campo para pegar link / mostrar botón).
- [x] (2) Garantía en cotización (UI + PDF).
- [x] (3) Acabados con variables (instalación con valor editable por item, reflejado en PDF).
- [x] (4) Precios con IVA incluido: cálculo correcto (extrae base+IVA desde total) + toggle por sede desde panel admin.
- [x] (5) Numeración por sede con prefijo: `COT-{sedeCodigo}-{####}`.
- [x] (Extra) Concurrencia: consecutivo atómico por sede con tabla de secuencia (evita colisiones).

### 🔜 Próximo bloque (recomendado)

- [x] (10) Descuento aplicado sobre utilidad (no sobre total).
  - Criterio: mostrar costo base vs precio vs utilidad estimada; el descuento reduce utilidad, no el costo.
  - Regla inicial: utilidad base fija 50% del subtotal (pendiente: hacerlo configurable por sede/empresa).

### 📌 Backlog importante (pendiente)

- [x] (6) Costos de producción litografía (plancha, tintas por cantidad, papel, corte, acabados, transporte).
  - Implementado (MVP): página “Calculadora Litografía” con inputs + desglose + costo unitario.
  - Pendiente: guardar parámetros por sede/empresa y/o integrarlo al cotizador como tipo de producto.
- [x] (7) Desperdicios de materiales (MVP): estándar por sede/material + override por item en cotizador.
  - Entregable: config editable por material/sede + campo por item, aplicado al cálculo y persistido.
- [ ] (8) Daños laborales.
  - Entregable: módulo mínimo para registrar evento/costo y asociarlo a sede/periodo.
- [x] (9) Terminados: base de datos + tamaño de archivo + ancho de material.
  - Implementado: tamaño de archivo aprox. (DPI / RGB-CMYK / sangrado) + specs de material (ancho/largo/espesor) en cotizador.
  - Implementado: catálogo CRUD de “Terminados” + selección por item + costo incluido en precio unitario + persistencia en BD.
  - Pendiente: correr migración Prisma `20260123194500_terminados_catalog` en el entorno/BD y definir reglas/restricciones por tipo de producto/material.
- [x] (11) Tamaños reales de productos (presets en cotizador: volantes, brochures, tarjetas, carpetas, sobres, etc.).
  - Entregable: selector de “Producto (preset)” que autocompleta ancho/alto.
- [x] (12) Recibos de caja / soportes de proveedores (contabilidad).
  - Implementado: adjuntar soportes/archivos a pagos de compras (proveedores).
- [x] (13) Proveedores: conciliación de facturas (debe/paga/abono) (MVP).
  - Implementado: pagos/abonos por compra + cálculo de pagado/saldo y estado.
- [x] (14) Resumen general (dashboard/finanzas/operación).
- [x] (15) Filtros/segmentación de clientes (potenciales/frecuentes/ocasionales).
- [ ] (16) Ingesta de facturas por correo (captura + clasificación automática).
- [ ] (17) Items regulares de stock (ej: buzos): cotizar/vender aunque no haya stock (política configurable).
- [x] (18) Remisiones: definir de dónde descuenta inventario y trazabilidad.
  - Implementado (MVP): modelos Prisma + migración + API (crear/listar/anular) + UI básica en dashboard.
  - Implementado: descuento de stock (bodega o global) + trazabilidad vía `InventoryMovement.sourceType = REMISION` y `sourceId`.
  - Pendiente si se requiere: vista detalle/impresión PDF, traslado entre bodegas (OUT+IN).
- [x] (19) Estándar de desperdicio editable (ver 7) (MVP).
  - Pendiente si se requiere: mostrar en PDF / auditoría avanzada de cambios.
- [ ] (20) Formato Excel para litografía (import/export).
- [ ] (22) Permisos: grupos/equipos (RBAC por equipo, sede y módulo).
  - [x] Implementado: RBAC por sede y por módulo (módulos dedicados: `INVENTARIO`, `REMISIONES`, `POS`).
  - [x] Implementado: permiso general (todas las sedes) como fallback cuando no hay membresía en una sede.
  - [ ] Pendiente: grupos/equipos (asignar permisos a un team y heredar por usuarios) + UI de gestión.

### 🧭 Orden sugerido de implementación

1) (10) Descuento sobre utilidad
3) (7)/(19) Desperdicios
4) (6)/(20) Litografía + Excel
5) (12)/(13) Proveedores + contabilidad básica
6) (15) Segmentación de clientes
7) (18)/(17) Remisiones + stock
8) (22) Equipos/permisos

**¿Por qué Next.js?**
✅ Full-stack en un solo framework (frontend + backend)  
✅ TypeScript nativo = menos errores  
✅ SSR/SSG = mejor SEO y performance  
✅ API Routes = no necesitas servidor separado  
✅ Despliegue fácil en Vercel/AWS/servidor propio  
✅ Mejor para comercializar como SaaS  

---

## 🎯 FASE 1: COTIZADOR INTELIGENTE
**Duración:** 3-4 meses  
**Estado:** 🟢 EN DESARROLLO

### **MES 1: Fundación del Proyecto**

#### Semana 1-2: Setup y Autenticación ✅
- [x] Crear proyecto Next.js con TypeScript
- [ ] Instalar dependencias base (Prisma, NextAuth, shadcn/ui, Zustand)
- [ ] Configurar Prisma con PostgreSQL
- [ ] Crear esquema de base de datos (usuarios, empresas)
- [ ] Implementar sistema de autenticación
  - Login con email/contraseña
  - Registro de usuarios
  - Recuperación de contraseña
  - Verificación de email
- [ ] Crear middleware de autenticación
- [ ] Implementar roles (admin, vendedor, cliente)

**Explicación Técnica:**
```typescript
// NextAuth.js maneja toda la autenticación
// Prisma conecta a PostgreSQL y maneja los datos
// Middleware protege rutas automáticamente
```

#### Semana 3-4: Dashboard y Navegación
- [ ] Crear layout principal del dashboard
- [ ] Implementar sidebar responsivo
- [ ] Crear navegación entre módulos
- [ ] Página de inicio/estadísticas básicas
- [ ] Perfil de usuario
- [ ] Configuración de cuenta

**Estructura de carpetas:**
```
src/
├── app/
│   ├── (auth)/              # Grupo de rutas de autenticación
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (dashboard)/         # Grupo de rutas protegidas
│   │   ├── dashboard/
│   │   ├── cotizaciones/
│   │   ├── clientes/
│   │   └── layout.tsx       # Layout con sidebar
│   └── api/                 # API Routes
│       ├── auth/
│       └── cotizaciones/
├── components/              # Componentes reutilizables
│   ├── ui/                  # shadcn/ui components
│   ├── auth/
│   ├── dashboard/
│   └── cotizador/
├── lib/                     # Utilidades
│   ├── prisma.ts            # Cliente de Prisma
│   ├── auth.ts              # Configuración NextAuth
│   └── utils.ts
├── types/                   # TypeScript types
│   └── index.ts
└── store/                   # Zustand stores
    └── useUserStore.ts
```

---

### **MES 2: Módulo de Cotizaciones**

#### Semana 5-6: CRUD de Cotizaciones
- [ ] Modelo de datos para cotizaciones
- [ ] Lista de cotizaciones (tabla con filtros)
- [ ] Crear nueva cotización (formulario)
- [ ] Ver detalle de cotización
- [ ] Editar cotización
- [ ] Eliminar cotización
- [ ] Estados: Borrador, Enviada, Aprobada, Rechazada
- [ ] Búsqueda y filtros avanzados

**Explicación - Modelo de Datos:**
```prisma
model Cotizacion {
  id              String    @id @default(cuid())
  numero          String    @unique // COT-2025-001
  clienteId       String
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  fecha           DateTime  @default(now())
  validezDias     Int       @default(30)
  estado          EstadoCotizacion @default(BORRADOR)
  subtotal        Decimal   @db.Decimal(10, 2)
  descuento       Decimal   @default(0) @db.Decimal(10, 2)
  impuesto        Decimal   @default(19) @db.Decimal(5, 2) // IVA 19%
  total           Decimal   @db.Decimal(10, 2)
  items           ItemCotizacion[]
  notas           String?
  createdBy       String
  usuario         User      @relation(fields: [createdBy], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum EstadoCotizacion {
  BORRADOR
  ENVIADA
  APROBADA
  RECHAZADA
  VENCIDA
}
```

#### Semana 7-8: Calculadora Inteligente
- [ ] Base de datos de materiales y precios
- [ ] Calculadora de costos por m²
- [ ] Selector de tipo de impresión:
  - Impresión digital
  - Gran formato
  - Sublimación
  - Corte de vinilo
  - etc.
- [ ] Selector de material/sustrato:
  - Vinilo adhesivo
  - Lona
  - Canvas
  - Papel fotográfico
  - Banner
  - etc.
- [ ] Calculadora de acabados:
  - Laminado
  - Montaje
  - Bastidor
  - Ojales
  - etc.
- [ ] Cálculo automático de:
  - Costo de material
  - Costo de impresión
  - Costo de mano de obra
  - Margen de ganancia
  - Precio sugerido
- [ ] Ajuste manual de precios

**Explicación - Lógica de Cálculo:**
```typescript
// Ejemplo de cálculo
const calcularCotizacion = (datos) => {
  const areaM2 = (datos.ancho * datos.alto) / 10000; // cm a m²
  
  const costoMaterial = areaM2 * datos.material.precioPorM2;
  const costoImpresion = areaM2 * datos.tipoImpresion.tarifaPorM2;
  const costoAcabados = datos.acabados.reduce((sum, acabado) => 
    sum + (acabado.precioFijo || areaM2 * acabado.precioPorM2), 0
  );
  
  const costoBase = costoMaterial + costoImpresion + costoAcabados;
  const precioConMargen = costoBase * (1 + datos.margenGanancia / 100);
  
  return {
    costoBase,
    precioSugerido: precioConMargen,
    margenReal: precioConMargen - costoBase
  };
};
```

---

### **MES 3: Gestión de Clientes y Catálogos**

#### Semana 9-10: Módulo de Clientes
- [ ] CRUD completo de clientes
- [ ] Datos de cliente:
  - Información básica (nombre, NIT, contacto)
  - Múltiples contactos por cliente
  - Historial de cotizaciones
  - Estadísticas (total facturado, promedio)
- [ ] Importar clientes (CSV/Excel)
- [ ] Exportar clientes

**Modelo de Cliente:**
```prisma
model Cliente {
  id              String    @id @default(cuid())
  tipoDocumento   TipoDocumento
  numeroDocumento String    @unique
  razonSocial     String
  nombreComercial String?
  email           String
  telefono        String
  celular         String?
  direccion       String
  ciudad          String
  departamento    String
  pais            String    @default("Colombia")
  contactos       Contacto[]
  cotizaciones    Cotizacion[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Contacto {
  id          String   @id @default(cuid())
  clienteId   String
  cliente     Cliente  @relation(fields: [clienteId], references: [id])
  nombre      String
  cargo       String?
  email       String
  telefono    String?
  principal   Boolean  @default(false)
}
```

#### Semana 11-12: Catálogos de Productos
- [ ] Gestión de materiales
  - Nombre, categoría, precio por m²
  - Ancho de rollo estándar
  - Stock mínimo/actual
  - Proveedor
- [ ] Gestión de tipos de impresión
  - Nombre, descripción
  - Tarifa por m²
  - Tiempo estimado por m²
- [ ] Gestión de acabados
  - Nombre, tipo (por m² o fijo)
  - Precio
  - Tiempo adicional
- [ ] Cálculo automático de desperdicio
- [ ] Alertas de stock bajo

---

### **MES 4: Generación de PDFs y Reportes**

#### Semana 13-14: Generación de Cotizaciones PDF
- [ ] Diseño de plantilla PDF profesional
- [ ] Generación con react-pdf o jsPDF
- [ ] Elementos del PDF:
  - Logo de la empresa
  - Datos de la empresa
  - Datos del cliente
  - Número de cotización
  - Fecha y validez
  - Tabla de items con detalle
  - Subtotal, descuento, IVA, total
  - Términos y condiciones
  - Notas adicionales
  - Información de contacto/pago
- [ ] Envío por email automático
- [ ] Descarga directa
- [ ] Vista previa antes de generar

**Explicación - Generación PDF:**
```typescript
// Usaremos @react-pdf/renderer
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

const CotizacionPDF = ({ cotizacion }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text>COTIZACIÓN N° {cotizacion.numero}</Text>
      </View>
      {/* Resto del contenido */}
    </Page>
  </Document>
);
```

#### Semana 15-16: Reportes y Analytics
- [ ] Dashboard con métricas:
  - Total cotizaciones por período
  - Tasa de conversión (aprobadas/enviadas)
  - Valor total cotizado vs facturado
  - Top 10 clientes
  - Productos/servicios más vendidos
- [ ] Gráficos (recharts o chart.js)
- [ ] Filtros por fecha, cliente, estado
- [ ] Exportar reportes a Excel

---

## 🎯 FASE 2: SISTEMA DE ÓRDENES DE TRABAJO
**Duración:** 5-6 meses  
**Estado:** 🔴 PENDIENTE

### **MES 5: Fundación del Módulo de Producción**

#### Semana 17-18: Conversión Cotización → Orden
- [ ] Botón "Convertir a Orden de Trabajo"
- [ ] Modelo de datos para Órdenes
- [ ] Copiar datos de cotización
- [ ] Asignar número de orden (OT-2025-001)
- [ ] Estados de orden:
  - Pendiente
  - En Diseño
  - En Preprensa
  - En Producción
  - En Acabados
  - Control de Calidad
  - Listo para Entrega
  - Entregado
- [ ] Historial de cambios de estado

**Modelo de Orden de Trabajo:**
```prisma
model OrdenTrabajo {
  id              String    @id @default(cuid())
  numero          String    @unique
  cotizacionId    String?   @unique
  cotizacion      Cotizacion? @relation(fields: [cotizacionId], references: [id])
  clienteId       String
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  fechaCreacion   DateTime  @default(now())
  fechaPromesa    DateTime
  fechaEntrega    DateTime?
  estado          EstadoOrden @default(PENDIENTE)
  prioridad       Prioridad @default(NORMAL)
  items           ItemOrden[]
  tareas          TareaProduccion[]
  archivos        ArchivoOrden[]
  notas           String?
  createdBy       String
  usuario         User      @relation(fields: [createdBy], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum EstadoOrden {
  PENDIENTE
  EN_DISENO
  EN_PREPRENSA
  EN_PRODUCCION
  EN_ACABADOS
  CONTROL_CALIDAD
  LISTO_ENTREGA
  ENTREGADO
  CANCELADO
}

enum Prioridad {
  BAJA
  NORMAL
  ALTA
  URGENTE
}
```

#### Semana 19-20: Sistema de Tareas y Flujo de Trabajo
- [ ] Crear tareas por etapa de producción
- [ ] Asignar responsables a cada tarea
- [ ] Tiempo estimado vs real por tarea
- [ ] Checklist por tarea
- [ ] Comentarios y notas por tarea
- [ ] Notificaciones de asignación
- [ ] Vista Kanban del flujo

---

### **MES 6: Gestión de Producción**

#### Semana 21-22: Gestión de Recursos
- [ ] Catálogo de máquinas/equipos:
  - Plotter de impresión
  - Plotter de corte
  - Laminadora
  - Prensa de sublimación
  - etc.
- [ ] Estado de máquinas (disponible, en uso, mantenimiento)
- [ ] Asignación de máquina a orden
- [ ] Cola de impresión por máquina
- [ ] Registro de mantenimientos

**Modelo de Recursos:**
```prisma
model Maquina {
  id              String    @id @default(cuid())
  nombre          String
  tipo            TipoMaquina
  marca           String?
  modelo          String?
  estado          EstadoMaquina @default(DISPONIBLE)
  anchoMaximo     Decimal?  @db.Decimal(8, 2) // en cm
  velocidad       Decimal?  @db.Decimal(8, 2) // m²/hora
  asignaciones    AsignacionMaquina[]
  mantenimientos  Mantenimiento[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum TipoMaquina {
  IMPRESORA_GRAN_FORMATO
  PLOTTER_CORTE
  LAMINADORA
  PRENSA_SUBLIMACION
  OTROS
}

enum EstadoMaquina {
  DISPONIBLE
  EN_USO
  MANTENIMIENTO
  FUERA_SERVICIO
}
```

#### Semana 23-24: Control de Tiempos
- [ ] Timer automático por tarea
- [ ] Registro manual de tiempos
- [ ] Pausar/reanudar trabajo
- [ ] Reporte de tiempo real vs estimado
- [ ] Análisis de eficiencia por operario
- [ ] Análisis de eficiencia por tipo de trabajo

---

### **MES 7: Gestión de Archivos y Preprensa**

#### Semana 25-26: Carga y Gestión de Archivos
- [ ] Upload de archivos de diseño
- [ ] Validación automática:
  - Formato (PDF, AI, PSD, CDR, etc.)
  - Tamaño máximo
  - Resolución mínima (DPI)
  - Modo de color (CMYK recomendado)
  - Sangrado/bleed
- [ ] Preview de archivos
- [ ] Versionado de archivos
- [ ] Comentarios sobre archivos
- [ ] Aprobación de cliente (portal)

**Almacenamiento:**
```typescript
// Opciones de storage:
// 1. Servidor local (si tienes servidor físico)
// 2. AWS S3 / Digital Ocean Spaces (cloud)
// 3. Cloudinary (optimización automática)

// Ejemplo con uploadthing (más fácil para Next.js)
import { UploadButton } from "@uploadthing/react";
```

#### Semana 27-28: Sistema de Aprobaciones
- [ ] Enviar prueba digital al cliente
- [ ] Portal de cliente para aprobar/rechazar
- [ ] Comentarios del cliente sobre la prueba
- [ ] Nueva versión si hay correcciones
- [ ] Historial de versiones
- [ ] No iniciar producción sin aprobación

---

### **MES 8: Dashboard de Producción en Tiempo Real**

#### Semana 29-30: Vista de Producción
- [ ] Dashboard principal de producción
- [ ] Vista de todas las órdenes activas
- [ ] Filtros por estado, prioridad, fecha
- [ ] Vista Kanban arrastrando tarjetas
- [ ] Vista de lista con detalles
- [ ] Vista de calendario/timeline
- [ ] Indicadores visuales:
  - Órdenes atrasadas (rojo)
  - Órdenes a tiempo (verde)
  - Órdenes próximas a vencer (amarillo)

**Explicación - Real-time:**
```typescript
// Opción 1: Polling (más simple)
useEffect(() => {
  const interval = setInterval(() => {
    fetchOrdenes();
  }, 30000); // cada 30 segundos
  return () => clearInterval(interval);
}, []);

// Opción 2: WebSockets (tiempo real verdadero)
// Usar Pusher, Ably o Socket.io
// Actualiza automáticamente cuando cambia algo
```

#### Semana 31-32: App Móvil (opcional)
- [ ] PWA para operarios
- [ ] Ver órdenes asignadas
- [ ] Cambiar estado de tareas
- [ ] Registrar tiempo de trabajo
- [ ] Tomar fotos del progreso
- [ ] Notificaciones push

---

### **MES 9-10: Portal del Cliente**

#### Semana 33-36: Portal Completo
- [ ] Registro de clientes
- [ ] Login independiente para clientes
- [ ] Dashboard del cliente:
  - Órdenes activas
  - Historial de trabajos
  - Cotizaciones pendientes
- [ ] Seguimiento en tiempo real
  - Estado actual
  - Tiempo estimado de entrega
  - Fotos del progreso
- [ ] Solicitar nueva cotización
- [ ] Subir archivos para nuevo trabajo
- [ ] Chat/mensajería con SGDigital
- [ ] Descargar facturas
- [ ] Re-orden rápida (repetir trabajo anterior)

---

## 🎯 FASE 3: FACTURACIÓN E INVENTARIO (OPCIONAL)
**Duración:** 3-4 meses  
**Estado:** 🔴 PENDIENTE

### Funcionalidades:
- [ ] Conversión orden → factura
- [ ] Generación de factura electrónica (si aplica)
- [ ] Control de inventario de materiales
- [ ] Alertas de stock bajo
- [ ] Registro de compras
- [ ] Costo real vs estimado

**Nota:** Esto puede integrarse con Odoo o software de contabilidad existente.

---

## 📊 INDICADORES DE ÉXITO (KPIs)

### Fase 1 - Cotizador:
- ✅ Reducir tiempo de cotización de 30 min a 5 min
- ✅ 100% cotizaciones con cálculos correctos
- ✅ 0 errores de precios
- ✅ Generación de PDF en < 3 segundos

### Fase 2 - Órdenes:
- ✅ Visibilidad 100% del estado de cada orden
- ✅ Reducir tiempo de búsqueda de archivos en 80%
- ✅ 90% entregas a tiempo
- ✅ Reducir errores de producción en 50%

---

## 🛠️ TECNOLOGÍAS Y DEPENDENCIAS

### Dependencias a Instalar:

```json
{
  "dependencies": {
    "next": "16.0.10",
    "react": "19.2.1",
    "react-dom": "19.2.1",
    "@prisma/client": "^6.0.0",
    "next-auth": "^5.0.0-beta",
    "@auth/prisma-adapter": "^2.0.0",
    "zustand": "^5.0.0",
    "zod": "^3.23.0",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^4.0.0",
    "@react-pdf/renderer": "^4.0.0",
    "recharts": "^2.12.0",
    "lucide-react": "^0.460.0",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "sonner": "^1.7.0",
    "uploadthing": "^7.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.0.10"
  }
}
```

### shadcn/ui Components:
```bash
npx shadcn@latest init
npx shadcn@latest add button input label card table dialog select textarea
npx shadcn@latest add dropdown-menu avatar badge tabs alert
```

---

## 📅 CRONOGRAMA VISUAL

```
Mes 1  [█████░░░░░] Setup + Auth + Dashboard
Mes 2  [█████████░] Cotizador + Cálculos
Mes 3  [████████░░] Clientes + Catálogos
Mes 4  [█████████░] PDFs + Reportes
       ════════════ FIN FASE 1 ════════════
Mes 5  [██░░░░░░░░] Órdenes de Trabajo
Mes 6  [███░░░░░░░] Gestión Producción
Mes 7  [████░░░░░░] Archivos + Aprobaciones
Mes 8  [█████░░░░░] Dashboard Producción
Mes 9  [██████░░░░] Portal Cliente
Mes 10 [███████░░░] Portal Cliente
       ════════════ FIN FASE 2 ════════════
```

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### HOY:
1. ✅ Crear proyecto Next.js
2. ⏳ Instalar dependencias base
3. ⏳ Configurar Prisma
4. ⏳ Crear estructura de carpetas
5. ⏳ Instalar shadcn/ui

### ESTA SEMANA:
- [ ] Implementar autenticación completa
- [ ] Crear primeros componentes UI
- [ ] Diseñar esquema de base de datos
- [ ] Setup de PostgreSQL (local o cloud)

---

## 📚 RECURSOS Y DOCUMENTACIÓN

- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **NextAuth.js:** https://authjs.dev
- **shadcn/ui:** https://ui.shadcn.com
- **Tailwind CSS:** https://tailwindcss.com/docs

---

**Actualizado:** 12 de Diciembre, 2025  
**Versión:** 1.0  
**Proyecto:** SGDigital - Sistema de Cotización y Órdenes de Trabajo
