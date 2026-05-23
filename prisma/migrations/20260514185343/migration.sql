/*
  Warnings:

  - You are about to drop the column `payment_method` on the `billing_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `empresa_module_overrides` table. All the data in the column will be lost.
  - You are about to drop the column `empresa_id` on the `empresa_module_overrides` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `empresa_module_overrides` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[empresaId,module]` on the table `empresa_module_overrides` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `empresaId` to the `empresa_module_overrides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `empresa_module_overrides` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `module` on the `empresa_module_overrides` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "empresa_module_overrides" DROP CONSTRAINT "empresa_module_overrides_empresa_id_fkey";

-- DropIndex
DROP INDEX "empresa_module_overrides_empresa_id_idx";

-- DropIndex
DROP INDEX "empresa_module_overrides_empresa_id_module_key";

-- AlterTable
ALTER TABLE "billing_invoices" DROP COLUMN "payment_method",
ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "empresa_module_overrides" DROP COLUMN "created_at",
DROP COLUMN "empresa_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "empresaId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "module",
ADD COLUMN     "module" "ModuleKey" NOT NULL;

-- AlterTable
ALTER TABLE "internal_chat_messages" ALTER COLUMN "attachmentsJson" DROP NOT NULL;

-- AlterTable
ALTER TABLE "plan_catalog_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plan_module_price_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "website_service_message_templates" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "website_service_reminder_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "empresa_module_overrides_empresaId_idx" ON "empresa_module_overrides"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_module_overrides_empresaId_module_key" ON "empresa_module_overrides"("empresaId", "module");

-- AddForeignKey
ALTER TABLE "empresa_module_overrides" ADD CONSTRAINT "empresa_module_overrides_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "website_service_message_templates_default_idx" RENAME TO "website_service_message_templates_empresaId_isDefault_idx";

-- RenameIndex
ALTER INDEX "website_service_message_templates_lookup_idx" RENAME TO "website_service_message_templates_empresaId_serviceKind_tri_idx";

-- RenameIndex
ALTER INDEX "website_service_reminder_logs_unique_key" RENAME TO "website_service_reminder_logs_websiteServiceId_dueKind_dueA_key";
