-- CreateTable
CREATE TABLE "website_projects" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "websiteServiceId" TEXT,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "primaryDomain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateKey" TEXT,
    "themeJson" JSONB NOT NULL DEFAULT '{}',
    "seoJson" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_project_pages" (
    "id" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_project_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_project_page_versions" (
    "id" TEXT NOT NULL,
    "websiteProjectPageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "editorJson" JSONB NOT NULL DEFAULT '{}',
    "renderedSnapshotJson" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_project_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_projects_empresaId_status_idx" ON "website_projects"("empresaId", "status");

-- CreateIndex
CREATE INDEX "website_projects_websiteServiceId_idx" ON "website_projects"("websiteServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "website_projects_empresaId_slug_key" ON "website_projects"("empresaId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "website_projects_empresaId_subdomain_key" ON "website_projects"("empresaId", "subdomain");

-- CreateIndex
CREATE INDEX "website_project_pages_websiteProjectId_isHome_idx" ON "website_project_pages"("websiteProjectId", "isHome");

-- CreateIndex
CREATE INDEX "website_project_pages_websiteProjectId_status_idx" ON "website_project_pages"("websiteProjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "website_project_pages_websiteProjectId_slug_key" ON "website_project_pages"("websiteProjectId", "slug");

-- CreateIndex
CREATE INDEX "website_project_page_versions_websiteProjectPageId_isPublis_idx" ON "website_project_page_versions"("websiteProjectPageId", "isPublished", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "website_project_page_versions_websiteProjectPageId_versionN_key" ON "website_project_page_versions"("websiteProjectPageId", "versionNumber");

-- AddForeignKey
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_websiteServiceId_fkey" FOREIGN KEY ("websiteServiceId") REFERENCES "website_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_project_pages" ADD CONSTRAINT "website_project_pages_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "website_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_project_page_versions" ADD CONSTRAINT "website_project_page_versions_websiteProjectPageId_fkey" FOREIGN KEY ("websiteProjectPageId") REFERENCES "website_project_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_project_page_versions" ADD CONSTRAINT "website_project_page_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
