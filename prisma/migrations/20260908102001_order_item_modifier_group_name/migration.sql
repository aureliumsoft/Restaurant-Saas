-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- AlterTable
ALTER TABLE "OrderItemModifier" ADD COLUMN IF NOT EXISTS "groupName" TEXT;

