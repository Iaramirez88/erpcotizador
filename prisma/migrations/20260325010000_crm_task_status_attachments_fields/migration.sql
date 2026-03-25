ALTER TYPE "CrmTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TYPE "CrmTaskHistoryType" ADD VALUE IF NOT EXISTS 'ATTACHMENTS_CHANGED';
ALTER TYPE "CrmTaskHistoryType" ADD VALUE IF NOT EXISTS 'CUSTOM_FIELDS_CHANGED';

ALTER TABLE "crm_tasks"
  ADD COLUMN IF NOT EXISTS "colorHex" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentsJson" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "customFieldsJson" JSONB DEFAULT '[]'::jsonb;

UPDATE "crm_tasks"
SET "attachmentsJson" = '[]'::jsonb
WHERE "attachmentsJson" IS NULL;

UPDATE "crm_tasks"
SET "customFieldsJson" = '[]'::jsonb
WHERE "customFieldsJson" IS NULL;

ALTER TABLE "crm_tasks"
  ALTER COLUMN "attachmentsJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "attachmentsJson" SET NOT NULL,
  ALTER COLUMN "customFieldsJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "customFieldsJson" SET NOT NULL;