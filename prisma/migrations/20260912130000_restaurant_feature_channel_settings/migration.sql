-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "websiteEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "kioskEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "kdsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "orderDisplayEnabled" BOOLEAN NOT NULL DEFAULT true;
