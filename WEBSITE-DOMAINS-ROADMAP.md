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

- [ ] Crear modelo `WebsiteProjectDomain` y estados de verificación/SSL.
- [ ] Garantizar unicidad global de `hostname`.
- [ ] Generar token TXT de verificación por dominio.
- [ ] Implementar consulta DNS TXT y CNAME/A desde backend.
- [ ] Activar dominios únicamente después de verificar propiedad y destino.
- [ ] Permitir seleccionar dominio principal.
- [ ] Resolver dominios personalizados activos desde el proxy.
- [ ] Autorizar TLS bajo demanda únicamente para dominios activos.
- [ ] Mostrar instrucciones DNS específicas para raíz y `www`.
- [ ] Añadir redirecciones canónicas y política de cambio/desconexión.
- [ ] Implementar tarea periódica de reverificación.
- [ ] Registrar auditoría de altas, verificaciones y desconexiones.

## Fase 3 - Buscar y comprar dominio

- [ ] Elegir un solo proveedor inicial: OpenSRS o ResellerClub.
- [ ] Crear interfaz interna `DomainProvider` desacoplada del proveedor.
- [ ] Configurar credenciales exclusivamente en servidor y registrar IP autorizada cuando aplique.
- [ ] Consultar disponibilidad y alternativas por TLD.
- [ ] Consultar precios reales de registro y renovación.
- [ ] Definir margen comercial, impuestos y moneda de venta.
- [ ] Recoger y proteger datos del titular requeridos por el registro.
- [ ] Integrar pago antes del registro con idempotencia.
- [ ] Registrar dominio y configurar DNS hacia Ordex.
- [ ] Persistir orden, identificador del proveedor, costo y respuesta auditada.
- [ ] Manejar operaciones pendientes, rechazo, reintentos y reembolso.
- [ ] Añadir sincronización o webhooks de estado del proveedor.

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
