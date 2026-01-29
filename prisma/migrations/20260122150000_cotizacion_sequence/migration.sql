-- Create cotizacion sequence table (atomic numbering per sede)
CREATE TABLE IF NOT EXISTS "cotizacion_sequences" (
  "sedeId" TEXT NOT NULL,
  "currentNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cotizacion_sequences_pkey" PRIMARY KEY ("sedeId"),
  CONSTRAINT "cotizacion_sequences_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill currentNumber from existing cotizaciones (max trailing digits)
INSERT INTO "cotizacion_sequences" ("sedeId", "currentNumber")
SELECT
  c."sedeId",
  COALESCE(MAX((substring(c."numero" from '(\\d+)$'))::int), 0) AS "currentNumber"
FROM "cotizaciones" c
WHERE c."sedeId" IS NOT NULL
GROUP BY c."sedeId"
ON CONFLICT ("sedeId") DO UPDATE
SET "currentNumber" = EXCLUDED."currentNumber",
    "updatedAt" = CURRENT_TIMESTAMP;
