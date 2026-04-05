BEGIN;

ALTER TABLE public."billing_invoices"
ADD COLUMN IF NOT EXISTS "quotedModulesJson" JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;