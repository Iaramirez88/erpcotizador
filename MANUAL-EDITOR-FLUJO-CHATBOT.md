# Manual del editor de flujo visual del chatbot

## Objetivo del manual

Este documento sirve para dos usos:

1. Enseñar cómo operar el editor visual del chatbot sin tocar código.
2. Dejar explícitos los huecos funcionales que hoy impiden construir cualquier flujo de negocio de punta a punta, por ejemplo un flujo que termine generando factura, orden y seguimiento.

La base de este manual se revisó directamente sobre estas piezas del sistema:

- src/components/crm/crm-chatbot-studio-client.tsx
- src/lib/crm-chatbot-studio.ts
- src/lib/crm-chatbot-flow.ts
- src/app/api/crm/captures/chatbot/route.ts
- src/components/crm/crm-public-chatbot-embed.tsx

## Qué es el editor visual hoy

El editor visual actual sí es un Studio funcional para diseñar conversaciones guiadas, con mapa, nodos, ramas, triggers, pausas, variables, coherencia y asignación.

Pero todavía no es un motor general de automatización transaccional. Hoy está más cerca de esto:

- Enrutador conversacional con captura guiada.
- Búsqueda de productos y stock contra materiales activos.
- Disparo de rutas por texto, botón, lead calificado o solicitud de humano.
- Aplicación de saludo, cierre, variables y reglas básicas de coherencia.
- Asignación del caso a responsables en CRM.

Todavía no llega a esto:

- Orquestador de procesos arbitrarios.
- Diseñador de formularios dinámicos con cualquier campo.
- Motor de validaciones avanzadas por tipo documental.
- Constructor de acciones backend como crear factura, crear orden, enviar WhatsApp, enviar correo, llamar webhook o ejecutar lógica de negocio parametrizable.

## Modelo mental correcto del editor

Si una persona va a usar el Studio, debe pensar el flujo con estas piezas:

- Mensaje: bloque principal donde el bot habla y espera una respuesta.
- Rama: intención posible del usuario que lleva a otro mensaje.
- Acción: botón o atajo que activa una intención operativa predefinida.
- Trigger: filtro que intercepta un evento y lo redirige.
- Pausa: espera visible entre un mensaje y el siguiente.
- Variable: dato reutilizable dentro de los textos.
- Coherencia: reglas globales de tono y copy.
- Asignación: responsable humano del caso cuando aplica.

## Cómo entrar al editor

Ruta operativa:

1. Abrir CRM.
2. Entrar a Chatbot Studio.
3. Seleccionar el canal chatbot web.
4. Ir a la pestaña Studio.
5. Trabajar en el mapa o en los paneles laterales.
6. Guardar Studio.

El editor muestra dos contextos principales:

- Studio: diseño del flujo.
- Historial: revisión de conversaciones reales.

## Zonas del Studio

### 1. Mapa

Es el canvas visual. Desde aquí puedes:

- Ver el flujo completo.
- Arrastrar nodos.
- Conectar nodos.
- Duplicar nodos.
- Eliminar nodos.
- Abrir inspector.
- Entrar a pantalla completa.
- Usar minimapa y zoom.

### 2. General

Aquí vive la metadata general del flujo y del canal.

### 3. Biblioteca

Aquí se gestionan los flujos disponibles y sus providers.

### 4. Flujo

Es el resumen editable del journey conversacional.

### 5. Triggers

Se configuran disparadores por evento.

### 6. Variables y coherencia

Se administran placeholders y reglas globales de copy.

### 7. Asignaciones

Se decide a quién cae el caso cuando se califica o se escala a humano.

### 8. Resumen operativo

Sirve para revisar el flujo antes de publicar.

### 9. Historial

Permite contrastar lo diseñado con conversaciones reales.

## Tipos de nodo disponibles hoy

## Nodo Mensaje

Representa una etapa del flujo. Cada mensaje tiene:

- Título.
- Descripción.
- Prompt del bot.
- Siguiente dato esperado.
- Acciones rápidas asociadas.
- Opciones de respuesta y ramas.

### Siguiente dato esperado

Los únicos datos nativos que el flujo guiado sabe pedir hoy son:

- name
- email
- phone
- product
- quantity
- none

Eso significa que el formulario conversacional nativo del motor no sabe pedir como campo estructurado:

- NIT
- cédula
- dirección
- barrio
- ciudad como entrada guiada del visitante
- WhatsApp separado de teléfono
- razón social
- método de pago
- aceptación de resumen
- datos de entrega
- datos de facturación adicionales

### Ramas de un mensaje

Cada rama tiene:

- Etiqueta visible.
- Modo de match: contains o exact.
- Valor o palabras que activan la rama.
- Texto que representa la intención del visitante.
- Respuesta del bot al tomar esa rama.
- Etapa destino.

Uso correcto:

- Si el usuario puede responder varias intenciones, crea una rama por intención.
- Si la conversación es libre, usa contains con palabras clave claras.
- Si el flujo necesita precisión, usa exact.

## Nodo Acción

Las acciones actuales no son pasos backend arbitrarios. Son quick actions de tipo limitado.

Tipos disponibles hoy:

- catalog
- stock
- product_lookup
- service_lookup
- url
- human
- message

### Qué hace cada una realmente

- catalog: favorece una respuesta de catálogo.
- stock: favorece búsqueda de disponibilidad.
- product_lookup: fuerza lookup de producto.
- service_lookup: fuerza lookup de servicio.
- url: responde con un enlace.
- human: deriva la conversación a humano.
- message: hoy funciona como acción auxiliar simple, no como acción backend programable.

### Qué no hace una acción hoy

No existe una acción nativa para:

- crear factura
- crear orden
- generar número de seguimiento
- enviar correo
- enviar WhatsApp
- invocar API externa configurable desde Studio
- ejecutar webhook
- crear cliente en ERP
- reservar inventario
- confirmar pago

## Nodo Trigger

El trigger intercepta eventos y manda a una etapa destino.

Eventos disponibles hoy:

- message
- quick_action
- response_option
- human_request
- lead_qualified

Cada trigger tiene:

- Etiqueta.
- Evento.
- Match mode.
- Valor a detectar.
- Etapa destino.
- Respuesta opcional.
- Estado activo o inactivo.

### Casos de uso correctos

- Enviar a handoff cuando el usuario pida asesor.
- Mover a una etapa cuando pulse una acción rápida.
- Saltar a una etapa cuando se detecten palabras concretas.
- Reaccionar cuando ya hay lead calificado.

### Límite actual de triggers

No pueden evaluar expresiones de negocio como:

- stock mayor que cantidad pedida
- total mayor a cierto umbral
- si el cliente ya existe en base de datos
- si el NIT es válido
- si el producto requiere orden de trabajo
- si la ciudad es Bogotá entonces enrutar a otra sede

Solo trabajan con eventos y texto detectado, no con reglas arbitrarias configurables en el UI.

## Nodo Pausa

La pausa hoy sirve para meter una espera visible entre dos mensajes del flujo.

Campos disponibles:

- Título.
- Descripción.
- Mensaje origen.
- Mensaje destino.
- Duración en minutos.
- Estado activo.

Uso correcto:

- Esperas operativas entre seguimiento y siguiente contacto.
- Recontacto comercial simulado.
- Enfriamiento antes de la siguiente interacción automática.

Límite actual:

- No agenda procesos reales complejos fuera de la lógica que ya entiende el backend del chatbot.
- No sirve como cola transaccional general.

## Variables disponibles hoy

El Studio sí soporta variables reutilizables en textos con formato {{clave}}.

Fuentes soportadas hoy:

- contact_name
- contact_email
- contact_phone
- product
- quantity
- company
- city
- channel_name
- assistant_name
- static

Cada variable tiene:

- Clave.
- Etiqueta.
- Origen.
- Fallback.
- Valor fijo si es static.
- Descripción.
- Estado activa o inactiva.

### Importante

Que exista una fuente de variable no significa que el usuario la pueda capturar nativamente desde el flujo guiado actual.

Ejemplo:

- company y city existen como fuentes posibles de variable.
- Pero el motor guiado del chatbot no tiene nextField nativo para pedir company o city como paso estructurado al visitante.

## Coherencia global

La coherencia sí impacta la salida real del chatbot.

Campos disponibles:

- Tono: consultivo, directo o amable.
- Saludo inicial.
- Cierre sugerido.
- Notas de estilo.
- Términos requeridos.
- Términos prohibidos.

### Qué hace realmente

- Inyecta saludo si no está presente.
- Inyecta cierre si no está presente.
- Interpola variables en saludo y cierre.
- Ajusta algunos términos por tono.
- Agrega términos requeridos si no aparecen.

### Qué no hace todavía

- No es un policy engine completo.
- No bloquea con validación dura todos los términos prohibidos.
- No reescribe toda la respuesta con un LLM configurable desde el Studio.

## Asignaciones automáticas

El Studio permite definir a quién cae el caso.

Modos disponibles:

- channel-owner
- default-user
- handoff-user

También se puede definir:

- Responsable por defecto.
- Responsable de handoff.
- Responsable para lead calificado.

Esto sí participa del flujo real del backend cuando el caso pasa a humano o se califica comercialmente.

## Cómo construir un flujo básico de cotización en el editor actual

## Caso ejemplo: cotización de Mug

Objetivo funcional esperado por negocio:

- El visitante entra.
- El bot se presenta como Miguel.
- Pregunta nombre y necesidad.
- Si piden Mug, revisa si existe y si hay stock.
- Pregunta cantidad.
- Pide datos para facturar.
- Resume.
- Confirma.
- Genera factura.
- Entrega número de orden y seguimiento.
- Envía por correo o WhatsApp.

## Qué parte sí se puede resolver hoy

### Paso 1. Mensaje inicial

Crear etapa Mensaje:

- Título: Bienvenida
- Prompt: Hola, soy Miguel chatbot. ¿Cómo te llamas y en qué te puedo ayudar?
- Siguiente dato esperado: name

Agregar ramas:

- Quiero cotizar
- Quiero ver catálogo
- Quiero asesor

### Paso 2. Descubrir el producto

Crear etapa Mensaje:

- Título: Producto
- Prompt: Cuéntame qué producto necesitas.
- Siguiente dato esperado: product

Opcionalmente enlazar quick actions:

- product_lookup
- stock
- human

### Paso 3. Resolver si existe el producto

El backend actual sí puede buscar materiales activos y responder con:

- coincidencia principal
- stock actual
- precio de referencia
- alternativas parecidas

Si existe Mug y el motor lo encuentra, puede responder algo de este tipo:

- Encontré Mug.
- Precio ref.
- Stock disponible.
- Ahora dime la cantidad.

### Paso 4. Capturar cantidad

Crear etapa Mensaje:

- Título: Cantidad
- Prompt: Perfecto, dime cuántas unidades requieres.
- Siguiente dato esperado: quantity

### Paso 5. Capturar datos comerciales que sí soporta hoy

El motor actual puede capturar nativamente:

- nombre
- correo
- teléfono
- producto
- cantidad

Entonces sí puedes dejar un flujo comercial funcional para lead calificado, pero todavía no un flujo de facturación completa.

### Paso 6. Escalar o cerrar comercialmente

Puedes usar:

- trigger de lead_qualified
- asignación a responsable comercial
- handoff a asesor

Resultado actual posible:

- El bot deja la conversación bien calificada.
- El CRM recibe contexto útil.
- El equipo comercial continúa.

## Qué parte no se puede resolver hoy sin ampliar el motor

En el caso del ejemplo faltan estos componentes estructurales:

### 1. Campos de captura para facturación

No existe soporte nativo para pedir y guardar como campos conversacionales estructurados:

- NIT
- cédula
- dirección
- razón social
- ciudad de facturación
- email de facturación separado del comercial
- WhatsApp separado de teléfono

### 2. Paso de resumen editable

No existe un nodo nativo de:

- resumen automático de variables recolectadas
- confirmación Sí o No
- editar un solo dato y volver al resumen

### 3. Condiciones de negocio avanzadas

No existe un nodo de condición configurable para cosas como:

- si stock >= cantidad, continuar
- si stock < cantidad, ofrecer alternativa o preventa
- si requiere orden de trabajo, pedir datos extra
- si el cliente ya existe, saltar captura parcial

### 4. Acción backend arbitraria

No existe una acción configurable desde Studio para:

- crear factura POS
- crear cotización formal
- crear orden de venta
- crear orden de trabajo
- generar consecutivo
- generar tracking
- llamar una API interna o externa
- disparar un webhook

### 5. Entrega automática del documento

No existe acción visual lista para:

- enviar factura por correo
- enviar factura por WhatsApp
- enviar link de verificación
- enviar PDF adjunto

### 6. Variables de documento y transacción

No existen variables de flujo listas para usar como:

- invoice_number
- order_number
- tracking_number
- nit
- document_number
- billing_address
- payment_link

## Lectura honesta del estado actual

Si hoy preguntas “¿el editor visual ya permite construir cualquier flujo?”, la respuesta técnica correcta es no.

La respuesta más precisa es esta:

- Sí permite construir flujos conversacionales guiados y comerciales bastante buenos.
- Sí permite catálogos, lookup de producto, stock, escalamiento humano, pausas, triggers y asignación.
- No permite todavía cualquier flujo de negocio arbitrario de punta a punta.
- No permite todavía automatización transaccional completa sin desarrollo adicional en backend y UI.

## Checklist de huecos para llegar a “100% funcional”

## Fase 1. Captura universal de datos

Se necesita agregar un sistema de campos configurables por flujo.

Mínimo:

- text
- textarea
- number
- email
- phone
- document
- nit
- address
- select
- radio
- checkbox
- date
- hidden/computed

Además cada campo debería soportar:

- key técnica
- label
- placeholder
- required
- validations
- regex
- mask
- fallback
- persist destination

## Fase 2. Motor de variables real

Se necesita extender variables para soportar:

- variables del visitante
- variables del producto
- variables del canal
- variables calculadas
- variables de integraciones
- variables de documentos generados
- variables del pedido

## Fase 3. Nodo de condición

Se necesita un nodo Condition con:

- operador
- left operand
- right operand
- ramas true y false

Operadores mínimos:

- equals
- not_equals
- contains
- greater_than
- less_than
- exists
- not_exists
- in_list

## Fase 4. Nodo de formulario

Se necesita un nodo Form que permita pedir varios datos en una sola etapa, no solo uno por nextField.

## Fase 5. Nodo de resumen y confirmación

Se necesita un nodo Review que:

- arme un resumen con variables
- pregunte si está correcto
- permita editar campo puntual
- vuelva a resumir

## Fase 6. Nodo de acción backend

Se necesita un nodo Action programable con tipos como:

- create_quote
- create_invoice
- create_order
- create_work_order
- create_customer
- reserve_stock
- send_email
- send_whatsapp
- http_request
- webhook
- update_crm_record

Cada acción debería tener:

- parámetros mapeados desde variables
- manejo de error
- salida a variables
- rutas success y error

## Fase 7. Nodo de decisión por inventario

Se necesita poder usar resultados reales del lookup:

- stock disponible
- requiere orden de trabajo
- precio base
- unidad
- alternativas

Y con eso bifurcar el flujo.

## Fase 8. Nodo de entrega

Se necesita un nodo Delivery para:

- enviar por correo
- enviar por WhatsApp
- enviar link de pago
- compartir PDF
- compartir tracking

## Fase 9. Observabilidad y prueba

Se necesita que el Studio pueda:

- simular variables paso a paso
- mostrar por qué tomó una rama
- mostrar trigger disparado
- mostrar acción ejecutada
- mostrar payload real enviado
- mostrar errores de integración

## Cómo usar el editor actual de forma efectiva mientras tanto

Hasta que exista el motor completo, el mejor uso del Studio hoy es este:

1. Usarlo para discovery, catálogo, lookup, stock y calificación comercial.
2. Llevar al usuario hasta producto, cantidad, nombre, correo y teléfono.
3. Usar triggers y handoff para pasar al equipo humano cuando ya hay contexto suficiente.
4. No prometer desde el flujo visual actual cosas como factura automática, tracking o envío transaccional, salvo que ya exista desarrollo específico de backend para ese caso.

## Recomendación práctica para el caso de facturación

Para soportar el flujo deseado de Mug a factura se recomienda diseñar el producto en dos capas.

### Capa 1. Studio conversacional

Responsable de:

- saludar
- entender intención
- buscar producto
- revisar stock
- capturar cantidad
- capturar datos del cliente
- pedir confirmación

### Capa 2. Motor transaccional

Responsable de:

- validar NIT, documento y dirección
- crear cliente si no existe
- crear cotización o factura
- generar número de orden
- generar tracking si aplica
- enviar correo o WhatsApp
- devolver resultado al flujo

Mientras esa capa 2 no exista como nodos del Studio, el editor visual no puede cubrir por sí solo “cualquier flujo”.

## Criterio de aceptación realista para declarar el editor “100% funcional”

El editor solo debería considerarse realmente completo cuando una persona de negocio pueda, sin tocar código:

1. Capturar cualquier dato necesario del cliente.
2. Consultar cualquier entidad de negocio relevante.
3. Evaluar condiciones sobre esos datos.
4. Ejecutar acciones de backend parametrizadas.
5. Manejar errores y reintentos.
6. Confirmar y corregir datos.
7. Generar documentos y referencias.
8. Entregar esos documentos por el canal correspondiente.
9. Ver trazabilidad de por qué el flujo hizo lo que hizo.

Hoy el Studio todavía no llega a ese umbral.

## Conclusión ejecutiva

El editor visual actual ya sirve para vender, orientar, filtrar y calificar mejor.

No sirve todavía, por sí solo, para resolver de punta a punta un flujo transaccional complejo como:

- cotizar
- validar stock contra cantidad
- capturar datos fiscales completos
- resumir y corregir
- generar factura
- generar orden
- generar tracking
- enviar documento por correo o WhatsApp

Ese es precisamente el hueco que debemos cerrar en siguientes fases del Studio.