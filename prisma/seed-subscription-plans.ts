import { PrismaClient } from '@prisma/client';

import {
  ensureMissingSubscriptionPlans,
  SUBSCRIPTION_CATALOG_SEED,
} from '../lib/subscription-catalog-defaults';

export type SeedSubscriptionPlansOptions = {
  /**
   * When true, existing rows keep admin-tuned discount flags/percents.
   * New plans still get seed defaults (off / 0).
   * Default false: full replace of pricing + discount fields from seed.
   */
  preserveDiscounts?: boolean;
  /**
   * Insert catalog rows that are missing. Leaves existing prices, names,
   * and PayPal ids untouched.
   */
  missingOnly?: boolean;
};

/**
 * Upserts all public pricing plans (Free → Custom).
 * Safe for production: does not touch PayPal plan/product ids.
 * Names / labels / features use `&&&&` for English + Spanish.
 */
export async function seedSubscriptionPlans(
  prisma: PrismaClient,
  options: SeedSubscriptionPlansOptions = {}
) {
  if (options.missingOnly) {
    return ensureMissingSubscriptionPlans(prisma);
  }

  const preserveDiscounts = Boolean(options.preserveDiscounts);
  const plans = SUBSCRIPTION_CATALOG_SEED;

  for (const p of plans) {
    const monthlyDiscountEnabled = p.monthlyDiscountEnabled ?? false;
    const monthlyDiscountPercent = p.monthlyDiscountPercent ?? 0;
    const yearlyDiscountEnabled = p.yearlyDiscountEnabled ?? false;
    const yearlyDiscountPercent = p.yearlyDiscountPercent ?? 0;

    if (preserveDiscounts) {
      await prisma.$executeRaw`
        INSERT INTO "SubscriptionCatalog" (
          "id", "plan", "name", "price", "priceLabel", "description", "features",
          "monthlyDiscountEnabled", "monthlyDiscountPercent",
          "yearlyPrice", "yearlyDiscountEnabled", "yearlyDiscountPercent",
          "createdAt", "updatedAt"
        )
        VALUES (
          ${p.id},
          ${p.plan}::"SubscriptionPlan",
          ${p.name},
          ${p.price},
          ${p.priceLabel},
          ${p.description},
          ${p.features}::text[],
          ${monthlyDiscountEnabled},
          ${monthlyDiscountPercent},
          ${p.yearlyPrice},
          ${yearlyDiscountEnabled},
          ${yearlyDiscountPercent},
          now(),
          now()
        )
        ON CONFLICT ("plan") DO UPDATE SET
          "id" = EXCLUDED."id",
          "name" = EXCLUDED."name",
          "price" = EXCLUDED."price",
          "priceLabel" = EXCLUDED."priceLabel",
          "description" = EXCLUDED."description",
          "features" = EXCLUDED."features",
          "yearlyPrice" = EXCLUDED."yearlyPrice",
          "updatedAt" = now()
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "SubscriptionCatalog" (
          "id", "plan", "name", "price", "priceLabel", "description", "features",
          "monthlyDiscountEnabled", "monthlyDiscountPercent",
          "yearlyPrice", "yearlyDiscountEnabled", "yearlyDiscountPercent",
          "createdAt", "updatedAt"
        )
        VALUES (
          ${p.id},
          ${p.plan}::"SubscriptionPlan",
          ${p.name},
          ${p.price},
          ${p.priceLabel},
          ${p.description},
          ${p.features}::text[],
          ${monthlyDiscountEnabled},
          ${monthlyDiscountPercent},
          ${p.yearlyPrice},
          ${yearlyDiscountEnabled},
          ${yearlyDiscountPercent},
          now(),
          now()
        )
        ON CONFLICT ("plan") DO UPDATE SET
          "id" = EXCLUDED."id",
          "name" = EXCLUDED."name",
          "price" = EXCLUDED."price",
          "priceLabel" = EXCLUDED."priceLabel",
          "description" = EXCLUDED."description",
          "features" = EXCLUDED."features",
          "monthlyDiscountEnabled" = EXCLUDED."monthlyDiscountEnabled",
          "monthlyDiscountPercent" = EXCLUDED."monthlyDiscountPercent",
          "yearlyPrice" = EXCLUDED."yearlyPrice",
          "yearlyDiscountEnabled" = EXCLUDED."yearlyDiscountEnabled",
          "yearlyDiscountPercent" = EXCLUDED."yearlyDiscountPercent",
          "updatedAt" = now()
      `;
    }
  }

  console.log(
    `[seed:pricing] Upserted ${plans.length} plans (FREE…CUSTOM)` +
      (preserveDiscounts ? '; preserved existing discounts' : '; replaced discounts from seed') +
      '; PayPal catalog ids left unchanged'
  );

  return plans.length;
}

async function main() {
  const preserveDiscounts = process.argv.includes('--preserve-discounts');
  const missingOnly = process.argv.includes('--missing-only');
  const prisma = new PrismaClient();
  try {
    console.log(
      `[seed:pricing] DATABASE_URL host → ${
        (() => {
          try {
            const u = new URL(process.env.DATABASE_URL ?? '');
            return `${u.hostname}${u.pathname}`;
          } catch {
            return '(unset or invalid DATABASE_URL)';
          }
        })()
      }`
    );
    const count = await seedSubscriptionPlans(prisma, {
      preserveDiscounts,
      missingOnly,
    });
    if (missingOnly) {
      console.log(
        `[seed:pricing] Inserted ${count} missing plan(s); existing prices left unchanged`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[seed:pricing] Failed:', e);
    process.exit(1);
  });
}
