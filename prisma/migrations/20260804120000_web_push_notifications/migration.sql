ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "__web_push_placeholder" TEXT;

ALTER TABLE "users"
DROP COLUMN IF EXISTS "__web_push_placeholder";

CREATE TABLE IF NOT EXISTS "web_push_subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expirationTime" TIMESTAMP(3),
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "web_push_subscriptions_endpoint_key" ON "web_push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "web_push_subscriptions_userId_idx" ON "web_push_subscriptions"("userId");