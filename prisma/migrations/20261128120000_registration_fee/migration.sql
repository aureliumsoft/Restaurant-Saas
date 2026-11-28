-- AlterTable
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "registrationFeePaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "registrationFeePaidAt" TIMESTAMP(3);
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "registrationFeeAmount" DOUBLE PRECISION;
ALTER TABLE "RestaurantSubscription" ADD COLUMN IF NOT EXISTS "registrationFeeCurrency" TEXT DEFAULT 'EUR';

-- Grandfather existing restaurants so they are not locked out.
UPDATE "RestaurantSubscription" SET "registrationFeePaid" = true WHERE "registrationFeePaid" = false;

-- Free catalog price becomes the one-time registration fee (idempotent if already set).
UPDATE "SubscriptionCatalog"
SET
  "price" = 49,
  "priceLabel" = '€49 once&&&&49 € una vez',
  "description" = 'One-time registration fee unlocks Free plan — core catalog and POS with tight limits, no monthly subscription.&&&&La cuota de registro única desbloquea el plan Gratis — catálogo básico y TPV con límites estrictos, sin cuota mensual.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "plan" = 'FREE' AND "price" = 0;
