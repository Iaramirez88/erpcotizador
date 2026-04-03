DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'PosInvoiceAuditAction'
  ) THEN
    CREATE TYPE "public"."PosInvoiceAuditAction" AS ENUM (
      'CREATED',
      'UPDATED',
      'SHARED_EMAIL',
      'SHARED_WHATSAPP',
      'PDF_DOWNLOADED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pos_invoice_audit_events'
      AND column_name = 'action'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "public"."pos_invoice_audit_events"
      ALTER COLUMN "action" TYPE "public"."PosInvoiceAuditAction"
      USING (
        CASE UPPER(BTRIM("action"))
          WHEN 'CREATED' THEN 'CREATED'
          WHEN 'UPDATED' THEN 'UPDATED'
          WHEN 'SHARED_EMAIL' THEN 'SHARED_EMAIL'
          WHEN 'SHARED_WHATSAPP' THEN 'SHARED_WHATSAPP'
          WHEN 'PDF_DOWNLOADED' THEN 'PDF_DOWNLOADED'
          ELSE 'UPDATED'
        END
      )::"public"."PosInvoiceAuditAction";
  END IF;
END
$$;