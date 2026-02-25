-- Add externalId (customer-assigned product code)
ALTER TABLE "materiales" ADD COLUMN "externalId" TEXT;

-- Enforce uniqueness of externalId within an empresa (NULLs allowed)
CREATE UNIQUE INDEX "uq_materiales_empresa_external_id" ON "materiales" ("empresaId", "externalId");

-- Support search/filter by externalId
CREATE INDEX "idx_materiales_empresa_external_id" ON "materiales" ("empresaId", "externalId");
