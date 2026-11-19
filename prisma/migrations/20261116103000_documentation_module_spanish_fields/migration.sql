-- Separate Spanish fields for documentation pages (English stays on the original columns).
ALTER TABLE "DocumentationModule" ADD COLUMN IF NOT EXISTS "nameEs" TEXT;
ALTER TABLE "DocumentationModule" ADD COLUMN IF NOT EXISTS "shortDescriptionEs" TEXT;
ALTER TABLE "DocumentationModule" ADD COLUMN IF NOT EXISTS "contentHtmlEs" TEXT;
