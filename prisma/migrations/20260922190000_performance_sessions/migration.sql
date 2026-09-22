-- Cache de sessão revogável sem buscar o hash da senha em toda navegação.
ALTER TABLE "AdminUser"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Índices das consultas que sustentam agenda, dashboard e expiração de sinais.
CREATE INDEX "Booking_startsAt_idx" ON "Booking"("startsAt");
CREATE INDEX "Booking_status_startsAt_idx" ON "Booking"("status", "startsAt");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");
CREATE INDEX "Booking_status_cancelledAt_idx" ON "Booking"("status", "cancelledAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
