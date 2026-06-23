-- CreateEnum
CREATE TYPE "PosShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "PosShift" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "closingCashInLocker" DOUBLE PRECISION,
    "status" "PosShiftStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosShift_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "posShiftId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosShift_restaurantId_status_idx" ON "PosShift"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "PosShift_restaurantId_branchId_status_idx" ON "PosShift"("restaurantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "PosShift_startedAt_idx" ON "PosShift"("startedAt");
CREATE INDEX IF NOT EXISTS "Order_posShiftId_idx" ON "Order"("posShiftId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_posShiftId_fkey" FOREIGN KEY ("posShiftId") REFERENCES "PosShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
