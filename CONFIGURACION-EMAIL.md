# Configuración de Email para Cotizaciones

## Resend (Recomendado - Gratis hasta 100 emails/día)

1. **Crear cuenta en Resend:**
   - Ve a [https://resend.com](https://resend.com)
   - Regístrate con tu email
   - Verifica tu cuenta

2. **Obtener API Key:**
   - Ve a [API Keys](https://resend.com/api-keys)
   - Clic en "Create API Key"
   - Copia la key (empieza con `re_`)

3. **Verificar dominio (opcional pero recomendado):**
   - Ve a [Domains](https://resend.com/domains)
   - Agrega tu dominio
   - Configura los registros DNS
   - Una vez verificado, podrás enviar desde `noreply@tudominio.com`

4. **Configurar en tu proyecto:**
   ```bash
   # En tu archivo .env
   RESEND_API_KEY="re_tu_key_aquí"
   EMAIL_FROM="SGDigital <noreply@tudominio.com>"
   CONTABILIDAD_EMAIL="contabilidad@tuempresa.com"
   ```

## Modo de Prueba (sin dominio verificado)

Si no tienes dominio verificado, usa el email de desarrollo de Resend:

```env
EMAIL_FROM="onboarding@resend.dev"
```

Los emails solo llegarán a tu email de cuenta Resend, pero podrás probar toda la funcionalidad.

## Funcionalidades Implementadas

✅ **Generar PDF de cotización**
- Endpoint: `GET /api/cotizaciones/[id]/pdf`
- Descarga directa del PDF con formato profesional
- Incluye logo, datos del cliente, tabla de items, totales

✅ **Enviar cotización por email**
- Endpoint: `POST /api/cotizaciones/[id]/enviar`
- Plantilla HTML profesional
- PDF adjunto automáticamente
- Copia a contabilidad (si cotización está aprobada)
- Personalización de mensaje

✅ **UI en página de cotizaciones**
- Botón de descarga PDF
- Botón de envío por email
- Confirmaciones antes de enviar
- Indicadores de carga

## Probar Funcionalidad

1. **Sin configurar Resend (solo PDF):**
   - El botón de descarga PDF funcionará inmediatamente
   - El botón de email dará error (esperado)

2. **Con Resend configurado:**
   - Descarga PDF ✅
   - Envío de email ✅
   - Copia a contabilidad ✅

## Personalizar Email

Edita el archivo: `src/app/api/cotizaciones/[id]/enviar/route.ts`

Busca la sección `htmlEmail` para personalizar:
- Colores corporativos
- Logo de empresa
- Texto del mensaje
- Pie de página
