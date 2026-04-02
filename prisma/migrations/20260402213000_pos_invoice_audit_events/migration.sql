CREATE TABLE IF NOT EXISTS "pos_invoice_audit_events" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "before" JSONB,
  "after" JSONB,
  "performedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pos_invoice_audit_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pos_invoice_audit_events"
  ADD CONSTRAINT "pos_invoice_audit_events_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "pos_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_invoice_audit_events"
  ADD CONSTRAINT "pos_invoice_audit_events_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "pos_invoice_audit_events_invoiceId_createdAt_idx"
  ON "pos_invoice_audit_events"("invoiceId", "createdAt");

CREATE INDEX IF NOT EXISTS "pos_invoice_audit_events_action_createdAt_idx"
  ON "pos_invoice_audit_events"("action", "createdAt");