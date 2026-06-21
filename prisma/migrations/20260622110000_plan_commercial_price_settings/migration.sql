CREATE TABLE IF NOT EXISTS "plan_commercial_price_settings" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "priceCOP" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_commercial_price_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_commercial_price_settings_code_key" ON "plan_commercial_price_settings"("code");
CREATE INDEX IF NOT EXISTS "plan_commercial_price_settings_code_idx" ON "plan_commercial_price_settings"("code");