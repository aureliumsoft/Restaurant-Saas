-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- CreateTable
CREATE TABLE "PlatformFaq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFaq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformFaq_status_sortOrder_idx" ON "PlatformFaq"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "PlatformFaq_createdAt_idx" ON "PlatformFaq"("createdAt");
