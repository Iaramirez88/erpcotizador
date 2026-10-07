# Google Marketing, SEO y contenido

## Alcance

La pestaña `CRM > Integraciones > Marketing y SEO` conecta una empresa con:

- Google Ads: campañas y métricas diarias de los últimos 30 días.
- Google Analytics 4: sesiones, usuarios, eventos clave e ingresos de los últimos 30 días.
- Google Search Console: consultas, URL, clics, impresiones y posición promedio.
- CRM: atribución por UTM y GCLID desde lead hasta oportunidad, cotización y venta.
- Agente de contenido: investigación de hasta tres páginas competidoras, comparación con el sitio actual y generación de un borrador original.

## Google Cloud

1. Crea o selecciona un proyecto en Google Cloud.
2. Habilita Google Ads API, Google Analytics Admin API, Google Analytics Data API y Google Search Console API.
3. Configura la pantalla de consentimiento OAuth.
4. Crea un cliente OAuth de tipo Aplicación web.
5. Registra como redirect URI exacta:

```text
https://TU_DOMINIO/api/oauth/google-marketing/callback
```

Para desarrollo puede añadirse al mismo cliente web:

```text
http://localhost:3000/api/oauth/google-marketing/callback
```

6. Autoriza estos scopes en la pantalla de consentimiento:

```text
openid
email
https://www.googleapis.com/auth/adwords
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/webmasters.readonly
```

### Revisión de flujos seguros

- El cliente OAuth debe ser de tipo **Aplicación web**. Elimina clientes antiguos de tipo Escritorio/Aplicación instalada si no se utilizan; el chequeo de Google evalúa todos los clientes del proyecto.
- ORDEX usa Authorization Code desde backend, `state` firmado con expiración, PKCE S256, verificador cifrado de un solo uso y callback vinculado al usuario que inició la conexión.
- ORDEX no usa flujo implícito ni WebViews embebidas.
- En producción, la redirect URI debe usar HTTPS y coincidir exactamente con `GOOGLE_MARKETING_REDIRECT_URI`.
- En producción configura `APP_URL`, `NEXTAUTH_URL` y `GOOGLE_MARKETING_REDIRECT_URI` con `https://sgdigitalordex.com`; el callback usa el origen de esta última para no redirigir a `localhost` detrás del proxy.
- Tras desplegar y completar una autorización real, Google puede tardar en recalcular el estado del chequeo del proyecto.

### Acceso a Google Ads API

Google retiró los developer tokens el 9 de septiembre de 2026. ORDEX no envía el header `developer-token` ni utiliza `GOOGLE_ADS_DEVELOPER_TOKEN`.

El acceso ahora pertenece al proyecto de Google Cloud que contiene el cliente OAuth. En **Google Cloud Console > Google Ads API > Overview**, verifica o solicita el nivel Explorer, Basic o Standard requerido. Un proyecto nuevo empieza con acceso de prueba y no puede consultar cuentas productivas hasta recibir el nivel correspondiente.

Cada empresa puede conectar Google Ads de dos formas:

- **Cuenta propia:** el cliente autoriza directamente su cuenta. ORDEX no envía `login-customer-id` y solo muestra las cuentas accesibles para ese usuario.
- **Mediante MCC:** la agencia autoriza una cuenta con acceso al MCC. ORDEX usa el Customer ID del MCC como `login-customer-id` y consulta sus cuentas operativas mediante `customer_client`.

La modalidad se guarda por conexión en `settingsJson`. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` funciona como MCC predeterminado para conexiones antiguas o cuando no se proporciona uno explícito. Nunca debe contener el Customer ID operativo.

### PageSpeed Insights

PageSpeed utiliza una API key independiente del cliente OAuth:

1. Habilita **PageSpeed Insights API** (`pagespeedonline.googleapis.com`).
2. Crea una credencial de tipo **API key**.
3. Restringe la clave a PageSpeed Insights API y, si el servidor tiene IP pública fija, limita su uso a esa IP.
4. Configura `PAGESPEED_API_KEY`. Si queda vacía, la auditoría técnica funciona, pero no obtiene Lighthouse ni Core Web Vitals.

## Variables de entorno

```bash
GOOGLE_MARKETING_CLIENT_ID="..."
GOOGLE_MARKETING_CLIENT_SECRET="..."
GOOGLE_MARKETING_REDIRECT_URI="https://sgdigitalordex.com/api/oauth/google-marketing/callback"
GOOGLE_ADS_LOGIN_CUSTOMER_ID="7889973249" # MCC, solo números; no usar el customer ID operativo
GOOGLE_ADS_API_VERSION="v25"
PAGESPEED_API_KEY="..."
```

El cifrado de tokens usa `CRM_CHANNEL_SECRET`; si no existe, usa `NEXTAUTH_SECRET`.
El agente reutiliza `LITOGRAFIA_AI_*` o `LLM_*`.

## Base de datos

La migración está versionada en:

```text
prisma/migrations/20261006130000_crm_google_marketing_seo/migration.sql
```

En producción, ejecútala mediante el flujo normal de despliegue antes de abrir la nueva pestaña. No fue aplicada automáticamente.

## Configuración en la aplicación

1. Abre `CRM > Integraciones > Marketing y SEO`.
2. Selecciona **Conectar Google** y autoriza la cuenta propietaria de los recursos.
3. ORDEX consulta automáticamente las cuentas Ads, propiedades GA4 y propiedades Search Console disponibles. Si existe una sola opción, queda seleccionada; si existen varias, elige cada una en su selector y pulsa **Guardar selección**.
4. Usa **Buscar cuentas** para refrescar la lista y **Sincronizar datos** para traer Ads y GA4.
5. Agrega palabras clave y usa **Actualizar** para consultar Search Console.

La propiedad de Search Console puede ser una URL (`https://cliente.com/`) o una propiedad de dominio (`sc-domain:cliente.com`).

## Atribución

Para cruzar campañas con el CRM, las URLs publicitarias deben conservar:

```text
utm_source=google
utm_medium=cpc
utm_campaign=Nombre exacto de campaña
gclid={gclid}
```

Los formularios del constructor, los formularios iframe y los snippets CRM conservan esos valores en `CrmLeadCapture`.
