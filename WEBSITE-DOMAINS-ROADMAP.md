# Website Domains - Checklist

Actualizado: 2026-09-12

## Objetivo

Ofrecer publicación profesional para sitios creados en Ordex:

- Gratis: `empresa.sgdigitalordex.com`.
- Dominio existente: `empresa.com` conectado mediante DNS.
- Compra: búsqueda y registro mediante un proveedor reseller.

## Fase 1 - Subdominio gratuito

### Aplicación

- [x] Resolver solicitudes públicas por cabecera `Host` y reescribirlas al renderer `/sites/*`.
- [x] Generar URLs públicas como `https://empresa.sgdigitalordex.com` cuando `NEXT_PUBLIC_WEBSITE_BASE_DOMAIN` está configurado.
- [x] Mantener fallback `/sites/empresa` para desarrollo y entornos sin dominio base.
- [x] Hacer `WebsiteProject.subdomain` único en toda la plataforma.
- [x] Sanear duplicados y nombres reservados existentes mediante migración no destructiva.
- [x] Reservar nombres internos como `www`, `api`, `admin`, `app`, `dashboard`, `mail` y `assets`.
- [x] Asignar automáticamente un subdominio global disponible al crear un sitio.
- [x] Añadir API autenticada para comprobar disponibilidad.
- [x] Añadir API autenticada para actualizar el subdominio de un proyecto propio.
- [x] Manejar conflictos concurrentes mediante el índice único y respuesta HTTP 409.
- [x] Añadir pestaña Dominios al módulo Servicios web.
- [x] Permitir comprobar, guardar y abrir el subdominio desde la pestaña Dominios.
- [x] Usar la URL por subdominio en Sitios y Builder visual.

### Infraestructura de producción

- [x] Añadir `NEXT_PUBLIC_WEBSITE_BASE_DOMAIN` al entorno y al build Docker.
- [x] Configurar Caddy para TLS bajo demanda.
- [x] Restringir la emisión TLS a subdominios registrados con contenido publicado.
- [ ] Crear en Cloudflare el registro wildcard `A  *  -> IP_DEL_VPS`.
- [ ] Mantener inicialmente el wildcard como DNS only.
- [ ] Desplegar la migración `20260912143000_website_project_global_subdomain`.
- [ ] Reconstruir `app` con `NEXT_PUBLIC_WEBSITE_BASE_DOMAIN=sgdigitalordex.com`.
- [ ] Reiniciar Caddy y comprobar `https://subdominio.sgdigitalordex.com`.
- [ ] Verificar renovación y persistencia de certificados en `caddy_data`.

## Fase 2 - Conectar dominio existente

- [x] Crear modelo `WebsiteProjectDomain` y estados de verificación/SSL.
- [x] Garantizar unicidad global de `hostname`.
- [x] Normalizar dominios con Public Suffix List, IDNA/punycode y rechazo de IP, localhost, dominios internos y nombres inválidos.
- [x] Generar un token TXT aleatorio por dominio con expiración y rotación.
- [x] Implementar consulta DNS TXT y CNAME/A/AAAA desde backend.
- [x] Activar dominios únicamente después de verificar propiedad y que A/AAAA/CNAME apunten a la infraestructura Ordex esperada.
- [x] No realizar fetch HTTP hacia el dominio durante la verificación para evitar SSRF y DNS rebinding; verificar mediante resolución DNS.
- [x] Usar un destino estable como `edge.sgdigitalordex.com`; indicar CNAME para `www`/subdominios y ALIAS/ANAME/CNAME flattening o A/AAAA para el dominio raíz.
- [x] Permitir seleccionar dominio principal.
- [x] Resolver dominios personalizados activos desde el proxy.
- [x] Autorizar TLS bajo demanda únicamente para dominios activos.
- [x] Mostrar instrucciones DNS para TXT, CNAME, A y AAAA.
- [x] Añadir redirecciones canónicas 308 desde dominios alternativos y el subdominio gratuito hacia el dominio principal conservando ruta y query string.
- [ ] Implementar estados `PENDING_VERIFICATION`, `PENDING_DNS`, `PENDING_TLS`, `ACTIVE`, `ERROR`, `SUSPENDED` y `DISCONNECTED`.
- [x] Al desconectar, retirar inmediatamente el host del proxy/TLS y aplicar una cuarentena antes de permitir que otro proyecto lo reclame.
- [ ] Implementar tarea periódica de reverificación de propiedad, destino DNS y vencimiento de verificación.
- [ ] Registrar auditoría de altas, verificaciones y desconexiones.
- [x] Aplicar rate limiting distribuido a la verificación DNS.
- [ ] Exigir reautenticación para desconectar o cambiar el dominio principal.

## Fase 3 - Buscar y comprar dominio

- [ ] Elegir un proveedor diseñado para reventa como proveedor inicial (recomendado: OpenSRS); usar Cloudflare para DNS/edge aunque el registrador sea otro.
- [ ] Evaluar Cloudflare Registrar API solo después de confirmar contractualmente que permite el modelo comercial y de custodia de dominios de terceros; disponibilidad de API no equivale a autorización de reventa.
- [ ] Crear interfaz interna `DomainProvider` desacoplada del proveedor.
- [ ] Configurar credenciales exclusivamente en servidor y registrar IP autorizada cuando aplique.
- [ ] Consultar disponibilidad y alternativas por TLD.
- [ ] Hacer una comprobación autoritativa y bloquear una cotización de corta duración con precio de registro, renovación, moneda, impuestos y margen separados.
- [ ] Definir margen comercial, impuestos y moneda de venta.
- [ ] Recoger, cifrar y limitar acceso a los datos del titular requeridos por ICANN/registro; el cliente debe figurar como titular, no Ordex.
- [ ] Mostrar consentimiento explícito sobre dominio exacto, titular, precio de renovación y carácter no reembolsable después de un registro exitoso.
- [ ] Integrar pago y registro como saga idempotente: orden `PENDING_PAYMENT` → pago confirmado → registro → captura/conciliación; si el registro falla, anular o reembolsar automáticamente.
- [ ] No reintentar ciegamente una compra: el nombre del dominio debe actuar como clave de idempotencia y toda respuesta incierta debe consultarse al proveedor antes de repetir.
- [ ] Registrar dominio, crear zona DNS y configurar raíz/`www` hacia Ordex automáticamente.
- [ ] Persistir orden, cotización aceptada, identificador del proveedor, costo, precio de venta y respuesta auditada sin guardar credenciales ni datos sensibles completos.
- [ ] Manejar workflows asíncronos `PENDING`, `IN_PROGRESS`, `ACTION_REQUIRED`, `BLOCKED`, `SUCCEEDED` y `FAILED` mediante polling/webhooks y cola de trabajos.
- [ ] Añadir sincronización o webhooks de estado del proveedor.
- [ ] Implementar renovación automática con aviso previo, período de gracia, fallo de cobro y procedimiento de transferencia/salida del cliente.

### Contratos internos recomendados

- `DomainProvider.search(query)` y `DomainProvider.check(domains)`.
- `DomainProvider.quote(domain, years)` con expiración y desglose de registro/renovación.
- `DomainProvider.register(order, registrant, idempotencyKey)`.
- `DomainProvider.getWorkflow(providerRef)` y `DomainProvider.renew(domain, years, idempotencyKey)`.
- `DnsProvider.createZone(domain)` y `DnsProvider.ensureWebsiteRecords(domain, target)`.
- Separar `DomainProvider` de `DnsProvider`: un dominio puede estar registrado en OpenSRS y usar DNS de Cloudflare.

## Fase posterior

- [ ] Correo empresarial (`ventas@empresa.com`).
- [ ] Administración DNS avanzada.
- [ ] Transferencia entrante y saliente de dominios.
- [ ] Renovación automática y avisos de vencimiento.
- [ ] Dominios premium.
- [ ] SSL avanzado y políticas por cliente.

## Validación de Fase 1

- [x] `prisma validate`.
- [x] `prisma generate`.
- [x] TypeScript `tsc --noEmit`.
- [x] Build de producción de Next.js.
- [ ] Aplicar migración en staging o producción con backup reciente.
- [ ] Crear un sitio de prueba y publicar su página Inicio.
- [ ] Confirmar que `/sites/subdominio` sigue funcionando como fallback.
- [ ] Confirmar HTTP y HTTPS sobre el subdominio gratuito.
- [ ] Confirmar navegación de páginas secundarias.
- [ ] Confirmar que un segundo proyecto no puede reclamar el mismo subdominio.
- [ ] Confirmar rechazo de nombres reservados.
