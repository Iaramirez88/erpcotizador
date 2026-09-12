-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RopCompanyType" AS ENUM ('INTERNAL', 'EXTERNAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "RopOnboardingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RopVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RopVisibilityLevel" AS ENUM ('PRIVATE', 'NETWORK', 'PUBLIC');

-- CreateEnum
CREATE TYPE "RopCoverageScope" AS ENUM ('LOCAL', 'REGIONAL', 'NATIONAL', 'EXPORT');

-- CreateEnum
CREATE TYPE "RopCapacityUnit" AS ENUM ('HOUR', 'UNIT', 'KG', 'M2', 'ORDER');

-- CreateEnum
CREATE TYPE "RopCompanyServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RopCapacityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'SATURATED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "RopCapacitySourceType" AS ENUM ('MANUAL', 'ERP_EVENT', 'API');

-- CreateEnum
CREATE TYPE "RopSlotStatus" AS ENUM ('OPEN', 'BLOCKED', 'RESERVED');

-- CreateEnum
CREATE TYPE "RopOpportunityStatus" AS ENUM ('DRAFT', 'OPEN', 'MATCHING', 'INVITED', 'IN_PROGRESS', 'WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RopOpportunitySourceType" AS ENUM ('MANUAL', 'CRM', 'PURCHASE', 'OPS_SIGNAL', 'API');

-- CreateEnum
CREATE TYPE "RopOpportunityVisibility" AS ENUM ('PRIVATE', 'CLUSTER', 'NETWORK');

-- CreateEnum
CREATE TYPE "RopInvitationStatus" AS ENUM ('PENDING', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RopBusinessCellStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RopConfidentialityLevel" AS ENUM ('INTERNAL', 'SHARED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RopMemberRole" AS ENUM ('OWNER', 'COORDINATOR', 'EXECUTOR', 'APPROVER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "RopMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "RopCollaborationOutcome" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RopModerationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RopRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RopClusterType" AS ENUM ('NICHO', 'CIUDAD', 'REGION', 'VERTICAL', 'CAPACIDAD', 'CURADO');

-- CreateEnum
CREATE TYPE "RopClusterMembershipStatus" AS ENUM ('ACTIVE', 'SUGGESTED', 'PAUSED');

-- CreateEnum
CREATE TYPE "RopMatchDecisionStatus" AS ENUM ('NEW', 'INVITED', 'DISMISSED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "RopVisibilityAudience" AS ENUM ('OWNER_ONLY', 'INVITED_ONLY', 'CLUSTER', 'NETWORK', 'PUBLIC');

-- CreateTable
CREATE TABLE "rop_companies" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "companyType" "RopCompanyType" NOT NULL,
    "legalName" VARCHAR(180) NOT NULL,
    "brandName" VARCHAR(180),
    "taxId" VARCHAR(40),
    "countryCode" CHAR(2) NOT NULL,
    "region" VARCHAR(120),
    "city" VARCHAR(120),
    "primaryAddress" VARCHAR(240),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "employeeRange" VARCHAR(40),
    "timezone" VARCHAR(60),
    "currencyCode" CHAR(3),
    "websiteUrl" VARCHAR(255),
    "phonePublic" VARCHAR(40),
    "emailPublic" VARCHAR(180),
    "descriptionPublic" TEXT,
    "onboardingStatus" "RopOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "RopVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "visibilityLevel" "RopVisibilityLevel" NOT NULL DEFAULT 'NETWORK',
    "externalAuthSubject" VARCHAR(180),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "rop_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_categories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rop_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_subcategories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rop_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_service_catalog" (
    "id" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "unitOfCapacity" "RopCapacityUnit" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rop_service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_company_services" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "sedeId" TEXT,
    "publicTitle" VARCHAR(180),
    "privateNotes" TEXT,
    "minOrderValue" DECIMAL(14,2),
    "leadTimeHours" INTEGER,
    "coverageScope" "RopCoverageScope",
    "activeStatus" "RopCompanyServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibilityLevel" "RopVisibilityLevel" NOT NULL DEFAULT 'NETWORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_company_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_capacity_availability" (
    "id" TEXT NOT NULL,
    "companyServiceId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "availableQuantity" DECIMAL(14,4) NOT NULL,
    "reservedQuantity" DECIMAL(14,4),
    "utilizationPercent" DECIMAL(5,2),
    "status" "RopCapacityStatus" NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3) NOT NULL,
    "slaHours" INTEGER,
    "freshnessAt" TIMESTAMP(3),
    "sourceType" "RopCapacitySourceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_capacity_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_availability_slots" (
    "id" TEXT NOT NULL,
    "companyServiceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "specificDate" DATE,
    "startTime" TIME(0),
    "endTime" TIME(0),
    "timezone" VARCHAR(60),
    "slotStatus" "RopSlotStatus" NOT NULL DEFAULT 'OPEN',
    "recurrenceRule" VARCHAR(180),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_opportunities" (
    "id" TEXT NOT NULL,
    "originCompanyId" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "descriptionPublic" TEXT,
    "requirementsPrivate" TEXT,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "locationCountryCode" CHAR(2) NOT NULL,
    "locationRegion" VARCHAR(120),
    "locationCity" VARCHAR(120),
    "expectedQuantity" DECIMAL(14,4),
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "currencyCode" CHAR(3),
    "dueAt" TIMESTAMP(3),
    "status" "RopOpportunityStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" "RopOpportunitySourceType" NOT NULL,
    "sourceRef" VARCHAR(180),
    "visibilityLevel" "RopOpportunityVisibility" NOT NULL DEFAULT 'NETWORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "rop_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_invitations" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "senderCompanyId" TEXT NOT NULL,
    "recipientCompanyId" TEXT NOT NULL,
    "status" "RopInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "messagePublic" TEXT,
    "internalNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_business_cells" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "ownerCompanyId" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "purpose" TEXT,
    "status" "RopBusinessCellStatus" NOT NULL DEFAULT 'DRAFT',
    "confidentialityLevel" "RopConfidentialityLevel" NOT NULL DEFAULT 'SHARED',
    "workspaceRef" VARCHAR(180),
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_business_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_members" (
    "id" TEXT NOT NULL,
    "businessCellId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "RopMemberRole" NOT NULL,
    "membershipStatus" "RopMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_collaboration_history" (
    "id" TEXT NOT NULL,
    "businessCellId" TEXT,
    "opportunityId" TEXT,
    "leadCompanyId" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcomeStatus" "RopCollaborationOutcome" NOT NULL,
    "deliveredQuantity" DECIMAL(14,4),
    "grossValue" DECIMAL(14,2),
    "currencyCode" CHAR(3),
    "slaMet" BOOLEAN,
    "issueCount" INTEGER DEFAULT 0,
    "summaryPublic" TEXT,
    "summaryPrivate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_collaboration_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_ratings" (
    "id" TEXT NOT NULL,
    "collaborationHistoryId" TEXT NOT NULL,
    "raterCompanyId" TEXT NOT NULL,
    "ratedCompanyId" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "timelinessScore" INTEGER NOT NULL,
    "communicationScore" INTEGER NOT NULL,
    "overallScore" DECIMAL(3,2) NOT NULL,
    "commentPublic" TEXT,
    "disputeFlag" BOOLEAN NOT NULL DEFAULT false,
    "moderationStatus" "RopModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_trust_scores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "reliabilityScore" DECIMAL(5,2) NOT NULL,
    "responsivenessScore" DECIMAL(5,2) NOT NULL,
    "qualityScore" DECIMAL(5,2) NOT NULL,
    "recurrenceScore" DECIMAL(5,2) NOT NULL,
    "disputePenalty" DECIMAL(5,2),
    "riskLevel" "RopRiskLevel" NOT NULL,
    "explainabilityJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_trust_score_snapshots" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "breakdownJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rop_trust_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_clusters" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "clusterType" "RopClusterType" NOT NULL,
    "geographyScope" VARCHAR(120),
    "rulesJson" JSONB NOT NULL DEFAULT '{}',
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_cluster_memberships" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "membershipScore" DECIMAL(5,2),
    "status" "RopClusterMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_cluster_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_opportunity_matches" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "matchScore" DECIMAL(5,2) NOT NULL,
    "scoreBreakdownJson" JSONB NOT NULL DEFAULT '{}',
    "rankPosition" INTEGER NOT NULL,
    "decisionStatus" "RopMatchDecisionStatus" NOT NULL DEFAULT 'NEW',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_opportunity_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rop_company_visibility_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fieldName" VARCHAR(120) NOT NULL,
    "audience" "RopVisibilityAudience" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rop_company_visibility_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rop_companies_verificationStatus_idx" ON "rop_companies"("verificationStatus");

-- CreateIndex
CREATE INDEX "rop_companies_countryCode_city_idx" ON "rop_companies"("countryCode", "city");

-- CreateIndex
CREATE UNIQUE INDEX "rop_companies_empresaId_key" ON "rop_companies"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "rop_companies_legalName_key" ON "rop_companies"("legalName");

-- CreateIndex
CREATE UNIQUE INDEX "rop_companies_taxId_key" ON "rop_companies"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "rop_categories_slug_key" ON "rop_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rop_categories_name_key" ON "rop_categories"("name");

-- CreateIndex
CREATE INDEX "rop_subcategories_categoryId_idx" ON "rop_subcategories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "rop_subcategories_categoryId_slug_key" ON "rop_subcategories"("categoryId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "rop_subcategories_categoryId_name_key" ON "rop_subcategories"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rop_service_catalog_code_key" ON "rop_service_catalog"("code");

-- CreateIndex
CREATE INDEX "rop_service_catalog_subcategoryId_idx" ON "rop_service_catalog"("subcategoryId");

-- CreateIndex
CREATE INDEX "rop_company_services_serviceCatalogId_activeStatus_idx" ON "rop_company_services"("serviceCatalogId", "activeStatus");

-- CreateIndex
CREATE INDEX "rop_company_services_companyId_activeStatus_idx" ON "rop_company_services"("companyId", "activeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "rop_company_services_companyId_serviceCatalogId_sedeId_key" ON "rop_company_services"("companyId", "serviceCatalogId", "sedeId");

-- CreateIndex
CREATE INDEX "rop_capacity_availability_serviceCatalogId_status_available_idx" ON "rop_capacity_availability"("serviceCatalogId", "status", "availableFrom");

-- CreateIndex
CREATE INDEX "rop_capacity_availability_companyId_availableFrom_idx" ON "rop_capacity_availability"("companyId", "availableFrom");

-- CreateIndex
CREATE INDEX "rop_capacity_availability_freshnessAt_idx" ON "rop_capacity_availability"("freshnessAt");

-- CreateIndex
CREATE INDEX "rop_availability_slots_companyServiceId_dayOfWeek_idx" ON "rop_availability_slots"("companyServiceId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "rop_availability_slots_companyServiceId_specificDate_idx" ON "rop_availability_slots"("companyServiceId", "specificDate");

-- CreateIndex
CREATE INDEX "rop_opportunities_originCompanyId_status_idx" ON "rop_opportunities"("originCompanyId", "status");

-- CreateIndex
CREATE INDEX "rop_opportunities_categoryId_subcategoryId_status_idx" ON "rop_opportunities"("categoryId", "subcategoryId", "status");

-- CreateIndex
CREATE INDEX "rop_opportunities_serviceCatalogId_dueAt_idx" ON "rop_opportunities"("serviceCatalogId", "dueAt");

-- CreateIndex
CREATE INDEX "rop_opportunities_locationCountryCode_locationCity_idx" ON "rop_opportunities"("locationCountryCode", "locationCity");

-- CreateIndex
CREATE INDEX "rop_invitations_recipientCompanyId_status_idx" ON "rop_invitations"("recipientCompanyId", "status");

-- CreateIndex
CREATE INDEX "rop_invitations_senderCompanyId_status_idx" ON "rop_invitations"("senderCompanyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rop_invitations_opportunityId_recipientCompanyId_key" ON "rop_invitations"("opportunityId", "recipientCompanyId");

-- CreateIndex
CREATE INDEX "rop_business_cells_ownerCompanyId_status_idx" ON "rop_business_cells"("ownerCompanyId", "status");

-- CreateIndex
CREATE INDEX "rop_business_cells_opportunityId_idx" ON "rop_business_cells"("opportunityId");

-- CreateIndex
CREATE INDEX "rop_members_companyId_membershipStatus_idx" ON "rop_members"("companyId", "membershipStatus");

-- CreateIndex
CREATE INDEX "rop_collaboration_history_leadCompanyId_completedAt_idx" ON "rop_collaboration_history"("leadCompanyId", "completedAt");

-- CreateIndex
CREATE INDEX "rop_collaboration_history_partnerCompanyId_completedAt_idx" ON "rop_collaboration_history"("partnerCompanyId", "completedAt");

-- CreateIndex
CREATE INDEX "rop_collaboration_history_serviceCatalogId_completedAt_idx" ON "rop_collaboration_history"("serviceCatalogId", "completedAt");

-- CreateIndex
CREATE INDEX "rop_collaboration_history_outcomeStatus_idx" ON "rop_collaboration_history"("outcomeStatus");

-- CreateIndex
CREATE INDEX "rop_ratings_ratedCompanyId_moderationStatus_idx" ON "rop_ratings"("ratedCompanyId", "moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "rop_ratings_collaborationHistoryId_raterCompanyId_ratedComp_key" ON "rop_ratings"("collaborationHistoryId", "raterCompanyId", "ratedCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "rop_trust_scores_companyId_key" ON "rop_trust_scores"("companyId");

-- CreateIndex
CREATE INDEX "rop_trust_scores_overallScore_idx" ON "rop_trust_scores"("overallScore" DESC);

-- CreateIndex
CREATE INDEX "rop_trust_scores_riskLevel_idx" ON "rop_trust_scores"("riskLevel");

-- CreateIndex
CREATE INDEX "rop_trust_score_snapshots_companyId_computedAt_idx" ON "rop_trust_score_snapshots"("companyId", "computedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "rop_clusters_slug_key" ON "rop_clusters"("slug");

-- CreateIndex
CREATE INDEX "rop_cluster_memberships_companyId_status_idx" ON "rop_cluster_memberships"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rop_cluster_memberships_clusterId_companyId_key" ON "rop_cluster_memberships"("clusterId", "companyId");

-- CreateIndex
CREATE INDEX "rop_opportunity_matches_opportunityId_rankPosition_idx" ON "rop_opportunity_matches"("opportunityId", "rankPosition");

-- CreateIndex
CREATE INDEX "rop_opportunity_matches_companyId_decisionStatus_idx" ON "rop_opportunity_matches"("companyId", "decisionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "rop_opportunity_matches_opportunityId_companyId_key" ON "rop_opportunity_matches"("opportunityId", "companyId");

-- CreateIndex
CREATE INDEX "rop_company_visibility_policies_companyId_idx" ON "rop_company_visibility_policies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "rop_company_visibility_policies_companyId_fieldName_audienc_key" ON "rop_company_visibility_policies"("companyId", "fieldName", "audience");

-- AddForeignKey
ALTER TABLE "rop_subcategories" ADD CONSTRAINT "rop_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "rop_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_service_catalog" ADD CONSTRAINT "rop_service_catalog_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "rop_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_company_services" ADD CONSTRAINT "rop_company_services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_company_services" ADD CONSTRAINT "rop_company_services_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "rop_service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_capacity_availability" ADD CONSTRAINT "rop_capacity_availability_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "rop_company_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_capacity_availability" ADD CONSTRAINT "rop_capacity_availability_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_capacity_availability" ADD CONSTRAINT "rop_capacity_availability_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "rop_service_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_availability_slots" ADD CONSTRAINT "rop_availability_slots_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "rop_company_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunities" ADD CONSTRAINT "rop_opportunities_originCompanyId_fkey" FOREIGN KEY ("originCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunities" ADD CONSTRAINT "rop_opportunities_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "rop_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunities" ADD CONSTRAINT "rop_opportunities_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "rop_subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunities" ADD CONSTRAINT "rop_opportunities_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "rop_service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_invitations" ADD CONSTRAINT "rop_invitations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "rop_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_invitations" ADD CONSTRAINT "rop_invitations_senderCompanyId_fkey" FOREIGN KEY ("senderCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_invitations" ADD CONSTRAINT "rop_invitations_recipientCompanyId_fkey" FOREIGN KEY ("recipientCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_business_cells" ADD CONSTRAINT "rop_business_cells_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "rop_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_business_cells" ADD CONSTRAINT "rop_business_cells_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_members" ADD CONSTRAINT "rop_members_businessCellId_fkey" FOREIGN KEY ("businessCellId") REFERENCES "rop_business_cells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_members" ADD CONSTRAINT "rop_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_collaboration_history" ADD CONSTRAINT "rop_collaboration_history_businessCellId_fkey" FOREIGN KEY ("businessCellId") REFERENCES "rop_business_cells"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_collaboration_history" ADD CONSTRAINT "rop_collaboration_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "rop_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_collaboration_history" ADD CONSTRAINT "rop_collaboration_history_leadCompanyId_fkey" FOREIGN KEY ("leadCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_collaboration_history" ADD CONSTRAINT "rop_collaboration_history_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_collaboration_history" ADD CONSTRAINT "rop_collaboration_history_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "rop_service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_ratings" ADD CONSTRAINT "rop_ratings_collaborationHistoryId_fkey" FOREIGN KEY ("collaborationHistoryId") REFERENCES "rop_collaboration_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_ratings" ADD CONSTRAINT "rop_ratings_raterCompanyId_fkey" FOREIGN KEY ("raterCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_ratings" ADD CONSTRAINT "rop_ratings_ratedCompanyId_fkey" FOREIGN KEY ("ratedCompanyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_trust_scores" ADD CONSTRAINT "rop_trust_scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_trust_score_snapshots" ADD CONSTRAINT "rop_trust_score_snapshots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_cluster_memberships" ADD CONSTRAINT "rop_cluster_memberships_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "rop_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_cluster_memberships" ADD CONSTRAINT "rop_cluster_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunity_matches" ADD CONSTRAINT "rop_opportunity_matches_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "rop_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_opportunity_matches" ADD CONSTRAINT "rop_opportunity_matches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rop_company_visibility_policies" ADD CONSTRAINT "rop_company_visibility_policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "rop_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
