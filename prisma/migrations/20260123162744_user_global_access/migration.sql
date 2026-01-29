-- CreateTable
CREATE TABLE "user_global_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL DEFAULT 'READ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_global_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_global_access_userId_key" ON "user_global_access"("userId");

-- CreateIndex
CREATE INDEX "user_global_access_empresaId_idx" ON "user_global_access"("empresaId");

-- AddForeignKey
ALTER TABLE "user_global_access" ADD CONSTRAINT "user_global_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_global_access" ADD CONSTRAINT "user_global_access_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
