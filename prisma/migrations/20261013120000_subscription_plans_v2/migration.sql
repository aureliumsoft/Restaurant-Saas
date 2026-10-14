-- Expand SubscriptionPlan: STARTER → FREE, add BASIC / PRO / CUSTOM.

-- 1) Add new enum values (must commit before use in some PG versions; Prisma runs in one txn — use temporary type swap).
CREATE TYPE "SubscriptionPlan_new" AS ENUM (
  'FREE',
  'BASIC',
  'GROWTH',
  'SCALE',
  'PRO',
  'CUSTOM'
);

-- 2) RestaurantSubscription.plan
ALTER TABLE "RestaurantSubscription"
  ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "RestaurantSubscription"
  ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
  USING (
    CASE "plan"::text
      WHEN 'STARTER' THEN 'FREE'
      WHEN 'GROWTH' THEN 'GROWTH'
      WHEN 'SCALE' THEN 'SCALE'
      ELSE 'FREE'
    END
  )::"SubscriptionPlan_new";

ALTER TABLE "RestaurantSubscription"
  ALTER COLUMN "plan" SET DEFAULT 'FREE'::"SubscriptionPlan_new";

-- 3) SubscriptionCatalog.plan
ALTER TABLE "SubscriptionCatalog"
  ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
  USING (
    CASE "plan"::text
      WHEN 'STARTER' THEN 'FREE'
      WHEN 'GROWTH' THEN 'GROWTH'
      WHEN 'SCALE' THEN 'SCALE'
      ELSE 'FREE'
    END
  )::"SubscriptionPlan_new";

-- 4) Replace old enum
DROP TYPE "SubscriptionPlan";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";

-- 5) Fix defaults to final type name
ALTER TABLE "RestaurantSubscription"
  ALTER COLUMN "plan" SET DEFAULT 'FREE'::"SubscriptionPlan";
