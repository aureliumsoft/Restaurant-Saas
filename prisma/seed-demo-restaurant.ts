import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { DEMO_RESTAURANT_SLUG } from '../lib/demo-restaurant';
import {
  ensureRestaurantOwnerEmployee,
  refreshAllRestaurantOwnerRoles,
} from './seed-restaurant-roles';
import { SEED_GLOBAL_ROLE_SLUG } from './seed-roles';

const DEMO_OWNER_EMAIL = 'demo-store-owner@local.dev';
const DEMO_OWNER_PASSWORD = '123456789';
const SALT_ROUNDS = 10;

async function seedDemoMenu(prisma: PrismaClient, restaurantId: string) {
  const existingCategories = await prisma.menuCategory.count({
    where: { restaurantId },
  });
  if (existingCategories > 0) {
    console.log('[seed-demo] Menu already present — skipping menu seed');
    return;
  }

  const catMains = await prisma.menuCategory.create({
    data: { name: 'Chef specials', restaurantId, showInFront: true },
  });
  const catSizes = await prisma.menuCategory.create({
    data: { name: 'Choose size', restaurantId, showInFront: false },
  });
  const catAddons = await prisma.menuCategory.create({
    data: { name: 'Add-ons', restaurantId, showInFront: false },
  });
  const catDrinks = await prisma.menuCategory.create({
    data: { name: 'Drinks', restaurantId, showInFront: true },
  });

  await prisma.menuItem.create({
    data: {
      name: 'Regular',
      description: 'Standard portion',
      price: 0,
      categoryId: catSizes.id,
      restaurantId,
    },
  });
  await prisma.menuItem.create({
    data: {
      name: 'Large',
      description: 'Upsize',
      price: 2,
      categoryId: catSizes.id,
      restaurantId,
    },
  });

  await prisma.menuItem.create({
    data: {
      name: 'Extra cheese',
      price: 1.5,
      categoryId: catAddons.id,
      restaurantId,
    },
  });
  await prisma.menuItem.create({
    data: {
      name: 'Bacon',
      price: 2,
      categoryId: catAddons.id,
      restaurantId,
    },
  });

  const drinkCola = await prisma.menuItem.create({
    data: {
      name: 'Cola',
      description: 'Chilled 33cl',
      price: 2.5,
      categoryId: catDrinks.id,
      restaurantId,
    },
  });

  const burger = await prisma.menuItem.create({
    data: {
      name: 'Classic Burger',
      description: 'House sauce, lettuce, tomato',
      price: 8.99,
      salePrice: 7.99,
      categoryId: catMains.id,
      restaurantId,
    },
  });

  const fries = await prisma.menuItem.create({
    data: {
      name: 'Seasoned fries',
      description: 'Side',
      price: 3.5,
      categoryId: catMains.id,
      restaurantId,
    },
  });

  await prisma.menuItemAttributeGroup.create({
    data: {
      menuItemId: burger.id,
      name: 'Choose size',
      sortOrder: 0,
      selectionType: 'SINGLE',
      required: true,
      linkedCategoryId: catSizes.id,
    },
  });

  await prisma.menuItemAttributeGroup.create({
    data: {
      menuItemId: burger.id,
      name: 'Add-ons',
      sortOrder: 1,
      selectionType: 'MULTIPLE',
      required: false,
      linkedCategoryId: catAddons.id,
    },
  });

  await prisma.menuItemOffer.create({
    data: {
      baseItemId: burger.id,
      offeredItemId: fries.id,
      sortOrder: 0,
    },
  });

  await prisma.menuItemOffer.create({
    data: {
      baseItemId: burger.id,
      offeredItemId: drinkCola.id,
      sortOrder: 1,
    },
  });

  console.log('[seed-demo] Created demo menu (categories, items, attributes, offers)');
}

async function seedDemoSubscription(prisma: PrismaClient, restaurantId: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  await prisma.restaurantSubscription.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      plan: 'GROWTH',
      status: 'TRIAL',
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      notes: 'Seeded demo subscription',
    },
    update: {
      plan: 'GROWTH',
      status: 'TRIAL',
      trialEndsAt,
      currentPeriodEnd: trialEndsAt,
    },
  });
}

async function seedDemoBranchesAndTables(
  prisma: PrismaClient,
  restaurantId: string
) {
  let mainBranch = await prisma.branch.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!mainBranch) {
    mainBranch = await prisma.branch.create({
      data: {
        restaurantId,
        name: 'Main location',
        address: '123 Demo Street',
        phone: '+1 555 0100',
      },
      select: { id: true },
    });
    console.log('[seed-demo] Created main branch');
  }

  const tableCount = await prisma.diningTable.count({ where: { restaurantId } });
  if (tableCount === 0) {
    const tables = ['Table 1', 'Table 2', 'Bar counter'];
    for (let i = 0; i < tables.length; i++) {
      await prisma.diningTable.create({
        data: {
          restaurantId,
          branchId: mainBranch.id,
          name: tables[i]!,
          sortOrder: i,
        },
      });
    }
    console.log('[seed-demo] Created dining tables');
  }
}

async function seedDemoSampleOrder(prisma: PrismaClient, restaurantId: string) {
  const orderCount = await prisma.order.count({ where: { restaurantId } });
  if (orderCount > 0) {
    return;
  }

  const burger = await prisma.menuItem.findFirst({
    where: { restaurantId, name: 'Classic Burger' },
    select: { id: true, price: true, salePrice: true },
  });
  if (!burger) {
    return;
  }

  const unitPrice = burger.salePrice ?? burger.price;
  const qty = 2;
  const total = unitPrice * qty;

  await prisma.order.create({
    data: {
      restaurantId,
      status: 'completed',
      total,
      sourceType: 'POS',
      items: {
        create: {
          menuItemId: burger.id,
          quantity: qty,
          price: unitPrice,
        },
      },
    },
  });

  console.log('[seed-demo] Created sample completed order for Sales');
}

/**
 * Idempotent demo tenant: slug `restaurant`, owner with full dashboard RBAC,
 * menu, subscription, branches, tables, and a sample order.
 */
export async function seedDemoRestaurant(prisma: PrismaClient): Promise<void> {
  const globalOwnerRole = await prisma.role.findFirst({
    where: { restaurantId: null, slug: SEED_GLOBAL_ROLE_SLUG.OWNER },
    select: { id: true },
  });
  if (!globalOwnerRole) {
    console.warn(
      '[seed-demo] Skipping: global seed_owner role missing. Run seedDefaultGlobalRoles first.'
    );
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, SALT_ROUNDS);

  let owner = await prisma.user.findUnique({
    where: { email: DEMO_OWNER_EMAIL },
    select: { id: true },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'Demo Store Owner',
        username: 'demo_store_owner',
        email: DEMO_OWNER_EMAIL,
        password: passwordHash,
        emailVerified: new Date(),
        roleId: globalOwnerRole.id,
      },
      select: { id: true },
    });
    console.log('[seed-demo] Created demo owner user');
  } else {
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        password: passwordHash,
        emailVerified: new Date(),
      },
    });
    console.log('[seed-demo] Updated demo owner password');
  }

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: DEMO_RESTAURANT_SLUG },
    create: {
      name: 'Restaurant',
      slug: DEMO_RESTAURANT_SLUG,
      subdomain: DEMO_RESTAURANT_SLUG,
      ownerId: owner.id,
      themePrimaryColor: '#e85d04',
    },
    update: {
      name: 'Restaurant',
      subdomain: DEMO_RESTAURANT_SLUG,
      ownerId: owner.id,
    },
  });

  await ensureRestaurantOwnerEmployee(prisma, restaurant.id, owner.id);
  await refreshAllRestaurantOwnerRoles(prisma);

  await seedDemoSubscription(prisma, restaurant.id);
  await seedDemoBranchesAndTables(prisma, restaurant.id);
  await seedDemoMenu(prisma, restaurant.id);
  await seedDemoSampleOrder(prisma, restaurant.id);

  console.log(
    `[seed-demo] Demo restaurant "${DEMO_RESTAURANT_SLUG}" ready — login ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`
  );
}
