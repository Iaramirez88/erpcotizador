-- Add UI language preference
ALTER TABLE "ui_preferences" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';

-- Backfill existing rows (in case defaults weren't applied)
UPDATE "ui_preferences" SET "language" = 'es' WHERE "language" IS NULL;

-- Optional index to speed up lookups by language (not strictly needed)
-- CREATE INDEX IF NOT EXISTS "idx_ui_preferences_language" ON "ui_preferences" ("language");
