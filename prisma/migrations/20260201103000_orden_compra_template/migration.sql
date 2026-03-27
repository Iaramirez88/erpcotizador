CREATE TABLE "orden_compra_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orden_compra_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orden_compra_templates_userId_key" ON "orden_compra_templates"("userId");

ALTER TABLE "orden_compra_templates"
ADD CONSTRAINT "orden_compra_templates_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;