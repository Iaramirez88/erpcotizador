-- CreateTable
CREATE TABLE "crm_agenda_calendars" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#0ea5e9',
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "visibility" TEXT NOT NULL DEFAULT 'TEAM',
    "ownerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_agenda_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_agenda_calendar_members" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_agenda_calendar_members_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "crm_tasks" ADD COLUMN "calendarId" TEXT;

-- CreateIndex
CREATE INDEX "crm_agenda_calendars_empresaId_archivedAt_createdAt_idx" ON "crm_agenda_calendars"("empresaId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "crm_agenda_calendars_ownerUserId_createdAt_idx" ON "crm_agenda_calendars"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_agenda_calendar_members_userId_createdAt_idx" ON "crm_agenda_calendar_members"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_agenda_calendar_members_calendarId_userId_key" ON "crm_agenda_calendar_members"("calendarId", "userId");

-- CreateIndex
CREATE INDEX "crm_tasks_calendarId_dueAt_idx" ON "crm_tasks"("calendarId", "dueAt");

-- AddForeignKey
ALTER TABLE "crm_agenda_calendars" ADD CONSTRAINT "crm_agenda_calendars_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agenda_calendars" ADD CONSTRAINT "crm_agenda_calendars_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agenda_calendars" ADD CONSTRAINT "crm_agenda_calendars_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agenda_calendar_members" ADD CONSTRAINT "crm_agenda_calendar_members_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agenda_calendar_members" ADD CONSTRAINT "crm_agenda_calendar_members_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "crm_agenda_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agenda_calendar_members" ADD CONSTRAINT "crm_agenda_calendar_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "crm_agenda_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
