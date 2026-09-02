-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "dineInEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Restaurant" ADD COLUMN "cardPaymentsEnabled" BOOLEAN NOT NULL DEFAULT true;
