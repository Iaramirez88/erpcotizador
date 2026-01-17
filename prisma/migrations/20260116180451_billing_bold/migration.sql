-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('BOLD');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'VOID', 'EXPIRED');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "planValidUntil" TIMESTAMP(3),
ADD COLUMN     "stripeCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "stripeSubscriptionStatus" TEXT;

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'BOLD',
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "planTier" "PlanTier" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "amountCOP" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "externalReference" TEXT NOT NULL,
    "boldPaymentLinkId" TEXT,
    "boldCheckoutUrl" TEXT,
    "boldPaymentId" TEXT,
    "boldEventId" TEXT,
    "boldType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_externalReference_key" ON "billing_invoices"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_boldPaymentLinkId_key" ON "billing_invoices"("boldPaymentLinkId");

-- CreateIndex
CREATE INDEX "billing_invoices_empresaId_status_idx" ON "billing_invoices"("empresaId", "status");

-- CreateIndex
CREATE INDEX "billing_invoices_externalReference_idx" ON "billing_invoices"("externalReference");

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
