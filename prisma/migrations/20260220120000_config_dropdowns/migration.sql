-- CreateTable
CREATE TABLE "config_dropdowns" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_dropdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_dropdown_items" (
    "id" TEXT NOT NULL,
    "dropdownId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_dropdown_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_dropdowns_empresaId_key_key" ON "config_dropdowns"("empresaId", "key");

-- CreateIndex
CREATE INDEX "config_dropdowns_empresaId_idx" ON "config_dropdowns"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "config_dropdown_items_dropdownId_value_key" ON "config_dropdown_items"("dropdownId", "value");

-- CreateIndex
CREATE INDEX "config_dropdown_items_dropdownId_activo_idx" ON "config_dropdown_items"("dropdownId", "activo");

-- CreateIndex
CREATE INDEX "config_dropdown_items_dropdownId_sortOrder_idx" ON "config_dropdown_items"("dropdownId", "sortOrder");

-- AddForeignKey
ALTER TABLE "config_dropdowns" ADD CONSTRAINT "config_dropdowns_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_dropdown_items" ADD CONSTRAINT "config_dropdown_items_dropdownId_fkey" FOREIGN KEY ("dropdownId") REFERENCES "config_dropdowns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
