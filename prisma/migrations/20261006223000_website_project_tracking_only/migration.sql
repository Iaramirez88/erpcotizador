ALTER TABLE "website_projects"
ADD COLUMN "trackingOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "website_projects_empresaId_trackingOnly_updatedAt_idx"
ON "website_projects"("empresaId", "trackingOnly", "updatedAt");