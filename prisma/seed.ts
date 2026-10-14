import { PrismaClient } from '@prisma/client';
import { fakeProductStockComplete } from './fake-data';
import { seedPlatformAdminUser } from './seed-admin-user';
import { seedDemoRestaurant } from './seed-demo-restaurant';
import {
  ensureAllRestaurantsOwnerRoles,
  refreshAllRestaurantOwnerRoles,
} from './seed-restaurant-roles';
import { seedDefaultGlobalRoles } from './seed-roles';
import { seedSubscriptionPlans } from './seed-subscription-plans';

const prisma = new PrismaClient();

async function assertSchemaReady() {
  try {
    await prisma.$queryRaw`SELECT "posServiceChargeEnabled" FROM "Restaurant" LIMIT 0`;
  } catch {
    throw new Error(
      'Database schema is out of date. Run migrations first:\n  npx prisma migrate deploy\nOr on deploy:\n  npm run db:setup'
    );
  }
}

async function main() {
  await assertSchemaReady();
  await seedDefaultGlobalRoles(prisma);
  await seedPlatformAdminUser(prisma);
  await ensureAllRestaurantsOwnerRoles(prisma);
  await refreshAllRestaurantOwnerRoles(prisma);
  await seedDemoRestaurant(prisma);
  await seedSubscriptionPlans(prisma);

  if (process.env.SEED_LEGACY_PRODUCT_STOCK === 'true') {
    await prisma.productStock.deleteMany({});
    const fakerRounds = 40;
    for (let i = 0; i < fakerRounds; i++) {
      const product = await prisma.productStock.create({
        data: {
          ...fakeProductStockComplete(),
        },
      });
      console.log(`Created product stock with id ${product.id}`);
    }
  } else {
    console.log(
      '[seed] Skipped legacy productStock (set SEED_LEGACY_PRODUCT_STOCK=true to enable)'
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
