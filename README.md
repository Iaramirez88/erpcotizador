This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Requisitos

- Node.js: recomendado `22.22.0` (ver `.nvmrc`). En Windows esto evita fallos de Prisma WASM al correr `prisma generate`.
- PostgreSQL accesible por `DATABASE_URL`.
- HTTPS en el dominio donde se instale la PWA si se quieren notificaciones push reales en móvil.

## Notificaciones Push PWA

Para que las notificaciones aparezcan con la app instalada y cerrada en Android o iOS, configura estas variables de entorno:

- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` ejemplo: `mailto:soporte@tudominio.com`

Notas operativas:

- En iPhone y iPad las push web sólo funcionan si el usuario instaló la app en pantalla de inicio y aceptó el permiso de notificaciones.
- En Android la PWA debe ejecutarse sobre HTTPS y el usuario debe conceder el permiso.
- La app ahora guarda suscripciones push por usuario y cualquier creación de notificación interna dispara entrega en tiempo real y push cuando hay una suscripción activa.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
# inicializar docker para el servicio OCR dee scaneo
docker-compose -f docker-compose.ocr.yml up -d --build

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Scripts útiles:

- `npm run typecheck`
- `npm run smoke:cotizaciones`
- `npm run test:cotizacion-sequence` (prueba concurrencia del consecutivo por sede)

## Cobros (Bold)

Endpoints:

- `POST /api/billing/bold/link`: crea un Payment Link y retorna `url` para redirección.
- `POST /api/billing/bold/webhook`: recibe eventos de Bold y sincroniza el estado del pago + la vigencia del plan.

Variables de entorno:

- `BOLD_IDENTITY_KEY`: API key para crear payment links.
- `BOLD_WEBHOOK_SECRET`: secret para validar `x-bold-signature` en webhooks.
- `BOLD_VERIFY_WEBHOOK`: por defecto `true`. En local puedes poner `false` para probar sin firma.
- `APP_URL`: URL pública de la app (recomendado en producción). Se usa para construir el callback al dashboard.

Notas:

- Bold exige `https://` para `callback_url`, por eso en local normalmente no se envía.
- La vigencia del plan se controla por `Empresa.planValidUntil` y se extiende 1 mes / 1 año cuando llega `SALE_APPROVED`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
