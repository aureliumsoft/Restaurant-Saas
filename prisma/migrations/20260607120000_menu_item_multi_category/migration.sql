-- CreateTable (idempotent: table may already exist from db push)
CREATE TABLE IF NOT EXISTS "MenuItemCategory" (
    "menuItemId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemCategory_pkey" PRIMARY KEY ("menuItemId","categoryId")
);

-- Backfill from existing primary category assignments
INSERT INTO "MenuItemCategory" ("menuItemId", "categoryId", "sortOrder")
SELECT "id", "categoryId", 0
FROM "MenuItem"
ON CONFLICT ("menuItemId", "categoryId") DO NOTHING;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MenuItemCategory_categoryId_idx" ON "MenuItemCategory"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MenuItemCategory_menuItemId_idx" ON "MenuItemCategory"("menuItemId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuItemCategory_menuItemId_fkey'
  ) THEN
    ALTER TABLE "MenuItemCategory" ADD CONSTRAINT "MenuItemCategory_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenuItemCategory_categoryId_fkey'
  ) THEN
    ALTER TABLE "MenuItemCategory" ADD CONSTRAINT "MenuItemCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
