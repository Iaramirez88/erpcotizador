# Roadmap Contabilidad Colombia

## Núcleo Operativo

1. Comprobantes contables manuales y automáticos.
2. Períodos contables con apertura, cierre y bloqueo (el estado se cambia en `/dashboard/contabilidad/cierres` vía `PATCH /api/contabilidad/periodos/[id]`; un período bloqueado no se reabre).
3. Consecutivos por tipo de comprobante.
4. Aprobación, anulación y reversión con trazabilidad.

## Libros Y Consultas

1. Libro diario.
2. Libro mayor.
3. Auxiliar por cuenta.
4. Auxiliar por tercero.
5. Auxiliar por centro de costo.
6. Balance de prueba.

## Estados Financieros

Estado: estado de situación financiera, estado de resultados y balance de prueba calculados desde asientos posteados y comprobantes aprobados en `/dashboard/contabilidad/estados-financieros` (API `/api/contabilidad/estados-financieros?from&to`).

1. [x] Estado de situación financiera (acumulado a la fecha de corte, con validación activo = pasivo + patrimonio + resultado).
2. [x] Estado de resultados por rango de fechas.
3. [x] Balance de prueba por rango con totales de débito/crédito.
4. [x] Metodología visible en pantalla y filtros rápidos (mes actual, mes anterior, año actual, año anterior).
5. [ ] Cambios en el patrimonio.
6. [ ] Flujo de efectivo.

## Tesorería Y Conciliación

Estado: cuentas bancarias y movimientos operativos en `/dashboard/contabilidad/tesoreria` (API `/api/contabilidad/bancos`, con `PATCH`/`DELETE` para cuentas y movimientos). Conciliación en `/dashboard/contabilidad/conciliaciones` (API `/api/contabilidad/conciliaciones`) cruzando saldo de tesorería contra la cuenta contable vinculada, con partidas pendientes y diferencia al corte; el cierre de cada corte se persiste en `treasury_bank_reconciliations` y se puede reabrir.

1. [x] Cuentas bancarias con saldo por cuenta y consolidado.
2. [x] Registro manual de movimientos (ingreso/egreso) por cuenta.
3. [x] Edición, activación/desactivación y eliminación controlada de cuentas y movimientos.
4. [x] Conciliación bancaria por cuenta (banco vs contabilidad al corte).
5. [x] Partidas pendientes y diferencias (movimientos sin asiento y asientos sin movimiento).
6. [x] Cierre de conciliación persistente por corte (snapshot de saldos, nota, marca de movimientos y reapertura).
7. [ ] Importación de extractos bancarios (CSV/OFX).
8. [ ] Ajustes generados desde conciliación.


## Tributario Colombia

1. IVA generado y descontable.
2. Retención en la fuente.
3. ReteICA.
4. Retención de IVA.
5. Autorretención.
6. Anexos tributarios por período.

## Integración ERP

Estado: POS (factura, finalización, anulación y devoluciones), compras (autorización y pagos) y recepción de documentos DIAN disparan el motor contable con `postReferenceToAccounting` (`src/lib/accounting/auto-post.ts`), apoyado en reglas por evento. La instalación de la base contable (PUC mínimo + 5 reglas) y la contabilización de pendientes se hacen desde `/dashboard/contabilidad` (`POST /api/contabilidad/base`, `/api/contabilidad/pendientes`).

1. [x] POS vendido (factura `PAID`) genera asiento `POS_INVOICE`; anulación deja el asiento en `VOID`.
2. [x] Devoluciones POS generan asiento `POS_RETURN`.
3. [x] Compras autorizadas generan asiento `COMPRA` y los pagos `COMPRA_PAGO`.
4. [x] Documentos DIAN recibidos generan `DIAN_DOCUMENT` cuando el payload trae montos y no existe compra con la misma factura.
5. [x] Nómina (período y liquidaciones).
6. [x] Base contable instalable por empresa (plan de cuentas + reglas base) y panel de pendientes de contabilizar.
7. [ ] Ajustes manuales del contador asistidos desde cada módulo (solo existe comprobante manual).

## Fases Recomendadas

### Fase 1

1. Comprobantes.
2. Períodos.
3. Libro diario y mayor.
4. Balance de prueba.

### Fase 2

1. Conciliación bancaria.
2. Auxiliares por tercero y centro.
3. Impuestos base.

### Fase 3

1. Estados financieros.
2. Cierre anual.
3. Exportables para contador y revisor fiscal.

### Fase 4

1. Exógena y anexos avanzados.
2. Reportes NIIF.
3. Automatizaciones tributarias.