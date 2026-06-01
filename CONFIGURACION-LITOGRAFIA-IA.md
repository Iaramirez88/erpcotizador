# Configuración de IA para Cotizador Litográfico

La pestaña "Cotice con IA" ya funciona en dos modos:

- Modo interno: parser por reglas, sin proveedor externo.
- Modo IA real: endpoint OpenAI-compatible configurado en Next.js.

## 1. Variables de entorno

Agrega estas variables en tu entorno de Next.js:

### Opción A: OpenAI

```env
LITOGRAFIA_AI_API_KEY="sk-..."
LITOGRAFIA_AI_MODEL="gpt-5.4-mini"
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

Además, la ruta ahora puede devolver un texto comercial listo para copiar al cliente con:

- resumen preliminar del trabajo,
- desglose base por papel, planchas, impresión y terminados detectados,
- utilidad e IVA,
- supuestos usados cuando el brief todavía es ambiguo.

## 3. Flujo técnico

1. El usuario pega el brief en la pestaña "Cotice con IA".
2. Next.js llama a /api/litografia/ia/cotizar.
3. Si hay proveedor configurado, la ruta invoca el modelo por /chat/completions.
4. Si el proveedor falla o no está configurado, el sistema cae al motor interno por reglas.
5. El sistema calcula el desglose preliminar con el motor litográfico y arma una respuesta comercial lista para copiar.
6. La UI muestra si el resultado salió por LLM o por fallback interno.

## 4. ChatGPT Business y Codex

Si el cliente compró ChatGPT Business y Codex, eso sirve muy bien para el equipo humano, pero no reemplaza la API del backend.

En la práctica hay que separarlo así:

- ChatGPT Business: para que comerciales, diseño y producción consulten briefs, creen imágenes de referencia, redacten mensajes y usen GPTs internos.
- Codex: para asistentes técnicos y flujos de automatización del equipo.
- API OpenAI-compatible: para que el cotizador web haga llamadas servidor a servidor.

Punto clave:

- el plan Business no se conecta por sí solo al código del cotizador;
- la app necesita una API key o un gateway compatible para operar desde Next.js;
- el workspace Business sí puede reutilizar el mismo criterio comercial mediante instrucciones y conocimiento cargado.

## 5. Cómo aprovechar el JSON de costos

El JSON de costos sirve como base de conocimiento operativa, no como entrenamiento mágico del modelo.

El uso correcto es:

1. tomar ese JSON como fuente oficial de reglas comerciales y costos base;
2. usarlo para definir instrucciones del GPT interno del equipo;
3. usar el motor del sistema para el cálculo preliminar reproducible;
4. dejar que ChatGPT explique, resuma o redacte la cotización, pero no que invente valores fuera de la base.

Ejemplo de brief soportado:

```text
Ayúdame a cotizar 7500 brochure tamaño 33 cm x 22 cm en propalcote de 300 gr, plastificado mate ambas caras, grafado y refilado.
```

Resultado esperado del sistema:

- interpretar cantidad, tamaño, material y tintas,
- detectar varios terminados dentro del mismo brief,
- calcular un desglose preliminar,
- devolver un texto listo para enviar al cliente.

## 6. Imágenes con ChatGPT

Si el cliente quiere usar ChatGPT también para imágenes, el enfoque correcto es separar dos casos:

- imágenes de referencia comercial: generar mockups, conceptos visuales, propuestas de portada, piezas publicitarias y muestras para vender la idea;
- imágenes operativas del sistema: solo si más adelante se implementa una ruta propia para generación o almacenamiento dentro del ERP.

Recomendación práctica:

- usar ChatGPT Business para crear imágenes conceptuales y validarlas con el cliente;
- no mezclar esas imágenes con el cálculo de costos litográficos;
- para integrarlo al sistema, configurar una API de imágenes y guardar cada resultado en el administrador de archivos.

Variables sugeridas para esta integración:

```env
LITOGRAFIA_AI_IMAGE_API_KEY="sk-..."
LITOGRAFIA_AI_IMAGE_MODEL="gpt-image-1"
LITOGRAFIA_AI_IMAGE_BASE_URL="https://api.openai.com/v1"

LITOGRAFIA_VECTORIZER_API_ID="tu_api_id"
LITOGRAFIA_VECTORIZER_API_SECRET="tu_api_secret"
LITOGRAFIA_VECTORIZER_BASE_URL="https://api.vectorizer.ai/api/v1"
```

Comportamiento esperado en la implementación actual:

- cada imagen generada se guarda en el administrador de archivos bajo IA/chatgpt-imagenes;
- cada vector aprobado desde la pestaña Vectorizar se guarda en IA/vectorizer-ai;
- cada generación deja historial con prompt, usuario y archivo creado;
- cada vectorización conserva historial y permite descargar SVG, PDF, EPS, DXF o PNG desde la plataforma mientras el token siga activo;
- el historial también guarda las consultas de cotización hechas desde la pestaña IA;
- la auditoría consolidada se consulta en Dashboard > Litografía > Auditoría IA.

## 7. Recomendación de despliegue

Para producción, el enfoque más sano es:

- usar un modelo pequeño y rápido para extracción de brief,
- mantener temperatura baja,
- no permitir que la IA calcule precios,
- seguir usando el motor litográfico actual para la cotización exacta.

## 8. Qué conviene probar primero

- OpenAI: mejor velocidad/calidad inicial, costo por uso, menor fricción operativa.
- Ollama: sin costo por API, mayor control, pero depende del hardware y puede ser más lento.

La arquitectura actual ya quedó abierta para comparar ambos sin cambiar código de negocio.

## 9. Siguiente iteración recomendada

La siguiente mejora útil es doble:

- mapear automáticamente el resultado de la IA a los campos del cotizador clásico para que el usuario no tenga que volver a digitarlos;
- crear un GPT interno de ChatGPT Business con las mismas reglas comerciales del JSON para uso del equipo comercial y creativo.

Ese mapeo debe incluir no solo producto, cantidad y papel, sino también hints estructurados de plastificado, corte, troquel y otros terminados para que el botón Pasar a cotización final deje el formulario formal casi completo.

## 10. Paso a paso real para conectar la API key

Si lo que se quiere es que el cotizador responda de verdad desde el backend, el paso a paso correcto es este:

1. Confirmar que el cliente entiende la separación:
	- ChatGPT Business y Codex sirven para los usuarios humanos.
	- la app Next.js necesita una API key server-to-server.
	- sin API key en el servidor, el sistema solo usará fallback interno o quedará sin imágenes.

2. Crear o tomar una API key del proveedor OpenAI-compatible.
	- Si van con OpenAI, la clave sale del proyecto/cuenta con acceso a API.
	- Si usan un gateway compatible, deben pedir base URL, modelo y API key de ese gateway.

3. Configurar texto litográfico en el entorno del servidor.

```env
LITOGRAFIA_AI_API_KEY="sk-..."
LITOGRAFIA_AI_MODEL="gpt-4.1-mini"
LITOGRAFIA_AI_PROVIDER="openai"
LITOGRAFIA_AI_BASE_URL="https://api.openai.com/v1"
```

4. Configurar imágenes IA en el entorno del servidor.

```env
LITOGRAFIA_AI_IMAGE_API_KEY="sk-..."
LITOGRAFIA_AI_IMAGE_MODEL="gpt-image-1"
LITOGRAFIA_AI_IMAGE_BASE_URL="https://api.openai.com/v1"

LITOGRAFIA_VECTORIZER_API_ID="tu_api_id"
LITOGRAFIA_VECTORIZER_API_SECRET="tu_api_secret"
LITOGRAFIA_VECTORIZER_BASE_URL="https://api.vectorizer.ai/api/v1"
```

5. Reiniciar la app después de cambiar variables de entorno.
	- En desarrollo: reiniciar `npm run dev`.
	- En producción: redeploy o reinicio del proceso Node.

6. Probar primero el flujo de texto.
	- Ir a Dashboard > Litografía > pestaña Cotice con IA.
	- Pegar un brief real.
	- Verificar que devuelve respuesta comercial, resumen y opción de pasar al cotizador formal.

7. Probar luego el flujo de imágenes.
	- Desde el panel de imágenes IA del asistente, enviar un prompt visual.
	- Verificar que la imagen se genere.
	- Verificar que aparezca guardada en CRM Archivos dentro de IA/chatgpt-imagenes.

8. Probar el flujo de vectorización.
	- Ir a Dashboard > Litografía > Imágenes IA > pestaña Vectorizar.
	- Subir un PNG o JPG del logo o arte raster.
	- Verificar que se muestre la vista previa SVG.
	- Aprobar y guardar.
	- Verificar que quede en CRM Archivos dentro de IA/vectorizer-ai.
	- Abrir el historial y descargar al menos un formato adicional como PDF o EPS.

9. Validar la trazabilidad.
	- Abrir Dashboard > Litografía > Auditoría IA.
	- Filtrar por usuario y fecha.
	- Confirmar que aparecen prompts, respuestas y archivos asociados.

10. Si quieren usar la misma lógica del cliente en ChatGPT Business.
	- cargar el JSON/reglas como conocimiento o instrucciones del GPT interno;
	- usarlo para asistencia humana y revisión comercial;
	- mantener el cálculo final dentro del motor del ERP.

### Bloque exacto para desarrollo

Archivo sugerido: `.env.local`

```env
LITOGRAFIA_AI_PROVIDER="openai"
LITOGRAFIA_AI_BASE_URL="https://api.openai.com/v1"
LITOGRAFIA_AI_MODEL="gpt-5.4-mini"
LITOGRAFIA_AI_API_KEY="sk-dev-reemplazar"

LITOGRAFIA_AI_IMAGE_BASE_URL="https://api.openai.com/v1"
LITOGRAFIA_AI_IMAGE_MODEL="gpt-image-1"
LITOGRAFIA_AI_IMAGE_API_KEY="sk-dev-reemplazar"

LITOGRAFIA_VECTORIZER_BASE_URL="https://api.vectorizer.ai/api/v1"
LITOGRAFIA_VECTORIZER_API_ID="vectorizer-dev-id"
LITOGRAFIA_VECTORIZER_API_SECRET="vectorizer-dev-secret"
```

### Bloque exacto para producción

```env
LITOGRAFIA_AI_PROVIDER="openai"
LITOGRAFIA_AI_BASE_URL="https://api.openai.com/v1"
LITOGRAFIA_AI_MODEL="gpt-5.4-mini"
LITOGRAFIA_AI_API_KEY="sk-prod-reemplazar"

LITOGRAFIA_AI_IMAGE_BASE_URL="https://api.openai.com/v1"
LITOGRAFIA_AI_IMAGE_MODEL="gpt-image-1"
LITOGRAFIA_AI_IMAGE_API_KEY="sk-prod-reemplazar"

LITOGRAFIA_VECTORIZER_BASE_URL="https://api.vectorizer.ai/api/v1"
LITOGRAFIA_VECTORIZER_API_ID="vectorizer-prod-id"
LITOGRAFIA_VECTORIZER_API_SECRET="vectorizer-prod-secret"
```

## 11. Datos exactos que necesitas de OpenAI Platform

Para conectar este backend no necesitas el nombre del workspace de ChatGPT Business. Lo que sí necesitas de OpenAI Platform es esto:

1. Un proyecto de API activo.
2. Facturación o créditos habilitados en Platform.
3. Una API key del proyecto.
4. El nombre del modelo de texto.
5. El nombre del modelo de imágenes, si vas a usar imágenes.
6. La base URL del proveedor.
7. Si vas a usar Vectorizer.AI, su API Id y API Secret.

Para OpenAI Platform estándar, el bloque práctico queda así:

```text
Proveedor: openai
Base URL: https://api.openai.com/v1
Modelo texto: gpt-5.4-mini
Modelo imágenes: gpt-image-1
API key: sk-... o la clave/token del proyecto
```

Notas importantes:

- si tu proyecto de Platform no tiene créditos, la integración no responderá aunque la key sea válida;
- el backend usa /chat/completions para texto y /images/generations para imágenes;
- puedes reutilizar la misma key para texto e imágenes si el proyecto tiene acceso a ambos productos;
- si prefieres separar costos o permisos, puedes usar una key para texto y otra para imágenes.

## 12. Checklist operativo para dejarlo funcionando

1. En OpenAI Platform crea o selecciona el proyecto del ERP.
2. Agrega créditos o habilita cobro por uso.
3. Crea la API key del proyecto.
4. Copia .env.litografia-ia.example a tu .env.local en desarrollo o usa secretos del servidor en producción.
5. Reemplaza solo estos valores:

```env
LITOGRAFIA_AI_API_KEY="TU_KEY_REAL"
LITOGRAFIA_AI_IMAGE_API_KEY="TU_KEY_REAL_O_OTRA"
```

6. Reinicia la app.
7. Prueba primero texto en Dashboard > Litografía > Cotice con IA.
8. Prueba después imágenes en Dashboard > Litografía > Imágenes IA.

## 13. Qué te voy a pedir cuando la quieras dejar conectada aquí

Para terminar la configuración en este proyecto, solo hace falta que tú pongas estos datos reales en el entorno:

```text
LITOGRAFIA_AI_API_KEY
LITOGRAFIA_AI_IMAGE_API_KEY
```

El resto de valores ya te los dejo definidos así:

```text
LITOGRAFIA_AI_PROVIDER=openai
LITOGRAFIA_AI_BASE_URL=https://api.openai.com/v1
LITOGRAFIA_AI_MODEL=gpt-5.4-mini
LITOGRAFIA_AI_IMAGE_BASE_URL=https://api.openai.com/v1
LITOGRAFIA_AI_IMAGE_MODEL=gpt-image-1
```

Si quieres usar una sola clave para todo, también funciona:

```env
LITOGRAFIA_AI_API_KEY="TU_KEY_REAL"
LITOGRAFIA_AI_IMAGE_API_KEY="TU_KEY_REAL"
```

## 14. Qué variable usa cada parte del sistema

- Cotización IA de litografía: `LITOGRAFIA_AI_API_KEY`, `LITOGRAFIA_AI_MODEL`, `LITOGRAFIA_AI_PROVIDER`, opcional `LITOGRAFIA_AI_BASE_URL`.
- Imágenes IA: `LITOGRAFIA_AI_IMAGE_API_KEY`, `LITOGRAFIA_AI_IMAGE_MODEL`, opcional `LITOGRAFIA_AI_IMAGE_BASE_URL`.
- Vectorizer.AI: `LITOGRAFIA_VECTORIZER_API_ID`, `LITOGRAFIA_VECTORIZER_API_SECRET`, opcional `LITOGRAFIA_VECTORIZER_BASE_URL`.
- Fallback de compatibilidad adicional:
	- si no existe `LITOGRAFIA_AI_IMAGE_API_KEY`, la ruta de imágenes intenta reutilizar `LITOGRAFIA_AI_API_KEY`;
	- si no existe `LITOGRAFIA_AI_IMAGE_BASE_URL`, intenta reutilizar `LITOGRAFIA_AI_BASE_URL`.

## 15. Error conceptual más común

El error más común es pensar esto:

- "ya compré ChatGPT Business, entonces el backend ya puede consumir IA".

No funciona así. Lo correcto es:

- Business/Codex para personas y equipos.
- API key OpenAI-compatible para el servidor del cotizador.
- motor determinista del ERP para precios y desglose final.

## 16. Prueba E2E corta

La validación mínima útil de punta a punta es esta:

1. Preparar entorno.
	- copiar las variables IA al entorno local o de staging;
	- reiniciar la app después de cargar variables;
	- iniciar sesión con un usuario que tenga acceso a Litografía y CRM.

2. Validar texto IA.
	- ir a Dashboard > Litografía > pestaña Cotice con IA;
	- pegar este brief:

```text
Cotizar 2500 flyers tamaño 21 x 28 cm en propalcote 150 g, impresión 4x4, plastificado mate, refile y entrega en Chapinero.
```

	- resultado esperado:
	- aparece resumen del trabajo;
	- aparece respuesta comercial lista para copiar;
	- el botón de pasar a cotización final lleva datos útiles al cotizador clásico.

3. Validar imágenes IA.
	- en el panel de imágenes del asistente, enviar este prompt:

```text
Mockup publicitario de flyer corporativo para servicios contables, estilo limpio, fondo claro, iconografía financiera, formato vertical.
```

	- resultado esperado:
	- se genera preview;
	- se crea archivo en CRM Archivos dentro de `IA/chatgpt-imagenes`;
	- el historial de IA registra el evento.

4. Validar historial y auditoría.
	- abrir Dashboard > Litografía > Auditoría IA;
	- filtrar por el usuario que hizo la prueba y por la fecha del día;
	- resultado esperado:
	- aparece al menos un evento `Cotización IA`;
	- aparece al menos un evento `Imagen IA`;
	- la fila de imagen muestra archivo asociado;
	- la fila de cotización muestra prompt y salida textual.

5. Validar almacenamiento final.
	- abrir Dashboard > CRM > Administrador de archivos;
	- entrar a `IA/chatgpt-imagenes`;
	- confirmar que el nombre del PNG y la fecha coinciden con la prueba recién hecha.

Si falla alguna parte, el orden correcto de revisión es:

1. variables de entorno cargadas;
2. reinicio del servidor Next.js;
3. permisos del usuario sobre Litografía/CRM;
4. respuesta del proveedor OpenAI-compatible;
5. revisión del evento en Auditoría IA para ver hasta qué punto avanzó el flujo.