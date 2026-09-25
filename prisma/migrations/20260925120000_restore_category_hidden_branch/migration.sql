-- Restore per-branch category visibility (dropped in deal_items_added).
CREATE TABLE IF NOT EXISTS "MenuCategoryHiddenBranch" (
    "categoryId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "MenuCategoryHiddenBranch_pkey" PRIMARY KEY ("categoryId","branchId")
);

CREATE INDEX IF NOT EXISTS "MenuCategoryHiddenBranch_branchId_idx" ON "MenuCategoryHiddenBranch"("branchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuCategoryHiddenBranch_categoryId_fkey'
  ) THEN
    ALTER TABLE "MenuCategoryHiddenBranch"
      ADD CONSTRAINT "MenuCategoryHiddenBranch_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuCategoryHiddenBranch_branchId_fkey'
  ) THEN
    ALTER TABLE "MenuCategoryHiddenBranch"
      ADD CONSTRAINT "MenuCategoryHiddenBranch_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
