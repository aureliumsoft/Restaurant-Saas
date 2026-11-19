-- Monthly price agreed for one restaurant. Null means the catalog price.
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "agreedPrice" INTEGER;
