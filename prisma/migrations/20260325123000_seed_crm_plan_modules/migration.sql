INSERT INTO "plan_module_settings" ("id", "planTier", "module", "enabled", "createdAt", "updatedAt")
SELECT
  md5('crm-plan-module:' || module_key::text),
  'CRM',
  module_key,
  CASE WHEN module_key IN ('DASHBOARD', 'CRM', 'NOTIFICACIONES', 'CONFIG') THEN true ELSE false END,
  NOW(),
  NOW()
FROM unnest(enum_range(NULL::"ModuleKey")) AS module_key
ON CONFLICT ("planTier", "module") DO NOTHING;

UPDATE "plan_module_settings"
SET "enabled" = false,
    "updatedAt" = NOW()
WHERE "planTier" IN ('BASIC', 'MEDIO', 'INTERMEDIO')
  AND "module" = 'CRM';

UPDATE "plan_module_settings"
SET "enabled" = true,
    "updatedAt" = NOW()
WHERE "planTier" = 'FULL'
  AND "module" = 'CRM';