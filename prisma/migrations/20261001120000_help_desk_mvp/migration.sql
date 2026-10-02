CREATE TYPE "HelpTicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'CANCELED');
CREATE TYPE "HelpTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "HelpTicketType" AS ENUM ('CUSTOMER', 'INTERNAL', 'TECHNICAL_SUPPORT', 'INCIDENT', 'REQUEST', 'QUESTION', 'IMPROVEMENT');
CREATE TYPE "HelpTicketChannel" AS ENUM ('WEB_PANEL', 'ADMIN', 'EMAIL', 'WHATSAPP', 'INTERNAL');
CREATE TYPE "HelpTicketMessageVisibility" AS ENUM ('PUBLIC', 'INTERNAL');
CREATE TYPE "HelpTicketActivityType" AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'CATEGORY_CHANGED', 'MESSAGE_ADDED', 'INTERNAL_NOTE_ADDED', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED', 'UPDATED');

CREATE TABLE "help_ticket_sequences" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_ticket_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "help_tickets" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "clienteId" TEXT,
    "requesterId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "module" TEXT,
    "submodule" TEXT,
    "type" "HelpTicketType" NOT NULL DEFAULT 'REQUEST',
    "priority" "HelpTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "HelpTicketStatus" NOT NULL DEFAULT 'NEW',
    "channel" "HelpTicketChannel" NOT NULL DEFAULT 'WEB_PANEL',
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "waitingSince" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "help_ticket_messages" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "visibility" "HelpTicketMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "bodyText" TEXT NOT NULL,
    "attachmentsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "help_ticket_activities" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "HelpTicketActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "help_ticket_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "help_ticket_sequences_sedeId_year_key" ON "help_ticket_sequences"("sedeId", "year");
CREATE UNIQUE INDEX "help_tickets_empresaId_number_key" ON "help_tickets"("empresaId", "number");
CREATE INDEX "help_tickets_empresaId_sedeId_status_updatedAt_idx" ON "help_tickets"("empresaId", "sedeId", "status", "updatedAt");
CREATE INDEX "help_tickets_requesterId_updatedAt_idx" ON "help_tickets"("requesterId", "updatedAt");
CREATE INDEX "help_tickets_assignedToId_status_updatedAt_idx" ON "help_tickets"("assignedToId", "status", "updatedAt");
CREATE INDEX "help_tickets_clienteId_updatedAt_idx" ON "help_tickets"("clienteId", "updatedAt");
CREATE INDEX "help_ticket_messages_ticketId_createdAt_idx" ON "help_ticket_messages"("ticketId", "createdAt");
CREATE INDEX "help_ticket_messages_empresaId_createdAt_idx" ON "help_ticket_messages"("empresaId", "createdAt");
CREATE INDEX "help_ticket_activities_ticketId_createdAt_idx" ON "help_ticket_activities"("ticketId", "createdAt");
CREATE INDEX "help_ticket_activities_empresaId_createdAt_idx" ON "help_ticket_activities"("empresaId", "createdAt");

ALTER TABLE "help_ticket_sequences" ADD CONSTRAINT "help_ticket_sequences_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "help_tickets" ADD CONSTRAINT "help_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_ticket_messages" ADD CONSTRAINT "help_ticket_messages_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_ticket_messages" ADD CONSTRAINT "help_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "help_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_ticket_messages" ADD CONSTRAINT "help_ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "help_ticket_activities" ADD CONSTRAINT "help_ticket_activities_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_ticket_activities" ADD CONSTRAINT "help_ticket_activities_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "help_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_ticket_activities" ADD CONSTRAINT "help_ticket_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
