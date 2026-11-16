-- Workflows: columna para programación por cron.
-- Migración 100% aditiva.
ALTER TABLE "workflows" ADD COLUMN "lastRunAt" TIMESTAMP(3);
