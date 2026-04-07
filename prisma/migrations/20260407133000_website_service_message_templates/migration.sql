CREATE TABLE IF NOT EXISTS "website_service_message_templates" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "serviceKind" TEXT NOT NULL DEFAULT 'WEBSITE_SERVICE',
  "triggerKind" TEXT NOT NULL DEFAULT 'EXPIRATION_REMINDER',
  "daysBefore" INTEGER NOT NULL DEFAULT 30,
  "emailSubjectTemplate" TEXT NOT NULL,
  "emailBodyTemplate" TEXT NOT NULL,
  "whatsappTemplate" TEXT NOT NULL,
  "isEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isWhatsAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_service_message_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "website_service_message_templates_lookup_idx"
  ON "website_service_message_templates"("empresaId", "serviceKind", "triggerKind", "isActive");

CREATE INDEX IF NOT EXISTS "website_service_message_templates_default_idx"
  ON "website_service_message_templates"("empresaId", "isDefault");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'website_service_message_templates_empresaId_fkey'
  ) THEN
    ALTER TABLE "website_service_message_templates"
      ADD CONSTRAINT "website_service_message_templates_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "website_service_message_templates" (
  "id",
  "empresaId",
  "nombre",
  "descripcion",
  "serviceKind",
  "triggerKind",
  "daysBefore",
  "emailSubjectTemplate",
  "emailBodyTemplate",
  "whatsappTemplate",
  "isEmailEnabled",
  "isWhatsAppEnabled",
  "isActive",
  "isDefault"
)
SELECT
  'wstmt_' || substr(md5(s."empresaId" || s."emailSubjectTemplate"), 1, 21),
  s."empresaId",
  'Recordatorio 30 días · servicios web',
  'Migrada desde la configuración inicial de recordatorios automáticos.',
  'WEBSITE_SERVICE',
  'EXPIRATION_REMINDER',
  s."daysBefore",
  s."emailSubjectTemplate",
  s."emailBodyTemplate",
  s."whatsappTemplate",
  s."isEmailEnabled",
  s."isWhatsAppEnabled",
  true,
  true
FROM "website_service_reminder_settings" s
WHERE NOT EXISTS (
  SELECT 1
  FROM "website_service_message_templates" t
  WHERE t."empresaId" = s."empresaId"
    AND t."serviceKind" = 'WEBSITE_SERVICE'
    AND t."triggerKind" = 'EXPIRATION_REMINDER'
);