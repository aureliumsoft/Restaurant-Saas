CREATE TABLE IF NOT EXISTS "MenuItemPersonalizeGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "maxItems" INTEGER NOT NULL DEFAULT 2,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemPersonalizeGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MenuItemPersonalizeOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemPersonalizeOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MenuItemPersonalizeGroup_menuItemId_idx" ON "MenuItemPersonalizeGroup"("menuItemId");
CREATE INDEX IF NOT EXISTS "MenuItemPersonalizeOption_groupId_idx" ON "MenuItemPersonalizeOption"("groupId");

DO $$ BEGIN
  ALTER TABLE "MenuItemPersonalizeGroup" ADD CONSTRAINT "MenuItemPersonalizeGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MenuItemPersonalizeOption" ADD CONSTRAINT "MenuItemPersonalizeOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuItemPersonalizeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OrderItemModifier" ALTER COLUMN "menuItemId" DROP NOT NULL;
