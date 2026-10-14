-- Custom plan request records + selected modules on restaurant subscription.

ALTER TABLE "RestaurantSubscription"
  ADD COLUMN IF NOT EXISTS "customSelectedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TYPE "CustomPlanRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "CustomPlanRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "restaurantId" TEXT,
    "selectedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "CustomPlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPlanRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomPlanRequest_createdAt_idx" ON "CustomPlanRequest"("createdAt");
CREATE INDEX "CustomPlanRequest_status_idx" ON "CustomPlanRequest"("status");
CREATE INDEX "CustomPlanRequest_restaurantId_idx" ON "CustomPlanRequest"("restaurantId");

ALTER TABLE "CustomPlanRequest"
  ADD CONSTRAINT "CustomPlanRequest_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
