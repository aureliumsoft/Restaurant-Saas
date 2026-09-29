-- Dining table availability status (AVAILABLE | RESERVED)

CREATE TYPE "DiningTableStatus" AS ENUM ('AVAILABLE', 'RESERVED');

ALTER TABLE "DiningTable"
  ADD COLUMN IF NOT EXISTS "status" "DiningTableStatus" NOT NULL DEFAULT 'AVAILABLE';

CREATE INDEX IF NOT EXISTS "DiningTable_status_idx" ON "DiningTable"("status");

-- Backfill: mark tables reserved when they have an active (non-terminal) order.
UPDATE "DiningTable" t
SET "status" = 'RESERVED'
WHERE EXISTS (
  SELECT 1
  FROM "Order" o
  WHERE o."diningTableId" = t.id
    AND LOWER(o.status) NOT IN (
      'canceled',
      'cancelled',
      'failed',
      'cancel',
      'completed',
      'complete',
      'delivered'
    )
);
