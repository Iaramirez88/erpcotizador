-- Add lastLoginAt to users
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
