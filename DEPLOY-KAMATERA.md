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

Nota de performance:
- El compose de producción ya reutiliza una sola imagen Node para `app`, `worker` y `migrate`.
- En cada despliegue solo deberían reconstruirse `app` y `ocr`; `worker` y `migrate` arrancan desde la misma imagen ya construida.

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
- Runtime IA y configuraciones JSON por empresa: `runtime_data`
- Archivos runtime: `scans_data`, `uploads_data`, `soportes_data`

Importante:
- El JSON maestro de Litografía IA y la auditoría/historial IA no viven en Postgres; se guardan en `.runtime-data` dentro de la app.
- Si esa carpeta no está montada a un volumen persistente, cada recreación del contenedor puede devolver la interfaz a “Base por defecto”, aunque la base de datos siga intacta.

## 5) Backups y operación

### Backups DB
Si el Postgres queda dentro del mismo servidor, planifica backups:
- `pg_dump` diario + retención (7–30 días)
- Copia externa (S3/Spaces/otro servidor)

### Actualizaciones
- `git pull` + `docker compose up -d --build`
- Considera ventanas de mantenimiento (habrá rebuild/restart).

Eso actualiza la aplicación. No actualiza Ubuntu ni los paquetes del sistema.

#### Actualizaciones del sistema operativo
Cuando el login del VPS muestra mensajes como `68 updates can be applied immediately` o `System restart required`, las actualizaciones se hacen con `apt`, no con Docker.

Secuencia recomendada:

1. Revisa qué se va a actualizar:
  - `sudo apt update`
  - `apt list --upgradable`
2. Aplica las actualizaciones disponibles:
  - `sudo apt upgrade -y`
3. Si también quieres incluir cambios que agregan o reemplazan dependencias del sistema:
  - `sudo apt full-upgrade -y`
4. Limpia paquetes que ya no se usan:
  - `sudo apt autoremove -y`
  - `sudo apt autoclean`
5. Si Ubuntu indica reinicio pendiente:
  - `sudo reboot`

Verificación después del reinicio:

- `sudo apt update`
- `apt list --upgradable`
- `sudo docker ps`
- `df -h /`

Qué conviene hacer antes de un `upgrade` en este VPS:

- Confirmar que la app esté estable: `docker compose -f docker-compose.prod.yml ps`
- Tener backup reciente de Postgres si vas a hacer mantenimiento amplio
- Hacerlo en una ventana corta de mantenimiento, porque un update del kernel o de librerías base puede requerir reinicio

Notas prácticas:

- `sudo apt upgrade -y` suele ser suficiente para mantenimiento rutinario
- `sudo apt full-upgrade -y` úsalo cuando quieras dejar el sistema completamente al día y aceptas posibles cambios adicionales de paquetes
- Si solo quieres instalar parches de seguridad automáticos, puedes evaluar `unattended-upgrades`, pero en este servidor hoy no está configurado

Para VPS pequeños, usa esta secuencia para reducir picos y hacer el proceso más predecible:
- `BUILDKIT_PROGRESS=plain docker compose -f docker-compose.prod.yml build app ocr`
- `docker compose -f docker-compose.prod.yml up -d --no-build`

Si el build parece quedarse congelado en `Creating an optimized production build ...` pero luego avanza apenas tocas el teclado, normalmente no es un error del código sino de la vista interactiva de BuildKit. En ese caso:
- usa `BUILDKIT_PROGRESS=plain docker compose -f docker-compose.prod.yml build app`
- o `docker compose --progress plain -f docker-compose.prod.yml build app`

Eso fuerza salida lineal continua y evita la pantalla "pausada" del renderer TTY. Si aun con progreso plano el build tarda demasiado o termina por OOM, sube `BUILD_MAX_OLD_SPACE_SIZE` en `.env` y confirma que el VPS tenga swap activa.

### Observabilidad mínima
- Alertas de disco (40GB se llena fácil con scans si no usas S3)
- CPU/RAM
- Logs de contenedores

### Limpieza segura de disco
En una revisión real de este VPS, el consumo fuerte no vino de la carpeta del proyecto ni de los volúmenes Docker de la app, sino de estas rutas del sistema:

- `/var/log/journal`
- `/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs`
- `/var/lib/containerd/io.containerd.content.v1.content`

Antes de borrar nada, revisa primero:

- `df -h /`
- `sudo du -xhd1 /var 2>/dev/null | sort -h`
- `sudo du -xhd1 /var/lib 2>/dev/null | sort -h`
- `sudo du -xhd1 /var/lib/containerd 2>/dev/null | sort -h`
- `sudo du -xhd1 /var/log 2>/dev/null | sort -h`
- `sudo journalctl --disk-usage`
- `docker ps -a`
- `docker images`

#### Limpieza de logs del sistema
Esto suele liberar varios GB sin tocar la app:

- `sudo journalctl --vacuum-time=7d`
- `sudo journalctl --vacuum-size=300M`

Verificación:

- `sudo journalctl --disk-usage`
- `df -h /`

Para dejar el límite permanente de logs:

- `sudo mkdir -p /etc/systemd/journald.conf.d`
- `sudo tee /etc/systemd/journald.conf.d/limits.conf >/dev/null <<'EOF'`
- `[Journal]`
- `SystemMaxUse=300M`
- `SystemKeepFree=2G`
- `MaxRetentionSec=7day`
- `EOF`
- `sudo systemctl restart systemd-journald`

#### Limpieza segura de contenedores e imágenes no usadas
Primero elimina contenedores detenidos:

- `docker container prune -f`

Luego elimina imágenes de builds viejos que ya no estén en uso. En esta app, si `docker images` muestra imágenes antiguas como `plataforma-gestion-empresarial-app`, `plataforma-gestion-empresarial-worker` o `plataforma-gestion-empresarial-migrate` y los contenedores activos están corriendo con `plataforma-gestion-empresarial-runtime`, esas imágenes viejas se pueden remover.

Ejemplo:

- `docker image rm plataforma-gestion-empresarial-app:latest plataforma-gestion-empresarial-migrate:latest plataforma-gestion-empresarial-worker:latest`

Después de eso, limpia residuos menores:

- `docker image prune -f`
- `docker builder prune -a -f`

Verificación:

- `docker images`
- `sudo du -xhd1 /var/lib/containerd 2>/dev/null | sort -h`
- `df -h /`

#### Qué no debes borrar manualmente
Para evitar romper contenedores o perder datos:

- No borres archivos a mano dentro de `/var/lib/containerd`
- No uses `docker system prune --volumes` sin validar exactamente qué volumen vas a perder
- No elimines volúmenes de datos como `db_data`, `runtime_data`, `uploads_data`, `scans_data`, `soportes_data`

#### Mantenimiento recomendado después de despliegues
Si haces muchos builds en el mismo VPS, revisa periódicamente:

- `df -h /`
- `sudo journalctl --disk-usage`
- `sudo du -xhd1 /var/lib/containerd 2>/dev/null | sort -h`

Y usa esta secuencia para evitar crecimiento innecesario:

- `BUILDKIT_PROGRESS=plain docker compose -f docker-compose.prod.yml build app ocr`
- `docker compose -f docker-compose.prod.yml up -d --no-build`
- `docker builder prune -a -f`

## Notas importantes (para evitar sustos)

- Si dejas archivos en disco local (sin S3), el tamaño del disco es crítico.
- El OCR es el principal riesgo de picos: por eso se limitaron CPU/RAM y threads en `docker-compose.prod.yml`.
- Si planeas varias instancias, hay que migrar archivos a S3/Spaces (no disco local).


<!-- #ERPPonyo2026* -->
sudo docker builder prune -a -f
docker compose -f docker-compose.prod.yml build --no-cache app