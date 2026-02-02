# Despliegue en Kamatera (Ubuntu 24.04 + Docker Compose)

Este proyecto ya trae un despliegue “1 VM” con Docker Compose en `docker-compose.prod.yml`.

> Recomendación: para el plan **2 vCPU / 4 GB RAM / 40 GB SSD**, mantén el OCR con límites (ya están en el compose) y considera activar swap para evitar OOM durante el build.

## 1) Preparar el servidor

### Crear VM
- Imagen: **Ubuntu Server 24.04 LTS**
- Tamaño sugerido mínimo: **2 vCPU / 4 GB RAM / 40 GB**
- Red: habilita IP pública
### Seguridad básica
- Crea un usuario (no root) y usa SSH keys.

### Firewall (Kamatera) + UFW (Ubuntu) — paso a paso

Objetivo: dejar **solo** abierto a Internet lo mínimo: SSH para administración y HTTP/HTTPS para el sitio. La app corre en Docker y no debe exponer `3000` públicamente.

#### A) Firewall en Kamatera (panel)
1. En Kamatera: **My Cloud → Server Management → tu servidor → Firewall**.
2. Verifica que el Firewall esté **Enabled**.
3. En **Interface Policy** (normalmente `net0`):
  - **IN**: `DROP`
  - **OUT**: `ACCEPT`
4. En **Firewall Rules → Add Rule**, agrega estas reglas (orden sugerido):
  - **Allow SSH**
    - Direction: `IN`
    - Protocol: `TCP`
    - Port: `22`
    - Source: tu IP pública (recomendado) o temporalmente `Any`
    - Policy: `ACCEPT`
  - **Allow HTTP**
    - Direction: `IN`, Protocol: `TCP`, Port: `80`, Source: `Any`, Policy: `ACCEPT`
  - **Allow HTTPS**
    - Direction: `IN`, Protocol: `TCP`, Port: `443`, Source: `Any`, Policy: `ACCEPT`

Notas:
- Si vas a usar Cloudflare con proxy (nube naranja) y quieres endurecer, puedes cambiar Source de `80/443` a **rangos IP de Cloudflare** (IPv4/IPv6). Kamatera soporta **IP Sets** para agruparlos, pero debes mantenerlos actualizados si Cloudflare cambia rangos.
- No abras `5432` (Postgres), `6379` (Redis) ni `3000` al público.

#### B) Firewall en Ubuntu (UFW)
Esto protege incluso si el firewall del panel queda mal configurado.

1. Conéctate por SSH y asegúrate de tener la sesión abierta mientras aplicas cambios.
2. Instala/activa UFW:
  - `sudo apt update`
  - `sudo apt install -y ufw`
3. Permite SSH antes de habilitar UFW:
  - `sudo ufw allow OpenSSH`
4. Permite web:
  - `sudo ufw allow 80/tcp`
  - `sudo ufw allow 443/tcp`
5. (Opcional) Si piensas administrar por VPN, puedes limitar SSH a tu IP:
  - `sudo ufw delete allow OpenSSH`
  - `sudo ufw allow from TU_IP_PUBLICA to any port 22 proto tcp`
6. Habilita y verifica:
  - `sudo ufw enable`
  - `sudo ufw status verbose`

#### C) Asegurar que Docker no exponga puertos no deseados
En producción, lo ideal es que el servicio `app` **no** publique `3000:3000` a Internet cuando tienes proxy (Caddy/Nginx). Solo el proxy publica `80/443`.

## 2) Dominio con Cloudflare + HTTPS con Caddy

### A) DNS (apuntar el dominio al servidor)
1. En Cloudflare: **DNS → Records → Add record**.
2. Crea un registro:
  - Type: `A`
  - Name: `@` (o el subdominio, por ejemplo `app`)
  - IPv4 address: `IP_PUBLICA_DE_TU_KAMATERA`
  - Proxy status:
    - Para Caddy + Let's Encrypt (simple): **DNS only (nube gris)**
    - Si quieres WAF/Proxy de Cloudflare (nube naranja): usa **certificado de origen** (ver notas abajo)
3. (Opcional) Para `www`, crea `CNAME` `www → @` y déjalo Proxied.

### B) SSL/TLS en Cloudflare
1. En Cloudflare: **SSL/TLS**:
  - Modo recomendado: confirmarlo como `Full (strict)`.
2. Si usas un proxy en el servidor (Caddy recomendado), Cloudflare conecta por HTTPS al origen.

### C) Caddy (reverse proxy) en Docker Compose
1. Edita `caddy/Caddyfile` y pon tus hosts (dominio y subdominios).
2. Firewall (Kamatera/UFW): permitir `80/tcp` y `443/tcp`.
3. Levanta el stack:
  - `docker compose -f docker-compose.prod.yml up -d --build`

Qué queda expuesto:
- Público: `80/443` (Caddy)
- Interno (red Docker): `app:3000`, `postgres:5432`, `redis:6379`, `ocr:8001`

Notas importantes sobre Cloudflare (nube naranja):
- Con el Caddy de este repo (imagen oficial), lo más simple es dejar los registros como **DNS only** para que Caddy pueda emitir/renovar certificados Let's Encrypt sin fricción.
- Si quieres mantener **Proxied**, lo correcto es generar un **Cloudflare Origin Certificate** y configurar Caddy para usarlo (cert+key montados como archivos). Evita depender de Let's Encrypt detrás del proxy.

## 3) Variables de entorno

Usa el ejemplo: [.env.docker.example](.env.docker.example)

Mínimo para arrancar:
- `DATABASE_URL`
- `NEXTAUTH_SECRET` (genera uno fuerte)
- `APP_URL=https://tu-dominio.com`

Opcional pero recomendado:
- `SHARE_TOKEN_SECRET`
- `RESEND_API_KEY` / `EMAIL_FROM` (si se usan envíos)
- `BOLD_*` (si se usa cobro)

OCR:
- `OCR_SERVICE_API_KEY` (si quieres proteger llamadas internas)
- Límites (importante en VPS): `OCR_CPUS`, `OCR_MEM_LIMIT`, etc.

## 4) Levantar el stack

En el servidor (dentro de `cotizador-inteligente/`):
- Copia `.env.docker.example` a `.env` y ajusta valores.
- Arranca:
  - `docker compose -f docker-compose.prod.yml up -d --build`

Incluye:
- `postgres` (NO expuesto públicamente)
- `redis` (NO expuesto públicamente)
- `ocr` (NO expuesto públicamente)
- `migrate` (aplica migraciones)
- `app` (interno en Docker, no publica `3000`)
- `worker` (cola OCR)
- `caddy` (publica `80/443`)

Persistencia (volúmenes docker):
- DB: `db_data`
- Redis: `redis_data`
- Archivos runtime: `scans_data`, `uploads_data`, `soportes_data`

## 5) Backups y operación

### Backups DB
Si el Postgres queda dentro del mismo servidor, planifica backups:
- `pg_dump` diario + retención (7–30 días)
- Copia externa (S3/Spaces/otro servidor)

### Actualizaciones
- `git pull` + `docker compose up -d --build`
- Considera ventanas de mantenimiento (habrá rebuild/restart).

### Observabilidad mínima
- Alertas de disco (40GB se llena fácil con scans si no usas S3)
- CPU/RAM
- Logs de contenedores

## Notas importantes (para evitar sustos)

- Si dejas archivos en disco local (sin S3), el tamaño del disco es crítico.
- El OCR es el principal riesgo de picos: por eso se limitaron CPU/RAM y threads en `docker-compose.prod.yml`.
- Si planeas varias instancias, hay que migrar archivos a S3/Spaces (no disco local).
