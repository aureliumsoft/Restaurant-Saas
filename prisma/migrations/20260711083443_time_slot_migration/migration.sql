-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "openingHours" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderScheduleAt" TIMESTAMP(3),
ADD COLUMN     "orderScheduleMode" TEXT DEFAULT 'asap',
ADD COLUMN     "orderScheduleSlot" TEXT,
ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
