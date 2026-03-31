# Despliegue en DigitalOcean (recomendación inicial)

> Objetivo: arrancar con ~20 usuarios concurrentes y ~100 escaneos/día, minimizando caídas.

## Conceptos rápidos: SLA vs HA

- **SLA** (Service Level Agreement): “promesa” de disponibilidad (por ejemplo 99.9% mensual) + soporte/compensación si no se cumple. Es un contrato/garantía.
- **HA** (High Availability): arquitectura para que el sistema siga funcionando si un componente cae (por ejemplo, 2 instancias de app tras un balanceador).

Sin HA, puedes tener un servidor grande y aun así habrá caídas cuando:
- el servidor se reinicie por mantenimiento,
- se llene el disco,
- el proceso se caiga,
- haya un pico de CPU (por ejemplo, OCR).

## Lo que hoy impacta la escalabilidad (importante)

- El archivo de escaneo se guarda en **disco local** en `public/scans` (ver `src/lib/scan-file-storage.ts`).
  - Con **más de una instancia** (load balancer), esto rompe porque el archivo puede quedar en otra máquina.
  - Recomendación: mover archivos a **Object Storage** (DigitalOcean Spaces / S3).

- El OCR se ejecuta **síncrono** en `POST /api/escaneos` (ver `src/app/api/escaneos/route.ts`).
  - Si el OCR tarda, el request se mantiene abierto y puede agotar recursos/timeout.
  - Recomendación: convertir a **asíncrono con cola** (202 Accepted + job/worker).

## Tamaño recomendado (arranque estable)

### Opción A — Estable “sin caídas” (HA real)

- **Web (Next.js) + API:**
  - 2 × Droplet **2 vCPU / 4 GB RAM** (Premium/AMD recomendado)
  - 1 × **Load Balancer**

- **Base de datos:**
  - **Managed PostgreSQL**: recomendado **2 vCPU / 4 GB RAM** (mínimo 1 vCPU / 2 GB si la carga es baja)

- **OCR:**
  - 1 × Droplet **2 vCPU / 4 GB RAM** corriendo el contenedor OCR (`docker-compose.ocr.yml`)
  - Si hay picos de escaneo o PDFs pesados, subir a **4 vCPU / 8 GB**

- **Archivos (escaneos):**
  - **DigitalOcean Spaces** (S3) + CDN opcional

**Ventaja:** si cae 1 droplet de web, el sistema sigue funcionando.

### Opción B — Mínimo costo (puede caerse por 1 VM)

- 1 × Droplet **2 vCPU / 4 GB** para Next.js + OCR juntos
- PostgreSQL Managed **1 vCPU / 2 GB**

**Nota:** funciona para 20 concurrentes y 100 escaneos/día en muchos casos, pero no es “sin caídas” por diseño.

## Checklist de producción (recomendado)

- **Separar OCR** del servidor web (o limitar concurrencia) para evitar picos de CPU.
- **Cola de trabajos** para OCR (Redis + worker) y endpoint que responda rápido.
- **Spaces/S3** para `scans` (no disco local).
- **Observabilidad:** alerts de CPU/RAM/disco, métricas de Postgres (conexiones, slow queries).
- **Backups:** DB managed con backups diarios + retención.
- **Seguridad:**
  - No exponer OCR público (o proteger con `OCR_SERVICE_API_KEY`).
  - HTTPS en Load Balancer.

## Variables de entorno relevantes

- `OCR_SERVICE_URL` (idealmente URL interna dentro de tu red/cluster)
- `OCR_SERVICE_API_KEY` (si se protege el servicio)

Para cola OCR:
- `REDIS_URL`
- `OCR_WORKER_CONCURRENCY`

Si se migra a Spaces (pendiente de implementar):
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_PUBLIC_BASE_URL`

## Próximo paso sugerido

Si quieres, puedo:
1) Proponer y aplicar el cambio a **Spaces** para almacenar escaneos.
2) Convertir OCR a **asíncrono con cola** para evitar timeouts y caídas por carga.
3) Revisar endpoints críticos (DB queries, índices, caché HTTP) para asegurar performance SaaS.

## Despliegue "1 droplet" (todo dentro)

Archivos:
- [docker-compose.prod.yml](cotizador-inteligente/docker-compose.prod.yml)
- [.env.docker.example](cotizador-inteligente/.env.docker.example)
- [Dockerfile](cotizador-inteligente/Dockerfile)

Pasos (en el droplet):
- Copia `.env.docker.example` a `.env` y ajusta valores (especialmente `DATABASE_URL`, `NEXTAUTH_SECRET`, `APP_URL`).
- Levanta todo: `docker compose -f docker-compose.prod.yml up -d --build`

Nota de performance:
- `app`, `worker` y `migrate` reutilizan la misma imagen Node para evitar reconstrucciones redundantes.
- Si el droplet es pequeño, prefiere esta secuencia:
- `docker compose -f docker-compose.prod.yml build app ocr`
- `docker compose -f docker-compose.prod.yml up -d --no-build`

Notas:
- Postgres/Redis/OCR no se exponen por puertos públicos (más seguro). Solo se publica `3000`.
- Los escaneos quedan persistidos en un volumen Docker (`scans_data`) montado en `/app/public/scans`.
