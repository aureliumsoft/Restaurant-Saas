ALTER TABLE "RestaurantSubscription"
  ADD COLUMN IF NOT EXISTS "billingPeriodOverriddenAt" TIMESTAMP(3);
