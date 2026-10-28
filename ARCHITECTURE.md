# ARCHITECTURE.md — Ordex / SGDigital

Documento de arquitectura del sistema **`cotizador-inteligente`** (producto comercializado como **Ordex** / SG Digital).

- **Alcance:** estado real del código en la rama `develop` al 27/10/2026. Describe lo que existe, no lo que se desea.
- **Naturaleza:** documento vivo. Toda decisión estructural nueva debe reflejarse aquí y, si es una decisión con alternativas, en un ADR dentro de `docs/adr/`.
- **Regla:** este documento **no contiene secretos**. Las variables de entorno se listan por nombre y propósito, nunca con valores.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Frontend](#3-frontend)
4. [Backend](#4-backend)
5. [Base de datos](#5-base-de-datos)
6. [Autenticación y autorización](#6-autenticación-y-autorización)
7. [Estructura de carpetas](#7-estructura-de-carpetas)
8. [Módulos principales](#8-módulos-principales)
9. [Integraciones externas](#9-integraciones-externas)
10. [Docker y servicios](#10-docker-y-servicios)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Cómo se ejecuta el proyecto](#12-cómo-se-ejecuta-el-proyecto)
13. [Dependencias críticas](#13-dependencias-críticas)
14. [Flujo general de datos](#14-flujo-general-de-datos)
15. [Recomendaciones arquitectónicas](#15-recomendaciones-arquitectónicas)
16. [Riesgos y deuda técnica registrada](#16-riesgos-y-deuda-técnica-registrada)

---

## 1. Visión general

Ordex es una **plataforma SaaS multiempresa (multi-tenant)** orientada a PyMEs colombianas, que integra en un solo producto:

- Cotizador y producción de **litografía / artes gráficas**.
- **POS** y facturación interna (no electrónica) con secuencias por sede.
- **CRM omnicanal** (WhatsApp, Instagram, Facebook, Messenger, chatbot, marketing/SEO).
- **Contabilidad**, **nómina**, **inventario/bodegas**, **compras**, **proveedores**, **remisiones**, **órdenes de trabajo**.
- **Website builder** multi-dominio (Puck) con formularios públicos y SEO.
- **Marketplace B2B "ROP"** para proveedores.
- **Facturación electrónica DIAN**.
- **Motor de inteligencia empresarial** (snapshots, analizadores, reportes).
- Verticales: **odontología**, **restaurante**, **dotaciones**, **servicios web**.

### Estilo arquitectónico

| Aspecto | Decisión actual |
|---|---|
| Tipo | **Monolito modular** desplegado como una sola app Next.js |
| Backend | API Routes del App Router (sin servidor separado) |
| Servicio auxiliar | **Microservicio Python/FastAPI para OCR** (único servicio con otro lenguaje) |
| Multi-tenancy | **Base de datos compartida, esquema compartido**, discriminado por `empresaId` y `sedeId` |
| Autorización | RBAC v2 (capabilities + scope) + modelo legacy por módulo + entitlements de plan |
| Asincronía | **BullMQ/Redis** para OCR; cron HTTP (`X-API-Key`) para jobs; contenedor *scheduler* para snapshots |
| Entrega | Docker Compose + Caddy en un VPS (Kamatera) |
| Testing | **Inexistente** (solo scripts `tsx` manuales de smoke/ACL) |

### Diagrama de despliegue (producción)

```
                          Internet
                             │
                       ┌─────▼─────┐
                       │   Caddy   │  :80/:443  TLS automático, reverse proxy
                       └─────┬─────┘
                             │ :3000
                 ┌───────────▼────────────┐
                 │  app (Next.js 16)      │  web + API Routes (384 handlers)
                 └───┬─────────┬──────────┘
                     │         │
         ┌───────────▼──┐   ┌──▼────────────┐        ┌──────────────┐
         │ postgres:16  │   │ redis:7       │◄───────┤ worker (OCR) │
         │ (no expuesto)│   │ (no expuesto) │        │ BullMQ       │
         └──────────────┘   └──┬────────────┘        └──────┬───────┘
                               │                            │ HTTP
                     ┌─────────▼───────────┐        ┌───────▼────────┐
                     │ decision-engine-    │        │ ocr (FastAPI)  │ :8001
                     │ scheduler (loop)    │        │ Paddle/Tesseract│
                     └─────────────────────┘        └────────────────┘

        migrate: contenedor one-shot que ejecuta `prisma migrate deploy` antes de `app`.
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión / nota |
|---|---|---|
| Framework | **Next.js** (App Router) | `16.2.1`; `dev` con `--webpack`, React Compiler activo |
| UI | **React** | `19.2.1` |
| Lenguaje | **TypeScript** | `5.x`, `strict: true`, alias `@/*` → `src/*` |
| Estilos | **Tailwind CSS v4** | CSS-first (`@import "tailwindcss"`), sin `tailwind.config` |
| Componentes | Radix UI + kit propio tipo shadcn | `cva`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner` |
| Estado cliente | **Zustand** | uso marginal (~2 módulos) |
| Datos cliente | `fetch` manual | `@tanstack/react-query` instalado **sin uso** |
| Formularios | `react-hook-form` + `@hookform/resolvers` | |
| Validación | **Zod 4** | presente en ~18 archivos (12 rutas de 384) |
| ORM | **Prisma** | `7.6` con driver adapter `@prisma/adapter-pg` |
| Base de datos | **PostgreSQL** | `16-alpine` en prod; local en `:5433` |
| Autenticación | **NextAuth v5 (Auth.js) beta** | Credentials + Google, `@auth/prisma-adapter`, JWT |
| Hash de contraseñas | `bcryptjs` | |
| Colas | **BullMQ + ioredis** | OCR; Redis opcional en local |
| Documentos | `@react-pdf/renderer`, `exceljs`, `papaparse`, `qrcode` | PDFs, exportaciones, QR |
| Email | **Resend** | `src/lib/resend.ts` |
| Pagos | **Bold** | botón de pago + webhook |
| Facturación DIAN | Cliente propio | `src/lib/dian*`, rutas `/api/dian/*` |
| Almacenamiento | Disco local (`public/scans`, `public/uploads`) o **S3/Spaces** | opcional vía `S3_*` |
| OCR | **Python 3.12 + FastAPI + PaddleOCR + Tesseract (spa) + PyMuPDF** | `services/ocr` |
| Website builder | **`@puckeditor/core`** | 4 archivos |
| PWA | manifest + `public/sw.js` + Web Push (VAPID) | |
| Tours/Gráficas | `driver.js`, `recharts` | |
| Infra | Docker multi-stage, Docker Compose, Caddy | |
| Runtime Node | **22.22.0** (`.nvmrc`) | ⚠️ `Dockerfile` usa Node 20 → divergencia conocida |

### Dependencias declaradas sin uso

`stripe` (0 referencias en `src/` y `scripts/`) y `@tanstack/react-query` (0 referencias). Candidatas a eliminación o a adopción deliberada (ver §15).

---

## 3. Frontend

### 3.1 Enrutamiento y layouts

- **App Router puro**. No existen route groups (`(auth)`, `(dashboard)`) pese a lo que sugiere la documentación heredada.
- `src/app/layout.tsx` (layout raíz): HTML, fuentes, metadata PWA, scripts inline de arranque de tema y limpieza de service worker en desarrollo, y la cadena de providers:

  `ThemeProvider` → `PwaProvider` → `PushNotificationProvider` → `AuthProvider` → `I18nProvider` → toasts (`GlobalAlertToast`, `NotificationToastBridge`).

- `src/app/dashboard/layout.tsx` (server component): **es el punto de control de acceso de toda la UI privada**. Antes de renderizar hace:
  1. `auth()` y redirección a `/login` sin sesión.
  2. Resolución de **sede activa** y del **mapa de accesos** (RBAC v2 + legacy).
  3. Consultas de contexto: módulos habilitados por **plan**, vertical activa, backups, servicios web, nómina, "scope externo ROP".
  4. Render de `Sidebar`, `PlanModuleGate`, `OnboardingGate`, `DashboardPermissionBoundary`, banners de suscripción.
- **Páginas públicas** fuera de `/dashboard`: `/login`, `/sites/[slug]` y dominios propios del website builder, `/cotizacion/[token]`, formularios públicos, verificación DIAN.

### 3.2 Server vs Client

| Métrica | Valor |
|---|---|
| Archivos `.tsx` con `"use client"` | **206** |
| Archivos con `"use server"` (server actions) | **4** |
| `page.tsx` totales | **155** (132 en `/dashboard`) |

Patrón dominante: **página server** que consulta Prisma directamente y pasa props a un **componente cliente** que muta vía `fetch('/api/...')`. Las *server actions* son marginales; no hay una capa de datos cliente unificada.

### 3.3 Organización de componentes (`src/components`, 142 archivos)

| Carpeta | Contenido |
|---|---|
| `crm/` (35) | Conversaciones, chatbot studio, integraciones, capturas, marketing, SEO, tareas |
| `dashboard/` (32) | `sidebar.tsx`, gates de plan/onboarding, banners, shells |
| `ui/` (20) | Kit base tipo shadcn (button, dialog, input, table, …) |
| `litografia/` (13) | Calculadora, diálogo de cotización, acabados, flyers |
| `website-builder/` (6) | Integración Puck, bloques, panel |
| `providers/` (5) | Theme, Auth, i18n, toasts |
| `pwa/` (3) | Instalación, push |
| `pos/`, `pdf/`, `rop/`, `nomina/`, `contabilidad/`, `inventario/` | UI por vertical |

**Deuda relevante:** varios componentes superan los 250 KB de código (`crm-integrations-client.tsx` ≈ 475 KB, `crm-chatbot-studio-client.tsx` ≈ 432 KB, `litografia-quote-dialog.tsx` ≈ 363 KB). Concentran UI + estado + cálculo + llamadas de red en un archivo.

### 3.4 Estilos y design system

- **Tailwind v4 CSS-first**: tokens en `src/app/globals.css` (`@theme`, variables CSS por tema claro/oscuro).
- Tema conmutado por atributo `data-theme` (no por clase de Tailwind).
- Componentes base con `cva` para variantes; iconografía `lucide-react`; feedback `sonner`; guías interactivas `driver.js`.
- Layout responsive propio para el website builder (`.website-responsive-block` con variables por breakpoint).

### 3.5 Internacionalización

- Sistema **propio**, no `next-intl`.
- Diccionario único `src/lib/i18n/messages.ts` (**≈ 242 KB**), `Record<string, string>`, idiomas `es` (por defecto) y `en`.
- Servidor: `src/lib/i18n/server.ts` lee cookie `sgd_language` y expone `getServerI18n()`.
- Cliente: `I18nProvider` + `useI18n()`.
- Sin tipado de claves ni carga diferida por namespace; parte de las cadenas siguen *hardcodeadas* en componentes.

### 3.6 PWA

- `src/app/manifest.ts`, `public/sw.js`, `PwaProvider` (registro/limpieza del SW), `PwaInstallCta`, `PushNotificationProvider` con suscripción VAPID y sincronización de suscripciones por usuario.
- Notificaciones de servidor: `prisma.$extends` intercepta `notification.create/createMany` y dispara push/tiempo real.

---

## 4. Backend

### 4.1 Superficie de API

**384 `route.ts`** bajo `src/app/api`. No hay capa de controladores ni servidor aparte: cada archivo es a la vez router, controlador, validador, autorizador y, con frecuencia, caso de uso.

| Módulo | Rutas | Módulo | Rutas |
|---|---|---|---|
| `crm` | 80 | `public` (formularios, sitios, verificación) | 12 |
| `servicios-web` | 24 | `cotizaciones` | 11 |
| `nomina` | 23 | `escaneos` | 10 |
| `litografia` | 19 | `dian` / `decision-engine` / `configuracion` | 9 c/u |
| `rop` | 15 | `inventario` / `respaldo` / `remisiones` / `ordenes` / `auth` / `compras` / `contabilidad` | 7 c/u |
| `admin` / `super-admin` | 14 c/u | `materiales` 6, `help-tickets` 5, `notificaciones`, `usuarios`, `clientes`, `proveedores`, `sedes`, `empresa`, … | 1–5 c/u |

**Convenciones observadas**

- Respuesta: convive `{ success: true }` (≈201 rutas) con `{ ok: true }` (≈139) y errores `{ error: string }` sin código ni `requestId`.
- Validación: `request.json()` manual en la mayoría; Zod en 12 rutas.
- Manejo de errores: `try/catch` + `console.error` + `500` genérico (≈226 rutas).
- Rutas de alias que reexportan otro handler: `api/sales/create` → `api/pos/facturas`; `api/cotizacion-template` → `api/templates/cotizacion`.

### 4.2 Autorización de API

`src/lib/api-rbac.ts` (≈18 KB) es el guardián central:

| Helper | Uso | Función |
|---|---|---|
| `requireApiAccess({ module, level })` | 152 rutas | Sesión + sede + membership + `AccessLevel` legacy |
| `requireCapabilityAccess(capability)` | 90 rutas | RBAC v2 (`domain.subdomain.action` + scope) |
| `getActiveSedeForUser()` | 2 rutas | Contexto de sede |
| Guardas ad-hoc | resto | `requireWebsiteBuilderAccess`, `requireWorkspaceTaskCapability`, `getGanttPlanAccess`, `scope externo ROP` por cookie, `X-API-Key` para jobs |

Cada guard resuelve: `auth()` → `User` → `Empresa` → `Sede` → `SedeMembership` → mapa de capabilities ⇒ **4–6 consultas por request** solo para autorizar, sin caché.

### 4.3 Lógica de negocio

Vive en `src/lib` (227 archivos, ~180 en la raíz de la carpeta). Módulos destacados por tamaño: `rop.ts` (~60 KB), `crm-files.ts` (~49 KB), `crm-omnichannel.ts` (~40 KB), `empresa-backups.ts` (~35 KB), `auth.ts` (~12 KB), `api-rbac.ts` (~18 KB), `prisma.ts` (~17 KB), `decision-engine/` (≈30 archivos con *collectors*, *analyzers*, *summarizers*).

No hay repositorios, casos de uso ni entidades de dominio: los helpers reciben y devuelven tipos de Prisma.

### 4.4 Middleware (`src/proxy.ts`)

En Next.js 16 el middleware se denomina *proxy*. `matcher: '/:path*'` y sus responsabilidades son:

1. Rewrite de `/uploads/*` → `/api/uploads/*`.
2. Headers de seguridad y CSP para sitios públicos del website builder.
3. **Resolución de dominio → sitio**: hace `fetch` HTTP al propio backend (`/api/public/sites/resolve-host`) y redirige 308 al dominio canónico.
4. **No verifica sesión**: la protección de UI vive en `dashboard/layout.tsx` y la de API en cada handler.

### 4.5 Trabajos asíncronos

| Mecanismo | Implementación | Protección |
|---|---|---|
| Cola OCR | `src/lib/ocr-queue.ts` (BullMQ) + `scripts/ocr-worker.ts` | `REDIS_URL`, `OCR_WORKER_CONCURRENCY` |
| Cron HTTP | `/api/admin/jobs/*` (SEO rank tracker, auditorías, search console, messenger, recordatorios) | `X-API-Key: $ADMIN_API_KEY` |
| Scheduler | contenedor `decision-engine-scheduler` → snapshots consolidados | `DECISION_ENGINE_SNAPSHOT_*` |
| Scripts manuales | 39 scripts `tsx` (seeds, smoke, ACL, perf, backfills) | `npm run <script>` |

### 4.6 Reglas de negocio distribuidas en el cliente

Parte del cálculo (precios de litografía, totales, armado de PDF) existe **tanto en servidor como en componentes cliente**, lo que duplica fuentes de verdad. Es una de las deudas registradas en §15.

---

## 5. Base de datos

### 5.1 Motor y acceso

- **PostgreSQL 16** (prod). Local: `localhost:5433`.
- **Prisma 7** como único acceso (el SQL crudo se limita a scripts puntuales en `scripts/sql/`).
- `src/lib/prisma.ts`: `Pool` de `pg` cacheado en `globalThis` + `PrismaPg` adapter; log de queries en desarrollo; `$extends` para notificaciones; y un mecanismo de detección de "drift del cliente" (≈100 comprobaciones de campos/delegates) que recrea el cliente tras `prisma generate` en caliente.
- `prisma.config.ts` en la raíz del proyecto (Prisma 7 lee la configuración de ahí).

### 5.2 Dimensiones del esquema

| Métrica | Valor |
|---|---|
| Líneas de `prisma/schema.prisma` | **7.450** |
| Modelos | **205** |
| Enums | **131** |
| Migraciones | **158** (última: `20261009120000_crm_google_ads_attribution`) |
| Archivo de esquema | **único** (no multi-file) |

### 5.3 Modelo multi-tenant

```
Empresa (tenant / cuenta de facturación)
  ├── Sede (unidad operativa, N por empresa)
  │     ├── SedeMembership (usuario ↔ sede, rol)
  │     ├── secuencias: CotizacionSequence · PosSequence · RemisionSequence · HelpTicketSequence
  │     └── datos operativos: cotizaciones, POS, inventario, órdenes, remisiones…
  ├── User (identidad; empresaId nullable para SUPER_ADMIN)
  ├── plan/entitlements: planTier, PlanModuleSetting, EmpresaModuleOverride,
  │                      DomainEntitlement, CapabilityEntitlement
  └── verticales: litografía, odontología, restaurante, dotaciones, ROP, website
```

- **Discriminación por columna**: casi todas las tablas llevan `empresaId` y/o `sedeId`; **no hay RLS** ni extensión de Prisma que imponga el filtro.
- **Sede activa implícita**: se deriva de `User.sedeDefaultId`, no de un parámetro explícito de la petición.
- **Borrado lógico**: `archivedAt` en las entidades principales.
- **Concurrencia**: consecutivos por sede con tablas de secuencia (no `autoincrement` global).

### 5.4 Familias de modelos

| Dominio | Ejemplos |
|---|---|
| Tenancy/identidad | `Empresa`, `Sede`, `SedeMembership`, `User`, `Account`, `Session`, `Role`, `Capability` |
| Ventas | `Cotizacion`, `ItemCotizacion`, `CotizacionSequence`, `CotizacionAuditEvent`, `Remision`, `RemisionItem`, `PosInvoice*`, `PosSequence` |
| Plantillas | `CotizacionTemplate`, `EmpresaCotizacionTemplate` (+ `*Version`), `RemisionTemplate`, `OrdenCompraTemplate`, `PosInvoiceTemplate`, `WebsiteServiceMessageTemplate`, `PayrollWorkflowTemplate` |
| CRM | leads, conversaciones, mensajes, `CrmChannelConnection`, capturas, tareas, `CrmGanttPlan`, campañas y atribución Google Ads |
| Marketing/SEO | proyectos, keywords, rankings, auditorías, Search Console, formularios públicos |
| Inventario | `Material`, `MaterialAllowedTerminado`, `SedeMaterialWaste`, `MaterialQuantityDiscount`, bodegas y movimientos |
| Producción | `OrdenTrabajo`, acabados litográficos, tarifas de flyers |
| Compras | órdenes de compra, `CompraPago`, proveedores |
| Nómina | contratos, periodos, novedades, `PayrollWorkflowTemplate`, recordatorios |
| Contabilidad | asientos, cuentas, conciliaciones |
| DIAN | documentos electrónicos, estados, resolución de numeración |
| Website builder | sitios, páginas/bloques Puck, dominios, formularios, mensajes |
| ROP (marketplace) | catálogo, cotizaciones B2B, conversaciones, membresías |
| Decision engine | snapshots consolidados y métricas |
| Plataforma | notificaciones, push subscriptions, backups, help tickets, auditoría, jobs |

### 5.5 Almacenamiento de archivos

- Disco: `public/uploads/`, `public/scans/`, `.runtime-data/` (runtime de IA/CRM), `storage/backups/`.
- Objetos: **S3/Spaces** opcional; si `S3_BUCKET` está vacío se usa disco local.
- Los archivos servidos por `/uploads/*` pasan por un rewrite a `/api/uploads/*`, donde se aplica control de acceso.

### 5.6 Rendimiento

Scripts dedicados: `perf:benchmark`, `perf:analyze`, `perf:startup`, `perf:indexes`, `perf:apply-indexes`. `PERFORMANCE.md` documenta índices y *hot paths*.

---

## 6. Autenticación y autorización

### 6.1 Autenticación (`src/lib/auth.ts`)

- **NextAuth v5 / Auth.js** con `PrismaAdapter` y estrategia **JWT**.
- Proveedores: **Credentials** (email + `bcryptjs`) y **Google OAuth** (opcional).
- Endurecimiento ya implementado:
  - Expiración **por inactividad** y **absoluta**, con duración distinta según "recordarme".
  - Sanitización del token para evitar cookies sobredimensionadas.
  - **Suplantación de usuario** (*impersonation*) con token de un solo uso y marca en la sesión.
  - Verificación de email (`VerificationToken`) y recuperación de contraseña con Resend.
- `AUTH_TRUST_HOST=true` es necesario en self-hosted para evitar `UntrustedHost`.
- Rutas: `src/app/api/auth/[...nextauth]/route.ts` + endpoints auxiliares (registro, verificación, recuperación).

### 6.2 Autorización: cuatro capas que conviven

| Capa | Modelo | Dónde se evalúa |
|---|---|---|
| **1. AccessLevel legacy** | `ModuleKey` × `NONE/READ/WRITE/ADMIN` | `requireApiAccess`, `dashboard-access.ts`, sidebar |
| **2. RBAC v2** | `Capability` = `domain.subdomain.action` + `scope` (`OWN`/`SEDE`/`EMPRESA`/`GLOBAL`), agrupadas en `Role` por empresa | `requireCapabilityAccess`, `getEffectiveAccessMap` |
| **3. Entitlements de plan** | `planTier` + `PlanModuleSetting` (default por tier) + `EmpresaModuleOverride` + `DomainEntitlement`/`CapabilityEntitlement` | `plan-modules.ts`, `PlanModuleGate`, guards de API |
| **4. Reglas de vertical/contexto** | vertical activa (litografía, odontología, restaurante…), "scope externo ROP" por cookie, flags por empresa | `dashboard/layout.tsx`, guardas ad-hoc |

**Efecto neto:** el acceso resulta de la intersección de las cuatro capas, con múltiples *fallbacks* (`allowLegacyFallback`) y sin un resolvedor único ni caché. Consecuencias: latencia alta en autorización, comportamiento difícil de predecir y riesgo de endpoints sin guarda.

### 6.3 Red de seguridad actual

`seed:rbac-v2`, `rbac:reset`, `test:dashboard-access-rbac`, `test:ai-history-acl`, `test:crm-files-acl` son, hoy, la única verificación del modelo de permisos. No hay tests automáticos en CI.

---

## 7. Estructura de carpetas

```
cotizador-inteligente/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # providers globales, PWA, tema
│   │   ├── page.tsx                # landing / redirección
│   │   ├── manifest.ts             # PWA
│   │   ├── globals.css             # Tailwind v4 + tokens de tema
│   │   ├── login/ ...              # autenticación y flujos públicos
│   │   ├── dashboard/              # 132 páginas privadas
│   │   │   ├── layout.tsx          # control de acceso + gating de plan
│   │   │   ├── page.tsx            # home con queries Prisma
│   │   │   ├── configuracion/ (36 archivos)
│   │   │   ├── contabilidad/ (26) · nomina/ (18) · crm/ (16) · rop/ (10)
│   │   │   ├── litografia/ · pos/ · inventario/ · compras/ · ordenes/
│   │   │   ├── restaurante/ · dotaciones/ · website/ · reportes/ …
│   │   ├── api/                    # 384 route.ts (ver §4)
│   │   ├── sites/[slug]/           # sitios publicados del website builder
│   │   └── uploads/                # (vacío; rewrite en proxy.ts)
│   ├── components/                 # 142 archivos (crm, dashboard, ui, litografia, …)
│   ├── hooks/                      # 5 hooks compartidos
│   ├── lib/                        # 227 archivos: dominio + integraciones + infra
│   │   ├── auth.ts                 # NextAuth
│   │   ├── prisma.ts               # cliente Prisma + extensiones
│   │   ├── api-rbac.ts             # guards de API
│   │   ├── rbac.ts                 # sede activa, accesos efectivos
│   │   ├── plan-catalog.ts / plan-modules.ts
│   │   ├── decision-engine/        # collectors · analyzers · summarizers
│   │   ├── i18n/                   # messages.ts (≈242 KB) + server.ts
│   │   └── crm-*.ts, litografia-*.ts, rop*.ts, payroll-*.ts, …
│   ├── pages/                      # VACÍO (legado Pages Router)
│   ├── types/                      # tipos compartidos (redefinen tipos de Prisma)
│   └── proxy.ts                    # middleware Next 16
├── prisma/
│   ├── schema.prisma               # 205 modelos / 131 enums / 7.450 líneas
│   └── migrations/                 # 158 migraciones
├── scripts/                        # 39 scripts tsx (seeds, smoke, ACL, perf, SQL)
├── services/ocr/                   # FastAPI + PaddleOCR (+ Dockerfile propio)
├── public/                         # assets, sw.js, uploads/, scans/
├── .runtime-data/                  # estado en disco de IA/CRM
├── storage/backups/                # backups locales
├── caddy/                          # Caddyfile
├── Dockerfile                      # stages: web · worker · migrate
├── docker-compose.prod.yml         # postgres · redis · ocr · migrate · app · caddy · worker · scheduler
├── docker-compose.ocr.yml · docker-compose.queue.yml
├── prisma.config.ts · next.config.ts · tsconfig.json · eslint.config.mjs
├── .nvmrc                          # 22.22.0
└── *.md                            # 48 documentos en la raíz (ver §15)
```

**Convenciones:**

- Alias `@/*` → `src/*` (configurado en `tsconfig.json`).
- Componentes por dominio en `src/components/<dominio>/`; kit genérico en `ui/`.
- Un `route.ts` por endpoint, con subcarpeta por recurso y `[id]` para parámetros dinámicos.
- Migraciones con nombre `YYYYMMDDHHMMSS_descripcion` (sellar con `prisma migrate dev`).

---

## 8. Módulos principales

| Módulo | UI | API | Lógica | Capacidades clave |
|---|---|---|---|---|
| **Cotizador / Ventas** | `dashboard/cotizaciones`, `components/litografia` | `api/cotizaciones`, `api/templates`, `api/sales` (alias) | `cotizacion-*`, `litografia-*` | Consecutivos por sede, plantillas versionadas, PDF, envío por email/WhatsApp, token público |
| **POS / Facturación interna** | `dashboard/pos`, `components/pos` | `api/pos` (13) | `pos-*` | Caja, medios de pago, Bold, `PosSequence`, `PosInvoiceTemplate` |
| **Litografía** | `dashboard/litografia` (13 componentes) | `api/litografia` (19) | `litografia-pricing`, `litografia-ai` | Cálculo por m²/insumos, acabados, tarifas de flyers, "cotice con IA" |
| **Remisiones / Órdenes** | `dashboard/remisiones`, `dashboard/ordenes` | `api/remisiones` (7), `api/ordenes` (7) | `remision-*`, `orden-trabajo-*` | Consecutivos, plantillas, estados de producción |
| **CRM omnicanal** | `dashboard/crm` (16) + 35 componentes | `api/crm` (80) | `crm-omnichannel`, `crm-files`, `crm-chatbot`, `crm-ai-*` | WhatsApp/IG/FB/Messenger, chatbot, capturas, tareas, Gantt, archivos, atribución |
| **Marketing / SEO** | `dashboard/crm/marketing`, `seo` | `api/crm/marketing`, `api/admin/jobs/seo-*` | `seo-rank-tracker`, `google-*`, `dataforseo` | Keywords, rankings, Search Console, auditorías, presupuesto de API |
| **Website builder** | `dashboard/website`, `components/website-builder` | `api/servicios-web` (24), `api/public` (12) | `website-*` | Puck, dominios propios, formularios con Turnstile, SEO, performance |
| **Inventario / Bodegas** | `dashboard/inventario` | `api/inventario` (7), `api/materiales` (6) | `inventory-*`, `material-*` | Stock por sede, movimientos, mermas, descuentos por cantidad |
| **Compras / Proveedores** | `dashboard/compras`, `dashboard/proveedores` | `api/compras` (7), `api/proveedores` | `purchase-*` | Órdenes de compra, pagos a proveedores, plantillas |
| **Nómina** | `dashboard/nomina` (18) | `api/nomina` (23) | `payroll-*` | Contratos, periodos, novedades, recordatorios, workflow |
| **Contabilidad** | `dashboard/contabilidad` (26) | `api/contabilidad` (7) | `accounting-*` | Asientos, cuentas, conciliaciones, reportes |
| **DIAN** | `dashboard/configuracion` | `api/dian` (9) | `dian-*` | Documentos electrónicos, numeración, estados |
| **ROP (marketplace)** | `dashboard/rop` (10) | `api/rop` (15) | `rop.ts` (~60 KB) | Catálogo, cotizaciones B2B, conversaciones, scope externo |
| **Verticales** | `dashboard/odontologia`, `restaurante`, `dotaciones` | rutas propias | seeds y catálogos | Habilitadas por empresa/vertical |
| **Motor de decisión** | `dashboard/reportes`, inteligencia | `api/decision-engine` (9) | `decision-engine/*` | Snapshots, analizadores, resúmenes consolidados |
| **Plataforma** | `configuracion/usuarios`, `sedes`, `empresa` | `api/usuarios`, `api/sedes`, `api/empresa`, `api/notificaciones`, `api/respaldo` (7), `api/help-tickets` (5), `api/super-admin` (14) | `rbac`, `plan-*`, `empresa-backups` | Usuarios, roles, capacidades, plan, backups, tickets, back-office |
| **Escaneos / OCR** | `dashboard/escaneos` | `api/escaneos` (10) | `ocr-queue`, `services/ocr` | Subida, cola, extracción de facturas, revisión |

---

## 9. Integraciones externas

| Proveedor | Propósito | Superficie en el código | Variables (sin valores) |
|---|---|---|---|
| **Meta** (WhatsApp, Instagram, Facebook, Messenger) | CRM omnicanal, webhooks, envío | `api/crm/*`, `api/public/webhooks/*`, `crm-omnichannel.ts` | `META_APP_ID`, `META_APP_SECRET`, `META_*_CONFIG_ID`, `CRM_CHANNEL_SECRET` |
| **Google OAuth** | Login social | `auth.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Google Marketing** (Ads, Analytics, Search Console) | Atribución y métricas SEO | `api/oauth/google-marketing/*`, `google-*.ts` | `GOOGLE_MARKETING_CLIENT_ID`, `GOOGLE_MARKETING_CLIENT_SECRET`, `GOOGLE_MARKETING_REDIRECT_URI`, `GOOGLE_ADS_API_VERSION`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` |
| **Google Sheets** | Exportación/importación | `google-sheets*.ts` | (reutiliza OAuth de marketing) |
| **DataForSEO** | Rank tracker y SERP | `api/admin/jobs/seo-*` | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_MODE`, `DATAFORSEO_MONTHLY_BUDGET_USD`, `DATAFORSEO_ESTIMATED_COST_PER_SERP_USD` |
| **PageSpeed Insights** | Auditorías de rendimiento web | `website-perf-*` | `PAGESPEED_API_KEY` |
| **Cloudflare Turnstile** | Anti-bot en formularios públicos | `api/public/*` | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTS` |
| **Resend** | Email transaccional | `resend.ts`, `email-*` | `RESEND_API_KEY`, `EMAIL_FROM`, `CONTABILIDAD_EMAIL` |
| **Bold** | Pagos en línea y webhook | `bold.ts`, `api/pos/*`, `api/servicios-web/*` | `BOLD_IDENTITY_KEY`, `BOLD_WEBHOOK_SECRET`, `BOLD_VERIFY_WEBHOOK` |
| **DIAN** | Facturación electrónica | `dian-*`, `api/dian/*` | Configuración por empresa (BD), sin claves globales |
| **S3 / DigitalOcean Spaces** | Almacenamiento de objetos | `s3.ts` | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` |
| **LLM OpenAI-compatible** (OpenAI / Ollama / OpenRouter / Groq) | IA litográfica y asistente | `litografia-ai-*.ts` | `LITOGRAFIA_AI_BASE_URL`, `LITOGRAFIA_AI_API_KEY`, `LITOGRAFIA_AI_MODEL`, `LITOGRAFIA_AI_PROVIDER` |
| **LLM para OCR** | Post-proceso del texto extraído | `services/ocr`, `llm-*` | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` |
| **Web Push (VAPID)** | Notificaciones push PWA | `push-*.ts`, `PushNotificationProvider` | `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` |
| **Telegram** | Notificaciones operativas | `telegram*.ts` | Token por empresa |
| **Daily.co** | Videollamadas del CRM | `crm-calls*` | API key por empresa |
| **Redis / BullMQ** | Cola de trabajos | `ocr-queue.ts`, `scripts/ocr-worker.ts` | `REDIS_URL`, `OCR_WORKER_CONCURRENCY` |

> Las credenciales de terceros se resuelven **por empresa** cuando el modelo lo permite (canales CRM, DIAN, pagos); las claves de plataforma viven en variables de entorno del contenedor.

---

## 10. Docker y servicios

### 10.1 Imagen de la aplicación (`Dockerfile`)

Multi-stage con tres objetivos:

| Stage | Uso | Notas |
|---|---|---|
| `web` | `app` (Next.js en producción) | `next build` + `next start`; `BUILD_MAX_OLD_SPACE_SIZE` controla la memoria del build |
| `worker` | `worker` (BullMQ OCR) | ejecuta `scripts/ocr-worker.ts` |
| `migrate` | job one-shot | `prisma migrate deploy` antes de arrancar `app` |

- Base actual: **`node:20-bookworm-slim`** (⚠️ divergente de `.nvmrc` = 22.22.0).
- El build **ya no ignora errores de tipos**: hasta el 27/10/2026 se lanzaba con `NEXT_DISABLE_BUILD_CHECKS=1` + `typescript.ignoreBuildErrors`; ambos se eliminaron en la Fase 1 (tareas 1.3 y 1.4). Un error de tipos **rompe la imagen**.
- **No** usa `output: 'standalone'`: la imagen incluye `node_modules` completo.

### 10.2 `docker-compose.prod.yml`

| Servicio | Rol | Exposición |
|---|---|---|
| `postgres` | PostgreSQL 16 | **solo red interna** |
| `redis` | Redis 7 (BullMQ) | **solo red interna** |
| `ocr` | FastAPI + PaddleOCR/Tesseract | **solo red interna** (`:8001`), con límites de CPU/memoria/PIDs |
| `migrate` | `prisma migrate deploy` | one-shot |
| `app` | Next.js | `:3000` interno |
| `caddy` | Reverse proxy + TLS automático | `:80/:443` público |
| `worker` | Consumidor BullMQ de OCR | interno |
| `decision-engine-scheduler` | Bucle de snapshots (`DECISION_ENGINE_SNAPSHOT_INTERVAL_SECONDS`) | interno |

Composes auxiliares: `docker-compose.ocr.yml` (OCR local) y `docker-compose.queue.yml` (Redis local).

### 10.3 Persistencia

- Volúmenes para datos de Postgres y para `public/uploads`, `public/scans`, `.runtime-data/` y `storage/backups/`.
- `.runtime-data/` guarda estado de IA/CRM que debe sobrevivir a reinicios.
- `caddy/Caddyfile` declara el dominio público y el proxy hacia `app`.

---

## 11. Variables de entorno

> Solo **nombres y propósito**. Los valores reales viven en el gestor de secretos o en el `.env` del servidor y **nunca** en el repositorio. Las variables `NEXT_PUBLIC_*` son visibles en el navegador y **no deben contener secretos**.

### 11.1 Núcleo

| Variable | Propósito |
|---|---|
| `APP_URL` | URL pública base (callbacks, links compartidos, PDF, webhooks) |
| `NEXTAUTH_URL` | URL de NextAuth |
| `NEXTAUTH_SECRET` | Firma de sesión/JWT y fallback de otros secretos |
| `AUTH_TRUST_HOST` | Requerido por Auth.js en self-hosted |
| `ADMIN_API_KEY` | Autentica `/api/admin/jobs/*` (cron/integraciones) |
| `SHARE_TOKEN_SECRET` | Firma de tokens públicos de cotización |
| `SUPER_ADMIN_EMAIL` | Cuenta de back-office |
| `BUILD_MAX_OLD_SPACE_SIZE` | Memoria máxima durante `next build` |

### 11.2 Base de datos y colas

`DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_URL`.

### 11.3 OCR

`OCR_SERVICE_URL`, `OCR_SERVICE_API_KEY`, `OCR_SYNC_FALLBACK`, `OCR_WORKER_CONCURRENCY`, `OCR_CPUS`, `OCR_MEM_LIMIT`, `OCR_MEM_RESERVATION`, `OCR_PIDS_LIMIT`, `OCR_OMP_NUM_THREADS`, `OCR_OPENBLAS_NUM_THREADS`, `OCR_MKL_NUM_THREADS`, `OCR_NUMEXPR_NUM_THREADS`, `DISABLE_MODEL_SOURCE_CHECK`.

### 11.4 Motor de decisión

`DECISION_ENGINE_SNAPSHOT_INTERVAL_SECONDS`, `DECISION_ENGINE_SNAPSHOT_LOCALE`, `DECISION_ENGINE_SNAPSHOT_ARGS`.

### 11.5 Email, pagos y notificaciones

`RESEND_API_KEY`, `EMAIL_FROM`, `CONTABILIDAD_EMAIL`, `BOLD_IDENTITY_KEY`, `BOLD_WEBHOOK_SECRET`, `BOLD_VERIFY_WEBHOOK`, `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`.

### 11.6 Sitios web y formularios públicos

`NEXT_PUBLIC_WEBSITE_BASE_DOMAIN`, `WEBSITE_DOMAIN_CNAME_TARGET`, `WEBSITE_DOMAIN_IPV4`, `WEBSITE_DOMAIN_IPV6`, `NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTS`, `PUBLIC_FORM_RATE_LIMIT_PER_MINUTE`, `PUBLIC_FORM_RATE_LIMIT_PER_HOUR`, `PUBLIC_FORM_RATE_LIMIT_CHANNEL_DAILY`.

### 11.7 Marketing y CRM

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MARKETING_CLIENT_ID`, `GOOGLE_MARKETING_CLIENT_SECRET`, `GOOGLE_MARKETING_REDIRECT_URI`, `GOOGLE_ADS_API_VERSION`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `META_WHATSAPP_CONFIG_ID`, `META_INSTAGRAM_CONFIG_ID`, `META_FACEBOOK_PAGE_CONFIG_ID`, `CRM_CHANNEL_SECRET`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_MODE`, `DATAFORSEO_MONTHLY_BUDGET_USD`, `DATAFORSEO_ESTIMATED_COST_PER_SERP_USD`, `PAGESPEED_API_KEY`.

### 11.8 IA y almacenamiento

`LITOGRAFIA_AI_BASE_URL`, `LITOGRAFIA_AI_API_KEY`, `LITOGRAFIA_AI_MODEL`, `LITOGRAFIA_AI_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`.

### 11.9 Build / flags

`NODE_ENV`. (`NEXT_DISABLE_BUILD_CHECKS` fue **eliminado** el 27/10/2026 — Fase 1, tarea 1.3.)

---

## 12. Cómo se ejecuta el proyecto

### 12.1 Requisitos

- **Node 22.22.0** (`.nvmrc`; en Windows es obligatorio para que `prisma generate` no falle por WASM).
- **PostgreSQL** accesible (local en `:5433` según `.env`, o Supabase/Docker).
- Opcional: **Docker** (OCR y Redis) y **Python 3.12** solo si el OCR se ejecuta fuera de Docker.

### 12.2 Desarrollo local

1. `nvm use 22.22.0`
2. `npm install` (dispara `postinstall` → `prisma generate`)
3. Crear `.env` con las variables de §11 (⚠️ hoy no existe plantilla versionada).
4. `npx prisma migrate dev` o `npm run prisma:migrate`
5. `npm run dev` → `http://localhost:3000` (`next dev --webpack`)
6. Seeds opcionales: `seed:rbac-v2`, `seed:accounting-sample`, `seed:litografia-*`, `seed:odontologia`, `seed:rop-catalog`.

Servicios opcionales:

- `docker compose -f docker-compose.ocr.yml up -d --build` → OCR en `:8001`
- `docker compose -f docker-compose.queue.yml up -d` → Redis en `:6379`
- `npm run worker:ocr` → worker BullMQ

### 12.3 Verificación

| Comando | Qué valida |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (hoy **pasa**) |
| `npm run lint` | ESLint (`eslint.config.mjs`) |
| `npm run build` | Build de producción |
| `npm run smoke:cotizaciones` | Flujo de cotizaciones contra BD real |
| `npm run test:cotizacion-sequence` | Concurrencia de consecutivos |
| `npm run test:decision-engine` | Slices del motor de decisión |
| `npm run test:dashboard-access-rbac` / `test:*-acl` | Matriz de permisos |
| `npm run perf:*` | Rendimiento y plan de índices |

### 12.4 Producción

Con los secretos fuera del repositorio:

`docker compose -f docker-compose.prod.yml up -d --build`

Orden efectivo: `postgres`/`redis` → `migrate` (deploy de migraciones) → `app` + `worker` + `decision-engine-scheduler` → `caddy` publica TLS. Guía operativa: `DEPLOY-KAMATERA.md`.

### 12.5 Tareas de VS Code

`.vscode/tasks.json` expone tareas para `dev`, `typecheck`, `prisma` y smoke tests.

---

## 13. Dependencias críticas

Dependencias cuya rotura o actualización mal gestionada detiene el negocio.

| Dependencia | Por qué es crítica | Riesgo de actualizar |
|---|---|---|
| **Next.js 16** | Framework de toda la app; App Router, `proxy.ts`, Turbopack/Webpack, React Compiler | Alto: cambios de API de middleware, caching y params asíncronos |
| **React 19** | Renderizado, `use`/Suspense, React Compiler | Medio–alto: warnings y patrones obsoletos |
| **Prisma 7** | Único acceso a datos; genera 205 modelos; requiere adapter `pg` | Alto: cambios de configuración (`prisma.config.ts`), generación WASM y `PrismaClient` |
| **`pg`** | Pool de conexiones compartido | Medio: tuning de `max`, timeouts y saturación de conexiones |
| **NextAuth v5 (beta)** | Sesión de todos los usuarios; **versión beta** en producción | Alto: cambios de API entre betas; migraciones de sesión |
| **PostgreSQL 16** | Fuente de verdad transaccional | Medio: migraciones de 158 pasos |
| **Tailwind v4** | Todo el estilo; CSS-first sin config JS | Medio: tokens y variantes |
| **Zod 4** | Validación (donde existe) | Medio: sintaxis de mensajes/errores |
| **BullMQ + ioredis** | Procesamiento OCR asíncrono | Bajo–medio |
| **PaddleOCR / Tesseract** | Extracción de documentos | Medio: modelos y dependencias nativas del contenedor Python |
| **`@react-pdf/renderer`** | PDFs de cotizaciones/facturas | Medio: requiere `transpilePackages` |
| **Puck (`@puckeditor/core`)** | Editor del website builder | Medio–alto: cambios de esquema de bloques |
| **Caddy** | TLS y proxy de todos los dominios, incluidos dominios de clientes | Medio: configuración de dominios dinámicos |
| **Node 22.22.0** | Prisma y Next en local/Docker | Divergencia actual con el Dockerfile (Node 20) |

**Versiones ancladas:** `package.json` usa versiones exactas (sin `^`) para las dependencias principales y `package-lock.json` está versionado. Los `engines` no están declarados: conviene añadirlos junto con `.nvmrc`.

---

## 14. Flujo general de datos

### 14.1 Petición autenticada (UI privada)

```
Navegador
  └─► Caddy ──► app (proxy.ts)                 # headers, rewrite /uploads, dominios de sitios
        └─► dashboard/layout.tsx (server)       # auth() + sede activa + accesos + plan
              └─► page.tsx (server)             # Prisma directo para la carga inicial
                    └─► componente cliente
                          └─► fetch('/api/...')
                                └─► route.ts
                                      ├─ 1. guarda (requireApiAccess / requireCapabilityAccess)
                                      ├─ 2. parseo del body/query
                                      ├─ 3. lógica en src/lib
                                      ├─ 4. Prisma (pool pg) ──► PostgreSQL
                                      └─ 5. respuesta JSON
```

### 14.2 Petición de API (resumen por pasos)

1. **Entrada** por `app`; `proxy.ts` aplica headers/rewrite si corresponde.
2. **Autenticación**: `auth()` decodifica el JWT (sin consultar la BD salvo que se requiera el usuario).
3. **Autorización**: el guard resuelve usuario → empresa → sede → membership → capabilities + plan (4–6 consultas).
4. **Validación**: manual o con Zod.
5. **Dominio**: helpers de `src/lib`.
6. **Persistencia**: Prisma sobre el pool compartido; `$extends` puede disparar notificaciones push.
7. **Respuesta**: `{ success }` u `{ ok }`, con errores en texto plano.

### 14.3 Escritura transaccional con consecutivo (patrón crítico)

```
POST /api/cotizaciones
  → autorización
  → $transaction:
       CotizacionSequence (UPDATE … RETURNING / incremento atómico por sede)
       Cotizacion + ItemCotizacion + CotizacionAuditEvent
  → posible evento: notificación, PDF, envío email/WhatsApp
```

### 14.4 OCR asíncrono

```
UI escaneos → POST /api/escaneos (sube archivo)
            → encola en BullMQ (Redis)
worker:ocr  → POST http://ocr:8001/...  (PaddleOCR/Tesseract)
            → post-proceso (opcional LLM)
            → escribe resultado en BD + archivos (disco o S3)
            → notifica al usuario (push/tiempo real)
Si Redis no está disponible: fallback síncrono (`OCR_SYNC_FALLBACK`) o error controlado.
```

### 14.5 Sitios del website builder (dominios de clientes)

```
Host desconocido → proxy.ts → fetch interno /api/public/sites/resolve-host
                 → 308 al dominio canónico o render de /sites/[slug]
                 → CSP y headers específicos de sitio público
```

> Este `fetch` interno en el camino caliente es un punto de latencia y acoplamiento (ver §15).

### 14.6 CRM omnicanal (entrada externa)

```
Meta (WhatsApp/IG/FB) ──webhook──► /api/public/webhooks/* (verificación de firma)
     → CrmChannelConnection (tokens cifrados con CRM_CHANNEL_SECRET)
     → CrmConversation / CrmMessage
     → chatbot (reglas o IA) → respuesta saliente vía Graph API
     → notificación al agente (push)
```

### 14.7 Cobros y facturación

- **Bold**: checkout desde POS/servicios web → webhook firmado → actualización de estado de pago.
- **DIAN**: generación de documento → envío al proveedor tecnológico → estados y numeración por empresa.

### 14.8 Jobs programados

`cron` del host → `POST /api/admin/jobs/*` con `X-API-Key` → proceso por lotes → escritura en BD/archivos. El *scheduler* de snapshots corre en su propio contenedor con un bucle de intervalo.

---

## 15. Recomendaciones arquitectónicas

Ordenadas por relación **riesgo/beneficio**. Ninguna implica microservicios ni múltiples bases de datos (ver §15.9).

### 15.1 Seguridad y cadena de suministro (primero)

1. **Rotar** todas las credenciales que hayan estado en texto plano (Resend, Bold, `NEXTAUTH_SECRET`, `ADMIN_API_KEY`, VAPID privada, S3) y centralizarlas en un gestor de secretos.
2. ✅ **Hecho (27/10/2026):** `.env*` excluido en `.gitignore` salvo las tres plantillas (`!.env.example`, `!.env.docker.example`, `!.env.litografia-ia.example`), todas **sin valores reales**.
3. ✅ **Hecho en CI (27/10/2026):** `gitleaks` **bloqueante** en `.github/workflows/secret-scan.yml` sobre todo el historial. ⏳ Pendiente el *pre-commit* (tarea 0.8).
4. ✅ **Hecho (27/10/2026):** `NEXT_DISABLE_BUILD_CHECKS` fuera del `Dockerfile` y `typescript.ignoreBuildErrors` fuera de `next.config.ts`; `npm run typecheck` y `npm run build` ya fallan ante errores de tipos.

### 15.2 Un único modelo de autorización

Consolidar las cuatro capas de §6.2 en **un resolvedor por request**:

- Contexto explícito de tenant: sede/empresa derivada de la petición (cabecera o cookie firmada) **validada** contra la membership, nunca inferida en silencio.
- `resolveAccessContext()` devuelve `{ empresaId, sedeId, rol, capabilities, módulos del plan }`, cacheado por request y en Redis con invalidación por versión.
- Un solo wrapper de API (`withApiHandler`) que exige **capacidad declarada**; ningún `route.ts` sin guarda.
- Deprecar `AccessLevel`/`ModuleKey` mediante *shim* con observabilidad (`legacy.used`) y eliminar cuando llegue a cero.

### 15.3 Aislamiento de datos garantizado, no disciplinado

1. Extensión de Prisma que inyecte `empresaId`/`sedeId` en toda operación sobre modelos *tenant-scoped* (lista declarativa) y **falle** si una escritura masiva no los incluye.
2. **PostgreSQL RLS** como defensa en profundidad (rol de aplicación + `SET LOCAL app.empresa_id` por transacción), después de la extensión y con tests de aislamiento.
3. Suite obligatoria: matriz empresa A × empresa B sobre los 20 endpoints más sensibles.

### 15.4 Backend por capas (estrangular, no reescribir)

- Estructura objetivo: `src/server/modules/<dominio>/{schema,controller,service,repository}.ts` + `src/server/core/{http,auth,validation,logging,events}`.
- Regla de oro: **todo endpoint que se toque se migra**; ningún PR añade lógica nueva a una ruta no migrada.
- Contador de rutas migradas verificado por script: no puede retroceder.
- Contrato único de respuesta `{ ok, data | error: { code, message, requestId } }` y mapeo centralizado de errores de Prisma/Zod.

### 15.5 Frontend sostenible

- Límite de tamaño por archivo (ESLint `max-lines`, primero `warn`, luego `error`) y presupuesto de bundle en CI.
- Separar UI / estado / dominio: la lógica pura (precios, totales, fechas) a `src/lib/domain/*`, compartida por servidor y cliente.
- Adoptar **una** capa de datos cliente (React Query o SWR) o eliminar la dependencia no usada; hoy hay `fetch` manual disperso.
- Reducir `"use client"` moviendo providers y páginas estáticas a servidor; medir el conteo como métrica de progreso.
- i18n: claves tipadas y diccionarios por namespace con carga diferida.

### 15.6 Prisma y dominio

- Dividir `schema.prisma` por dominios (multi-file schema de Prisma) manteniendo **una sola base de datos**.
- Consolidar plantillas (`CotizacionTemplate`/`EmpresaCotizacionTemplate` y las demás `*Template`) en un modelo polimórfico con `kind`+`scope`, y las secuencias (`*Sequence`) en una tabla `DocumentSequence(documentType, sedeId, next)`.
- Unificar `DomainEntitlement`/`CapabilityEntitlement`/`PlanModuleSetting`/`EmpresaModuleOverride` en una sola tabla de entitlements.
- No duplicar reglas de cálculo entre servidor y cliente.

### 15.7 Operación

- **Node 22** en Docker, `output: 'standalone'`, imagen mínima y `npm ci --omit=dev` en runtime.
- **CI/CD** obligatorio: `lint` + `typecheck` + `test` + `build` en cada PR; despliegue desde una imagen versionada.
- **Observabilidad**: logs JSON con `requestId`, duración, `empresaId` y `route`; métricas de latencia por endpoint; captura de errores (Sentry o equivalente).
- Quitar el `fetch` interno del proxy y cachear la resolución host → sitio.
- Sacar los `ensure*` (creación implícita de sede/plan) del camino de lectura.

### 15.8 Documentación y limpieza

- Un `README.md` real (hoy es el de `create-next-app`) y `/docs` con índice; ADRs en `docs/adr/`.
- Eliminar `tsc-trace.txt` (8,4 MB), `tmp-*` y artefactos; `.gitignore` para logs y trazas.
- Eliminar dependencias muertas (`stripe`, decidir sobre `@tanstack/react-query`) y directorios vacíos (`src/pages`, `src/app/uploads`).
- Reconciliar `.github/copilot-instructions.md` (habla de Next.js 14 y route groups inexistentes).

### 15.9 No objetivos explícitos (por ahora)

- **No** dividir en microservicios: el dominio comparte transacciones (cotización ↔ inventario ↔ contabilidad) y el equipo es pequeño; el coste operativo superaría el beneficio.
- **No** migrar a múltiples bases de datos: el aislamiento se resuelve con tenant scoping + RLS, no con particionado físico.
- **No** reescribir el frontend ni cambiar de ORM: el valor está en ordenar y endurecer lo existente.

---

## 16. Riesgos y deuda técnica registrada

| ID | Riesgo | Severidad | Impacto |
|---|---|---|---|
| P-1 | Handlers con lógica + Prisma + RBAC, sin capas | Alta | Duplicación, tests imposibles |
| P-2 | Multi-tenancy por filtro manual, sin RLS | **Crítica** | Fuga de datos entre empresas |
| P-3 | Cuatro sistemas de autorización y guardas dispersas | **Crítica** | Endpoints sin proteger, latencia |
| P-4 | Cero tests y sin CI | **Crítica** | Regresiones en producción |
| P-5 | Build ignora errores de tipos | **Crítica** | Despliegues defectuosos |
| P-6 | Componentes de 300–475 KB | Media | Bundles y mantenibilidad |
| P-7 | Esquema único de 205 modelos | Alta | Migraciones arriesgadas |
| P-8 | Zod en 12 de 384 rutas | Alta | Datos inválidos, mass-assignment |
| P-9 | Lógica de negocio duplicada en cliente | Media | Totales inconsistentes |
| P-10 | Sin contrato de errores ni observabilidad | Alta | Diagnóstico lento |
| P-11 | `fetch` interno en el proxy | Media | Latencia y acoplamiento |
| P-12 | Escrituras en rutas de lectura | Alta | Latencia y bloqueos |
| P-13 | Node 20 en Docker vs 22 en local | Media | Divergencia de entorno |
| P-14 | Sin `output: standalone` | Media | Imagen grande, RAM alta |
| P-15 | Secretos en texto plano y plantillas con valores | **Crítica** | Credenciales comprometidas |
| P-16 | 48 `.md` en la raíz + artefactos versionados | Baja | Onboarding lento |
| P-17 | Endpoints y modelos duplicados | Media | Ambigüedad funcional |
| P-18 | Dependencias y directorios muertos | Baja | Ruido |
| P-19 | i18n monolítico de 242 KB | Media | Rendimiento y mantenibilidad |
| P-20 | Gating de 4 capas sin matriz documentada | **Crítica** | Comportamiento impredecible |

El plan de remediación por fases (objetivos, criterios de aceptación y estrategia incremental) se mantiene fuera de este documento para no acoplarlo a la descripción del sistema actual.

---

## Mantenimiento de este documento

- Actualizar al **cambiar la arquitectura**, no en cada feature.
- Toda cifra (rutas, modelos, migraciones, líneas) debe indicar fecha de medición.
- Si una recomendación de §15 se implementa, moverla a la sección descriptiva correspondiente y registrar el ADR.
- Última verificación de cifras: **27/10/2026** (`develop`, árbol limpio, `npm run typecheck` sin errores).
