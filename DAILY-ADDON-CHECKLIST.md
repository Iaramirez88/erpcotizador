# Daily Addon Checklist

## Fase 1. Base plugin activable

- [x] Definir Daily como addon hijo de CRM, no como modulo padre nuevo
- [x] Reutilizar persistencia por empresa con DomainEntitlement + metadata
- [x] Crear catalogo base y parser de configuracion en src/lib/crm-addons.ts
- [x] Exponer API para listar y activar el addon
- [x] Mostrar tarjeta Addons CRM en Integraciones CRM

## Fase 2. Conexion y aprovisionamiento

- [x] Permitir modo SGDigital administrado
- [x] Permitir modo cuenta propia de Daily
- [x] Guardar API key cifrada solo en backend
- [x] Validar dominio/configuracion antes de marcar listo

## Fase 3. Llamadas embebidas

- [x] Crear room por conversacion CRM
- [x] Crear token efimero por participante
- [x] Abrir llamada en modal desde el inbox CRM
- [x] Registrar sesion, duracion y estado en CRM

## Fase 4. Operacion avanzada

- [x] Permisos por usuario para iniciar/unirse/grabar
- [x] Grabacion opcional
- [x] Metricas de uso y consumo mensual
- [x] Cobro/activacion comercial del addon
# ====== daily ==========
SGDIGITAL_DAILY_API_KEY=tu_api_key_de_daily
SGDIGITAL_DAILY_DOMAIN=tu-dominio.daily.co

## Diagnostico: "no se abre la ventana de llamada"

Importante: la llamada del CRM **no es una llamada telefonica**. El CRM crea una sala
Daily (audio o video) y **el prospecto entra desde un enlace** en su navegador. No existe
marcacion nativa por API en WhatsApp Cloud, Messenger ni Instagram.

### Requisitos que deben cumplirse a la vez

1. Existe la fila `DomainEntitlement` con `domain = 'CRM_ADDON_DAILY_CALLS'` y `enabled = true`.
2. Hay credencial Daily: `SGDIGITAL_DAILY_API_KEY` (modo `SGDIGITAL_MANAGED`) o API key
   propia cifrada de la empresa (modo `CUSTOMER_DAILY`).
3. La validacion contra `https://api.daily.co/v1/` quedo OK (`validationCheckedAt` sin
   `lastValidationError`). Solo entonces `addon.ready = true`.
4. `SHARE_TOKEN_SECRET` o `NEXTAUTH_SECRET` configurado: sin secreto no se firma el token
   del enlace publico `/llamada?token=...`.

### Como verificar en caliente

- `GET /api/crm/addons/DAILY_CALLS` devuelve `enabled`, `ready`, `validation.message` y
  `checklist`. El modal de llamada del inbox ahora muestra esa misma checklist y marca
  cada requisito pendiente.
- `POST /api/crm/conversations/{id}/call` devuelve 200 con `roomName`, `ownerToken`,
  `guestInviteUrl` e `inviteDispatch`, o un error con la causa exacta del bloqueo.

### Causa mas frecuente en local/DEV

`SGDIGITAL_DAILY_API_KEY` vacia y sin fila de addon: el modal abre, pero informa
"El addon Videollamadas Daily esta inactivo..." o "Falta configurar
SGDIGITAL_DAILY_API_KEY en el servidor." No es un bug de la ventana: falta aprovisionar
el addon. Con cuenta propia basta crear la cuenta en Daily, guardar la API key en la
tarjeta del addon y pulsar validar.

### Canales y forma de conectar al prospecto

| Canal conectado | Llamada nativa por API | Como entra el prospecto |
| --- | --- | --- |
| WhatsApp Cloud / Sandbox | No | Enlace `/llamada?token=...` enviado por WhatsApp si la ventana de 24 h esta abierta; si no, se copia manualmente |
| Messenger / Facebook Page | No | Enlace manual (boton "Copiar enlace") |
| Instagram DM | No | Enlace manual (boton "Copiar enlace") |
| Formulario web / Chatbot web | No | Enlace manual (boton "Copiar enlace") |
| Telefono (`tel:`) | No aplica | Abre el marcador del dispositivo del asesor; no queda sala ni registro en CRM |
