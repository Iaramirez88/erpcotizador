-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "emailSentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "lastWhatsappSentAt" TIMESTAMP(3),
ADD COLUMN     "whatsappSentCount" INTEGER NOT NULL DEFAULT 0;
