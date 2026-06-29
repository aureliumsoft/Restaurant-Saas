-- Restaurant-level currency and country (PKR/EUR, Pakistan/Spain).
ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'ES';

-- Align existing PayPal credential rows with restaurant settings where present.
UPDATE "RestaurantPayPalCredentials" ppc
SET
  "currency" = COALESCE(r."currencyCode", ppc."currency"),
  "countryCode" = COALESCE(r."countryCode", ppc."countryCode")
FROM "Restaurant" r
WHERE r."id" = ppc."restaurantId";
