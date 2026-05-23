# Configuración de IA para Cotizador Litográfico

La pestaña "Cotice con IA" ya funciona en dos modos:

- Modo interno: parser por reglas, sin proveedor externo.
- Modo IA real: endpoint OpenAI-compatible configurado en Next.js.

## 1. Variables de entorno

Agrega estas variables en tu entorno de Next.js:

### Opción A: OpenAI

```env
LITOGRAFIA_AI_API_KEY="sk-..."
LITOGRAFIA_AI_MODEL="gpt-4.1-mini"
LITOGRAFIA_AI_PROVIDER="openai"
```

Notas:

- `LITOGRAFIA_AI_BASE_URL` es opcional para OpenAI; si no la defines, el sistema usa `https://api.openai.com/v1`.
- La API de OpenAI normalmente es de pago por uso.

### Opción B: Ollama local

```env
LITOGRAFIA_AI_PROVIDER="ollama"
LITOGRAFIA_AI_BASE_URL="http://127.0.0.1:11434/v1"
LITOGRAFIA_AI_MODEL="llama3.1:8b"
LITOGRAFIA_AI_API_KEY=""
```

Notas:

- Si defines `LITOGRAFIA_AI_PROVIDER=ollama` y no pones `LITOGRAFIA_AI_BASE_URL`, el sistema intentará usar `http://127.0.0.1:11434/v1`.
- Ollama evita pago por API, pero consume recursos del servidor o del equipo local.

También puedes apuntar a cualquier backend OpenAI-compatible, por ejemplo:

- OpenAI
- Ollama con endpoint compatible
- OpenRouter
- Groq
- un gateway interno propio

## 2. Qué hace realmente la IA

La IA no cotiza precios finales directamente.

Su función en esta fase es:

- interpretar el brief comercial del cliente,
- extraer especificaciones litográficas,
- detectar datos faltantes,
- sugerir preguntas de aclaración,
- dejar el trabajo listo para pasar al cotizador exacto.

Esto reduce tiempo comercial sin arriesgar precios alucinados.

## 3. Flujo técnico

1. El usuario pega el brief en la pestaña "Cotice con IA".
2. Next.js llama a /api/litografia/ia/cotizar.
3. Si hay proveedor configurado, la ruta invoca el modelo por /chat/completions.
4. Si el proveedor falla o no está configurado, el sistema cae al motor interno por reglas.
5. La UI muestra si el resultado salió por LLM o por fallback interno.

## 4. Recomendación de despliegue

Para producción, el enfoque más sano es:

- usar un modelo pequeño y rápido para extracción de brief,
- mantener temperatura baja,
- no permitir que la IA calcule precios,
- seguir usando el motor litográfico actual para la cotización exacta.

## 5. Qué conviene probar primero

- OpenAI: mejor velocidad/calidad inicial, costo por uso, menor fricción operativa.
- Ollama: sin costo por API, mayor control, pero depende del hardware y puede ser más lento.

La arquitectura actual ya quedó abierta para comparar ambos sin cambiar código de negocio.

## 6. Siguiente iteración recomendada

La siguiente mejora útil es mapear automáticamente el resultado de la IA a los campos del cotizador clásico para que el usuario no tenga que volver a digitarlos.