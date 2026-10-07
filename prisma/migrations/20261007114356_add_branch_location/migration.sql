-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "deliveryRadiusKm" DOUBLE PRECISION,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

