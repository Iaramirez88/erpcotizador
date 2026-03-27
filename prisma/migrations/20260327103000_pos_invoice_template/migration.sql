CREATE TABLE "pos_invoice_templates" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pos_invoice_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_invoice_templates_userId_key" ON "pos_invoice_templates"("userId");

ALTER TABLE "pos_invoice_templates"
ADD CONSTRAINT "pos_invoice_templates_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;