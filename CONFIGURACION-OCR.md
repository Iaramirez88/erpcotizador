# Configuración OCR + IA (Facturas CO)

Este proyecto usa un **microservicio Python** para OCR/IA (OpenCV + PaddleOCR + Tesseract + LLM opcional).

## 1) Variables de entorno (Next.js)

En tu `.env` del proyecto Next.js:

- `OCR_SERVICE_URL=http://127.0.0.1:8001`
- (opcional) `OCR_SERVICE_API_KEY=...`

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
