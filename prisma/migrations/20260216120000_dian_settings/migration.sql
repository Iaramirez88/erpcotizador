-- Add DIAN settings JSON storage per empresa
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "dianSettings" JSONB NOT NULL DEFAULT '{}'::jsonb;
