-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shortOrderId" SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- CreateTable
CREATE TABLE "MenuCategoryHiddenBranch" (
    "categoryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuCategoryHiddenBranch_pkey" PRIMARY KEY ("categoryId","branchId")
);

-- CreateIndex
CREATE INDEX "MenuCategoryHiddenBranch_branchId_idx" ON "MenuCategoryHiddenBranch"("branchId");

-- AddForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" ADD CONSTRAINT "MenuCategoryHiddenBranch_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategoryHiddenBranch" ADD CONSTRAINT "MenuCategoryHiddenBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
