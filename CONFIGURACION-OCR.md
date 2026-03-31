# Configuración OCR + IA (Facturas CO)

Este proyecto usa un **microservicio Python** para OCR/IA (OpenCV + PaddleOCR + Tesseract + LLM opcional).

## 1) Variables de entorno (Next.js)

En tu `.env` del proyecto Next.js:

- `OCR_SERVICE_URL=http://127.0.0.1:8001`
- (opcional) `OCR_SERVICE_API_KEY=...`

### OCR asíncrono (recomendado en producción)

Para evitar timeouts y que el OCR tumbe el servidor web, el escaneo se **encola** y se procesa en un **worker**.

Variables:

- `REDIS_URL=redis://...` (habilita la cola)
- `OCR_WORKER_CONCURRENCY=1` (empieza así en VPS de 1-2 vCPU; solo súbelo si ya mediste margen)
- `OCR_SYNC_FALLBACK=false` (en producción, para que el contenedor web no procese OCR dentro del request)

Ejecutar el worker:

```bash
npm run worker:ocr
```

Para levantar Redis en local (opcional):

```bash
docker compose -f docker-compose.queue.yml up -d
```

Si `REDIS_URL` no está configurado, el escaneo quedará en **PENDIENTE** y no se procesará automáticamente.

Fallback síncrono (útil en local):
- Por defecto, si no hay `REDIS_URL`, el sistema intenta procesar el OCR en el mismo request.
- Puedes desactivarlo con: `OCR_SYNC_FALLBACK=false`

## 1.1) Storage de escaneos en Spaces (S3)

Para un SaaS con varias instancias, no uses disco local. Configura DigitalOcean Spaces:

- `S3_ENDPOINT=https://nyc3.digitaloceanspaces.com`
- `S3_REGION=us-east-1` (o el que uses)
- `S3_BUCKET=tu-bucket`
- `S3_ACCESS_KEY_ID=...`
- `S3_SECRET_ACCESS_KEY=...`
- `S3_PUBLIC_BASE_URL=https://tu-bucket.nyc3.digitaloceanspaces.com` (o tu CDN)

Nota: actualmente el sistema guarda `fileUrl` como URL directa. Eso asume bucket/CDN público. Si quieres bucket privado, hay que servir URLs firmadas desde la app.

## 2) Ejecutar el microservicio OCR

Ruta: `services/ocr`.

### Opción recomendada (sin instalaciones complejas): Docker

Desde la raíz del proyecto (`cotizador-inteligente/`):

```bash
docker compose -f docker-compose.ocr.yml up --build
```

Esto levanta el OCR en `http://127.0.0.1:8001` con **Tesseract + español** ya incluidos.

Para producción, lo ideal es desplegar este contenedor como servicio (Azure Container Apps, ECS, Kubernetes, VPS con Docker, etc.).

Notas:
- Si tu app Next.js corre en otro contenedor/red, configura `OCR_SERVICE_URL` apuntando al servicio interno (ej: `http://ocr:8001`).
- Si quieres proteger el OCR con llave, define `OCR_SERVICE_API_KEY` en el entorno y también en Next.js.

### Opción local (solo si no usarás Docker)

1. Crear y activar un entorno virtual (recomendado).
2. Instalar dependencias:
   - `pip install -r requirements.txt`
3. Ejecutar:
   - `uvicorn main:app --host 127.0.0.1 --port 8001`

Endpoint de salud:
- `GET http://127.0.0.1:8001/health`

## 3) Dependencias del sistema (Windows)

### Tesseract (obligatorio para fallback)
- Instala Tesseract OCR y asegúrate de que `tesseract.exe` esté en el `PATH`.
- Idioma: instala datos `spa` (español).

Alternativa: puedes setear `TESSERACT_CMD` apuntando a `tesseract.exe`.

### Poppler (requerido si vas a subir PDFs)
- `pdf2image` requiere Poppler.
- Instala Poppler para Windows y agrega su carpeta `bin` al `PATH`.

Nota: el servicio tiene fallback a PyMuPDF para PDF si Poppler no está disponible, pero Poppler suele dar mejores resultados en algunos PDFs.

## 4) LLM (IA semántica) - opción recomendada

El microservicio soporta endpoint **OpenAI-compatible**.

### Opción A (open source local): Ollama
- Levanta Ollama y usa su endpoint compatible (según tu setup).

Variables en el microservicio (`services/ocr/.env` o variables del sistema):
- `LLM_BASE_URL=http://localhost:11434/v1`
- `LLM_MODEL=llama3.1:8b`
- `LLM_API_KEY=` (vacío si no aplica)

Si el LLM no está configurado, el sistema igual procesa OCR y genera diagnóstico/validaciones, pero **no estructurará** campos automáticamente.

## 5) Uso en la app

Dashboard → **Escaneos**:
- Subir imagen/PDF
- Opción: "Usar IA semántica (LLM)"
- Historial paginado + aprobación + % captación
