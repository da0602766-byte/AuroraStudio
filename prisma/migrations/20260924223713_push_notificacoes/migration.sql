-- Notificação mesmo com o navegador fechado (Web Push).
ALTER TABLE "Booking"
ADD COLUMN "overduePushSentAt" TIMESTAMP(3);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_adminUserId_idx" ON "PushSubscription"("adminUserId");

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
