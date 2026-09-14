-- Normalize duplicate or reserved host labels before enforcing global uniqueness.
WITH ranked_subdomains AS (
    SELECT
        "id",
        "subdomain",
        ROW_NUMBER() OVER (PARTITION BY "subdomain" ORDER BY "createdAt", "id") AS duplicate_position
    FROM "website_projects"
    WHERE "subdomain" IS NOT NULL
),
subdomains_to_rename AS (
    SELECT "id", "subdomain"
    FROM ranked_subdomains
    WHERE duplicate_position > 1
       OR "subdomain" IN ('admin', 'api', 'app', 'assets', 'cdn', 'dashboard', 'ftp', 'mail', 'smtp', 'soporte', 'support', 'www')
)
UPDATE "website_projects" AS project
SET "subdomain" = LEFT(conflict."subdomain", 50) || '-' || LEFT(MD5(project."id"), 8)
FROM subdomains_to_rename AS conflict
WHERE project."id" = conflict."id";

DROP INDEX IF EXISTS "website_projects_empresaId_subdomain_key";
CREATE UNIQUE INDEX "website_projects_subdomain_key" ON "website_projects"("subdomain");