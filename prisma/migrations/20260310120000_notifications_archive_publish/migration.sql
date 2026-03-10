-- Add archivedAt/publishAt to notifications

ALTER TABLE "notifications"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "notifications_userId_archivedAt_publishAt_idx"
ON "notifications" ("userId", "archivedAt", "publishAt");
