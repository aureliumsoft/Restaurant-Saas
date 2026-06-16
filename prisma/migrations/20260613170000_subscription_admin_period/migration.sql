-- Lock platform period end when admin sets a custom date (cleared on PayPal renewal).
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "adminPeriodEndAt" TIMESTAMP(3);
