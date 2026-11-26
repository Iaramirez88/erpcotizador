-- CreateTable
CREATE TABLE "free_trial_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_trial_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "free_trial_settings_key_key" ON "free_trial_settings"("key");

-- CreateIndex
CREATE INDEX "free_trial_settings_key_idx" ON "free_trial_settings"("key");
