-- AlterTable
ALTER TABLE "MenuItemAttributeGroup" ADD COLUMN IF NOT EXISTS "productOverrides" JSONB NOT NULL DEFAULT '{}';

