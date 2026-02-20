-- Add plan owner user id for Empresa (billing/plan owner)

ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "planOwnerUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = ANY (current_schemas(false))
    AND    indexname = 'empresas_planOwnerUserId_idx'
  ) THEN
    CREATE INDEX "empresas_planOwnerUserId_idx" ON "empresas"("planOwnerUserId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'empresas_planOwnerUserId_fkey'
  ) THEN
    ALTER TABLE "empresas"
      ADD CONSTRAINT "empresas_planOwnerUserId_fkey"
      FOREIGN KEY ("planOwnerUserId")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
