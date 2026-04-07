ALTER TABLE "website_services"
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

CREATE TABLE IF NOT EXISTS "website_service_reminder_settings" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL DEFAULT 30,
  "emailSubjectTemplate" TEXT NOT NULL,
  "emailBodyTemplate" TEXT NOT NULL,
  "whatsappTemplate" TEXT NOT NULL,
  "isEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isWhatsAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_service_reminder_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_service_reminder_settings_empresaId_key"
  ON "website_service_reminder_settings"("empresaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'website_service_reminder_settings_empresaId_fkey'
  ) THEN
    ALTER TABLE "website_service_reminder_settings"
      ADD CONSTRAINT "website_service_reminder_settings_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "website_service_reminder_settings" (
  "id",
  "empresaId",
  "daysBefore",
  "emailSubjectTemplate",
  "emailBodyTemplate",
  "whatsappTemplate"
)
SELECT
  'wsr_' || substr(md5(e."id"), 1, 24),
  e."id",
  30,
  'Tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días',
  E'Hola {{contacto_nombre}},\n\nTe recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.\n\nComponentes por vencer:\n{{componentes_detalle}}\n\nFechas de vencimiento: {{fechas_vencimiento}}.\n\nSi deseas renovarlo, responde este mensaje y con gusto te ayudamos.\n\nEquipo {{empresa_nombre}}',
  E'Hola {{contacto_nombre}}, te recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.\nComponentes por vencer: {{componentes_por_vencer}}.\n{{componentes_detalle}}\nFechas: {{fechas_vencimiento}}.\nSi deseas renovarlo, respóndenos por este medio.\nEquipo {{empresa_nombre}}'
FROM "empresas" e
WHERE NOT EXISTS (
  SELECT 1
  FROM "website_service_reminder_settings" s
  WHERE s."empresaId" = e."id"
);

CREATE TABLE IF NOT EXISTS "website_service_reminder_logs" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "websiteServiceId" TEXT NOT NULL,
  "dueKind" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_service_reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "website_service_reminder_logs_empresaId_idx"
  ON "website_service_reminder_logs"("empresaId");

CREATE INDEX IF NOT EXISTS "website_service_reminder_logs_websiteServiceId_idx"
  ON "website_service_reminder_logs"("websiteServiceId");

CREATE UNIQUE INDEX IF NOT EXISTS "website_service_reminder_logs_unique_key"
  ON "website_service_reminder_logs"("websiteServiceId", "dueKind", "dueAt", "daysBefore", "channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'website_service_reminder_logs_empresaId_fkey'
  ) THEN
    ALTER TABLE "website_service_reminder_logs"
      ADD CONSTRAINT "website_service_reminder_logs_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'website_service_reminder_logs_websiteServiceId_fkey'
  ) THEN
    ALTER TABLE "website_service_reminder_logs"
      ADD CONSTRAINT "website_service_reminder_logs_websiteServiceId_fkey"
      FOREIGN KEY ("websiteServiceId") REFERENCES "website_services"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;