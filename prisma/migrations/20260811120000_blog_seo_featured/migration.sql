-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "seoImageUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlogPost_status_featured_publishedAt_idx" ON "BlogPost"("status", "featured", "publishedAt");
