# Deploy seguro: precios por modulo y snapshot de cobro

Este cambio agrega dos piezas nuevas al esquema de facturación:

1. `billing_invoices.quotedModulesJson`
2. tabla `plan_module_price_settings`

## Desarrollo

En desarrollo puedes usar Prisma normalmente:

```bash
npx prisma migrate dev
```

Si la base tiene drift y es descartable:

```bash
npx prisma migrate reset --force
```

## Producción sin borrar datos

Si producción no debe resetearse, aplica SQL idempotente y luego resuelve las migraciones en Prisma.

### 1. Aplicar columna de snapshot

```bash
psql "$DATABASE_URL" -f scripts/sql/20260405_billing_invoice_modules_snapshot_prod.sql
```

### 2. Crear tabla de precios por módulo

```bash
psql "$DATABASE_URL" -f scripts/sql/20260405_plan_module_price_settings_prod.sql
```

### 3. Marcar migraciones como aplicadas

```bash
npx prisma migrate resolve --applied 20260405223000_billing_invoice_modules_snapshot
npx prisma migrate resolve --applied 20260405231500_plan_module_price_settings
```

### 4. Regenerar cliente Prisma en el servidor

```bash
npx prisma generate
```

### 5. Validar

1. Abrir `/dashboard/configuracion/plan` y verificar que aparece historial de cobros.
2. Abrir `/dashboard/configuracion/super-admin/modulos-por-plan` y confirmar que se ven los precios por módulo.
3. Cambiar un precio en super admin y validar que la calculadora del plan refleje el nuevo valor.