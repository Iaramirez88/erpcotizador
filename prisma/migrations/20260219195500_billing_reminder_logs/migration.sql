-- Create billing reminder logs for plan expiration reminders

CREATE TABLE IF NOT EXISTS "billing_reminder_logs" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "planValidUntil" TIMESTAMP(3) NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_reminder_logs_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'billing_reminder_logs_empresaId_fkey'
  ) THEN
    ALTER TABLE "billing_reminder_logs"
      ADD CONSTRAINT "billing_reminder_logs_empresaId_fkey"
      FOREIGN KEY ("empresaId")
      REFERENCES "empresas"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = ANY (current_schemas(false))
    AND    indexname = 'billing_reminder_logs_empresaId_idx'
  ) THEN
    CREATE INDEX "billing_reminder_logs_empresaId_idx" ON "billing_reminder_logs"("empresaId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = ANY (current_schemas(false))
    AND    indexname = 'billing_reminder_logs_unique_key'
  ) THEN
    CREATE UNIQUE INDEX "billing_reminder_logs_unique_key" ON "billing_reminder_logs"(
      "empresaId", "planValidUntil", "billingCycle", "daysBefore", "channel"
    );
  END IF;
END $$;
