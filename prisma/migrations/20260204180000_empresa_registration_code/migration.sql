-- Add registration code hash to Empresa
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "registrationCodeHash" TEXT;
