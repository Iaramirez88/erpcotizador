-- Add ItemCotizacion.observaciones to persist editable meta (Litografía)
ALTER TABLE "items_cotizacion"
  ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- Add Cotizacion.editCount for quick counter
ALTER TABLE "cotizaciones"
  ADD COLUMN IF NOT EXISTS "editCount" INTEGER NOT NULL DEFAULT 0;

-- Enums for audit
DO $$ BEGIN
  CREATE TYPE "CotizacionAuditAction" AS ENUM ('CREATED', 'UPDATED', 'APPROVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CotizacionAuditEffect" AS ENUM ('NONE', 'DEBIT', 'CREDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Audit events table
CREATE TABLE IF NOT EXISTS "cotizacion_audit_events" (
  "id" TEXT NOT NULL,
  "cotizacionId" TEXT NOT NULL,
  "action" "CotizacionAuditAction" NOT NULL,
  "effect" "CotizacionAuditEffect" NOT NULL DEFAULT 'NONE',
  "note" TEXT,
  "before" JSONB,
  "after" JSONB,
  "performedById" TEXT NOT NULL,
  "requestedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cotizacion_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cotizacion_audit_events_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cotizacion_audit_events_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cotizacion_audit_events_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_cot_audit_cot_created" ON "cotizacion_audit_events" ("cotizacionId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_cot_audit_action_created" ON "cotizacion_audit_events" ("action", "createdAt");
