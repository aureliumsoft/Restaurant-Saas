-- Spanish restaurants are the PayPal default; DE was leftover from earlier setup.
ALTER TABLE "RestaurantPayPalCredentials"
  ALTER COLUMN "countryCode" SET DEFAULT 'ES';

UPDATE "RestaurantPayPalCredentials" ppc
SET "countryCode" = r."countryCode"
FROM "Restaurant" r
WHERE r."id" = ppc."restaurantId"
  AND ppc."countryCode" = 'DE'
  AND r."countryCode" = 'ES';
