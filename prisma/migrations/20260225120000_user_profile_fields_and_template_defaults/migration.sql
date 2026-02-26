-- Add profile fields to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "cargo" TEXT,
  ADD COLUMN IF NOT EXISTS "sedeDefaultId" TEXT;

-- Add defaultSettings to cotizacion_templates
ALTER TABLE "cotizacion_templates"
  ADD COLUMN IF NOT EXISTS "defaultSettings" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- FK users.sedeDefaultId -> sedes.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_sedeDefaultId_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_sedeDefaultId_fkey"
      FOREIGN KEY ("sedeDefaultId") REFERENCES "sedes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Helpful index
CREATE INDEX IF NOT EXISTS "users_sedeDefaultId_idx" ON "users" ("sedeDefaultId");
