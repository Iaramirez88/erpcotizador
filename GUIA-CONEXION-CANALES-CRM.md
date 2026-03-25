# GUIA PASO A PASO PARA CONECTAR CADA CANAL AL CRM

Esta guia describe el proceso real de conexion del modulo omnicanal actual de SGDigital al CRM. No es una idea futura: esta escrita con base en los endpoints, snippets y wizard que hoy existen en el proyecto.

## 1. Objetivo de esta guia

El objetivo es que cualquier implementador pueda:

1. Crear el canal desde el CRM.
2. Obtener el endpoint correcto.
3. Obtener el token correcto.
4. Pegar el snippet o conectar el proveedor externo.
5. Verificar que los leads entren al inbox omnicanal.
6. Confirmar que se creen lead, conversacion, mensaje y captura.

## 2. Donde se hace todo dentro del sistema

La pantalla central para montar canales es:

- Dashboard > CRM > Integraciones
- Ruta UI: /dashboard/crm/integraciones

Desde esa pantalla se hace todo esto:

1. Crear el canal con el wizard.
2. Elegir plantilla.
3. Definir estado inicial.
4. Generar o pegar token de prueba/verificacion.
5. Copiar endpoint, snippet, iframe, webhook o payload.
6. Conectar Meta cuando el canal sea de WhatsApp, Messenger, Facebook o Instagram.

## 3. Conceptos que debes tener claros antes de empezar

### 3.1 Estados del canal

- DRAFT: canal creado pero no listo para recibir trafico.
- TESTING: canal habilitado para pruebas seguras.
- ACTIVE: canal listo para produccion.
- DISABLED: canal apagado.
- ERROR: el canal tuvo un fallo operativo.

Regla importante:

- Los endpoints de captura y webhook solo aceptan canales en TESTING o ACTIVE.

### 3.2 Token del canal

Cada canal tiene un token de prueba/verificacion.

Ese token se usa para:

1. Validar capturas web.
2. Validar bridges de Gmail, Outlook, TikTok y YouTube.
3. Validar webhooks sociales.
4. Verificaciones iniciales del canal.

Si el token no coincide, el backend responde con error 403.

### 3.3 Que crea el CRM cuando un canal recibe un contacto

Cuando un inbound entra correctamente, el sistema crea o actualiza:

1. Lead.
2. Conversacion.
3. Mensaje.
4. Captura.
5. Actividad CRM.

El destino final operativo es:

- Pipeline CRM.
- Inbox omnicanal.
- Oportunidades del CRM existente.

## 4. Flujo general para crear cualquier canal

Haz esto siempre, sin importar el canal:

1. Entra a /dashboard/crm/integraciones.
2. Haz clic en Nuevo canal.
3. En el paso 1 del wizard, elige la plantilla correcta.
4. En el paso 2, define:
   - Nombre del canal.
   - Estado inicial, normalmente TESTING.
   - Token de prueba / verificacion.
5. Completa los campos especificos del canal.
6. Finaliza la creacion.
7. Selecciona el canal en la lista.
8. En Studio de assets, copia el endpoint, token, snippet o payload.
9. Conecta el proveedor externo.
10. Haz una prueba real.
11. Revisa:
   - Capturas.
   - Conversaciones.
   - Ultimo webhook.
   - Inbox omnicanal.

## 5. Resumen rapido por tipo de canal

| Canal | Plantilla | Endpoint principal | Metodo de conexion |
|---|---|---|---|
| Formulario Web | Formulario Web | /api/crm/captures/web-form | Iframe hospedado o script legacy |
| Chatbot Web | Chatbot Web | /api/crm/captures/chatbot | Iframe o widget |
| WhatsApp Cloud | WhatsApp Cloud | /api/crm/channels/{channelId}/webhook | Meta OAuth o credenciales/manual |
| WhatsApp Sandbox | WhatsApp Cloud o sandbox interno | /api/crm/channels/{channelId}/webhook | Testing / webhook |
| Facebook Page | Facebook / Messenger | /api/crm/channels/{channelId}/webhook | Meta OAuth |
| Messenger | Facebook / Messenger | /api/crm/channels/{channelId}/webhook | Meta OAuth |
| Instagram DM | Instagram DM | /api/crm/channels/{channelId}/webhook | Meta OAuth |
| Gmail | Gmail Inbox Bridge | /api/crm/captures/bridge | Apps Script |
| Outlook | Outlook Inbox Bridge | /api/crm/captures/bridge | Power Automate |
| TikTok | TikTok Lead Bridge | /api/crm/captures/bridge | Make, Zapier, n8n o backend propio |
| YouTube | YouTube Lead Bridge | /api/crm/captures/bridge | Make, Zapier, n8n o backend propio |

## 6. Formulario Web

Este es el canal mas simple y el primero que deberia quedar operativo en cada empresa.

### 6.1 Como crearlo

1. En Integraciones, crea un canal con la plantilla Formulario Web.
2. Pon un nombre claro, por ejemplo: Formulario landing etiquetas.
3. Deja el proveedor tecnico en WEB_FORM.
4. Deja el estado en TESTING mientras pruebas.
5. Genera o pega el token.
6. En Tipo de bridge deja GENERIC.
7. Configura el builder visual del formulario:
   - Titulo.
   - Descripcion.
   - Texto del CTA.
   - Mensaje de exito.
   - Campos visibles.
   - Labels y placeholders.
   - Tipografia, colores, radios y espaciados.
8. Si el cliente va a incrustarlo en su sitio, deja habilitado Publicar formulario por iframe.
9. Si el cliente ya tiene un formulario propio en HTML, puedes dejar tambien el Selector del formulario legacy, por ejemplo:
   - #lead-form
   - .form-cotizacion
10. Guarda el canal.

### 6.2 Como conectarlo al sitio web

Ahora hay dos formas reales de integrarlo.

#### Opcion recomendada: iframe profesional hospedado por SGDigital

1. Selecciona el canal en la lista.
2. Ve a la pestaña Formulario.
3. Copia la URL publica del formulario o el iframe listo para pegar.
4. Pegalo en la pagina del cliente.
5. Si quieres endurecer seguridad, define Dominios permitidos con los hosts reales del sitio.
6. Verifica que el preview del canal coincida con lo que el cliente espera visualmente.

#### Opcion legacy: script sobre formulario existente

1. Selecciona el canal en la lista.
2. Ve a la pestaña Formulario.
3. Copia el snippet legacy por selector.
4. Pegalo en la pagina donde ya existe el formulario HTML.
5. Verifica que el selector del script coincida exactamente con el formulario real.

### 6.3 Que campos soporta

El endpoint acepta, entre otros:

- nombre
- email
- telefono
- empresaNombre
- ciudad
- producto
- mensaje
- landingPageUrl
- referrerUrl
- utmSource
- utmMedium
- utmCampaign
- utmContent
- utmTerm

### 6.4 Endpoint real

- POST /api/crm/captures/web-form

Cuando usas el modo iframe, tambien queda disponible una URL publica del formulario con esta estructura:

- /form/{channelId}

El body debe incluir:

1. channelId
2. token o header x-crm-channel-token
3. Los datos del lead

### 6.5 Verificacion minima

Despues de enviar el formulario, revisa:

1. Que aumente el contador de capturas.
2. Que aparezca una conversacion nueva.
3. Que el lead quede asociado a la empresa y sede del canal.
4. Que el ultimo webhook o captura quede registrado.

## 7. Chatbot Web

Este canal sirve para incrustar un asistente web que alimenta el inbox omnicanal y puede responder automaticamente.

### 7.1 Como crearlo

1. Crea un canal con la plantilla Chatbot Web.
2. Define nombre del canal.
3. Deja estado en TESTING al inicio.
4. Genera el token.
5. Configura:
   - Titulo visible del chatbot.
   - Nombre del asistente.
   - Prompt inicial.
   - Altura del iframe.
   - Color de acento.
   - Colores de fondo.
   - Fuente CSS.
   - Launcher flotante si aplica.
   - Texto, icono, posicion y tamaño del launcher.
   - Dominios permitidos.
6. Guarda el canal.

### 7.2 Como publicarlo

Tienes dos opciones:

1. Iframe.
2. Widget flotante.

En Studio de assets puedes copiar:

1. URL publica del chatbot.
2. Iframe listo para pegar.
3. Snippet del widget flotante.

### 7.3 Recomendacion operativa

Si el chatbot va a ser publico:

1. Deja publicEmbedEnabled activo.
2. Configura allowedDomains con dominios reales, por ejemplo:
   - cliente.com
   - www.cliente.com
   - demo.cliente.com

Si no restringes dominios, la demo puede funcionar, pero la configuracion queda menos endurecida.

### 7.4 Endpoint real

- POST /api/crm/captures/chatbot

### 7.5 Como valida seguridad

El backend valida:

1. channelId.
2. Estado del canal.
3. Token si el iframe publico no esta habilitado.
4. Dominio permitido cuando el embed es publico.

### 7.6 Que hace ademas de capturar

Este canal no solo recibe el lead. Tambien puede:

1. Crear respuesta automatica.
2. Cambiar la conversacion a BOT_ACTIVE o HUMAN_ACTIVE.
3. Marcar el lead como QUALIFIED si ya tiene suficiente informacion.
4. Buscar coincidencias de inventario/materiales para responder mejor.

### 7.7 Verificacion minima

1. Abre la URL publica o la pagina con el iframe.
2. Enviale un mensaje de prueba.
3. Verifica que se cree la conversacion.
4. Verifica la respuesta automatica del bot.
5. Revisa el inbox omnicanal.

## 8. WhatsApp Cloud

Este canal usa el webhook omnicanal y puede apoyarse en Meta para dejar IDs y assets reales sincronizados.

### 8.1 Como crearlo

1. Crea un canal con la plantilla WhatsApp Cloud.
2. Define el nombre del canal.
3. Deja estado en TESTING.
4. Genera o pega el token.
5. Completa estos campos si ya los tienes:
   - Business Account ID.
   - Phone Number ID.
   - Access Token Cloud API.
   - Version Graph API.
6. Guarda el canal.

### 8.2 Forma recomendada de conectarlo

Despues de crear el canal:

1. Seleccionalo.
2. Usa el boton Conectar con Meta.
3. Completa el login OAuth de Meta.
4. Deja que el callback regrese al CRM.
5. Si hace falta, pulsa Sincronizar Meta.

Con eso el sistema puede completar datos reales del canal y dejar sincronizados los assets de WhatsApp.

### 8.3 Si prefieres configuracion manual

Tambien puedes operar con:

1. Business Account ID.
2. Phone Number ID.
3. Token de verificacion.
4. Access Token Cloud API.

Esto sirve sobre todo para ambientes de prueba o cuando el cliente te entrega las credenciales directamente.

### 8.4 Webhook real

- GET /api/crm/channels/{channelId}/webhook
- POST /api/crm/channels/{channelId}/webhook

Uso:

1. GET para verificacion inicial del proveedor.
2. POST para eventos inbound.

### 8.5 Que debes configurar en Meta

1. Webhook callback URL apuntando al canal exacto.
2. Verify token igual al token del canal.
3. Suscripcion a eventos de mensajes.
4. Numero correcto vinculado al canal.

### 8.6 Verificacion minima

1. Haz la verificacion GET desde Meta.
2. Enviale un mensaje al numero.
3. Verifica que entre una conversacion al inbox CRM.
4. Revisa que el canal muestre Ultimo webhook.

### 8.7 Minimo vital para dejarlo viable

Del lado del sistema SGDigital debe quedar listo esto:

1. APP_URL o NEXTAUTH_URL publico y estable.
2. META_APP_ID y META_APP_SECRET configurados en el entorno.
3. Callback OAuth accesible en /api/crm/channels/{channelId}/meta/callback.
4. Webhook del canal accesible en /api/crm/channels/{channelId}/webhook.
5. Canal creado en CRM con provider WhatsApp Cloud, token de verificacion y estado TESTING o ACTIVE.
6. Si van a enviar desde el inbox, access token y Phone Number ID reales guardados o sincronizados desde Meta.

Del lado del cliente, lo minimo viable es esto:

1. Tener un Business Manager con permisos sobre WhatsApp.
2. Tener un numero dado de alta en WhatsApp Business Platform.
3. Autorizar el login Conectar con Meta desde una cuenta con acceso al activo correcto.
4. Elegir el Phone Number ID correcto dentro del CRM.
5. Configurar en Meta el callback URL exacto y el verify token del canal.
6. Suscribirse al evento de mensajes para que entren inbound al inbox.
7. Hacer una prueba real enviando un mensaje al numero y confirmar que el hilo aparece en el CRM.

Si eso no se cumple, el canal puede quedar creado pero no operativo para conversacion real.

## 9. WhatsApp Sandbox

Funciona con la misma base operativa del webhook social, pero orientado a pruebas.

### 9.1 Como crearlo

1. Crea el canal en TESTING.
2. Define token.
3. Completa Business Account ID y Phone Number ID si los tienes.
4. Si vas a probar salida por Cloud API, agrega Access Token.
5. Guarda el canal.

### 9.2 Endpoint

- /api/crm/channels/{channelId}/webhook

### 9.3 Recomendacion

Usa este canal para:

1. Pruebas internas.
2. Simulaciones controladas.
3. Pruebas previas antes de pasar a ACTIVE.

## 10. Facebook Page

Este canal mete mensajes de pagina de Facebook al inbox omnicanal.

### 10.1 Como crearlo

1. Crea el canal con la plantilla Facebook / Messenger.
2. Define nombre.
3. Deja estado en TESTING.
4. Genera token.
5. Si aun no conectas Meta, puedes dejar temporalmente:
   - Account ID.
   - Page ID / Inbox ID.
6. Guarda el canal.

### 10.2 Como conectarlo

1. Selecciona el canal.
2. Pulsa Conectar con Meta.
3. Autoriza la cuenta correcta.
4. Regresa al CRM.
5. Pulsa Sincronizar Meta si quieres refrescar paginas y activos.

### 10.3 Endpoint

- /api/crm/channels/{channelId}/webhook

### 10.4 Verificacion minima

1. Confirma que la pagina quede asociada al canal.
2. Enviale un mensaje de prueba a la pagina.
3. Revisa la conversacion en el inbox CRM.

## 11. Messenger

Messenger comparte la misma base de conexion Meta, pero debes tratarlo como canal propio dentro del CRM.

### 11.1 Como crearlo

1. Crea el canal con la plantilla Facebook / Messenger.
2. Define nombre especifico, por ejemplo: Messenger principal.
3. Estado en TESTING.
4. Genera token.
5. Guarda el canal.

### 11.2 Como conectarlo

1. Conecta Meta desde el boton del canal.
2. Asegura que la pagina correcta quede vinculada.
3. Verifica que el Page ID asociado sea el correcto.

### 11.3 Endpoint

- /api/crm/channels/{channelId}/webhook

### 11.4 Verificacion minima

1. Envia un DM de prueba a la pagina.
2. Revisa que caiga al inbox CRM.
3. Verifica lead y conversacion.

## 12. Instagram DM

Este canal usa el mismo ecosistema Meta, pero el activo importante es la cuenta de Instagram asociada.

### 12.1 Como crearlo

1. Crea el canal con la plantilla Instagram DM.
2. Define nombre.
3. Estado en TESTING.
4. Genera token.
5. Guarda el canal.

### 12.2 Como conectarlo

1. Selecciona el canal.
2. Pulsa Conectar con Meta.
3. Autoriza la cuenta que tenga vinculada la pagina y el Instagram correcto.
4. Regresa al CRM.
5. Revisa que quede sincronizado el Instagram activo.

### 12.3 Endpoint

- /api/crm/channels/{channelId}/webhook

### 12.4 Verificacion minima

1. Enviale un DM a la cuenta.
2. Revisa que se cree la conversacion en el inbox.
3. Verifica que el canal muestre actividad y ultima sincronizacion.

## 13. Gmail Inbox Bridge

Este canal ya esta listo para operar via bridge real hacia el CRM.

### 13.1 Como crearlo

1. Crea un canal con la plantilla Gmail Inbox Bridge.
2. Verifica que el proveedor quede en WEB_FORM.
3. Verifica que el bridgeKind quede en GMAIL.
4. Define nombre.
5. Deja estado en TESTING.
6. Genera token.
7. Guarda el canal.

### 13.2 Como conectarlo

1. Selecciona el canal.
2. Ve a la pestaña Bridges.
3. Copia el script de Google Apps Script.
4. En tu cuenta de Google, abre Apps Script.
5. Crea un proyecto nuevo.
6. Pega el script.
7. Ajusta la etiqueta si quieres otra distinta de CRM/Prospectos.
8. Autoriza el script.
9. Crea un trigger recurrente para ejecutar la funcion.
10. En Gmail, etiqueta los correos de prospectos con la etiqueta configurada.

### 13.3 Que hace el script

1. Lee hilos con la etiqueta.
2. Toma el ultimo mensaje.
3. Construye payload con remitente, correo, asunto y cuerpo.
4. Lo envia al bridge del CRM.
5. Remueve la etiqueta para no reprocesar el hilo.

### 13.4 Endpoint real

- POST /api/crm/captures/bridge

### 13.5 Campos principales que envia Gmail

- channelId
- token
- fromName
- fromAddress
- message
- subject
- eventAt
- payload.threadId
- payload.messageId

### 13.6 Verificacion minima

1. Marca un correo con la etiqueta del bridge.
2. Ejecuta el trigger o corre manualmente el Apps Script.
3. Verifica que aparezca una conversacion en el inbox.
4. Revisa que la actividad quede como ingreso de Gmail.

## 14. Outlook Inbox Bridge

Este canal queda listo usando Power Automate o cualquier flujo que pueda hacer un POST HTTP.

### 14.1 Como crearlo

1. Crea un canal con la plantilla Outlook Inbox Bridge.
2. Verifica que el proveedor quede en WEB_FORM.
3. Verifica que bridgeKind quede en OUTLOOK.
4. Define nombre.
5. Deja estado en TESTING.
6. Genera token.
7. Guarda el canal.

### 14.2 Como conectarlo con Power Automate

1. Selecciona el canal.
2. Ve a la pestaña Bridges.
3. Copia el payload de ejemplo para Outlook / Power Automate.
4. En Power Automate, crea un flujo con trigger de correo entrante.
5. Filtra solo correos comerciales o de prospectos.
6. Agrega una accion HTTP.
7. Usa como URL el endpoint que aparece en el payload o el endpoint del bridge del CRM.
8. Usa metodo POST.
9. Usa Content-Type application/json.
10. Pega el body y mapea los campos dinamicos del correo.

### 14.3 Endpoint real

- POST /api/crm/captures/bridge

### 14.4 Campos que debes mapear

- fromName = remitente visible
- fromAddress = correo remitente
- message = bodyPreview o cuerpo resumido
- subject = asunto
- eventAt = fecha de recepcion
- payload.messageId = id del correo
- payload.threadId = conversationId o id equivalente

### 14.5 Verificacion minima

1. Envia un correo de prueba al inbox monitoreado.
2. Verifica que Power Automate ejecute el POST.
3. Revisa que el CRM cree la conversacion.
4. Confirma que la actividad quede como Outlook Inbox Bridge.

## 15. TikTok Lead Bridge

Este canal usa el mismo bridge general y sirve mientras no exista integracion nativa directa.

### 15.1 Como crearlo

1. Crea un canal con la plantilla TikTok Lead Bridge.
2. Verifica que bridgeKind quede en TIKTOK.
3. Define nombre.
4. Estado en TESTING.
5. Genera token.
6. Guarda el canal.

### 15.2 Como conectarlo

1. Usa Make, Zapier, n8n o una funcion serverless.
2. Configura el disparador desde TikTok Lead Ads o la fuente que tengas.
3. Mapea los datos del lead.
4. Haz POST al endpoint bridge del CRM.

### 15.3 Endpoint real

- POST /api/crm/captures/bridge

### 15.4 Recomendacion

Incluye al menos:

1. Nombre.
2. Email o telefono.
3. Mensaje o contexto.
4. Campaign/sourceCampaign si existe.

## 16. YouTube Lead Bridge

Sirve para capturas originadas en formularios, comentarios cualificados o automatizaciones asociadas a campañas de video.

### 16.1 Como crearlo

1. Crea un canal con la plantilla YouTube Lead Bridge.
2. Verifica bridgeKind en YOUTUBE.
3. Define nombre.
4. Estado en TESTING.
5. Genera token.
6. Guarda el canal.

### 16.2 Como conectarlo

1. Usa Make, Zapier, n8n o backend propio.
2. Toma el evento de la fuente de YouTube o landing conectada.
3. Haz POST al bridge del CRM.

### 16.3 Endpoint real

- POST /api/crm/captures/bridge

## 17. Como verificar que un canal quedo bien conectado

Despues de montar cualquier canal, revisa siempre esto:

1. El canal aparece en Integraciones.
2. El canal tiene estado TESTING o ACTIVE.
3. El token del canal esta definido.
4. El endpoint se puede copiar desde Studio de assets.
5. El contador de capturas aumenta cuando haces la prueba.
6. El contador de conversaciones aumenta.
7. El inbox omnicanal muestra el hilo.
8. El detalle del canal muestra Ultimo webhook o ultima captura.

## 18. Errores comunes y que significan

### 18.1 Error 403 Token invalido

Significa que:

1. El token enviado no coincide con el del canal.
2. O no estas enviando el header esperado.

Que hacer:

1. Copia otra vez el token desde el canal.
2. Revisa si el proveedor lo manda por header o en body.

### 18.2 Error 409 Canal no disponible

Significa que el canal esta en:

- DRAFT
- DISABLED
- ERROR

Que hacer:

1. Cambia el estado a TESTING o ACTIVE.
2. Guarda de nuevo el canal.

### 18.3 Error 404 Canal no encontrado

Significa que:

1. El channelId es incorrecto.
2. O estas usando el endpoint de otro tipo de canal.

### 18.4 El canal no se deja eliminar

Eso es correcto cuando ya tiene:

1. Conversaciones.
2. Capturas.

En ese caso no se elimina: se desactiva.

## 19. Recomendacion de rollout por cliente

Si vas a implementar esto por empresa, el orden mas sano es:

1. Formulario Web.
2. Chatbot Web.
3. WhatsApp Cloud.
4. Messenger y Facebook Page.
5. Instagram DM.
6. Gmail.
7. Outlook.
8. TikTok.
9. YouTube.

La razon es simple:

1. Formularios y chatbot dependen solo de tu propio stack.
2. WhatsApp y Meta requieren mas coordinacion con el cliente.
3. Gmail y Outlook dependen de automatizaciones externas.
4. TikTok y YouTube conviene activarlos cuando el proceso base ya este estable.

## 20. Checklist final de entrega a produccion

Antes de pasar un canal a ACTIVE, confirma esto:

1. El canal recibio al menos una prueba real exitosa.
2. El inbox muestra la conversacion.
3. El asesor puede ver el lead en CRM.
4. El token esta documentado y bajo control.
5. En chatbot, los dominios permitidos estan definidos.
6. En Meta, el activo correcto quedo sincronizado.
7. En Gmail y Outlook, la automatizacion externa ya corre sola.
8. El canal tiene responsable operativo dentro del cliente.

## 21. Nota importante sobre esta version

La base actual ya soporta de forma real:

1. Formularios web.
2. Chatbot web.
3. Webhook omnicanal para WhatsApp, Messenger, Facebook e Instagram.
4. Bridge Gmail.
5. Bridge Outlook.
6. Bridges reutilizables para TikTok y YouTube.

Y todo termina sobre la misma base multiempresa del CRM, sin crear modulos paralelos para cada canal.