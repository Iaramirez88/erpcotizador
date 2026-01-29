-- AlterTable
ALTER TABLE "compra_pagos" ADD COLUMN     "soporteMimeType" TEXT,
ADD COLUMN     "soporteOriginalName" TEXT,
ADD COLUMN     "soporteSizeBytes" INTEGER,
ADD COLUMN     "soporteStoredName" TEXT,
ADD COLUMN     "soporteUrl" TEXT;
