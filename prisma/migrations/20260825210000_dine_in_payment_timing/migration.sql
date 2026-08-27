-- CreateEnum
CREATE TYPE "DineInPaymentTiming" AS ENUM ('ON_LEAVE', 'BEFORE_KITCHEN');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "dineInPaymentTiming" "DineInPaymentTiming" NOT NULL DEFAULT 'ON_LEAVE';
