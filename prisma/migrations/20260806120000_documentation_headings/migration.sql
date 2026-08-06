-- CreateTable
CREATE TABLE "DocumentationHeading" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationHeading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentationSubHeading" (
    "id" TEXT NOT NULL,
    "headingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentationSubHeading_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DocumentationModule" ADD COLUMN "headingId" TEXT,
ADD COLUMN "subHeadingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentationHeading_slug_key" ON "DocumentationHeading"("slug");

-- CreateIndex
CREATE INDEX "DocumentationHeading_status_sortOrder_idx" ON "DocumentationHeading"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentationSubHeading_headingId_sortOrder_idx" ON "DocumentationSubHeading"("headingId", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentationSubHeading_status_sortOrder_idx" ON "DocumentationSubHeading"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentationSubHeading_headingId_slug_key" ON "DocumentationSubHeading"("headingId", "slug");

-- CreateIndex
CREATE INDEX "DocumentationModule_headingId_idx" ON "DocumentationModule"("headingId");

-- CreateIndex
CREATE INDEX "DocumentationModule_subHeadingId_idx" ON "DocumentationModule"("subHeadingId");

-- AddForeignKey
ALTER TABLE "DocumentationSubHeading" ADD CONSTRAINT "DocumentationSubHeading_headingId_fkey" FOREIGN KEY ("headingId") REFERENCES "DocumentationHeading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentationModule" ADD CONSTRAINT "DocumentationModule_headingId_fkey" FOREIGN KEY ("headingId") REFERENCES "DocumentationHeading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentationModule" ADD CONSTRAINT "DocumentationModule_subHeadingId_fkey" FOREIGN KEY ("subHeadingId") REFERENCES "DocumentationSubHeading"("id") ON DELETE SET NULL ON UPDATE CASCADE;
