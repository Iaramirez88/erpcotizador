CREATE TABLE "odontology_patient_profiles" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3),
  "bloodType" TEXT,
  "allergies" TEXT,
  "currentMedications" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "insuranceProvider" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "odontology_patient_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "odontology_clinical_records" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "patientProfileId" TEXT,
  "appointmentId" TEXT,
  "treatmentPlanId" TEXT,
  "createdByUserId" TEXT,
  "appointmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consultationReason" TEXT NOT NULL,
  "diagnosis" TEXT,
  "procedureSummary" TEXT,
  "treatmentStatus" TEXT,
  "odontogram" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "observations" TEXT,
  "nextVisitAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "odontology_clinical_records_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "OdontologyAppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "OdontologyTreatmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OdontologyTreatmentItemStatus" AS ENUM ('PLANNED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "odontology_treatment_plans" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "patientProfileId" TEXT,
  "createdByUserId" TEXT,
  "title" TEXT NOT NULL,
  "status" "OdontologyTreatmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "diagnosisSummary" TEXT,
  "objectives" TEXT,
  "notes" TEXT,
  "estimatedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "odontology_treatment_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "odontology_treatment_plan_items" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "toothCode" TEXT,
  "procedureType" TEXT NOT NULL,
  "description" TEXT,
  "status" "OdontologyTreatmentItemStatus" NOT NULL DEFAULT 'PLANNED',
  "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "odontology_treatment_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "odontology_appointments" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "patientProfileId" TEXT,
  "treatmentPlanId" TEXT,
  "assignedDentistUserId" TEXT,
  "createdByUserId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "OdontologyAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "reason" TEXT NOT NULL,
  "chairName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "odontology_appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "odontology_patient_profiles_clienteId_key" ON "odontology_patient_profiles"("clienteId");
CREATE INDEX "odontology_patient_profiles_empresaId_idx" ON "odontology_patient_profiles"("empresaId");
CREATE INDEX "odontology_clinical_records_empresaId_appointmentDate_idx" ON "odontology_clinical_records"("empresaId", "appointmentDate");
CREATE INDEX "odontology_clinical_records_clienteId_appointmentDate_idx" ON "odontology_clinical_records"("clienteId", "appointmentDate");
CREATE INDEX "odontology_clinical_records_patientProfileId_idx" ON "odontology_clinical_records"("patientProfileId");
CREATE INDEX "odontology_clinical_records_appointmentId_idx" ON "odontology_clinical_records"("appointmentId");
CREATE INDEX "odontology_clinical_records_treatmentPlanId_idx" ON "odontology_clinical_records"("treatmentPlanId");
CREATE INDEX "odontology_treatment_plans_empresaId_status_updatedAt_idx" ON "odontology_treatment_plans"("empresaId", "status", "updatedAt");
CREATE INDEX "odontology_treatment_plans_clienteId_status_idx" ON "odontology_treatment_plans"("clienteId", "status");
CREATE INDEX "odontology_treatment_plans_patientProfileId_idx" ON "odontology_treatment_plans"("patientProfileId");
CREATE INDEX "odontology_treatment_plan_items_empresaId_status_idx" ON "odontology_treatment_plan_items"("empresaId", "status");
CREATE INDEX "odontology_treatment_plan_items_planId_status_idx" ON "odontology_treatment_plan_items"("planId", "status");
CREATE INDEX "odontology_treatment_plan_items_toothCode_idx" ON "odontology_treatment_plan_items"("toothCode");
CREATE INDEX "odontology_appointments_empresaId_startsAt_status_idx" ON "odontology_appointments"("empresaId", "startsAt", "status");
CREATE INDEX "odontology_appointments_clienteId_startsAt_idx" ON "odontology_appointments"("clienteId", "startsAt");
CREATE INDEX "odontology_appointments_assignedDentistUserId_startsAt_idx" ON "odontology_appointments"("assignedDentistUserId", "startsAt");
CREATE INDEX "odontology_appointments_treatmentPlanId_idx" ON "odontology_appointments"("treatmentPlanId");

ALTER TABLE "odontology_patient_profiles"
  ADD CONSTRAINT "odontology_patient_profiles_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_patient_profiles"
  ADD CONSTRAINT "odontology_patient_profiles_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "odontology_patient_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "odontology_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "odontology_treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_clinical_records"
  ADD CONSTRAINT "odontology_clinical_records_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plans"
  ADD CONSTRAINT "odontology_treatment_plans_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plans"
  ADD CONSTRAINT "odontology_treatment_plans_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plans"
  ADD CONSTRAINT "odontology_treatment_plans_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "odontology_patient_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plans"
  ADD CONSTRAINT "odontology_treatment_plans_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plan_items"
  ADD CONSTRAINT "odontology_treatment_plan_items_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_treatment_plan_items"
  ADD CONSTRAINT "odontology_treatment_plan_items_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "odontology_treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_patientProfileId_fkey"
  FOREIGN KEY ("patientProfileId") REFERENCES "odontology_patient_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "odontology_treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_assignedDentistUserId_fkey"
  FOREIGN KEY ("assignedDentistUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odontology_appointments"
  ADD CONSTRAINT "odontology_appointments_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;