-- AlterTable
ALTER TABLE "NewsletterCampaign" ADD COLUMN IF NOT EXISTS "buttonTitle" TEXT;
ALTER TABLE "NewsletterCampaign" ADD COLUMN IF NOT EXISTS "buttonLink" TEXT;
