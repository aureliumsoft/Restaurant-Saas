-- Replace admin billing override with restaurant auto-renew toggle.
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "RestaurantSubscription" DROP COLUMN IF EXISTS "billingPeriodOverriddenAt";
