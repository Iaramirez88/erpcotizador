-- Help videos (tutoriales)

CREATE TABLE IF NOT EXISTS "help_videos" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "embedUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" TEXT,

  CONSTRAINT "help_videos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "help_videos_createdAt_idx" ON "help_videos" ("createdAt");

ALTER TABLE "help_videos"
ADD CONSTRAINT "help_videos_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
