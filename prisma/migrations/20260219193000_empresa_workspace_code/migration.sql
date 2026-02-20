-- Add stable visible workspace code for Empresa

ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "workspaceCode" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = ANY (current_schemas(false))
    AND    indexname = 'empresas_workspaceCode_key'
  ) THEN
    CREATE UNIQUE INDEX "empresas_workspaceCode_key" ON "empresas"("workspaceCode");
  END IF;
END $$;
