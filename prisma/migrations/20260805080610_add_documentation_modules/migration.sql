-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- CreateTable
CREATE TABLE "DocumentationModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentationModule_status_sortOrder_idx" ON "DocumentationModule"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentationModule_createdAt_idx" ON "DocumentationModule"("createdAt");
