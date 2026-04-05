ALTER TABLE "billing_invoices"
ADD COLUMN "quotedModulesJson" JSONB NOT NULL DEFAULT '[]'::jsonb;