-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "english" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "spanish" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlogPost_status_english_publishedAt_idx" ON "BlogPost"("status", "english", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogPost_status_spanish_publishedAt_idx" ON "BlogPost"("status", "spanish", "publishedAt");
