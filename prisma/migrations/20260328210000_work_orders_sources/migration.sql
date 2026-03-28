ALTER TABLE "materiales"
ADD COLUMN "requiresWorkOrder" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "pos_invoices"
ADD COLUMN "clienteId" TEXT,
ADD COLUMN "cotizacionId" TEXT;

ALTER TABLE "ordenes_trabajo"
ADD COLUMN "fechaInicio" TIMESTAMP(3),
ADD COLUMN "sourceType" VARCHAR(32),
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "posInvoiceId" TEXT,
ADD COLUMN "itemsSnapshot" JSONB;

CREATE INDEX "pos_invoices_clienteId_idx" ON "pos_invoices"("clienteId");
CREATE UNIQUE INDEX "pos_invoices_cotizacionId_key" ON "pos_invoices"("cotizacionId");
CREATE UNIQUE INDEX "ordenes_trabajo_posInvoiceId_key" ON "ordenes_trabajo"("posInvoiceId");
CREATE INDEX "idx_ordenes_source" ON "ordenes_trabajo"("sourceType", "sourceId");

ALTER TABLE "pos_invoices"
ADD CONSTRAINT "pos_invoices_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_invoices"
ADD CONSTRAINT "pos_invoices_cotizacionId_fkey"
FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ordenes_trabajo_posInvoiceId_fkey"
FOREIGN KEY ("posInvoiceId") REFERENCES "pos_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
