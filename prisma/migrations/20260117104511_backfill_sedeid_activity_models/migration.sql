-- Backfill de sedeId (multi-sede MVP)
-- Asigna la primera sede (por createdAt asc) de la empresa relacionada.

-- Cotizaciones: se infiere empresa por cliente.empresaId
UPDATE "cotizaciones" c
SET "sedeId" = sede_pick."id"
FROM "clientes" cl
JOIN LATERAL (
	SELECT s2."id"
	FROM "sedes" s2
	WHERE s2."empresaId" = cl."empresaId"
	ORDER BY s2."createdAt" ASC
	LIMIT 1
) sede_pick ON TRUE
WHERE c."sedeId" IS NULL
	AND cl."id" = c."clienteId";

-- Órdenes: se infiere empresa por cliente.empresaId
UPDATE "ordenes_trabajo" o
SET "sedeId" = sede_pick."id"
FROM "clientes" cl
JOIN LATERAL (
	SELECT s2."id"
	FROM "sedes" s2
	WHERE s2."empresaId" = cl."empresaId"
	ORDER BY s2."createdAt" ASC
	LIMIT 1
) sede_pick ON TRUE
WHERE o."sedeId" IS NULL
	AND cl."id" = o."clienteId";

-- Compras: ya tienen empresaId
UPDATE "compras" co
SET "sedeId" = (
	SELECT s2."id"
	FROM "sedes" s2
	WHERE s2."empresaId" = co."empresaId"
	ORDER BY s2."createdAt" ASC
	LIMIT 1
)
WHERE co."sedeId" IS NULL
	AND co."empresaId" IS NOT NULL;

-- Escaneos: se infiere empresa por user.empresaId (si existe)
UPDATE "document_scans" ds
SET "sedeId" = sede_pick."id"
FROM "users" u
JOIN LATERAL (
	SELECT s2."id"
	FROM "sedes" s2
	WHERE s2."empresaId" = u."empresaId"
	ORDER BY s2."createdAt" ASC
	LIMIT 1
) sede_pick ON TRUE
WHERE ds."sedeId" IS NULL
	AND ds."userId" = u."id"
	AND u."empresaId" IS NOT NULL;