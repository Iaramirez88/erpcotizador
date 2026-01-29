-- CreateTable
CREATE TABLE "compra_pagos" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodo" "PosPaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "referencia" TEXT,
    "observaciones" TEXT,
    "sedeId" TEXT,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compra_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compra_pagos_compraId_idx" ON "compra_pagos"("compraId");

-- CreateIndex
CREATE INDEX "compra_pagos_empresaId_idx" ON "compra_pagos"("empresaId");

-- CreateIndex
CREATE INDEX "compra_pagos_sedeId_idx" ON "compra_pagos"("sedeId");

-- CreateIndex
CREATE INDEX "compra_pagos_fecha_idx" ON "compra_pagos"("fecha");

-- AddForeignKey
ALTER TABLE "compra_pagos" ADD CONSTRAINT "compra_pagos_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_pagos" ADD CONSTRAINT "compra_pagos_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_pagos" ADD CONSTRAINT "compra_pagos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_pagos" ADD CONSTRAINT "compra_pagos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
