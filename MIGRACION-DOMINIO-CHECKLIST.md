# Checklist operativo — Migración de dominio

> **Dominio actual:** `sgdigitalordex.com`
> **Dominio nuevo:** `joinclap.com.co` (ya en Cloudflare)
> **Objetivo:** migrar la plataforma en producción manteniendo su funcionamiento normal (servidor Kamatera + integraciones/APIs).

Este documento es una lista operativa para ejecutar y verificar el cambio de dominio de extremo a extremo. Está pensado para tildar (`[x]`) a medida que avanza cada fase.

---

## Valores de referencia (viejo → nuevo)

| Concepto | Valor actual | Valor nuevo |
|---|---|---|
| Dominio principal | `sgdigitalordex.com` | `joinclap.com.co` |
| `www` | `www.sgdigitalordex.com` | `www.joinclap.com.co` |
| Subdominios gratuitos (Website Builder) | `*.sgdigitalordex.com` | `*.joinclap.com.co` |
| CNAME target (dominios personalizados) | `edge.sgdigitalordex.com` | `edge.joinclap.com.co` |
| IP pública VPS | `<IP actual>` (NO cambia) | `<IP actual>` |
| Callback OAuth Meta | `https://sgdigitalordex.com/api/oauth/meta/callback` | `https://joinclap.com.co/api/oauth/meta/callback` |
| Webhook Meta | `https://sgdigitalordex.com/api/webhooks/meta` | `https://joinclap.com.co/api/webhooks/meta` |
| Callback Google Marketing | `https://sgdigitalordex.com/api/oauth/google-marketing/callback` | `https://joinclap.com.co/api/oauth/google-marketing/callback` |
| Callback Google login social | `https://sgdigitalordex.com/api/auth/callback/google` | `https://joinclap.com.co/api/auth/callback/google` |
| Webhook Bold | `https://sgdigitalordex.com/api/pos/payments/bold/webhook` | `https://joinclap.com.co/api/pos/payments/bold/webhook` |
| Email remitente | `no-reply@sgdigitalordex.com` | `no-reply@joinclap.com.co` |

---

## Fase 0 — Preparación

- [ ] Confirmar en el servidor el dominio actual real:
  ```bash
  cat .env | grep -E 'APP_URL|NEXTAUTH_URL|NEXT_PUBLIC_WEBSITE_BASE_DOMAIN'
  ```
- [ ] Obtener la IP pública del VPS desde el panel de Kamatera (no asumirla).
- [ ] Tomar **snapshot** de la VM en Kamatera.
- [ ] Backup de la BD:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U sgdigital sgdigital > backup_$(date +%F).sql
  ```
- [ ] Guardar copia del `.env` actual en un lugar seguro (fuera del servidor).
- [ ] Listar accesos a los portales externos: Cloudflare, Google Cloud Console, Meta for Developers, TikTok, Resend, Bold, Daily.co, DIAN/proveedor, S3/Spaces.
- [ ] Definir ventana de mantenimiento y avisar a los usuarios (habrá cierre de sesión).

## Fase 1 — Cloudflare DNS (`joinclap.com.co`)

- [x] Verificar que la zona `joinclap.com.co` está activa en Cloudflare.
- [x] Crear registro `A @ → <IP_VPS>` (Proxy: **DNS only** / nube gris inicialmente).
- [x] Crear registro `CNAME www → joinclap.com.co` (DNS only inicialmente).
- [x] Crear registro `A * → <IP_VPS>` (wildcard, para subdominios gratuitos).
- [x] Crear registro `A edge → <IP_VPS>` (para `edge.joinclap.com.co`).
- [x] Verificar resolución:
  ```bash
  nslookup joinclap.com.co
  nslookup www.joinclap.com.co
  nslookup edge.joinclap.com.co
  ```
- [x] Configurar SSL/TLS en Cloudflare → **Full (strict)**.

## Fase 2 — Cloudflare Turnstile

- [x] En el widget Turnstile, agregar a hostnames permitidos: `joinclap.com.co`, `www.joinclap.com.co`, `*.joinclap.com.co`.
- [x] Confirmar que `TURNSTILE_ALLOWED_HOSTS` quedará alineado en `.env` (Fase 4).

## Fase 3 — Código (repo)

- [x] `caddy/Caddyfile` línea 10: `sgdigitalordex.com, www.sgdigitalordex.com` → `joinclap.com.co, www.joinclap.com.co`.
- [x] `caddy/Caddyfile` líneas 24-25: wildcard `*.sgdigitalordex.com` → `*.joinclap.com.co`.
- [x] `src/lib/google-oauth.ts` línea 62: `https://sgdigitalordex.com/dashboard` → `https://joinclap.com.co/dashboard`.
- [x] `docker-compose.prod.yml`: defaults `sgdigitalordex.com` → `joinclap.com.co` (líneas 68, 89), `edge.sgdigitalordex.com` → `edge.joinclap.com.co` (línea 91), `TURNSTILE_ALLOWED_HOSTS` (línea 96).
- [x] `src/app/dashboard/configuracion/servicios-web/sitios/[projectId]/seo/page.tsx` línea 29: `${subdomain}.sgdigitalordex.com` → `${subdomain}.joinclap.com.co`.
- [x] Rutas `src/app/api/admin/jobs/*`: strings `cron_setup`/`curl_example` con `sgdigitalordex.com` → `joinclap.com.co`.
- [x] `.env.docker.example`: actualizar valores de ejemplo (`APP_URL`, `NEXT_PUBLIC_WEBSITE_BASE_DOMAIN`, `WEBSITE_DOMAIN_CNAME_TARGET`, `TURNSTILE_ALLOWED_HOSTS`, `EMAIL_FROM`).
- [x] Documentos `.md` (opcional): `DEPLOY-KAMATERA.md`, `CONFIGURACION-GOOGLE-MARKETING-SEO.md`, `WEBSITE-DOMAINS-ROADMAP.md`.
- [ ] PR → revisión → merge → build de imagen.

## Fase 4 — Servidor Kamatera (`.env` + deploy)

- [ ] Editar `.env`:
  ```dotenv
  APP_URL=https://joinclap.com.co
  NEXTAUTH_URL=https://joinclap.com.co
  NEXT_PUBLIC_WEBSITE_BASE_DOMAIN=joinclap.com.co
  WEBSITE_DOMAIN_CNAME_TARGET=edge.joinclap.com.co
  WEBSITE_DOMAIN_IPV4=<IP actual>
  TURNSTILE_ALLOWED_HOSTS=joinclap.com.co
  EMAIL_FROM="SGDigital <no-reply@joinclap.com.co>"
  ```
- [ ] Solo si están en uso: actualizar `GOOGLE_MARKETING_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `S3_PUBLIC_BASE_URL`, `NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION`, `SGDIGITAL_DAILY_DOMAIN`.
- [ ] Reconstruir `app` (obligatorio por `NEXT_PUBLIC_*`):
  ```bash
  BUILDKIT_PROGRESS=plain docker compose -f docker-compose.prod.yml build app ocr
  docker compose -f docker-compose.prod.yml up -d --no-build
  ```
- [ ] Reiniciar Caddy para cargar el nuevo Caddyfile y emitir certificados:
  ```bash
  docker compose -f docker-compose.prod.yml restart caddy
  ```
- [ ] Verificar HTTPS y certificado:
  ```bash
  curl -I https://joinclap.com.co
  ```

## Fase 5 — Portales externos

### Google Cloud Console (OAuth)
- [ ] Agregar *Authorized JavaScript origins*: `https://joinclap.com.co`.
- [ ] Agregar *Authorized redirect URIs*:
  - `https://joinclap.com.co/api/auth/callback/google` (login social)
  - `https://joinclap.com.co/api/oauth/google-marketing/callback` (marketing/SEO)
- [ ] Actualizar `GOOGLE_REDIRECT_URI` y `GOOGLE_MARKETING_REDIRECT_URI` en `.env`.
- [ ] Re-verificar propiedad en **Google Search Console** y reenviar sitemaps.
- [ ] Actualizar dominio en **Google Ads / Analytics** (atribución/conversiones).

### Meta (WhatsApp / Instagram / Facebook / Messenger)
- [ ] *App Domains* → `joinclap.com.co`.
- [ ] *Valid OAuth Redirect URIs* → `https://joinclap.com.co/api/oauth/meta/callback`.
- [ ] Webhook → Callback URL `https://joinclap.com.co/api/webhooks/meta` + verify token.
- [ ] Re-verificar dominio de la app (si Meta lo exige) y actualizar `NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION`.

### TikTok
- [ ] Actualizar redirect/callback OAuth al nuevo dominio.
- [ ] Actualizar webhook URL a `https://joinclap.com.co/...`.

### Resend (email)
- [ ] Verificar dominio `joinclap.com.co` en Resend (SPF + DKIM).
- [ ] Agregar como dominio verificado.
- [ ] Actualizar `EMAIL_FROM` a `no-reply@joinclap.com.co`.
- [ ] Actualizar webhooks de Resend si están configurados.

### Bold (pagos)
- [ ] Actualizar **return URL** y **webhook URL** a `https://joinclap.com.co/api/pos/payments/bold/webhook`.
- [ ] Actualizar link de billing si aplica (`/api/billing/bold/link`).
- [ ] No tocar `BOLD_IDENTITY_KEY` / `BOLD_WEBHOOK_SECRET`.

### Daily.co (videollamadas)
- [ ] Actualizar dominios permitidos de las salas si usan el dominio.

### DIAN (facturación electrónica)
- [ ] Revisar configuración por empresa en BD (`empresa.dianSettings`) por URLs de callback/retorno.
- [ ] Confirmar con el proveedor tecnológico si el dominio está registrado/certificado.

### S3 / DigitalOcean Spaces
- [ ] Actualizar `S3_PUBLIC_BASE_URL` solo si el bucket/CDN usa el dominio.

## Fase 6 — Crontab del servidor

- [ ] Listar el crontab actual:
  ```bash
  crontab -l
  ```
- [ ] Reemplazar `https://sgdigitalordex.com/...` → `https://joinclap.com.co/...` en todos los jobs (`/api/admin/jobs/*`, `/api/cron/*`).

## Fase 7 — Verificación end-to-end

- [ ] Login con credenciales.
- [ ] Login con Google.
- [ ] Conexión OAuth Google Marketing.
- [ ] Conexión OAuth Meta (WhatsApp/IG/FB).
- [ ] Recepción de webhook WhatsApp (`/api/webhooks/meta`).
- [ ] Formulario público con Turnstile.
- [ ] Pago Bold: checkout + confirmación por webhook.
- [ ] Envío de email desde `no-reply@joinclap.com.co`.
- [ ] Publicar sitio gratuito `empresa.joinclap.com.co`.
- [ ] Conectar/verificar dominio personalizado apuntando a `edge.joinclap.com.co`.
- [ ] Jobs de cron administrativos responden en el dominio nuevo.

## Fase 8 — Redirección 301 (recomendado)

- [x] Agregar en `caddy/Caddyfile` un bloque que redirija `sgdigitalordex.com` y `www.sgdigitalordex.com` → `https://joinclap.com.co` (301).
- [ ] Recargar Caddy y verificar:
  ```bash
  curl -I https://sgdigitalordex.com
  ```

## Fase 9 — Monitoreo y rollback

- [ ] Vigilar logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f --tail=100 app caddy
  ```
- [ ] Verificar renovación de certificados (`caddy_data`).
- [ ] Confirmar que no quedan referencias a `sgdigitalordex` en el repo ni en `.env`:
  ```bash
  grep -ri "sgdigitalordex" . --exclude-dir=node_modules --exclude-dir=.git --exclude='*.lock'
  ```
- [ ] Mantener snapshot/backup disponible por si hay que revertir.


