-- CreateTable
CREATE TABLE "website_project_domains" (
    "id" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationToken" TEXT NOT NULL,
    "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "dnsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "sslStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "quarantineUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_project_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_project_domains_hostname_key" ON "website_project_domains"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "website_project_domains_verificationToken_key" ON "website_project_domains"("verificationToken");

-- CreateIndex
CREATE INDEX "website_project_domains_websiteProjectId_status_idx" ON "website_project_domains"("websiteProjectId", "status");

-- CreateIndex
CREATE INDEX "website_project_domains_status_lastCheckedAt_idx" ON "website_project_domains"("status", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "website_project_domains_quarantineUntil_idx" ON "website_project_domains"("quarantineUntil");

-- Only one custom domain can be canonical for each website.
CREATE UNIQUE INDEX "website_project_domains_one_primary_per_project" ON "website_project_domains"("websiteProjectId") WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "website_project_domains" ADD CONSTRAINT "website_project_domains_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "website_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;