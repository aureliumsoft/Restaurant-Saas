import { PrismaClient } from '@prisma/client';
import { fakeProductStockComplete } from './fake-data';
import { seedPlatformAdminUser } from './seed-admin-user';
import { seedDemoRestaurant } from './seed-demo-restaurant';
import {
  ensureAllRestaurantsOwnerRoles,
  refreshAllRestaurantOwnerRoles,
} from './seed-restaurant-roles';
import { seedDefaultGlobalRoles } from './seed-roles';

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

  await prisma.$executeRaw`
    INSERT INTO "SubscriptionCatalog" ("id","plan","name","price","priceLabel","description","features","createdAt","updatedAt")
    VALUES
      ('subcat_starter','STARTER','Starter',29,'$29/mo','Perfect for one small location getting online.',ARRAY['1 branch maximum','Menu & order tools','Basic dashboard metrics','No recommendations module','No custom roles or branding changes'],now(),now()),
      ('subcat_growth','GROWTH','Growth',79,'$79/mo','For growing restaurants and multiple teams.',ARRAY['Up to 5 branches','Role-based users & permissions','Advanced analytics & 7-day charts','Logo, banners & theme','Recommendations & add-ons','Everything in Starter'],now(),now()),
      ('subcat_scale','SCALE','Scale',0,'Custom','Enterprise setup for multi-brand operations.',ARRAY['Unlimited branches','All Growth features','Priority support','Custom integrations','Dedicated onboarding'],now(),now())
    ON CONFLICT ("plan") DO NOTHING
  `;

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
