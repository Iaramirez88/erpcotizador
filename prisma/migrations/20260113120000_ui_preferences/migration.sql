-- CreateTable
CREATE TABLE "ui_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nav" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "report" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ui_preferences_userId_key" ON "ui_preferences"("userId");

-- AddForeignKey
ALTER TABLE "ui_preferences" ADD CONSTRAINT "ui_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
