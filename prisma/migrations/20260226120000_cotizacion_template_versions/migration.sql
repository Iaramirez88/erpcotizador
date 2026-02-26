-- CreateTable
CREATE TABLE IF NOT EXISTS "cotizacion_template_versions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "defaultSettings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizacion_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cotizacion_template_versions_userId_createdAt_idx" ON "cotizacion_template_versions"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cotizacion_template_versions_userId_fkey'
  ) THEN
    ALTER TABLE "cotizacion_template_versions" ADD CONSTRAINT "cotizacion_template_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
