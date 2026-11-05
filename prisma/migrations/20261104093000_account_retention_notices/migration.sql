-- Avisos de retención de cuentas (licencia vencida, trial terminado, aviso previo al borrado).
-- Es idempotente para poder aplicarse con `prisma db execute` y también con `prisma migrate deploy`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountRetentionNoticeKind') THEN
    CREATE TYPE "AccountRetentionNoticeKind" AS ENUM (
      'TRIAL_ENDED',
      'LICENSE_EXPIRED',
      'INACTIVITY_WARNING',
      'ACCOUNT_DELETED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "account_retention_notices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AccountRetentionNoticeKind" NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "referenceDate" TIMESTAMP(3) NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "account_retention_notices_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'account_retention_notices_userId_fkey'
  ) THEN
    ALTER TABLE "account_retention_notices"
      ADD CONSTRAINT "account_retention_notices_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "users"("id")
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
    AND    indexname = 'account_retention_notices_dedupeKey_key'
  ) THEN
    CREATE UNIQUE INDEX "account_retention_notices_dedupeKey_key"
      ON "account_retention_notices"("dedupeKey");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = ANY (current_schemas(false))
    AND    indexname = 'account_retention_notices_userId_kind_idx'
  ) THEN
    CREATE INDEX "account_retention_notices_userId_kind_idx"
      ON "account_retention_notices"("userId", "kind");
  END IF;
END $$;
