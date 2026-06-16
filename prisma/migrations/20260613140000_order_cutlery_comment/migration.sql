-- Online order cutlery + customer comment
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "cutleryRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "customerComment" TEXT;
