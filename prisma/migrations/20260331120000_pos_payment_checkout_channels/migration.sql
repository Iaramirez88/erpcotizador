-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosPaymentProvider" AS ENUM ('MANUAL', 'BOLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosPaymentFlow" AS ENUM ('CASH', 'DATAPHONE', 'QR', 'LINK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PosPaymentSource" AS ENUM ('NONE', 'NEQUI', 'DAVIPLATA', 'BANCOLOMBIA', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "pos_payments"
  ADD COLUMN IF NOT EXISTS "status" "PosPaymentStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN IF NOT EXISTS "provider" "PosPaymentProvider" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "flow" "PosPaymentFlow" NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "source" "PosPaymentSource" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "externalReference" TEXT,
  ADD COLUMN IF NOT EXISTS "boldPaymentLinkId" TEXT,
  ADD COLUMN IF NOT EXISTS "boldCheckoutUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "boldPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "boldEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "boldType" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "pos_payments"
SET "paidAt" = COALESCE("paidAt", "receivedAt")
WHERE "status" = 'PAID' AND "paidAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_payments_status_provider_idx" ON "pos_payments"("status", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_payments_externalReference_idx" ON "pos_payments"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_payments_externalReference_key" ON "pos_payments"("externalReference") WHERE "externalReference" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_payments_boldPaymentLinkId_key" ON "pos_payments"("boldPaymentLinkId") WHERE "boldPaymentLinkId" IS NOT NULL;