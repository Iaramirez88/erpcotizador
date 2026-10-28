# PLAN-MAESTRO-REFACTORIZACION.md — Ordex / SGDigital

Documento de ejecución del programa de refactorización de **`cotizador-inteligente`** (producto **Ordex** / SG Digital).

- **Naturaleza:** documento **vivo y ejecutable**. Se actualiza a medida que se avanza; el estado de cada tarea se marca aquí, no en la memoria de nadie.
- **Documento hermano:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) describe el **estado real del sistema** (fotografía al 27/10/2026). Este documento describe el **camino** para cambiarlo. Si divergen, manda `ARCHITECTURE.md` y hay que corregir este plan.
- **Regla:** aquí **no hay secretos**. Los secretos se referencian por nombre; los valores viven en el gestor de secretos y, en local, en `.env` (nunca versionado).

| Campo | Valor |
|---|---|
| Versión del plan | **1.0** |
| Fecha de creación | 27/10/2026 |
| Rama base analizada | `develop` |
| Alcance | Fases 0 → 7 (88–127 días de esfuerzo) |
| Equipo supuesto | 1 dev senior full-time + 1 apoyo parcial (revisión/QA); 1 día = 6 h efectivas |
| Estado global | **0 % — ninguna fase iniciada** |

---

## Índice

| § | Sección | Contenido |
|---|---|---|
| 0 | [Cómo usar este documento](#0-cómo-usar-este-documento) | Leyenda de estados, disciplina del tablero, comandos de verificación |
| 1 | [Tablero de progreso](#1-tablero-de-progreso) | Estado por fase, ruta crítica, calendario de sprints |
| 2 | [Línea base medida](#2-línea-base-medida-27102026) | Cifras de partida (27/10/2026) |
| 3 | [Fase 0 — Seguridad inmediata](#3-fase-0--seguridad-inmediata) | Secretos, rotación, plantillas de entorno · 19 tareas |
| 4 | [Fase 1 — Calidad y ciclo de desarrollo](#4-fase-1--calidad-y-seguridad-del-ciclo-de-desarrollo) | CI, Vitest, Playwright · 30 tareas |
| 5 | [Fase 2 — Multi-tenancy y autorización](#5-fase-2--multi-tenancy-y-autorización) | Contexto único, tenant scoping, RLS · 30 tareas |
| 6 | [Fase 3 — Arquitectura backend](#6-fase-3--arquitectura-backend) | Capas, wrapper, Zod, contrato de errores · 24 tareas |
| 7 | [Fase 4 — Frontend](#7-fase-4--frontend) | Componentes gigantes, dominio, `use client`, i18n · 20 tareas |
| 8 | [Fase 5 — Prisma y dominio](#8-fase-5--prisma-y-dominio) | Esquema por dominios, duplicados · 17 tareas |
| 9 | [Fase 6 — Infraestructura](#9-fase-6--infraestructura) | Node 22, `standalone`, observabilidad, CI/CD · 16 tareas |
| 10 | [Fase 7 — Limpieza y documentación](#10-fase-7--limpieza-y-documentación) | README, `docs/`, ADRs, artefactos · 15 tareas |
| 11 | [Registro de problemas P-1…P-20](#11-registro-de-problemas-p-1--p-20) | Priorización, checklist de cierre, definición de "cerrado" |
| 12 | [KPIs de éxito](#12-kpis-de-éxito-del-programa) | Inicial vs meta vs actual |
| 13 | [Reglas de oro](#13-reglas-de-oro-del-programa) | Disciplina permanente |
| 14 | [Bitácora de ejecución](#14-bitácora-de-ejecución) | Hitos, bloqueos, decisiones |
| 15 | [Control de cambios](#15-control-de-cambios-del-documento) | Versiones de este plan |
| 16 | [Mantenimiento](#16-mantenimiento-de-este-documento) | Cómo y cuándo se actualiza |

**Total de tareas accionables: 171** (19 + 30 + 30 + 24 + 20 + 17 + 16 + 15).

---

## 0. Cómo usar este documento

### 0.1 Leyenda de estados

| Marca | Significado | Cuándo se usa |
|---|---|---|
| `- [ ]` | Pendiente | Nadie lo ha empezado |
| `- [~]` | En curso | Hay trabajo activo en una rama |
| `- [x]` | Hecho | Existe evidencia verificable (comando verde, PR mergeado, documento publicado) |
| `- [!]` | Bloqueado | Hay un impedimento externo; se anota en la columna *Bloqueadores* del tablero |
| `- [-]` | Descartado | Se decidió no hacerlo; se justifica en la bitácora y, si es estructural, en un ADR |

### 0.2 Reglas de disciplina del tablero

1. **Solo se marca `[x]` con evidencia.** Cada tarea completada deja constancia en la *Bitácora de ejecución* (§14) con: fecha, PR/commit y cómo se verificó.
2. **Máximo una fase "En curso" a la vez** en la ruta crítica (0 → 1 → 2 → 3 → 5). Las fases paralelas permitidas figuran en el tablero.
3. **Un PR = un lote pequeño + sus tests.** No se abre un PR que mezcle dos fases.
4. **Si el build o los smoke tests fallan, se revierte el lote.** No se avanza marcando tareas a medias.
5. **Las fases 0 y 1 son barreras de entrada:** ninguna otra fase empieza antes de que estén cerradas.
6. **Al cerrar una fase** se actualizan: este documento (estado + bitácora), `ARCHITECTURE.md` (si cambió la arquitectura) y se escribe el ADR correspondiente en `docs/adr/`.

### 0.3 Cómo retomar el trabajo (checklist de arranque de sesión)

- [ ] `git switch develop && git pull`
- [ ] `npm install` (si cambió `package.json`)
- [ ] `git status --porcelain` limpio salvo cambios propios
- [ ] Leer el **Tablero de progreso** (§1) y la última fila de la **Bitácora** (§14)
- [ ] Ejecutar la verificación de la fase en curso (§0.4)
- [ ] Elegir el siguiente `- [ ]` de la fase en curso y crear la rama `refactor/f{N}-{descripcion-corta}`

### 0.4 Comandos de verificación por estado

| Qué se quiere saber | Comando |
|---|---|
| El proyecto compila en tipos | `npm run typecheck` |
| No hay errores de lint | `npm run lint` |
| Pasan los tests (desde Fase 1) | `npm test` |
| Pasan los E2E (desde Fase 1) | `npm run test:e2e` |
| El build de producción funciona | `npm run build` |
| No hay secretos filtrados (desde Fase 0) | `gitleaks detect --log-opts=--all` |
| Las rutas respetan el patrón (desde Fase 2/3) | `npm run check:guards` · `npm run check:architecture` |
| Solo está modificado lo esperado | `git status --porcelain` |

> Nota: los scripts `npm run test`, `test:e2e`, `check:guards` y `check:architecture` **no existen todavía**; se crean en las Fases 1, 2 y 3 respectivamente. Hasta entonces, marcar esa fila como "n/a".

### 0.5 Medir el avance (sin contar a mano)

Ejecutar en PowerShell desde `cotizador-inteligente/`. Cuenta solo las **tareas numeradas** (`0.1`, `1.7`, `4.12`…), no los criterios de aceptación:

```powershell
$c = Get-Content 'PLAN-MAESTRO-REFACTORIZACION.md' -Encoding UTF8
foreach ($p in 0..7) {
  $h = ($c | Select-String -Pattern ('^- \[x\] \*\*' + $p + '\.\d+\*\*')).Count
  $t = ($c | Select-String -Pattern ('^- \[[ x~!-]\] \*\*' + $p + '\.\d+\*\*')).Count
  "Fase $p : $h / $t"
}
"TOTAL: " + ($c | Select-String -Pattern '^- \[x\] \*\*\d+\.\d+\*\*').Count + " / " + ($c | Select-String -Pattern '^- \[[ x~!-]\] \*\*\d+\.\d+\*\*').Count
```

Salida esperada al inicio (v1.0): `Fase 0 : 0 / 19` … `TOTAL: 0 / 171`.

Estos contadores deben coincidir con la columna *Tareas hechas* de §1.1. Si divergen, se corrige §1.1 en el mismo commit (nunca se "ajusta" el conteo a mano sin marcar la casilla).

---

## 1. Tablero de progreso

### 1.1 Estado por fase

| Fase | Nombre | Estado | Tareas hechas | Riesgo | Esfuerzo est. | Inicio | Cierre | Bloqueadores |
|---|---|---|---|---|---|---|---|---|
| **0** | Seguridad inmediata | `- [~]` en curso | 3 / 19 | Bajo técnico / Crítico negocio | 1–2 d | — | — | — |
| **1** | Calidad y ciclo de desarrollo | `- [~]` en curso | 6 / 30 | Bajo | 5–7 d | — | — | Depende de Fase 0 |
| **2** | Multi-tenancy y autorización | `- [ ]` pendiente | 0 / 30 | Alto | 15–21 d | — | — | Depende de Fase 1 |
| **3** | Arquitectura backend | `- [ ]` pendiente | 0 / 24 | Medio-Alto | 20–28 d | — | — | Depende de Fases 1 y 2 |
| **4** | Frontend | `- [ ]` pendiente | 0 / 20 | Medio | 14–19 d | — | — | Depende de Fase 1 |
| **5** | Prisma y dominio | `- [ ]` pendiente | 0 / 17 | Alto | 10–14 d | — | — | Depende de Fases 1 y 3 |
| **6** | Infraestructura | `- [ ]` pendiente | 0 / 16 | Medio | 6–8 d | — | — | Depende de Fases 1 y 3 |
| **7** | Limpieza y documentación | `- [ ]` pendiente | 0 / 15 | Bajo | 3–5 d | — | — | Cierre del programa |
| **Total** | 8 fases | `- [~]` en curso | **9 / 171** | — | 88–127 d | — | — | — |

### 1.2 Ruta crítica y paralelismo permitido

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 5 ──► cierre
                         │           │
                         ├──► Fase 4 ◄──┘   (Fase 4 puede arrancar con Fase 2 cerrada)
                         └──► Fase 6        (Fase 6 puede arrancar con Fase 1 cerrada)
Fase 7: se alimenta en paralelo desde el inicio; se cierra al final
```

### 1.3 Calendario de referencia (sprints de 2 semanas)

| Sprint | Trabajo principal | En paralelo |
|---|---|---|
| **S0** | Fase 0 completa + inicio de plantilla de variables | — |
| **S1** | Fase 1: CI + Vitest + primeros 10 tests | Fase 7 (README real) |
| **S2** | Fase 1: Playwright + retirar flags de build | Fase 2.1 (matriz de acceso) |
| **S3–S4** | Fase 2: `resolveAccessContext` en shadow + `withApiHandler` | Fase 6 (Node 22) |
| **S5–S6** | Fase 2: tenant scoping + shim legacy + RLS | Fase 4 (lote 1) |
| **S7–S8** | Fase 3: `core/` + piloto `cotizaciones` | Fase 6 (observabilidad) |
| **S9–S10** | Fase 3: lotes por módulo | Fase 4: componentes gigantes |
| **S11–S12** | Fase 5: split del esquema + plantillas | Fase 4: `use client` + i18n |
| **S13** | Fase 5: secuencias + entitlements | Fase 6: CI/CD + imágenes |
| **S14** | Fase 7: cierre, ADRs, limpieza | Estabilización |

> Las fechas reales se anotan en la tabla §1.1 al iniciar y cerrar cada fase. El calendario es una guía, no un compromiso contractual.

---

## 2. Línea base medida (27/10/2026)

Cifras verificadas sobre `develop`; son el punto de partida para medir el éxito (§7 y §8). **No se recalculan a mano**: se actualizan con los scripts de la Fase 1.

| Métrica | Valor inicial | Fuente |
|---|---|---|
| Rutas API (`route.ts`) | 384 | conteo de archivos |
| Páginas (`page.tsx`) | 155 | conteo de archivos |
| Modelos Prisma | 205 | `prisma/schema.prisma` |
| Migraciones | 158 | `prisma/migrations/` |
| Rutas con `requireApiAccess` (legacy) | 152 | grep |
| Rutas con `requireCapabilityAccess` (RBAC v2) | 90 | grep |
| Rutas con `requireModuleAccess` | 0 | grep |
| Rutas con validación Zod | 12 | grep |
| Rutas con `console.error` + 500 genérico | 226 | grep |
| Archivos `"use client"` | 206 | grep |
| Archivos `"use server"` | 4 | grep |
| Tests automatizados | **0** | no hay framework instalado |
| Workflows de CI | **0** | `.github/workflows/` inexistente |
| Imagen Docker | Node 20, sin `output: 'standalone'` | `Dockerfile`, `next.config.ts` |
| Node local declarado | 22.22.0 | `.nvmrc` |
| Chequeos de build | `NEXT_DISABLE_BUILD_CHECKS=1` + `ignoreBuildErrors` | `Dockerfile`, `next.config.ts` |
| Dependencias sin uso | `stripe`, `@tanstack/react-query` | `package.json` |
| Documentos `.md` en la raíz | 45–48 | listado del repo |
| Artefactos versionados obsoletos | `tsc-trace.txt` (8,4–8,6 MB), `tmp-ocr*.json`, `tmp-smoke-*.pdf`, `tmp-i18n-*.txt` | `git ls-files` |

> Cifras que se revalidan al cerrar cada fase: si una cambia inesperadamente hacia arriba, es una señal de regresión (por ejemplo, nuevas rutas sin guarda).

---

## 3. FASE 0 — Seguridad inmediata

**Estado:** `- [ ]` pendiente · **Sprint:** S0 · **Esfuerzo:** 1–2 d · **Riesgo:** Bajo técnico / Crítico de negocio si se omite

### 3.1 Objetivo

Cerrar la exposición de credenciales y establecer una gestión de secretos verificable **antes** de tocar una sola línea de lógica.

### 3.2 Problemas que resuelve

**P-15** (secretos en texto plano y plantillas con valores). Elimina el riesgo de que **P-5** (build sin chequeos) permita publicar material sensible. Es prerrequisito de cualquier auditoría y de la Fase 1 (secretos en CI).

### 3.3 Archivos/módulos afectados

`.env`, `.env.example`, `.env.docker.example`, `.gitignore`, `README.md`, `INSTALACION.md`, `DEPLOY-KAMATERA.md`, `Dockerfile` (build args), `docker-compose.prod.yml` (`env_file`), `next.config.ts` (`NEXT_PUBLIC_*`), y los módulos que leen `process.env`: `src/lib/auth.ts`, `src/lib/api-rbac.ts`, `src/lib/s3.ts`, `src/lib/bold.ts`, `src/lib/resend.ts`, `src/lib/crm-*.ts`.

### 3.4 Dependencias

Ninguna. Es la única fase que se ejecuta sola y primero. **Habilita:** Fase 1 (secretos en CI) y Fase 6 (despliegue).

### 3.5 Riesgo

**Bajo** en lo técnico. **Crítico** si se omite. Puntos delicados de la rotación:

- Rotar `NEXTAUTH_SECRET` **invalida todas las sesiones activas** → requiere aviso a usuarios y horario de bajo uso.
- Rotar `BOLD_WEBHOOK_SECRET` exige actualizar el panel de Bold **en la misma ventana** o se pierden pagos.
- Rotar `ADMIN_API_KEY` exige actualizar el `crontab` del host que llama a `/api/admin/jobs/*`.

### 3.6 Esfuerzo

**1–2 días** de trabajo + **una ventana de 2 h** para la rotación coordinada.

### 3.7 Beneficio

Exposición cerrada, onboarding reproducible (`cp .env.example .env` vuelve a funcionar), base para auditorías y para exigir escaneo de secretos en cada PR.

### 3.8 Qué NO debemos modificar todavía

- **No** cambiar el esquema de autenticación ni la forma del JWT; en `src/lib/auth.ts` solo se cambia **de dónde se lee** el secreto.
- **No** reescribir el modelo de permisos (es Fase 2).
- **No** tocar migraciones ni el esquema de BD.
- **No** borrar los archivos `.example` hasta tener la plantilla nueva revisada y versionada.

### 3.9 Hallazgos ya verificados (base de esta fase)

| Hallazgo | Estado |
|---|---|
| `.env`, `.env.example`, `.env.docker.example` nunca fueron versionados (`git log --all -- <archivo>` sin resultados) | ✅ Sin fuga en el historial |
| Claves reales en archivos versionados (patrones `re_`, `sk-`, `AKIA`, claves privadas) | ✅ Ninguna (4 falsos positivos) |
| `.env.docker.example` con `NEXTAUTH_SECRET`, `SHARE_TOKEN_SECRET` y `RESEND_API_KEY` con formato real, IP pública de producción y email del super-admin | ❌ **Material sensible: considerar comprometido** |
| `.env` local con `BOLD_API_KEY` y `BOLD_WEBHOOK_SECRET` con formato real | ❌ **Material sensible: considerar comprometido** |
| `.gitignore` con `.env*` deja también fuera a `.env.example` → onboarding documentado roto | ❌ Corregir |

### 3.10 Tareas de ejecución

**Preparación (día 1)**
- [ ] **0.1** Crear `docs/security/` con un `README.md` que indexe la carpeta
- [ ] **0.2** `docs/security/secrets-inventory.md`: una fila por secreto con *nombre, uso, proveedor, responsable, último cambio, caducidad* — **sin valores**
- [ ] **0.3** Reescribir `.env.example` sin valores, agrupado por proveedor, marcando `# OBLIGATORIO` / `# OPCIONAL`
- [x] **0.4** Sanear `.env.docker.example`: quitar los 3 secretos con formato real, la IP pública y el email personal; sustituir por marcadores `<...>` — **Hecho 2026-10-27**: `NEXTAUTH_SECRET`, `SHARE_TOKEN_SECRET`, `RESEND_API_KEY`, `WEBSITE_DOMAIN_IPV4` (IP pública del VPS) y `SUPER_ADMIN_EMAIL` sustituidos por marcadores; el archivo vuelve a ser versionable.
- [x] **0.5** `.gitignore`: añadir `!.env.example` (y `!.env.docker.example` si se conserva como plantilla) tras la regla `.env*` — **Hecho 2026-10-27**: añadidas `!.env.example`, `!.env.docker.example` y `!.env.litografia-ia.example`; `git check-ignore` confirma que `.env` y `.env.local` **siguen ignorados**.
- [x] **0.6** Confirmar historial limpio: `git log --all --oneline -- .env .env.example .env.docker.example` debe salir vacío — **Hecho 2026-10-27**: salida vacía, ningún `.env*` se versionó nunca.
- [ ] **0.7** Ejecutar `gitleaks detect --log-opts=--all`; si aparece un hallazgo, **parar** y evaluar reescritura de historial con `git filter-repo` (coordinando clones)
- [ ] **0.8** Añadir `gitleaks` como *pre-commit hook* y como job de CI **en modo informe**

**Rotación (ventana de 2 h, de menor a mayor impacto)**
- [ ] **0.9** Rotar `RESEND_API_KEY` → probar envío de cotización por email
- [ ] **0.10** Rotar claves de DataForSEO / PageSpeed → probar auditoría SEO
- [ ] **0.11** Rotar `META_APP_SECRET` / token de WhatsApp → probar recepción de webhook CRM
- [ ] **0.12** Rotar credenciales S3/Spaces → probar subida y descarga de un PDF
- [ ] **0.13** Rotar claves de Turnstile (site/secret) si están en uso → probar formulario público
- [ ] **0.14** Rotar `BOLD_API_KEY` y `BOLD_WEBHOOK_SECRET` **con el panel de Bold sincronizado** → probar pago y webhook
- [ ] **0.15** Rotar `ADMIN_API_KEY` → actualizar el `crontab` del host y verificar `/api/admin/jobs/*`
- [ ] **0.16** Rotar `SHARE_TOKEN_SECRET` → avisar que los enlaces públicos de cotización ya emitidos dejan de validar
- [ ] **0.17** Rotar `NEXTAUTH_SECRET` **al final**, en horario de bajo uso → avisar a usuarios del cierre de sesión; verificar login

**Cierre**
- [ ] **0.18** `docs/security/rotation-runbook.md` con el procedimiento por proveedor (dónde se genera, dónde se despliega, cómo se verifica, cómo se revoca)
- [ ] **0.19** Actualizar `README.md`, `INSTALACION.md` y `DEPLOY-KAMATERA.md` al flujo `cp .env.example .env`

### 3.11 Criterios de aceptación

- [ ] `.env.example` versionado, **sin valores**, con todas las variables de `ARCHITECTURE.md` §11 y anotación de obligatoriedad
- [ ] `.gitignore` con `!.env.example`; ningún `.env*` real versionado (`git ls-files | Select-String '\.env'` solo devuelve los `.example`)
- [ ] `gitleaks` sobre historial completo y sobre el árbol de trabajo: **cero hallazgos**
- [ ] Inventario de secretos con fecha de rotación de **todos** los secretos de producción
- [ ] Cada secreto rotado verificado funcionalmente (login, email, push, pago, S3, webhook CRM)
- [ ] `.env` local y `.env.production` fuera de cualquier backup versionado y con permisos restringidos al usuario del servicio
- [ ] `rotation-runbook.md` publicado y probado por una segunda persona (prueba de que es reproducible)

### 3.12 Estrategia incremental

1. **Día 1:** plantilla nueva, inventario, `!.env.example`, `gitleaks` en modo informe. Nada de rotaciones todavía.
2. **Día 1 (tarde):** escaneo del historial completo. Hoy no se espera hallazgo; si lo hay, se planifica aparte.
3. **Día 2:** rotaciones en orden de impacto creciente, **una a una**, con verificación funcional inmediata y anotación en la tabla §3.13.
4. Usar **doble clave** donde el proveedor lo permita (Resend, Meta, S3): crear nueva → desplegar → verificar → revocar antigua. Cero downtime.
5. **No eliminar** el `.env` antiguo hasta 7 días sin errores en logs de autenticación y emisión.
6. Si algo falla, se vuelve a la clave anterior (por eso la doble clave) y se anota el bloqueo en §3.13.

### 3.13 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| 27/10/2026 | Saneadas las plantillas de entorno: `NEXTAUTH_SECRET` (real) fuera de `.env.example`; `NEXTAUTH_SECRET`, `SHARE_TOKEN_SECRET`, `RESEND_API_KEY`, IP pública del VPS y email personal fuera de `.env.docker.example` | `git status --porcelain` → `M .gitignore`, `?? .env.example`, `?? .env.docker.example`, `?? .env.litografia-ia.example` (sin `.env`) | — |
| 27/10/2026 | `.gitignore` deja versionables las plantillas sin exponer los `.env` reales | `git check-ignore -q .env` → ignorado; `git check-ignore -q .env.local` → ignorado; las 3 plantillas → versionables | — |
| 27/10/2026 | Escaneo de secretos en las 3 plantillas (Resend, `sk-`, AWS, base64 ≥40, IPv4, email personal) | 0 secretos reales; solo 2 IPv4 en **comentarios** de ejemplo (`192.168.1.50` privada y `127.0.0.1` loopback) | — |
| 27/10/2026 | Confirmado que ningún `.env*` real estuvo nunca en Git | `git log --all --oneline -- .env .env.example .env.docker.example` → vacío | — |
| 27/10/2026 | `.gitignore`: solo las 3 plantillas **exactas** quedan visibles; ningún `.env*` real ni variantes | `git check-ignore -q`: `.env`, `.env.local`, `.env.production`, `.env.example.local`, `.env.production.example`, `.env.docker.example.bak` → **ignorados**; solo `.env.example`, `.env.docker.example`, `.env.litografia-ia.example` → versionables | — |
| 27/10/2026 | Prueba funcional: las 3 plantillas se siguen parseando con `dotenv` | `.env.example` 46 claves, `.env.docker.example` 51 claves, `.env.litografia-ia.example` 7 claves; **0 valores sospechosos** | — |
| 27/10/2026 | Verificación de que el cambio no rompe código | `npm run typecheck` → **EXIT 0**; `npm run lint` → **EXIT 1 con 163 errores preexistentes** (124 son `@typescript-eslint/no-explicit-any`), **0** relacionados con `.env*`/`.gitignore` → base de partida de la Fase 1 | — |
| 27/10/2026 | Hallazgo abierto (fuera de 0.4–0.6): email personal **hardcodeado** en código versionado como fallback de super-admin/soporte | `src/lib/super-admin.ts:3`, `src/components/dashboard/floating-chat-drawer.tsx:158`, `src/app/dashboard/onboarding/page.tsx:73,82`, `scripts/restore-superadmin.ts:25,54`, `scripts/migrate-users-to-sgdigital.ts:7,184` | — |
| 27/10/2026 | Hallazgo abierto: IP pública del VPS documentada en reposo | `DEPLOY-KAMATERA.md:109,113,118` (aceptable en doc de despliegue; revisar si el repo es público) | — |
| 27/10/2026 | **Hallazgo abierto (seguridad, Fase 6):** `.dockerignore` **no excluye `.env`**, de modo que `COPY . .` (`Dockerfile:25`) mete el `.env` real en la imagen y `next start` lo carga en runtime | `.dockerignore` revisado: no contiene `.env*`; el contexto de build incluye el `.env` del servidor → secretos en claro dentro de la imagen. Acción: añadir `.env*` al `.dockerignore` y pasar los secretos por `env_file`/`environment` en `docker-compose.prod.yml` | — |
| 27/10/2026 | **Hallazgo CRÍTICO (Fase 0 — rotación urgente):** el repositorio es **público** y el historial contiene **dos secretos reales** | `GET api.github.com/repos/Iaramirez88/erpcotizador` → `visibility=public` (default branch `develop`); `gitleaks`: (a) `generic-api-key` en `7740c5b:INSTALACION.md:72` = `NEXTAUTH_SECRET` real; (b) `curl-auth-header` en `d92e74be:DEPLOY-KAMATERA.md:178,188,199` = token `X-API-Key` **literal** de 16 caracteres, compatible con `ADMIN_API_KEY`. Ninguno está ya en el árbol, pero **siguen en el historial público** → rotar `ADMIN_API_KEY` (0.15) y `NEXTAUTH_SECRET` (0.17); evaluar repo privado / reescritura de historial | — |

---

## 4. FASE 1 — Calidad y seguridad del ciclo de desarrollo

**Estado:** `- [~]` en curso — **bloque A (CI) ejecutado el 27/10/2026** · **Sprint:** S1–S2 · **Esfuerzo:** 5–7 d · **Riesgo:** Bajo

### 4.1 Objetivo

Construir la red de seguridad que permita refactorizar sin miedo: pipeline obligatorio (lint + typecheck + test + build) y los primeros tests de reglas críticas.

### 4.2 Problemas que resuelve

**P-4** (cero tests, sin CI), **P-5** (build ignora errores), **P-13** de forma parcial (divergencia de versiones).

### 4.3 Archivos/módulos afectados

`next.config.ts` (`ignoreBuildErrors`), `Dockerfile` (`NEXT_DISABLE_BUILD_CHECKS`), `package.json` (scripts y devDependencies), `eslint.config.mjs`, nuevos: `vitest.config.ts`, `playwright.config.ts`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `.github/workflows/ci.yml`, `.github/workflows/secret-scan.yml`, `.github/pull_request_template.md`, `docs/testing.md`. Referencia (no se borran): `scripts/test-*-acl.ts`, `scripts/smoke-*`.

### 4.4 Dependencias

Requiere **Fase 0** (secretos disponibles en CI y escaneo bloqueante). Es **prerrequisito de las Fases 2, 3 y 5**: sin tests, esos refactors son ruleta.

### 4.5 Riesgo

**Bajo.** El único riesgo real es que al retirar `ignoreBuildErrors` aparezcan errores latentes; la mitigación es que `npm run typecheck` **ya pasa hoy**, por lo que el cambio es seguro.

### 4.6 Esfuerzo

**5–7 días:** 1,5 d CI · 2 d Vitest + primeros tests · 1,5 d Playwright · 1 d documentación y ajustes de scripts.

### 4.7 Beneficio

Cualquier regresión de tipos, de lint o de las 5 reglas de negocio más caras se detecta **antes** de producción. Reduce drásticamente el coste de las fases 2–5.

### 4.8 Qué NO debemos modificar todavía

- **No** refactorizar lógica "para hacerla testeable" (eso es Fase 3); solo extraer funciones puras cuando el test lo exija.
- **No** eliminar los scripts `tsx` existentes ni el *smoke* actual: conviven.
- **No** cambiar el framework de build (Webpack/Turbopack) ni actualizar dependencias mayores.
- **No** imponer cobertura mínima obligatoria todavía (bloquearía todo).

### 4.9 Tareas de ejecución

**A. Pipeline de CI**
- [x] **1.1** Crear `.github/workflows/ci.yml`: `npm ci` → `npx prisma generate` → `npm run lint` → `npm run typecheck` → `npm run build` — **hecho 27/10/2026.** Dos jobs **en paralelo** (`estatico`: lint + typecheck · `build`: build) para caber en el objetivo de tiempo; Node según `.nvmrc`, `NODE_OPTIONS=--max-old-space-size=4096` y `DATABASE_URL` de relleno (solo para `prisma generate`, no conecta a BD). Validado con un build real sin `.env`: **EXIT 0**
- [x] **1.2** Añadir caché de `node_modules` y del cliente Prisma; medir y documentar el tiempo total (objetivo < 12 min) — **hecho.** `setup-node` con `cache: npm` + `actions/cache` para `~/.cache/prisma` y `.next/cache` (clave sobre `package-lock.json` + `prisma/schema.prisma`). Tiempos medidos en §4.13: lint **166 s**, typecheck **154,4 s**, build **389,3 s**. La suma secuencial (≈ 11,8 min) más `npm ci` habría superado el objetivo → dos jobs en paralelo (pared esperado ≈ 7,5 min). El *wall-clock* real de CI se anota en la primera ejecución
- [x] **1.3** Eliminar `NEXT_DISABLE_BUILD_CHECKS` del `Dockerfile` — **hecho 27/10/2026** (era `Dockerfile:34`, etapa `web`)
- [x] **1.4** Eliminar `typescript.ignoreBuildErrors` de `next.config.ts` — **hecho 27/10/2026**, junto con la constante `skipBuildChecks`, que quedaba sin uso
- [x] **1.5** Borrar el `tsc.log` obsoleto y confirmar `npm run typecheck` verde en limpio — **hecho.** `tsc.log` (5.956 B de errores antiguos, ignorado por `*.log`) eliminado; `tsc --noEmit --incremental false` → **EXIT 0 en 154,4 s**
- [ ] **1.6** Activar el job como **bloqueante** en PR hacia `develop` (branch protection) — ⏳ **pendiente de acción externa**: requiere admin del repositorio (GitHub UI o API), no se puede versionar. Pasos exactos en la cabecera de `.github/workflows/ci.yml`
- [x] **1.7** `.github/workflows/secret-scan.yml` con `gitleaks` **bloqueante** (cierra Fase 0) — **hecho.** gitleaks **8.30.1** fijado, `--log-opts=--all` (427 commits), `.gitleaks.toml` con 4 allowlists estrechas (commit + rutas). Verificado en local con el binario real: **`no leaks found`, EXIT 0**

**B. Vitest y tests unitarios (sin BD)**
- [ ] **1.8** Instalar `vitest` (+ `jsdom`, `@vitest/coverage-v8`) y crear `vitest.config.ts` (entorno node para dominio, jsdom para componentes)
- [ ] **1.9** Scripts `test`, `test:watch`, `test:coverage` en `package.json`
- [ ] **1.10** Test: cálculo de precios de litografía (m², merma, acabados, descuentos por cantidad, redondeo)
- [ ] **1.11** Test: totales de cotización y POS (impuestos, descuentos, redondeo monetario)
- [ ] **1.12** Test: matriz de permisos `getEffectiveAccessMap` por rol (ADMIN/USER/VENDEDOR/PRODUCCION/CLIENTE)
- [ ] **1.13** Test: entitlements de plan (`planTier` → módulos habilitados + overrides)
- [ ] **1.14** Test: firma y verificación de tokens públicos de cotización (`SHARE_TOKEN_SECRET`)
- [ ] **1.15** Test: cifrado/descifrado de tokens de canales CRM (`CRM_CHANNEL_SECRET`)
- [ ] **1.16** Test: validación con Zod de los payloads ya existentes + rechazo de campos desconocidos
- [ ] **1.17** Portar a Vitest los *slices* de `decision-engine` (hoy script manual)

**C. Tests de integración (BD efímera)**
- [ ] **1.18** Servicio `postgres` en el job de CI + `prisma migrate deploy` sobre base de prueba limpia
- [ ] **1.19** Test: consecutivos por sede bajo concurrencia (`CotizacionSequence`): 50 creaciones simultáneas, cero duplicados
- [ ] **1.20** Test: webhook con firma inválida → 401/403 y **sin efectos** en BD
- [ ] **1.21** Test: aislamiento entre empresas (usuario de empresa A no accede a recurso de empresa B)

**D. E2E (Playwright)**
- [ ] **1.22** Instalar Playwright + `playwright.config.ts` + script `test:e2e`
- [ ] **1.23** E2E: login → dashboard con sidebar según permisos
- [ ] **1.24** E2E: crear cotización → generar PDF → abrir token público
- [ ] **1.25** E2E: POS — venta completa con medio de pago y consecutivo
- [ ] **1.26** E2E: CRM — mensaje entrante simulado (Graph mockeado) → conversación visible → respuesta enviada
- [ ] **1.27** E2E: website builder — publicar sitio → visible en `/sites/[slug]`

**E. Cierre**
- [ ] **1.28** `docs/testing.md`: cómo escribir un test, qué se considera crítico, cómo se ejecuta todo
- [ ] **1.29** Job E2E en CI con `workers: 1` y BD efímera
- [ ] **1.30** `.github/pull_request_template.md` con la regla **"todo bug corregido deja un test"**

### 4.10 Criterios de aceptación

- [x] `NEXT_DISABLE_BUILD_CHECKS` eliminado del `Dockerfile` y `ignoreBuildErrors` eliminado de `next.config.ts`
- [ ] Pipeline con `npm ci` → `prisma generate` → `lint` → `typecheck` → `test` → `build`, **obligatorio** en PR hacia `develop`
- [~] `gitleaks` bloqueante en CI (**hecho 27/10/2026**, tarea 1.7) y en *pre-commit* (⏳ pendiente, tarea 0.8)
- [ ] Vitest operativo con `npm test` y `npm run test:watch`
- [ ] **≥ 10 tests unitarios** de reglas puras y **≥ 4 de integración** contra BD efímera, todos verdes
- [ ] Playwright con **5 flujos E2E** verdes en CI
- [ ] Tiempo total de pipeline **< 12 min** con caché
- [ ] `docs/testing.md` publicado; regla "todo bug deja test" en la plantilla de PR

### 4.11 Estrategia incremental

1. **Semana 1:** CI **no bloqueante** (solo informa) + Vitest con 5 tests puros. Medir tiempo y falsos positivos.
2. **Semana 2:** pasar a **bloqueante** en este orden: `lint` + `typecheck` + `build` → `test` → `gitleaks`.
3. Playwright se añade al final, con `workers: 1` y BD efímera, para no inflar el pipeline.
4. Regla permanente desde el cierre de la fase: **ningún issue se cierra sin el test que lo cubre**.

### 4.12 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| 27/10/2026 | **1.3** `NEXT_DISABLE_BUILD_CHECKS` fuera del `Dockerfile` (era l. 34, etapa `web`) | `git grep` del identificador → 0 apariciones en código/config (solo quedaba en `ARCHITECTURE.md`, ya actualizado) | Cline |
| 27/10/2026 | **1.4** `typescript.ignoreBuildErrors` + constante `skipBuildChecks` fuera de `next.config.ts` | `next.config.ts` final sin ninguna opción que relaje el build; `npm run typecheck` → **EXIT 0** | Cline |
| 27/10/2026 | **1.5** `tsc.log` obsoleto eliminado y typecheck en limpio | `tsc --noEmit --incremental false` → **EXIT 0 en 154,4 s** | Cline |
| 27/10/2026 | **1.1** `.github/workflows/ci.yml` creado (2 jobs en paralelo, 13 pasos) | YAML validado con `js-yaml`: `estatico` (7 pasos, termina en `Typecheck`) y `build` (6 pasos, termina en `Build`); Node desde `.nvmrc`; `lint` informativo, `typecheck`+`build` bloqueantes | Cline |
| 27/10/2026 | **Medición de la línea base de `lint`** (dato para 1.2) | `npm run lint` → **EXIT 1 en 166 s**: 466 problemas (**163 errores**, 303 warnings), 1 error y 6 warnings auto-corregibles. Idéntico a la base de la Fase 0 → **0 regresiones** introducidas | Cline |
| 27/10/2026 | **1.2** Caché de dependencias y del cliente Prisma en CI | `setup-node` (`cache: npm`) + `actions/cache` (`~/.cache/prisma`, `.next/cache`) con clave sobre `package-lock.json` + `prisma/schema.prisma` | Cline |
| 27/10/2026 | **Verificación de 1.3 + 1.4:** build completo sin las vendas | `npm run build` → **EXIT 0 en 389,3 s (6 min 29 s)**, 0 errores de tipos (Next ejecutó su chequeo: `.next/cache/.tsbuildinfo`) | Cline |
| 27/10/2026 | **Verificación extra (paridad con CI):** build sin `.env`, solo con las variables del workflow | `.env` apartado y restaurado en `finally`; `npm run build` → **EXIT 0 en 294,6 s**, `env_restaurado=True` → CI no necesita secretos para compilar | Cline |
| 27/10/2026 | **1.6** Branch protection en `develop` | ⏳ **No versionable**: requiere admin del repo (`Settings → Branches → Add branch protection rule`). Instrucciones exactas en la cabecera de `ci.yml` | ⏳ Pendiente |
| 27/10/2026 | **1.7** `gitleaks` bloqueante (cierra Fase 0) | `gitleaks 8.30.1 detect --log-opts=--all` → 427 commits, **`no leaks found`, EXIT 0**. Sin `.gitleaks.toml`: 7 hallazgos → **5 falsos positivos + 2 secretos reales históricos** (`NEXTAUTH_SECRET` en `INSTALACION.md`, tarea 0.17; token `X-API-Key` de 16 car. compatible con `ADMIN_API_KEY` en `DEPLOY-KAMATERA.md`, tarea 0.15), ambos fuera del árbol actual | Cline |

### 4.13 Tiempos medidos (base para el objetivo < 12 min)

Medición **local** del 27/10/2026 (Windows, Node 22.22.0, sin caché de CI). Sirve para dimensionar el pipeline, no como promesa del tiempo real de GitHub Actions (Linux suele ser algo más rápido y `.next/cache` acelera las ejecuciones sucesivas).

| Etapa | Tiempo | Notas |
|---|---|---|
| `npm ci` | no medido (≈ 1–2 min estimado) | `setup-node` con `cache: npm` evita la descarga del registro |
| `npx prisma generate` | no medido (≈ 10–20 s estimado) | `~/.cache/prisma` evita bajar los binarios |
| `npm run lint` | **166 s** | EXIT 1: 466 problemas heredados (163 errores) → corre en modo informe |
| `npm run typecheck` | **154,4 s** | `tsc --noEmit --incremental false` (sin caché incremental) |
| `npm run build` | **389,3 s** con `.env` · **294,6 s** sin `.env` | Incluye el chequeo de tipos de Next |
| **Suma secuencial** | **≈ 11,8 min** | Solo las etapas medidas: sumando `npm ci` habría superado el objetivo |
| **Pared con 2 jobs en paralelo** | **≈ 7,5 min esperado** | `estatico` ≈ 6,5 min · `build` ≈ 7,5 min, ejecutándose a la vez |

**Decisión derivada:** el pipeline se partió en dos jobs simultáneos (`estatico` y `build`) porque la suma secuencial no deja margen frente al objetivo de 12 min. El tiempo real de CI se anotará en esta tabla tras la primera ejecución.

---

## 5. FASE 2 — Multi-tenancy y autorización

**Estado:** `- [ ]` pendiente · **Sprint:** S3–S6 · **Esfuerzo:** 15–21 d · **Riesgo:** **Alto**

### 5.1 Objetivo

Un solo modelo de identidad y acceso, con contexto de tenant **explícito**, decisión de permisos **única y cacheada**, y aislamiento de datos **garantizado por diseño** en lugar de por disciplina.

### 5.2 Problemas que resuelve

**P-2** (fugas entre empresas), **P-3** (cuatro sistemas y guardas dispersas), **P-20** (gating sin matriz), y **P-12** (escrituras en rutas de lectura al mover `ensure*` fuera del camino).

### 5.3 Archivos/módulos afectados

`src/lib/api-rbac.ts`, `src/lib/rbac.ts`, `src/lib/dashboard-access.ts`, `src/lib/plan-catalog.ts`, `src/lib/plan-modules.ts`, `src/lib/gantt-plan-access.ts`, `src/lib/prisma.ts`, `src/app/dashboard/layout.tsx`, `src/components/dashboard/sidebar.tsx`, `src/components/dashboard/*gate*`, **todos** los `route.ts` (progresivamente), `prisma/schema.prisma` (campos de versión y tabla de entitlements consolidada).

### 5.4 Dependencias

Requiere **Fase 1** (tests de permisos y de aislamiento como red de seguridad) y **Fase 0** (secretos de cookie/contexto). Es **prerrequisito de la Fase 3** (wrapper de autorización) y de la **Fase 5** (consolidación de entitlements).

### 5.5 Riesgo

**Alto.** Un error de *scoping* no rompe el build: **rompe el acceso de clientes o mezcla datos**. Por eso el resolvedor entra en modo *shadow* y solo bloquea tras una matriz de pruebas verde.

### 5.6 Esfuerzo

**15–21 días** en 6 sub-fases:

| Sub-fase | Contenido | Días |
|---|---|---|
| 2.1 | Inventario y matriz de acceso real por `route.ts` (guarda, capacidad, filtros de tenant) | 2–3 |
| 2.2 | `resolveAccessContext()` en modo **shadow** con telemetría de divergencias | 4–5 |
| 2.3 | `withApiHandler({ capability })` + `ApiError` + contexto explícito de sede | 3–4 |
| 2.4 | Extensión de Prisma de tenant scoping (`warn` → `throw`) | 4–5 |
| 2.5 | Deprecación del sistema legacy con shim + eliminación de `allowLegacyFallback` | 2–3 |
| 2.6 | RLS en tablas de alto riesgo + tests de aislamiento empresa A × B | 3–4 |

### 5.7 Beneficio

- Eliminación estructural del riesgo de fuga entre empresas.
- Autorización ~3–5× más barata (una resolución + caché) y explicable.
- Un solo lugar para añadir permisos: los endpoints nuevos no pueden "olvidarse" del guard.
- Base para vender planes y verticales sin condicionales dispersos.

### 5.8 Qué NO debemos modificar todavía

- **No** renombrar tablas ni columnas existentes (migraciones destructivas prohibidas en esta fase).
- **No** activar RLS antes de tener la extensión de Prisma y los tests de aislamiento verdes.
- **No** tocar la lógica de negocio de nómina, DIAN ni contabilidad: solo su guarda.
- **No** eliminar los fallbacks legacy hasta que la telemetría marque cero uso.
- **No** cambiar el flujo de login ni la forma del JWT.

### 5.9 Modelo unificado propuesto

| Concepto | Definición canónica | Cambio respecto a hoy |
|---|---|---|
| **Empresa (Tenant)** | Cuenta de facturación y límite de aislamiento | Sin cambio de identidad; se añade `accessVersion` para invalidar cachés |
| **Sede** | Unidad operativa; **toda entidad transaccional pertenece a una sede** | Se prohíbe crear datos sin sede |
| **User** | Identidad global (email único); puede pertenecer a varias empresas | `User.empresaId` deja de ser fuente de verdad (queda por compatibilidad) |
| **Membership** | `SedeMembership { userId, sedeId, roleId, status, scope }`; el acceso a empresa se **deriva** | Se formaliza como única puerta de entrada |
| **Role** | `{ empresaId \| null (sistema), key, name }` | Roles por empresa; los de sistema son inmutables |
| **Capability** | Catálogo inmutable `dominio.acción` (`cotizaciones.read`, `nomina.approve`) | Ya existe en RBAC v2: se convierte en **el** mecanismo |
| **Scope** | `OWN < SEDE < EMPRESA < GLOBAL` sobre cada capability | Igual, pero aplicado de forma uniforme |
| **Plan** | `planTier` por empresa + módulos habilitados | Sin cambios |
| **Entitlement** | Resultado de `PlanModuleSetting` **con** `EmpresaModuleOverride` en una sola consulta | **Consolida** `DomainEntitlement` / `CapabilityEntitlement` |

**Regla de decisión única:**

```
acceso_efectivo = capability del rol (con scope)
                  ∩ entitlement del plan
                  ∩ estado del usuario (activo, empresa activa)
```

**Resolvedor:** `resolveAccessContext(request)` → `{ empresaId, sedeId, userId, roleKeys, capabilities: Map<cap, scope>, modules: Set, planTier, flags }`, memoizado por request y cacheado con clave `access:{userId}:{sedeId}:v{accessVersion}`.

**Contexto explícito:** la sede se toma de la petición (cabecera `X-Sede-Id` o cookie firmada) y se **valida** contra la membership; si no viene, se usa la sede por defecto de `User.sedeDefaultId` **solo por compatibilidad** y se registra `access.implicit_sede` para medir y luego eliminar ese camino.

### 5.10 Aislamiento: Prisma Extensions vs PostgreSQL RLS

| Opción | Ventajas | Inconvenientes | Veredicto |
|---|---|---|---|
| **Extensión de Prisma** (`$extends` + `$allOperations`) que inyecta `where.empresaId` sobre una lista declarativa de modelos *tenant-scoped* | Mismo lenguaje, testeable, sin cambios de BD, permite modo `warn` → `throw` | No cubre SQL crudo; exige disciplina en la lista; hay que cuidar `upsert`, `aggregate`, `groupBy` | **Primero** |
| **PostgreSQL RLS** (rol de app + `SET LOCAL app.empresa_id` por transacción + políticas) | Defensa en profundidad real: ni un bug de código filtra; cubre SQL crudo | Obliga a envolver **todas** las transacciones; problemas con *pooling* si no se usa `SET LOCAL`; super-admin necesita `BYPASSRLS`; migración de 205 tablas | **Después**, por fases y con flag |
| **Ambos (objetivo final)** | Cinturón y tirantes | Doble mantenimiento de listas y políticas | **Meta** |

**Decisión:** extensión primero (2.6), RLS después (2.11) activada por variable de entorno y solo en tablas de alto riesgo (cotizaciones, nómina, contabilidad, CRM), con `app.bypass_rls` para migraciones y super-admin.

### 5.11 Tareas de ejecución

**A. Inventario y matriz de acceso (2.1)**
- [ ] **2.1** Script `scripts/audit-api-guards.ts` que recorre los 384 `route.ts` y extrae: guarda usada, capacidad exigida, filtros `empresaId`/`sedeId`, escrituras en GET
- [ ] **2.2** Generar `docs/architecture/access-matrix.md` y revisarlo a mano (100 % de las rutas)
- [ ] **2.3** Abrir corrección de las rutas detectadas **sin guarda** o **sin filtro de tenant**
- [ ] **2.4** Script `npm run check:guards`: falla si un `route.ts` no declara guarda/capacidad o si un modelo *tenant-scoped* se consulta sin filtro

**B. Contexto de acceso (2.2)**
- [ ] **2.5** Definir el tipo `AccessContext` en `src/server/core/auth/access-context.ts`
- [ ] **2.6** Implementar `resolveAccessContext()` memoizado por request
- [ ] **2.7** Caché en Redis con clave `access:{userId}:{sedeId}:v{accessVersion}`
- [ ] **2.8** Añadir `accessVersion` a `Empresa` y `User`; invalidar al cambiar rol, membership o plan
- [ ] **2.9** Modo shadow: calcular la decisión nueva **en paralelo** y loggear `access.shadow_mismatch` (ruta, usuario, decisión vieja/nueva)
- [ ] **2.10** Consulta/dashboard de divergencias y criterio de salida (< 0,1 % en 7 días)

**C. Handler único (2.3)**
- [ ] **2.11** `withApiHandler({ capability, legacyShape? })` en `src/server/core/http/`
- [ ] **2.12** `ApiError` con `{ code, status, details }` + mapeo de `ZodError` y de errores de Prisma
- [ ] **2.13** Contexto explícito de sede: `X-Sede-Id` / cookie firmada validada contra membership + telemetría `access.implicit_sede`
- [ ] **2.14** Migrar **10 rutas de lectura** de bajo riesgo como piloto (dashboard, catálogos)
- [ ] **2.15** Migrar **30 rutas de lectura** adicionales por lotes de 10–15

**D. Tenant scoping en Prisma (2.4)**
- [ ] **2.16** Definir `TENANT_SCOPED_MODELS` (lista declarativa y comentada)
- [ ] **2.17** Extensión `$extends` que inyecta el filtro en `findMany`, `findFirst`, `findUnique`, `count`, `aggregate`, `groupBy`, `update`, `delete`, `upsert`
- [ ] **2.18** Modo `warn` durante 2 semanas con log `tenant.missing_filter` (ruta + modelo)
- [ ] **2.19** Pasar a `throw` **modelo por modelo**, empezando por cotizaciones
- [ ] **2.20** Revisar y parametrizar todo `$queryRaw` / `$executeRaw` (no cubierto por la extensión)

**E. Deprecación del sistema legacy (2.5)**
- [ ] **2.21** Shim `AccessLevel` / `ModuleKey` → capability (una sola traducción, testeada)
- [ ] **2.22** Telemetría `legacy.used` por ruta para medir el remanente
- [ ] **2.23** Reducir `allowLegacyFallback` a < 5 rutas documentadas y eliminar el resto
- [ ] **2.24** Sacar `ensureDefaultSedeForEmpresa` y `ensurePlanModuleDefaults` del camino GET (**P-12**): se ejecutan al crear empresa/plan, no al leer

**F. RLS en tablas de alto riesgo (2.6)**
- [ ] **2.25** Rol de aplicación en Postgres + `SET LOCAL app.empresa_id` por transacción
- [ ] **2.26** Políticas RLS en cotizaciones, nómina, contabilidad y CRM
- [ ] **2.27** `app.bypass_rls` para migraciones y super-admin documentado
- [ ] **2.28** Suite de aislamiento: **20 endpoints críticos × 2 empresas** en CI
- [ ] **2.29** ADR `docs/adr/0003-modelo-autorizacion.md` con la decisión y las alternativas descartadas
- [ ] **2.30** Actualizar `ARCHITECTURE.md` §6 y §7 con el modelo definitivo

### 5.12 Criterios de aceptación

- [ ] `docs/architecture/access-matrix.md` cubre **100 %** de las 384 rutas (guarda, capacidad, filtros de tenant)
- [ ] `npm run check:guards` verde y bloqueante en CI
- [ ] `resolveAccessContext` en producción con divergencia shadow **< 0,1 %** durante 7 días
- [ ] Extensión de tenant scoping en modo `throw` con **0 falsos positivos** durante 14 días
- [ ] Suite de aislamiento: 20 endpoints × empresa A/B, todos en 403/404 **sin datos cruzados**
- [ ] `allowLegacyFallback` eliminado o limitado a < 5 rutas documentadas
- [ ] Latencia p95 de autorización **< 40 ms** (medida con `perf:benchmark`)
- [ ] RLS activa en tablas de alto riesgo, con `app.bypass_rls` solo en migraciones/super-admin
- [ ] **P-12 cerrado**: ninguna ruta GET escribe en BD

### 5.13 Estrategia incremental

1. **Documentar antes de cambiar** (2.1): la matriz actual es la línea base y revela endpoints ya sin guarda.
2. **Shadow mode** (2.2): el resolvedor nuevo **nunca decide**, solo compara; se mide con logs.
3. **Migración por lotes** de 10–15 rutas por PR, empezando por `GET` y por módulos de bajo tráfico; cada lote con su test.
4. **Feature flag por capacidad**: activar para una ruta es 1 línea + 1 test; revertir es 1 línea.
5. **Tenant scoping en `warn`** durante 2 semanas, luego `throw` modelo por modelo.
6. **RLS al final**, tabla por tabla, con *canary* en una empresa interna de pruebas.
7. En cualquier momento, si la divergencia shadow sube o aparece un 403 inesperado en producción, **se apaga el flag** y se investiga.

### 5.14 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 6. FASE 3 — Arquitectura backend

**Estado:** `- [ ]` pendiente · **Sprint:** S7–S10 · **Esfuerzo:** 20–28 d · **Riesgo:** Medio-Alto

### 6.1 Objetivo

Introducir capas explícitas (controller → validación → autorización → caso de uso → repositorio → Prisma) y migrar los 384 handlers de forma **estrangulada**, sin reescritura masiva.

### 6.2 Problemas que resuelve

**P-1** (handlers monolíticos), **P-8** (validación ausente), **P-10** (sin contrato de errores), y parte de **P-17** (endpoints alias).

### 6.3 Archivos/módulos afectados

Todo `src/app/api/**` (progresivamente), `src/lib/*` (se va moviendo a `src/server/modules/*`), `src/types/index.ts` (se sustituye por tipos inferidos de Zod/Prisma), `src/proxy.ts` (CSP y resolución de host), `src/lib/prisma.ts` (pasa a ser la base de los repositorios).

### 6.4 Dependencias

Requiere **Fase 1** (tests) y **Fase 2** (contexto + guarda + tenant scoping). Habilita **Fase 5** (los repositorios son el punto donde cambian los modelos) y **Fase 6** (logging y `requestId` viven en `core/`).

### 6.5 Riesgo

**Medio-Alto.** El riesgo es de **comportamiento**: un handler migrado puede cambiar código de estado o forma de respuesta. Mitigación: contrato único + test de contrato por ruta migrada + migrar lectura antes que escritura.

### 6.6 Esfuerzo

**20–28 días:** 3 d de `core/` · 5 d del módulo piloto `cotizaciones` · 12–16 d de migración por lotes (25–30 % de las rutas de mayor valor) · 2 d de herramientas de verificación. El resto se migra orgánicamente con la regla del boy scout.

### 6.7 Beneficio

- Lógica reutilizable y **testeable** (servicios puros).
- Contrato de API consistente (fin de `{success}` vs `{ok}`).
- Validación sistemática → menos 500 y menos *mass assignment*.
- Cambios de esquema contenidos en una sola capa (facilita Fase 5).

### 6.8 Qué NO debemos modificar todavía

- **No** cambiar las **URLs** de los endpoints existentes (clientes e integraciones las usan); los alias se deprecan con aviso, no se eliminan aquí.
- **No** reescribir las rutas de CRM ni de website builder en esta fase: son las más grandes y van después del piloto.
- **No** mover los jobs con `X-API-Key` al nuevo wrapper hasta tener el modo `service` del wrapper.
- **No** cambiar el motor de cálculo de precios: solo se **mueve**, validado con los tests de Fase 1.

### 6.9 Estructura de carpetas objetivo

```
src/server/
├── core/
│   ├── http/         # withApiHandler, ApiError, responses, pagination
│   ├── auth/         # access-context, authorize, guards
│   ├── validation/   # parse + schemas comunes
│   ├── logging/      # logger estructurado, requestContext
│   └── events/       # publicación de eventos de dominio (post-commit)
└── modules/
    └── cotizaciones/
        ├── cotizaciones.schema.ts       # Zod entrada/salida
        ├── cotizaciones.repository.ts   # solo Prisma + tenant scope
        ├── cotizaciones.service.ts      # reglas puras, sin Next ni Prisma directo
        ├── cotizaciones.controller.ts   # HTTP: parse → authorize → service → map
        └── index.ts
```

`src/app/api/**/route.ts` queda como **adaptador de 5–15 líneas**: declara método + capacidad y delega en el controlador.

### 6.10 Reglas permanentes para endpoints nuevos y tocados

1. Ningún `route.ts` contiene lógica de negocio, ni `prisma.*` directo, ni `try/catch` propio.
2. Toda entrada pasa por Zod; toda salida pasa por el serializador del módulo.
3. Toda ruta declara capacidad; el wrapper la exige (las públicas se declaran explícitamente).
4. Los errores se lanzan como `ApiError` con `code` estable y `status`.
5. Los efectos secundarios (email, push, PDF, contabilidad) se publican como **eventos post-commit**, no dentro del handler.
6. Un módulo no importa de otro módulo: se comunica por `service` público o por evento.
7. Regla del boy scout: **todo endpoint que se toque, se migra**.
8. `npm run check:architecture` bloquea PRs que importen `@prisma/client` desde `route.ts` o que excedan el límite de líneas.

### 6.11 Tareas de ejecución

**A. Núcleo (`core/`)**
- [ ] **3.1** `src/server/core/http/`: `withApiHandler`, respuestas tipadas, paginación, `ApiError`
- [ ] **3.2** `src/server/core/validation/`: helper `parse(schema, data)` con mensajes de error normalizados
- [ ] **3.3** `src/server/core/logging/`: logger base + `requestContext` (se completa en Fase 6)
- [ ] **3.4** `src/server/core/events/`: bus mínimo con publicación **post-commit**
- [ ] **3.5** Tests unitarios de `core/` (wrapper, mapeo de errores, paginación)
- [ ] **3.6** ADR `docs/adr/0004-capas-backend.md`

**B. Piloto `cotizaciones` (valida el patrón antes de escalar)**
- [ ] **3.7** `cotizaciones.schema.ts` con Zod de entrada/salida (crear, editar, listar, ítems)
- [ ] **3.8** `cotizaciones.repository.ts` (solo Prisma + tenant scope)
- [ ] **3.9** `cotizaciones.service.ts` con las reglas de cálculo extraídas y testeadas
- [ ] **3.10** `cotizaciones.controller.ts` + migrar **las 11 rutas** de cotizaciones
- [ ] **3.11** Migrar la generación de PDF y el endpoint de token público
- [ ] **3.12** Helper `expectContract()` y test de contrato por cada ruta migrada del piloto

**C. Migración por lotes (15–20 rutas por lote)**
- [ ] **3.13** Lote 1: `materiales` + `clientes`
- [ ] **3.14** Lote 2: `inventario` + `bodegas`
- [ ] **3.15** Lote 3: `pos` (secuencias y medios de pago con test de contrato estricto)
- [ ] **3.16** Lote 4: `nomina` (sin tocar cálculos, solo capa)
- [ ] **3.17** Lote 5: `proveedores` + `compras` + `remisiones`
- [ ] **3.18** Lote 6: `crm` (el más grande; solo tras cerrar los anteriores)
- [ ] **3.19** Lote 7: `servicios-web` / website builder
- [ ] **3.20** Deprecar alias de endpoints con cabecera `Deprecation` + fecha de retirada documentada (no borrar todavía)

**D. Herramientas y cierre**
- [ ] **3.21** `npm run check:architecture` (bloquea `@prisma/client` en `route.ts` y límite de líneas) + job en CI
- [ ] **3.22** `docs/backend/patterns.md` con el patrón y un ejemplo "de libro" completo
- [ ] **3.23** Panel de progreso: `% rutas migradas` publicado y que **no puede bajar**
- [ ] **3.24** Actualizar `ARCHITECTURE.md` §4 y §15 con la arquitectura por capas

### 6.12 Criterios de aceptación

- [ ] `src/server/core` completo, con tests propios verdes
- [ ] Módulo piloto `cotizaciones` migrado al 100 % con contrato único
- [ ] **≥ 40 rutas** migradas (las de mayor tráfico) con tests de contrato
- [ ] `npm run check:architecture` verde y bloqueante en CI
- [ ] 100 % de las rutas **migradas** con Zod; **0** `prisma.` directo en esos `route.ts`
- [ ] Un único formato de error `{ ok: false, error: { code, message, requestId } }` en todo lo migrado
- [ ] `docs/backend/patterns.md` publicado y usado como referencia en revisión de PR
- [ ] Ningún cliente roto: los alias siguen respondiendo durante la transición

### 6.13 Estrategia incremental

1. **Piloto vertical completo** (`cotizaciones`: 11 rutas + PDF + token público) para validar el patrón antes de escalar.
2. **Lotes por módulo**, priorizando por tráfico y riesgo: `materiales` → `clientes` → `inventario` → `pos` → `nomina` → `crm` → `servicios-web`.
3. **Doble respuesta temporal**: el wrapper puede emitir el formato antiguo si la ruta declara `legacyShape: true`, para no romper clientes.
4. **Métrica de progreso** en CI: `% rutas migradas`, que no puede bajar entre PRs.
5. **Congelación de lógica nueva:** a partir de aquí, ningún PR añade lógica a una ruta no migrada (se migra primero o se rechaza).
6. Si una ruta migrada presenta un incidente, se revierte **solo ese lote** (el wrapper permite convivir con las no migradas).

### 6.14 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 7. FASE 4 — Frontend

**Estado:** `- [ ]` pendiente · **Sprint:** S5–S12 (paralelo) · **Esfuerzo:** 14–19 d · **Riesgo:** Medio

### 7.1 Objetivo

Romper los componentes gigantes, separar UI / estado / dominio, unificar la capa de datos cliente y reducir el `"use client"` innecesario.

### 7.2 Problemas que resuelve

**P-6** (componentes de 300–475 KB), **P-9** (lógica de negocio duplicada en cliente), **P-19** (i18n monolítico de 242 KB), **P-18** (`@tanstack/react-query` instalado sin uso).

### 7.3 Archivos/módulos afectados

`src/components/crm/crm-integrations-client.tsx`, `crm-chatbot-studio-client.tsx`, `crm-task-workspaces-client.tsx`, `crm-conversations-client.tsx`, `src/components/litografia/litografia-quote-dialog.tsx`, `litografia-calculator.tsx`, `src/app/dashboard/pos/page.tsx`, `src/lib/i18n/messages.ts`, `src/app/layout.tsx`, `src/components/providers/*`, `src/hooks/*`, `eslint.config.mjs`.

### 7.4 Dependencias

Requiere **Fase 1** (Playwright, para no romper flujos) y, en cada módulo concreto, la **Fase 3** correspondiente (para no duplicar el trabajo de mover lógica al servidor). Puede avanzar en paralelo en módulos independientes.

### 7.5 Riesgo

**Medio.** Riesgo de regresión visual/funcional en pantallas de uso diario; se mitiga con E2E y *feature flags* por componente.

### 7.6 Esfuerzo

**14–19 días:** 2 d de infraestructura (librería de datos + límites de lint + bundle analyzer) · 8–10 d de refactor de los 4 componentes más grandes · 2–3 d de reducción de `use client` · 2–3 d de i18n por *namespaces*.

### 7.7 Beneficio

- Bundles más pequeños y navegación más rápida (objetivo: **−30 %** en las rutas más pesadas).
- Una sola fuente de verdad para cálculos y datos.
- Archivos revisables (≤ 400 líneas) → PRs más rápidos y menos conflictos.

### 7.8 Qué NO debemos modificar todavía

- **No** migrar de Tailwind v4 ni cambiar el sistema de diseño.
- **No** reescribir el website builder (Puck) ni el editor de plantillas.
- **No** eliminar `zustand` ni el sistema de temas.
- **No** cambiar el diccionario i18n completo en un solo PR.

### 7.9 Tareas de ejecución

**A. Medición e infraestructura (medir antes de tocar)**
- [ ] **4.1** Script `npm run report:frontend`: KB y líneas por archivo, conteo de `use client`, tamaño de bundle por ruta
- [ ] **4.2** Instalar `@next/bundle-analyzer` y fijar presupuesto de bundle en CI (falla si una ruta lo excede)
- [ ] **4.3** Regla `max-lines` en `eslint.config.mjs` (primero `warn`, luego `error` por carpeta)
- [ ] **4.4** ADR `docs/adr/0005-datos-cliente.md`: una sola librería de datos cliente (usar `@tanstack/react-query` ya instalado **o** eliminarlo; nunca las dos cosas)

**B. Unificación de la capa de datos**
- [ ] **4.5** Módulo piloto `cotizaciones` consumiendo la librería elegida (queries, mutaciones, invalidación)
- [ ] **4.6** Sustituir los `fetch` + `useState` duplicados de cotizaciones por los *hooks* nuevos
- [ ] **4.7** Replicar el patrón en `pos` y `materiales`

**C. Extracción de dominio (fin de la lógica duplicada)**
- [ ] **4.8** Mover los cálculos de litografía a `src/lib/domain/litografia.ts` reutilizando **los mismos tests** que usa el servidor
- [ ] **4.9** Mover totales de cotización/POS a `src/lib/domain/totales.ts`
- [ ] **4.10** Eliminar del cliente toda fórmula que ahora vive en el dominio

**D. Refactor de componentes gigantes (un PR por sección)**
- [ ] **4.11** `litografia-calculator.tsx` y `litografia-quote-dialog.tsx` partidos por secciones
- [ ] **4.12** `crm-conversations-client.tsx` partido (lista, hilo, compositor, panel lateral)
- [ ] **4.13** `crm-task-workspaces-client.tsx` partido (tablero, filtros, detalle)
- [ ] **4.14** `crm-chatbot-studio-client.tsx` partido (flujo, nodos, panel de propiedades)
- [ ] **4.15** `crm-integrations-client.tsx` partido (catálogo, configuración, estado)
- [ ] **4.16** Verificar E2E verdes al cerrar **cada** refactor antes de mergear

**E. `use client` e i18n**
- [ ] **4.17** Reducir `"use client"`: revisar componente por componente y convertir a Server Component donde no haya estado/eventos
- [ ] **4.18** Dividir `src/lib/i18n/messages.ts` en `src/lib/i18n/messages/` por *namespace* con carga diferida y claves tipadas
- [ ] **4.19** Migrar cadenas por módulo, empezando por el de más volumen
- [ ] **4.20** Actualizar `ARCHITECTURE.md` §3 con la estructura de componentes e i18n resultante

### 7.10 Criterios de aceptación

- [ ] Cero archivos en `src/components` por encima de **600 líneas** al cerrar la fase
- [ ] Cálculos de litografía y totales en `src/lib/domain/*` con tests, usados por cliente **y** servidor
- [ ] **Una** librería de datos cliente en uso real, documentada en ADR (y `@tanstack/react-query` usado o eliminado)
- [ ] `"use client"` reducido **≥ 20 %** (de 206 a ≤ 165), medido en CI
- [ ] i18n por *namespace* con carga diferida, claves tipadas y ningún archivo > 50 KB
- [ ] Presupuesto de bundle en CI con umbral acordado y sin regresiones
- [ ] Los 5 E2E de Fase 1 siguen verdes

### 7.11 Estrategia incremental

1. **Medir primero** (4.1): el reporte se convierte en el tablero de la fase.
2. **Infraestructura antes que refactor**: límites de lint, bundle analyzer y librería de datos con **un** módulo piloto.
3. **Refactor por sub-feature**: cada componente gigante se parte en un PR por pestaña/sección, sin cambiar comportamiento.
4. **Dominio antes que UI**: los cálculos se extraen a funciones puras (cubiertas por tests) y luego el componente las consume.
5. **`use client` al final**: se evalúa componente por componente si realmente necesita estado/eventos.
6. **i18n por namespace y por módulo**, nunca en un PR global.

### 7.12 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 8. FASE 5 — Prisma y dominio

**Estado:** `- [ ]` pendiente · **Sprint:** S11–S13 · **Esfuerzo:** 10–14 d · **Riesgo:** **Alto**

### 8.1 Objetivo

Organizar el modelo de datos por dominios, consolidar duplicados y dejar el esquema preparado para evolucionar **sin dividir la base de datos**.

### 8.2 Problemas que resuelve

**P-7** (esquema único de 205 modelos y 158 migraciones), **P-17** (modelos duplicados), parte de **P-20** (entitlements duplicados).

### 8.3 Archivos/módulos afectados

`prisma/schema.prisma` (→ multi-archivo), `prisma/migrations/*`, `prisma.config.ts`, `scripts/sql/*`, `src/lib/prisma.ts`, repositorios de Fase 3, scripts de seed y `decision-engine:apply-snapshot-schema`.

### 8.4 Dependencias

Requiere **Fase 1** (tests, sobre todo de consecutivos y facturación) y **Fase 3** (repositorios, para que el cambio de modelos no toque handlers). Puede avanzar en paralelo con Fase 4.

### 8.5 Riesgo

**Alto.** Son migraciones sobre datos de producción (dinero, nómina, fiscal). Toda consolidación exige migración de datos reversible y periodo de doble lectura.

### 8.6 Esfuerzo

**10–14 días:** 2 d split del esquema · 1 d convenciones y CI · 3 d consolidación de plantillas · 2 d secuencias · 2–3 d entitlements · 2 d limpieza de tipos.

### 8.7 Beneficio

- Migraciones más pequeñas y localizadas (menos riesgo por PR).
- Menos tablas casi idénticas → menos código y menos bugs de sincronización.
- Modelo explicable por dominio, base para cualquier evolución futura.

### 8.8 Qué NO debemos modificar todavía

- **No** dividir la base de datos ni introducir microservicios (ver §8.13).
- **No** renombrar tablas en la misma migración en que se consolidan: primero crear + migrar datos, luego deprecar, luego borrar en una release posterior.
- **No** tocar los modelos de DIAN ni de contabilidad sin revisión funcional/contable.
- **No** eliminar `CotizacionTemplate` mientras existan documentos que lo referencien.

### 8.9 Organización propuesta (una sola base de datos)

```
prisma/
├── schema.prisma            # generator + datasource
└── schema/
    ├── tenancy.prisma       # Empresa, Sede, SedeMembership, User, Role, Capability, entitlements
    ├── sales.prisma         # Cotizacion, ItemCotizacion, Remision, RemisionItem, POS, secuencias
    ├── crm.prisma           # leads, conversaciones, mensajes, canales, campañas, tareas
    ├── marketing.prisma     # SEO, keywords, auditorías, formularios públicos
    ├── inventory.prisma     # materiales, bodegas, movimientos, mermas
    ├── purchasing.prisma    # órdenes de compra, pagos, proveedores
    ├── production.prisma    # órdenes de trabajo, acabados, tarifas litográficas
    ├── payroll.prisma       # contratos, periodos, novedades
    ├── accounting.prisma    # asientos, cuentas, conciliaciones
    ├── dian.prisma          # documentos electrónicos, numeración
    ├── website.prisma       # sitios, páginas/Puck, dominios, mensajes
    ├── rop.prisma           # marketplace B2B
    ├── platform.prisma      # notificaciones, push, backups, tickets, auditoría, jobs
    └── decision-engine.prisma
```

> Prisma 7 soporta esquema multi-archivo. Si la versión en uso no lo permitiera, se mantiene el archivo único **con separadores y convención de nombres por dominio**, sin dejar de aplicar el resto de la fase.

### 8.10 Relaciones entre dominios (evaluación)

| Relación | Estado | Recomendación |
|---|---|---|
| Ventas ↔ Inventario | Descuenta stock al confirmar cotización/remisión | Mantener en el **mismo** servicio transaccional (una transacción) |
| Ventas ↔ Contabilidad | Asiento generado al facturar | Evento post-commit dentro del monolito, no llamada síncrona entre módulos |
| Ventas ↔ Producción | Orden de trabajo desde cotización | FK directa (`cotizacionId`), sin duplicar datos de ítems |
| Nómina ↔ Contabilidad | Provisión y pago | Evento + asiento, jamás `UPDATE` cruzado |
| CRM ↔ Ventas | Lead convertido en cotización | FK blanda (`crmLeadId`) para no acoplar ciclos de vida |
| DIAN ↔ Ventas/Contabilidad | Documento electrónico referencia la venta | FK fuerte con estado propio (la DIAN es fuente de verdad del estado fiscal) |
| ROP ↔ Ventas | Cotización B2B puede convertirse en venta | FK blanda + evento |
| Website ↔ CRM | Formulario público crea lead | Evento, no transacción compartida |

### 8.11 Duplicados y candidatos a consolidación (verificados)

| # | Grupo | Modelos implicados | Acción |
|---|---|---|---|
| 1 | Plantillas de documento | `CotizacionTemplate` + `…Version`, `EmpresaCotizacionTemplate` + `…Version`, `RemisionTemplate`, `OrdenCompraTemplate`, `PosInvoiceTemplate`, `WebsiteServiceMessageTemplate`, `PayrollWorkflowTemplate` | Consolidar en `DocumentTemplate { empresaId, kind, scope, version }` + `DocumentTemplateVersion` |
| 2 | Secuencias | `CotizacionSequence`, `PosSequence`, `RemisionSequence`, `HelpTicketSequence` | `DocumentSequence { sedeId, documentType, next }` con la misma garantía de atomicidad |
| 3 | Entitlements | `PlanModuleSetting`, `EmpresaModuleOverride`, `DomainEntitlement`, `CapabilityEntitlement` | `Entitlement { empresaId \| planTier, capability \| module, enabled, source }` |
| 4 | Ítems de documento | `ItemCotizacion` vs `RemisionItem` | **No** fusionar tablas (semántica distinta); **sí** unificar cálculo y DTO en el dominio |
| 5 | Tipos TypeScript | `src/types/index.ts` redefine tipos de Prisma | Reemplazar por `Prisma.<Modelo>` y tipos inferidos de Zod |

> Cada fila es una unidad de trabajo independiente: se planifica, se migra y se verifica por separado.

### 8.12 Tareas de ejecución

**A. Split del esquema (movimiento puro, sin cambios)**
- [ ] **5.1** Verificar que la versión de Prisma instalada soporta esquema multi-archivo; si no, documentarlo y aplicar la convención por dominios en archivo único
- [ ] **5.2** Dividir `schema.prisma` **sin cambiar modelos** y validar con `prisma migrate diff` = **vacío**
- [ ] **5.3** `docs/architecture/data-model.md` con el mapa de dominios, relaciones y convención de nombres
- [ ] **5.4** ADR `docs/adr/0006-esquema-por-dominios.md`

**B. Plantillas de documento (duplicado #1)**
- [ ] **5.5** Crear `DocumentTemplate` + `DocumentTemplateVersion` (migración aditiva, sin borrar nada)
- [ ] **5.6** Script de migración de datos desde los 7 modelos de plantilla + verificación de conteos origen = destino
- [ ] **5.7** Repositorio leyendo del modelo nuevo con *feature flag*; doble lectura durante 2 semanas
- [ ] **5.8** Deprecar los modelos antiguos (`/// @deprecated`) **sin borrarlos**; borrado en una release posterior

**C. Secuencias (duplicado #2)**
- [ ] **5.9** Crear `DocumentSequence { sedeId, documentType, next }` + migrar el valor actual de cada secuencia por sede y tipo
- [ ] **5.10** Test de concurrencia sobre `DocumentSequence` (50 creaciones simultáneas, cero duplicados)
- [ ] **5.11** Verificar que el siguiente número emitido por sede coincide con el esperado (prueba controlada)

**D. Entitlements (duplicado #3)**
- [ ] **5.12** Crear `Entitlement` y hacer *backfill* desde las 4 fuentes actuales
- [ ] **5.13** Doble lectura y comparación: cualquier diferencia se investiga antes de cambiar la fuente de verdad
- [ ] **5.14** Unificar la consulta en `resolveAccessContext` (una sola query)

**E. Limpieza de tipos y cierre**
- [ ] **5.15** Eliminar de `src/types/index.ts` los tipos que duplican Prisma; sustituir por `Prisma.<Modelo>` e inferencia de Zod
- [ ] **5.16** Plan escrito de borrado de tablas deprecadas (release posterior, con *down* documentado)
- [ ] **5.17** Actualizar `ARCHITECTURE.md` §5 con el esquema por dominios

### 8.13 Por qué NO microservicios ni múltiples bases de datos

| Razón | Explicación |
|---|---|
| **Transacciones compartidas** | Cotización ↔ inventario ↔ contabilidad deben ser atómicas; partirlas exige sagas y compensaciones → mucho más código y modos de fallo nuevos |
| **Equipo pequeño** | Cada servicio añade despliegue, red, observabilidad y *on-call*; el beneficio (escalado independiente) no aplica a picos modestos |
| **El aislamiento no requiere particionado** | Se resuelve con tenant scoping + RLS (Fase 2), no con bases separadas |
| **Caso ya separado correctamente** | El OCR está en Python porque su *runtime* es distinto: ese es el criterio válido (diferencia tecnológica real), no el tamaño del módulo |

### 8.14 Criterios de aceptación

- [ ] Esquema dividido (o dominios delimitados y documentados) y `prisma generate` + `migrate deploy` verdes
- [ ] `docs/architecture/data-model.md` publicado
- [ ] Plantillas consolidadas con conteos origen = destino y doble lectura de 2 semanas sin incidencias
- [ ] Secuencias consolidadas sin perder consecutivos: test de concurrencia verde y siguiente número verificado
- [ ] `src/types/index.ts` eliminado o reducido a tipos que no existen en Prisma
- [ ] Cero migraciones destructivas sin *down* documentado
- [ ] Ningún modelo deprecado borrado en la misma release en que se introdujo el reemplazo

### 8.15 Estrategia incremental

1. **Split puro primero** (movimiento de texto) y validación con `migrate diff` vacío: garantiza que no cambia nada.
2. **Consolidaciones una por una**, cada una con esta secuencia: crear modelo nuevo → script de migración de datos → repositorio leyendo del nuevo → *backfill* → switch de lectura → deprecación.
3. **Nunca dos consolidaciones en el mismo PR.**
4. **Feature flag por consolidación** para poder volver a leer el modelo antiguo durante el periodo de observación.
5. El borrado físico de tablas viejas se hace **en una release posterior**, separada y con copia de seguridad verificada.

### 8.16 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 9. FASE 6 — Infraestructura

**Estado:** `- [ ]` pendiente · **Sprint:** S3, S7–S13 (paralelo) · **Esfuerzo:** 6–8 d · **Riesgo:** Medio

### 9.1 Objetivo

Alinear entornos, acelerar el despliegue y hacer el sistema **observable** (saber qué falló, dónde y para qué empresa) con logs estructurados, *request IDs* y manejo centralizado de errores.

### 9.2 Problemas que resuelve

**P-13** (Node 20 vs 22), **P-14** (imagen sin `standalone`), **P-10** (sin observabilidad ni contrato de errores), **P-11** (`fetch` interno en `proxy.ts`), parte de **P-12**.

### 9.3 Archivos/módulos afectados

`Dockerfile`, `docker-compose.prod.yml`, `.nvmrc`, `package.json` (`engines`), `next.config.ts` (`output: 'standalone'`, imágenes), `caddy/Caddyfile`, `src/proxy.ts`, `src/server/core/logging` (de Fase 3), `.github/workflows/deploy.yml`.

### 9.4 Dependencias

Requiere **Fase 1** (CI) y **Fase 3** (`core/http` para el handler de errores y el logger). Puede avanzar en paralelo a Fases 4 y 5.

### 9.5 Riesgo

**Medio.** Cambiar la imagen y el modo de arranque puede romper el despliegue; se mitiga con entorno de pruebas o despliegue *canary* en el mismo VPS.

### 9.6 Esfuerzo

**6–8 días:** 1 d Node 22 · 1,5 d `standalone` e imagen · 1 d imágenes/optimización · 1,5 d observabilidad y `requestId` · 1,5 d CI/CD · 1 d `proxy`.

### 9.7 Beneficio

- Imagen notablemente más pequeña y arranque más rápido; menos presión de RAM en el VPS.
- Un incidente se diagnostica en minutos (`requestId` → logs → empresa → ruta).
- Despliegues reproducibles y reversibles.

### 9.8 Qué NO debemos modificar todavía

- **No** migrar de VPS a Kubernetes ni a serverless.
- **No** cambiar la versión de Postgres ni el proveedor de BD.
- **No** introducir un APM propietario caro: primero logs estructurados + métricas básicas.
- **No** tocar `caddy` más allá de los dominios necesarios.

### 9.9 Tareas de ejecución

**A. Versión y build**
- [ ] **6.1** Alinear `Dockerfile` a **Node 22** (misma versión que `.nvmrc` 22.22.0) y declarar `engines.node` en `package.json`
- [ ] **6.2** Activar `output: 'standalone'` en `next.config.ts`
- [ ] **6.3** Reescribir el runtime del `Dockerfile` a partir de `.next/standalone` + `node_modules` mínimos (`npm ci --omit=dev`); medir tamaño antes/después
- [ ] **6.4** Verificar el build sin `NEXT_DISABLE_BUILD_CHECKS` (depende de Fase 1)
- [ ] **6.5** Documentar en `docs/operations/docker.md` los pasos de build, arranque y variables requeridas

**B. Imágenes y assets**
- [ ] **6.6** Instalar `sharp` y migrar a `next/image` donde hoy se usa `<img>` en listados y tarjetas
- [ ] **6.7** Configurar `images.remotePatterns` para S3/Spaces y para los dominios de sitios publicados
- [ ] **6.8** Auditar peso de fuentes y de las rutas más pesadas (usar el reporte de Fase 4)

**C. Observabilidad**
- [ ] **6.9** Logger **JSON** con `requestId`, `route`, `method`, `status`, `durationMs`, `empresaId`, `userId`; sin PII ni secretos
- [ ] **6.10** Generar `requestId` en el borde (o en `proxy.ts`), propagarlo a logs y a la respuesta (`X-Request-Id`)
- [ ] **6.11** Handler centralizado de errores: mapear `ApiError`, `ZodError` y errores de Prisma a HTTP (consolida Fase 3)
- [ ] **6.12** `/api/health` con estado de BD, Redis y OCR (sin exponer detalles sensibles)
- [ ] **6.13** Documentar en `docs/operations/observability.md` qué se registra y cómo se consulta un incidente

**D. CI/CD y proxy**
- [ ] **6.14** `.github/workflows/deploy.yml`: build de imagen en cada tag, migración previa, despliegue y *rollback* documentado
- [ ] **6.15** Eliminar el `fetch` interno de `src/proxy.ts`; resolver host con caché en memoria (TTL corto) y, si hay varios nodos, en Redis
- [ ] **6.16** Actualizar `ARCHITECTURE.md` §10 y §12 con la nueva imagen y el flujo de despliegue

### 9.10 Criterios de aceptación

- [ ] `Dockerfile` sobre **Node 22**, con `engines.node` declarado y build reproducible
- [ ] `output: 'standalone'` activo; imagen final **< 400 MB** y runtime sin `devDependencies`
- [ ] Build sin `NEXT_DISABLE_BUILD_CHECKS`
- [ ] `next/image` con `sharp` y `remotePatterns` configurados para S3 y dominios de sitios
- [ ] Logs JSON con `requestId` en todas las rutas migradas, sin PII ni secretos
- [ ] `X-Request-Id` presente en todas las respuestas de API
- [ ] Un solo lugar mapea errores a HTTP (sin `try/catch` repetidos en handlers migrados)
- [ ] CI/CD con build en tag, migración previa y *rollback* documentado
- [ ] `proxy.ts` sin `fetch` interno
- [ ] `/api/health` operativo y monitorizado

### 9.11 Estrategia incremental

1. **Node 22 y `standalone`** en una rama, desplegando primero a entorno de pruebas; comparar arranque y memoria antes de producción.
2. **Observabilidad entra por `core/http`** módulo a módulo: cada ruta migrada nace ya con logs y `requestId`.
3. **CI/CD** empieza con build + push de imagen (sin deploy automático) → luego deploy manual asistido → después automático en `develop`.
4. **Proxy**: primero caché en memoria con TTL corto (riesgo bajo); después mover a Redis si hay varios nodos.
5. Cualquier cambio de imagen se despliega en ventana con *rollback* listo (imagen anterior etiquetada).

### 9.12 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 10. FASE 7 — Limpieza y documentación

**Estado:** `- [ ]` pendiente · **Sprint:** S1 (inicio) y S14 (cierre) · **Esfuerzo:** 3–5 d · **Riesgo:** Bajo

### 10.1 Objetivo

Convertir el repositorio en un lugar donde alguien nuevo pueda trabajar en un día: README real, `docs/` con índice, ADRs y cero artefactos.

### 10.2 Problemas que resuelve

**P-16** (45–48 `.md` en la raíz, `tsc-trace.txt` de 8,4 MB, `tmp-*`), **P-18** (dependencias y directorios muertos) y documentación desactualizada (`.github/copilot-instructions.md` describe Next.js 14 y route groups inexistentes).

### 10.3 Archivos/módulos afectados

`README.md`, `INSTALACION.md`, `ROADMAP.md`, `PERFORMANCE.md`, `DEPLOY-KAMATERA.md`, los ~40 `.md` de arquitectura/CRM/ROP, `.github/copilot-instructions.md`, `tsc-trace.txt`, `tmp-ocr*.json`, `tmp-smoke-*.pdf`, `tmp-i18n-*.txt`, `package.json` (`stripe`), `src/pages/`, `src/app/uploads/`, `.gitignore`.

### 10.4 Dependencias

Requiere **Fase 0** (plantilla de variables) y **Fase 1** (CI documentado). Se alimenta en paralelo desde el inicio y se cierra al final, con los ADRs de todas las fases.

### 10.5 Riesgo

**Bajo.** Único riesgo: borrar un documento con valor histórico → se mitiga moviendo a `docs/archive/` antes de borrar.

### 10.6 Esfuerzo

**3–5 días:** 1 d README · 1,5 d `docs/` e índice · 1 d ADRs · 1 d limpieza de artefactos y dependencias · 0,5 d reconciliar instrucciones de IA.

### 10.7 Beneficio

Onboarding de horas en lugar de días, menos preguntas repetidas y documentación que no miente.

### 10.8 Qué NO debemos modificar todavía

- **No** borrar el histórico de decisiones: se mueve a `docs/archive/`.
- **No** eliminar scripts de `scripts/` que no estén claramente muertos: primero marcarlos y observarlos.
- **No** reescribir `ROADMAP.md` sin validar prioridades de negocio con el dueño del producto.

### 10.9 Tareas de ejecución

**A. Documentación base**
- [ ] **7.1** `README.md` real: qué es el producto, requisitos, arranque en 5 pasos, tests, despliegue y enlaces a `docs/`. Cero referencias a `create-next-app`
- [ ] **7.2** Crear `docs/` con estructura `architecture/`, `backend/`, `frontend/`, `data/`, `security/`, `operations/`, `adr/`, `archive/`
- [ ] **7.3** Índice `docs/README.md` y enlace a `ARCHITECTURE.md` y a este plan desde el README raíz
- [ ] **7.4** **Mover** (no borrar) los documentos temáticos de la raíz a `docs/<área>/`, dejando enlaces donde tenía sentido
- [ ] **7.5** ADRs de todas las fases (mínimo 8: secretos, CI/tests, autorización, tenant scoping, capas backend, datos cliente, esquema por dominios, `standalone`/Node 22)

**B. Limpieza técnica**
- [ ] **7.6** Eliminar `tsc-trace.txt`, `tmp-ocr*.json`, `tmp-smoke-*.pdf`, `tmp-i18n-*.txt`, `tsc.log` y cualquier `tmp-*` restante
- [ ] **7.7** Ampliar `.gitignore` para cubrir logs, trazas y archivos `tmp-*`
- [ ] **7.8** Eliminar `stripe` de `package.json` (sin uso) y ejecutar `npm audit` documentando el resultado
- [ ] **7.9** Decidir y ejecutar sobre `@tanstack/react-query` según el ADR de Fase 4 (usarlo o quitarlo)
- [ ] **7.10** Eliminar `src/pages/` (vacío) y `src/app/uploads/` (vacío) si siguen sin uso
- [ ] **7.11** Revisar `scripts/` y marcar/eliminar los scripts muertos de forma justificada

**C. Instrucciones para IA y cierre**
- [ ] **7.12** Actualizar `.github/copilot-instructions.md` a Next.js 16 y a la estructura real (sin route groups inexistentes)
- [ ] **7.13** Verificar que cada fase tiene su fila en la bitácora (§14) y su ADR
- [ ] **7.14** Revisión final de `ARCHITECTURE.md` contra el estado real del código
- [ ] **7.15** Cierre del plan: marcar todas las fases, archivar este documento en `docs/archive/` como versión ejecutada y abrir el siguiente ciclo en un plan nuevo

### 10.10 Criterios de aceptación

- [ ] `README.md` real y verificado por alguien externo al proyecto siguiendo solo sus pasos
- [ ] `docs/` con índice y estructura completa; `ARCHITECTURE.md` enlazado desde README y desde `docs/`
- [ ] **≥ 8 ADRs** publicados y enlazados desde el índice
- [ ] Cero archivos `tmp-*`, `tsc-*.log` ni `tsc-trace.txt` en Git
- [ ] `package.json` sin `stripe`; decisión sobre `@tanstack/react-query` documentada y aplicada
- [ ] `src/pages/` y `src/app/uploads/` eliminados (o justificados por escrito)
- [ ] `.github/copilot-instructions.md` alineado con el stack real
- [ ] Bitácora §14 completa: cada fase con fecha de inicio, cierre y evidencia

### 10.11 Estrategia incremental

1. `ARCHITECTURE.md` primero (ya creado) como fuente de verdad y punto de anclaje de todos los enlaces.
2. Crear `docs/` y **mover** los documentos existentes; nunca borrar en el mismo PR.
3. Un ADR por fase, escrito **al terminar** la fase (no antes: se documenta lo decidido, no lo imaginado).
4. Limpieza de artefactos en un PR aislado y trivial, fácil de revertir.
5. Revisión trimestral de la documentación con checklist propio (`docs/operations/doc-review.md`).

### 10.12 Evidencia y notas de ejecución

| Fecha | Acción | Evidencia (comando / PR) | Ejecutado por |
|---|---|---|---|
| — | — | — | — |

---

## 11. Registro de problemas P-1 … P-20

### 11.1 Tabla de priorización y estado

| ID | Problema | Prioridad | Riesgo de implementar | Impacto en negocio | Esfuerzo | Dependencias | Fase | Estado |
|---|---|---|---|---|---|---|---|---|
| **P-1** | Handlers con lógica + Prisma + RBAC sin capas | Alta | Medio | Alto | 20–28 d | P-8, Fase 1, Fase 2 | 3 | Pendiente |
| **P-2** | Multi-tenancy por filtro manual, sin RLS | **Crítica** | **Alto** | **Crítico** (fuga de datos) | 15–21 d | Fase 1, P-20 | 2 | Pendiente |
| **P-3** | Autorización fragmentada y sin caché | **Crítica** | **Alto** | Alto | 12–16 d | P-20, Fase 1 | 2 | Pendiente |
| **P-4** | Cero tests y sin CI | **Crítica** | Bajo | Alto | 5–7 d | Fase 0 | 1 | Pendiente |
| **P-5** | Build ignora errores de tipos | **Crítica** | Bajo | Alto | 1–2 d | Fase 1 | 1 | **Mitigado** (27/10/2026, tareas 1.3+1.4); falta CI bloqueante en `develop` (1.6) |
| **P-6** | Componentes de 300–475 KB | Media | Medio | Medio-Alto | 8–10 d | Fase 1, P-9 | 4 | Pendiente |
| **P-7** | Esquema único de 205 modelos | Alta | **Alto** | Alto | 10–14 d | Fase 1, Fase 3 | 5 | Pendiente |
| **P-8** | Zod en 12 de 384 rutas | Alta | Bajo | Alto | 8–10 d | P-1 | 3 | Pendiente |
| **P-9** | Lógica de negocio duplicada en cliente | Media | Medio | Medio | 5–7 d | Fase 1, P-1 | 4 | Pendiente |
| **P-10** | Sin contrato de errores ni observabilidad | Alta | Bajo | Alto | 6–8 d | Fase 3 (`core/http`) | 6 | Pendiente |
| **P-11** | `fetch` interno a sí mismo en `proxy.ts` | Media | Medio | Medio | 1–2 d | — | 6 | Pendiente |
| **P-12** | Escrituras (`ensure*`) en rutas de lectura | Alta | Medio | Medio-Alto | 2–3 d | Fase 2 | 2 | Pendiente |
| **P-13** | Node 20 en Docker vs 22 en local | Media | Bajo | Medio | 0,5–1 d | Fase 1 | 6 | Pendiente |
| **P-14** | Sin `output: 'standalone'` en Docker | Media | Bajo | Medio | 1–2 d | Fase 1, P-13 | 6 | Pendiente |
| **P-15** | Secretos en texto plano y plantillas con valores | **Crítica** | Bajo | Alto | 1–2 d | — | **0** | Pendiente |
| **P-16** | 45–48 `.md` en raíz + artefactos versionados | Baja | Bajo | Medio | 2–3 d | Fase 0 | 7 | Pendiente |
| **P-17** | Endpoints y modelos duplicados | Media | Medio | Medio | 3–5 d | Fase 3, P-7 | 5 | Pendiente |
| **P-18** | Dependencias y directorios muertos | Baja | Bajo | Bajo | 0,5–1 d | — | 7 | Pendiente |
| **P-19** | i18n monolítico de 242 KB | Media | Bajo | Medio | 5–8 d | Fase 4 | 4 | Pendiente |
| **P-20** | Cuatro capas de gating sin matriz documentada | **Crítica** | **Alto** | Alto | 10–15 d | P-3, Fase 1 | 2 | Pendiente |

**Totales:** **6 problemas críticos** (P-2, P-3, P-4, P-5, P-15, P-20) · 8 de prioridad alta · 6 de prioridad media · 2 de prioridad baja · esfuerzo agregado **88–127 días**.

### 11.2 Checklist de cierre por problema

Marcar solo cuando la verificación de §11.3 esté cumplida.

- [ ] **P-1** Cerrado — rutas críticas con capas y `check:architecture` bloqueante
- [ ] **P-2** Cerrado — extensión de tenant scoping en `throw` + RLS en tablas de alto riesgo
- [ ] **P-3** Cerrado — `resolveAccessContext` único, cacheado y usado por las rutas migradas
- [ ] **P-4** Cerrado — CI bloqueante con unit + integración + E2E
- [ ] **P-5** Cerrado — build sin `ignoreBuildErrors` ni `NEXT_DISABLE_BUILD_CHECKS`
- [ ] **P-6** Cerrado — ningún componente > 600 líneas
- [ ] **P-7** Cerrado — esquema por dominios + consolidaciones verificadas
- [ ] **P-8** Cerrado — Zod en todas las rutas migradas y en las nuevas por obligación
- [ ] **P-9** Cerrado — cálculos viven en `src/lib/domain/*` y los consume cliente y servidor
- [ ] **P-10** Cerrado — logs JSON + `requestId` + handler centralizado de errores
- [ ] **P-11** Cerrado — `proxy.ts` sin `fetch` interno
- [ ] **P-12** Cerrado — ninguna ruta GET escribe en BD
- [ ] **P-13** Cerrado — Docker y local en Node 22
- [ ] **P-14** Cerrado — imagen con `output: 'standalone'` < 400 MB
- [ ] **P-15** Cerrado — `gitleaks` limpio + todos los secretos rotados e inventariados
- [ ] **P-16** Cerrado — `.md` organizados en `docs/` y cero artefactos versionados
- [ ] **P-17** Cerrado — alias deprecados con fecha de retirada y modelos duplicados consolidados
- [ ] **P-18** Cerrado — sin `stripe`, sin directorios vacíos, decisión sobre `react-query` aplicada
- [ ] **P-19** Cerrado — i18n por *namespace* con carga diferida
- [ ] **P-20** Cerrado — matriz documentada y decisión de acceso única

### 11.3 Definición de "cerrado" (aplica a P-1…P-20)

Un problema **no** se cierra porque "ya se tocó el código". Se cierra cuando:

1. Existe **test automatizado** que fallaría si el problema volviera.
2. Existe **verificación en CI** (script o job) que lo impide en el futuro, cuando aplica.
3. `ARCHITECTURE.md` está actualizado.
4. Está anotado en la bitácora §14 con evidencia (PR/commit/comando).

---

## 12. KPIs de éxito del programa

Se miden con los scripts de la Fase 1 y se actualizan al cerrar cada fase.

| Métrica | Inicial | Meta | Actual | Fecha medición |
|---|---|---|---|---|
| Rutas con guarda declarada y verificada en CI | ~85 % (sin verificar) | 100 % | — | — |
| Rutas con validación Zod | 12 / 384 (3 %) | ≥ 80 % del tráfico | — | — |
| Tests automatizados | 0 | ≥ 120 unit + 20 integración + 5 E2E | — | — |
| Tiempo de pipeline en PR | No existe | < 12 min, bloqueante | — | — |
| Fugas de tenant en pruebas | Sin medición | 0 con 20 endpoints × 2 empresas | — | — |
| Latencia de autorización (p95) | 4–6 queries/request | < 40 ms con caché | — | — |
| Archivos > 600 líneas en `src/components` | 5 (hasta ~475 KB) | 0 | — | — |
| Archivos `"use client"` | 206 | ≤ 165 | — | — |
| Tamaño de imagen Docker | Sin `standalone` | < 400 MB | — | — |
| Rutas migradas a capas | 0 / 384 | ≥ 40 (alto tráfico) + nuevas | — | — |
| Tiempo de onboarding documentado | No medido (README inválido) | < 1 día | — | — |

---

## 13. Reglas de oro del programa

1. **Ninguna fase se salta:** Fase 0 y Fase 1 son barreras de entrada para el resto.
2. **Un PR = un lote pequeño + sus tests**; nada de refactors de tres semanas.
3. **Migrar, no reescribir:** el sistema sigue vendiendo durante todo el programa.
4. **Toda consolidación de datos tiene vuelta atrás** (doble lectura + *feature flag*).
5. **Sin microservicios ni múltiples BD:** el problema es de disciplina y capas, no de topología.
6. **La documentación se escribe al cerrar la fase**, no al abrirla.
7. **Todo bug corregido deja un test** y toda decisión estructural deja un ADR.
8. **Si el build o los smoke tests fallan, se revierte el lote** y se anota el bloqueo.

---

## 14. Bitácora de ejecución

Una fila por hito relevante (inicio/cierre de fase, cambio de decisión, incidente, bloqueo resuelto). Es la memoria del programa.

| Fecha | Fase | Hito / acción | Evidencia (PR / commit / comando) | Responsable |
|---|---|---|---|---|
| 27/10/2026 | — | Creación de `ARCHITECTURE.md` (estado real del sistema) | `cotizador-inteligente/ARCHITECTURE.md` | — |
| 27/10/2026 | — | Creación de este plan maestro (v1.0) | `cotizador-inteligente/PLAN-MAESTRO-REFACTORIZACION.md` | — |
| 27/10/2026 | 0 | Saneadas las plantillas de entorno y corregido `.gitignore` (tareas 0.4, 0.5, 0.6) | `git check-ignore` (`.env`/`.env.local` siguen ignorados), escaneo de secretos: 0 reales, `git log --all -- .env*` vacío | — |
| 27/10/2026 | 1 | **Retiradas las "vendas" del build** (tareas 1.3, 1.4, 1.5): `NEXT_DISABLE_BUILD_CHECKS` fuera del `Dockerfile`, `ignoreBuildErrors` fuera de `next.config.ts`, `tsc.log` borrado | `npm run typecheck` → EXIT 0 (154,4 s); `npm run build` → sin errores de tipos; `git grep NEXT_DISABLE_BUILD_CHECKS` → 0 en código/config | Cline |
| 27/10/2026 | 1 | Creado el pipeline de CI (tareas 1.1, 1.2) y el escaneo de secretos bloqueante (1.7) | `.github/workflows/ci.yml` (job `quality`, 8 pasos, caché npm/Prisma/.next), `.github/workflows/secret-scan.yml` + `.gitleaks.toml`; `gitleaks 8.30.1 --all` → 427 commits, `no leaks found` | Cline |

### 14.1 Bloqueos activos

| Fecha apertura | Fase | Bloqueo | Impacto | Plan de salida |
|---|---|---|---|---|
| 27/10/2026 | 0 | **Repositorio PÚBLICO con dos secretos reales en el historial** (`github.com/Iaramirez88/erpcotizador`): `NEXTAUTH_SECRET` (commit `7740c5b`) y un token `X-API-Key` de 16 caracteres compatible con `ADMIN_API_KEY` (commit `d92e74be`) | Cualquiera puede leerlos; si siguen vigentes permiten falsificar sesiones/JWT y llamar a `/api/admin/jobs/*` | Rotar `ADMIN_API_KEY` (0.15) y `NEXTAUTH_SECRET` (0.17) y desplegar; evaluar repo privado y/o reescritura de historial; borrar después las allowlists de `.gitleaks.toml` |
| 27/10/2026 | 1 | **Branch protection en `develop` sin activar** (tarea 1.6): requiere admin del repositorio y no se puede versionar | El pipeline ya corre, pero **no bloquea** merges: un PR con `build` rojo podría fusionarse | Admin: `Settings → Branches → Add branch protection rule` sobre `develop` → *Require a pull request* + *Require status checks* con `CI / Estático (lint · typecheck)`, `CI / Build` y `Secret Scan / gitleaks (historial completo)`. Pasos en la cabecera de `ci.yml` |
| 27/10/2026 | 0 | **Rotaciones de secretos pendientes** (tareas 0.9–0.17): `NEXTAUTH_SECRET` histórico en Git, `SHARE_TOKEN_SECRET`, `RESEND_API_KEY`, `ADMIN_API_KEY`, Bold, VAPID, S3 | Los valores siguen siendo válidos si alguna vez se filtraron; `gitleaks` los verá como deuda histórica | Rotar en cada proveedor, desplegar, anotar en §3.13 y borrar las allowlists de `.gitleaks.toml` que ya no apliquen |

### 14.2 Decisiones tomadas durante la ejecución

| Fecha | Fase | Decisión | Alternativas descartadas | ADR |
|---|---|---|---|---|
| 27/10/2026 | 1 | `npm run lint` entra en CI en modo **informe** (`continue-on-error`) porque arrastra 163 errores heredados; se volverá bloqueante al saldarlos (§4.11) | Bloquearlo desde el primer día → habría congelado todos los PR sin código nuevo que lo justifique | — |
| 27/10/2026 | 1 | El pipeline se partió en **dos jobs en paralelo** (`estatico` y `build`) | Un solo job secuencial: la suma medida daba **≈ 11,8 min** sin contar `npm ci`, fuera del objetivo de 12 min | — |
| 27/10/2026 | 1 | CI usa **Node 22.22.0** (`.nvmrc`) y no el `node:20` del `Dockerfile` | Usar Node 20 para igualar producción → habría divergido del entorno de desarrollo y del `typecheck` local | pendiente (P-13, Fase 6) |
| 27/10/2026 | 1 | `gitleaks` escanea **todo el historial** con allowlists estrechas por *commit + archivo*, en vez de limitarse al diff del PR | Escanear solo el rango del PR → habría dejado pasar secretos antiguos que siguen siendo válidos | — |

---

## 15. Control de cambios del documento

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 27/10/2026 | Versión inicial: fases 0–7, tabla P-1…P-20, KPIs, bitácora | — |

---

## 16. Mantenimiento de este documento

- **Cuándo se actualiza:** al iniciar/cerrar una fase, al completar un bloque de tareas y en cada hito de la bitácora. Nunca se deja "para el final".
- **Qué se actualiza:** el estado del tablero (§1.1), las casillas de tareas y criterios de la fase, la bitácora (§14), los KPIs (§12) y la tabla P (§11).
- **Qué NO se hace aquí:** registrar decisiones estructurales sin ADR, ni valores de secretos, ni detalles de implementación que pertenecen a `docs/backend/patterns.md`.
- **Regla de coherencia:** si el plan y `ARCHITECTURE.md` divergen, manda `ARCHITECTURE.md` (describe la realidad) y este plan se corrige en el mismo PR.
- **Revisión de integridad recomendada antes de cada sprint:**
  - [ ] Ninguna fase tiene tareas en curso sin fecha de inicio en §1.1
  - [ ] Ninguna tarea marcada `[x]` sin evidencia en §14
  - [ ] Los totales de §1.1 cuadran con las casillas marcadas de cada fase
  - [ ] Cifras de §2 revalidadas si se tocó código de rutas, modelos o componentes

---

*Documento vivo. Última revisión de estructura: 27/10/2026 (v1.0). Documento hermano del estado real: [`ARCHITECTURE.md`](./ARCHITECTURE.md).*
