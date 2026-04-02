# Guia tecnica del flujo DIAN

## Estado actual

El modulo DIAN ya tiene base funcional para:

- guardar configuracion por empresa en `Empresa.dianSettings`
- crear documentos electronicos salientes y entrantes
- registrar eventos por documento
- listar historico enviado y recibido
- avanzar estados manuales o mock: `GENERATED -> TRANSMITTED -> EXPEDITED -> DELIVERED -> RECEIVED`

Todavia no existe integracion real con proveedor DIAN. La transmision actual es mock y genera valores `MOCK`, `UUID-*` y `CUFE-*`.

## Modelo de datos

La base del modulo esta en los modelos:

- `DianElectronicDocument`
- `DianElectronicEvent`

Campos clave actuales:

- `direction`: `OUTBOUND` o `INBOUND`
- `type`: `INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`, `ELECTRONIC_INSTRUMENT`
- `status`: `GENERATED`, `TRANSMITTED`, `EXPEDITED`, `DELIVERED`, `RECEIVED`, `ERROR`
- `payload`: snapshot JSON del documento
- `xml`: reservado para XML DIAN real
- `uuid`, `cufe`, `provider`, `providerRef`: ids externos o mock
- `lastError`: ultimo error operativo

## Pantallas y endpoints actuales

### Configuracion

- Pantalla POS/DIAN: `src/app/dashboard/pos/page.tsx`
- Endpoint configuracion: `src/app/api/dian/config/route.ts`

La configuracion DIAN se guarda completa como JSON en `empresa.dianSettings`. Hoy no hay validacion fuerte de estructura; la UI y los helpers la interpretan en runtime.

### Historico y detalle

- Listado: `src/app/api/dian/documentos/route.ts`
- Detalle: `src/app/api/dian/documentos/[id]/route.ts`

El historico ya permite separar enviados y recibidos por `direction`.

### Acciones por documento

- Transmitir: `src/app/api/dian/documentos/[id]/transmitir/route.ts`
- Expedir: `src/app/api/dian/documentos/[id]/expedir/route.ts`
- Entregar: `src/app/api/dian/documentos/[id]/entregar/route.ts`
- Recepcionar: `src/app/api/dian/documentos/[id]/recepcionar/route.ts`
- Recepcion manual de documentos entrantes: `src/app/api/dian/recepcion/route.ts`

Observacion importante:

- `transmitir` hoy no llama DIAN ni un operador tecnologico. Solo cambia estado a `TRANSMITTED`, pone `provider: MOCK` y crea `uuid/cufe/providerRef` simulados.
- `expedir`, `entregar` y `recepcionar` son pasos manuales de workflow. No hay callback externo ni polling de estado real.

### Plantilla visual PDF

- PDF interno POS: `src/lib/pos-invoice-pdf-template.tsx`

Esta plantilla sirve para la presentacion PDF interna. No genera XML UBL ni reemplaza la representacion fiscal exigida por DIAN.

## Flujo real que existe hoy

### 1. Crear documento saliente

Desde la UI POS/DIAN se puede:

- construir factura electronica manualmente
- vincular una factura POS ya creada por `posInvoiceId`
- vincular una devolucion POS para nota por `posReturnId`

El endpoint `POST /api/dian/documentos` ya hace dos cosas correctas:

- valida pertenencia de la factura/devolucion a la empresa y sede activas
- evita duplicar documento DIAN para una misma factura POS si ya existe uno reciente ligado

### 2. Guardar payload

El payload queda persistido como snapshot JSON. Eso es bueno porque permite:

- auditar exactamente lo enviado
- regenerar XML despues
- renderizar una vista previa sin volver a depender de los datos vivos

### 3. Transmitir

La accion actual solo simula envio. Aqui es donde debe conectarse el proveedor real.

### 4. Expedir, entregar y recepcionar

Estos pasos ya dejan trazabilidad en `DianElectronicEvent`, pero hoy son operados de forma manual desde la UI.

## Hallazgos de consistencia

### Lo que ya esta bien encaminado

- El modulo DIAN vive dentro de POS y reutiliza busqueda de clientes y productos desde la misma pantalla.
- El historico y el detalle usan una entidad propia, no dependen solamente de la factura POS.
- Ya existe una separacion entre documento interno y documento DIAN.
- El detalle ya muestra payload, XML, errores y eventos.

### Huecos reales que faltan

1. No hay vista previa previa al envio basada en el snapshot DIAN final.
2. No existe adaptador real a proveedor DIAN o a UBL XML.
3. No hay estado asincrono real desde proveedor externo.
4. `dianSettings` no tiene contrato fuerte tipado/validado en backend.
5. La numeracion se valida en UI, pero no queda blindada transaccionalmente en backend frente a concurrencia.
6. No hay reconciliacion visible entre factura POS, documento DIAN, acuse, entrega y recepcion en una sola tarjeta de seguimiento.

## Recomendacion de flujo coherente

### Flujo saliente

1. Crear o seleccionar factura POS.
2. Congelar snapshot fiscal DIAN desde esa factura.
3. Mostrar vista previa DIAN antes de transmitir.
4. Confirmar transmision.
5. Generar XML UBL y enviar a proveedor.
6. Guardar respuesta tecnica: `providerRef`, `uuid`, `cufe`, XML, codigo de respuesta, errores.
7. Refrescar historico con estado real.
8. Permitir reintentos solo si el estado tecnico lo permite.

### Flujo entrante

1. Registrar documento recibido o consumir webhook/importacion.
2. Guardar XML/payload crudo.
3. Mostrar timeline con `RECEIVED` y eventos de validacion.
4. Permitir conciliacion posterior con compra, proveedor o contabilidad.

## Como conectar datos reales DIAN

## 1. Tipar `dianSettings`

Se recomienda definir un contrato unico en backend con Zod o esquema equivalente para estas secciones:

- resolucion/numeracion autorizada
- emisor
- ambiente: pruebas o produccion
- proveedor tecnologico
- credenciales o identificadores de integracion
- comprador por defecto
- catalogo de productos DIAN por defecto

Minimo esperado para integracion real:

- prefijo
- rango `desde/hasta`
- numero actual
- fecha de vencimiento de resolucion
- NIT emisor
- razon social
- regimen/responsabilidades fiscales
- correo y telefono
- identificacion del software/proveedor

## 2. Crear adaptador de proveedor

Crear un servicio dedicado, por ejemplo:

- `src/lib/dian-provider.ts`

Responsabilidades:

- transformar `payload` a XML UBL o formato del operador
- firmar o preparar autenticacion
- transmitir
- consultar estado
- normalizar errores

Interfaz sugerida:

```ts
type DianProviderResult = {
  accepted: boolean
  providerRef?: string
  uuid?: string
  cufe?: string
  xml?: string
  statusMessage?: string
  raw?: unknown
}
```

## 3. Reemplazar la transmision mock

Archivo a intervenir primero:

- `src/app/api/dian/documentos/[id]/transmitir/route.ts`

Cambio esperado:

- leer documento y `empresa.dianSettings`
- construir XML desde `payload`
- enviar a proveedor real
- persistir `provider`, `providerRef`, `uuid`, `cufe`, `xml`, `lastError`
- pasar a `TRANSMITTED` o `ERROR` segun respuesta
- crear evento con metadata tecnica real

## 4. Agregar vista previa DIAN antes de enviar

Lo mas consistente es construir una vista previa desde `payload`, no desde el formulario vivo.

Recomendacion:

- cuando el usuario pulse crear documento, guardar el documento en `GENERATED`
- abrir panel de detalle o modal de vista previa
- mostrar comprador, items, impuestos, consecutivo, prefijo y totales
- desde esa misma vista ejecutar `transmitir`

Esto evita transmitir algo distinto a lo que el usuario aprobó.

## 5. Blindar numeracion en backend

Hoy la validacion del consecutivo vive sobre todo en la UI. Para evitar choques por concurrencia, el backend debe:

- validar el rango activo al crear
- reservar o avanzar consecutivo dentro de transaccion
- rechazar duplicados por `numero` + `empresaId` + `type` cuando aplique

## 6. Unificar seguimiento visual

En la UI de detalle del documento conviene mostrar una sola linea de tiempo con:

- creado
- transmitido
- expedido
- entregado
- recibido
- error si aplica

Y al lado:

- factura POS origen
- cliente
- total
- CUFE
- proveedor
- referencia externa

## Orden de implementacion recomendado

1. Tipar y validar `dianSettings` en backend.
2. Crear helper para renderizar snapshot fiscal consistente desde POS.
3. Agregar vista previa antes de transmitir.
4. Reemplazar `transmitir` mock por adaptador real.
5. Persistir XML y respuesta tecnica completa.
6. Agregar consulta/reconciliacion de estado externo.
7. Reforzar numeracion en backend con transaccion.

## Resumen ejecutivo

El sistema ya tiene una base buena de trazabilidad, historico y configuracion. Lo que falta no es rehacer el modulo sino cerrar el tramo tecnico entre `payload` persistido y proveedor real DIAN. El primer punto critico a resolver es dejar de transmitir en mock y meter una vista previa aprobable antes del envio.