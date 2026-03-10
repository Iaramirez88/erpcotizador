-- Ensure columns exist (shadow DB / fresh DB)
ALTER TABLE "notifications"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Backfill (defensive) and enforce constraints
UPDATE "notifications" SET "publishAt" = NOW() WHERE "publishAt" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "publishAt" SET DEFAULT NOW();
ALTER TABLE "notifications" ALTER COLUMN "publishAt" SET NOT NULL;

-- Normalize types to match Prisma defaults
ALTER TABLE "notifications"
	ALTER COLUMN "archivedAt" TYPE TIMESTAMP(3) USING "archivedAt"::timestamp(3),
	ALTER COLUMN "publishAt" TYPE TIMESTAMP(3) USING "publishAt"::timestamp(3);
