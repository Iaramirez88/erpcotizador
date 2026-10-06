ALTER TABLE "crm_seo_keywords"
ADD COLUMN "latestSerpPosition" DOUBLE PRECISION,
ADD COLUMN "previousSerpPosition" DOUBLE PRECISION,
ADD COLUMN "latestSerpUrl" TEXT,
ADD COLUMN "lastSerpCheckedAt" TIMESTAMP(3),
ADD COLUMN "latestSearchConsolePosition" DOUBLE PRECISION,
ADD COLUMN "previousSearchConsolePosition" DOUBLE PRECISION,
ADD COLUMN "latestSearchConsoleUrl" TEXT,
ADD COLUMN "lastSearchConsoleCheckedAt" TIMESTAMP(3);

WITH ranked_positions AS (
	SELECT
		"keywordId",
		"source",
		"position",
		"resultUrl",
		"checkedAt",
		ROW_NUMBER() OVER (PARTITION BY "keywordId", "source" ORDER BY "checkedAt" DESC, "id" DESC) AS row_number
	FROM "crm_seo_keyword_positions"
	WHERE "source" IN ('DATAFORSEO', 'SEARCH_CONSOLE')
), source_snapshots AS (
	SELECT
		"keywordId",
		MAX("position") FILTER (WHERE "source" = 'DATAFORSEO' AND row_number = 1) AS "latestSerpPosition",
		MAX("position") FILTER (WHERE "source" = 'DATAFORSEO' AND row_number = 2) AS "previousSerpPosition",
		MAX("resultUrl") FILTER (WHERE "source" = 'DATAFORSEO' AND row_number = 1) AS "latestSerpUrl",
		MAX("checkedAt") FILTER (WHERE "source" = 'DATAFORSEO' AND row_number = 1) AS "lastSerpCheckedAt",
		MAX("position") FILTER (WHERE "source" = 'SEARCH_CONSOLE' AND row_number = 1) AS "latestSearchConsolePosition",
		MAX("position") FILTER (WHERE "source" = 'SEARCH_CONSOLE' AND row_number = 2) AS "previousSearchConsolePosition",
		MAX("resultUrl") FILTER (WHERE "source" = 'SEARCH_CONSOLE' AND row_number = 1) AS "latestSearchConsoleUrl",
		MAX("checkedAt") FILTER (WHERE "source" = 'SEARCH_CONSOLE' AND row_number = 1) AS "lastSearchConsoleCheckedAt"
	FROM ranked_positions
	WHERE row_number <= 2
	GROUP BY "keywordId"
)
UPDATE "crm_seo_keywords" AS keyword
SET
	"latestSerpPosition" = snapshot."latestSerpPosition",
	"previousSerpPosition" = snapshot."previousSerpPosition",
	"latestSerpUrl" = snapshot."latestSerpUrl",
	"lastSerpCheckedAt" = snapshot."lastSerpCheckedAt",
	"latestSearchConsolePosition" = snapshot."latestSearchConsolePosition",
	"previousSearchConsolePosition" = snapshot."previousSearchConsolePosition",
	"latestSearchConsoleUrl" = snapshot."latestSearchConsoleUrl",
	"lastSearchConsoleCheckedAt" = snapshot."lastSearchConsoleCheckedAt"
FROM source_snapshots AS snapshot
WHERE keyword."id" = snapshot."keywordId";