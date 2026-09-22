import { z } from 'zod';

import { db } from '@/lib/db';
import { MENU_ITEM_CATEGORY_LINK_SORT_ORDER } from '@/lib/menu/product-order';

export const finalViewReorderSchema = z.object({
  tab: z.enum(['storefront', 'recommendations']),
  categories: z
    .array(
      z.object({
        id: z.string().uuid(),
        productIds: z.array(z.string().uuid()),
      })
    )
    .max(500),
});

export type FinalViewReorderInput = z.infer<typeof finalViewReorderSchema>;

export type FinalViewProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type FinalViewCategory = {
  id: string;
  name: string;
  imageUrl: string | null;
  showInFront: boolean;
  sortOrder: number;
  products: FinalViewProduct[];
};

/** Load all categories with products ordered for Final View editing. */
export async function loadFinalViewCatalog(
  restaurantId: string
): Promise<FinalViewCategory[]> {
  const categories = await db.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      imageUrl: true,
      showInFront: true,
      sortOrder: true,
    },
  });
  if (categories.length === 0) return [];

  const categoryIds = categories.map((c) => c.id);
  const links = await db.menuItemCategory.findMany({
    where: { categoryId: { in: categoryIds } },
    orderBy: [...MENU_ITEM_CATEGORY_LINK_SORT_ORDER],
    select: {
      categoryId: true,
      menuItemId: true,
      menuItem: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          restaurantId: true,
        },
      },
    },
  });

  const productsByCategory = new Map<string, FinalViewProduct[]>();
  for (const id of categoryIds) {
    productsByCategory.set(id, []);
  }

  for (const link of links) {
    if (link.menuItem.restaurantId !== restaurantId) continue;
    const list = productsByCategory.get(link.categoryId);
    if (!list) continue;
    if (list.some((p) => p.id === link.menuItem.id)) continue;
    list.push({
      id: link.menuItem.id,
      name: link.menuItem.name,
      imageUrl: link.menuItem.imageUrl,
    });
  }

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    showInFront: c.showInFront !== false,
    sortOrder: c.sortOrder,
    products: productsByCategory.get(c.id) ?? [],
  }));
}

export async function applyFinalViewReorder(
  restaurantId: string,
  input: FinalViewReorderInput
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const categoryIds = input.categories.map((c) => c.id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    return { ok: false, error: 'Duplicate categories in payload.', status: 400 };
  }

  const owned = await db.menuCategory.findMany({
    where: { id: { in: categoryIds }, restaurantId },
    select: { id: true, showInFront: true },
  });
  if (owned.length !== categoryIds.length) {
    return {
      ok: false,
      error: 'One or more categories were not found.',
      status: 404,
    };
  }

  const ownedMap = new Map(owned.map((c) => [c.id, c]));
  for (const row of input.categories) {
    const cat = ownedMap.get(row.id);
    if (!cat) continue;
    const isFront = cat.showInFront !== false;
    if (input.tab === 'storefront' && !isFront) {
      return {
        ok: false,
        error: 'Storefront reorder includes a recommendation-only category.',
        status: 400,
      };
    }
    if (input.tab === 'recommendations' && isFront) {
      return {
        ok: false,
        error: 'Recommendation reorder includes a storefront category.',
        status: 400,
      };
    }
  }

  const allProductIds = [
    ...new Set(input.categories.flatMap((c) => c.productIds)),
  ];
  if (allProductIds.length > 0) {
    const productCount = await db.menuItem.count({
      where: { id: { in: allProductIds }, restaurantId },
    });
    if (productCount !== allProductIds.length) {
      return {
        ok: false,
        error: 'One or more products were not found.',
        status: 404,
      };
    }
  }

  await db.$transaction(async (tx) => {
    if (input.tab === 'storefront') {
      for (let i = 0; i < input.categories.length; i++) {
        await tx.menuCategory.update({
          where: { id: input.categories[i].id },
          data: { sortOrder: i },
        });
      }
    }

    for (const cat of input.categories) {
      const uniqueProductIds = [...new Set(cat.productIds)];
      for (let i = 0; i < uniqueProductIds.length; i++) {
        await tx.menuItemCategory.updateMany({
          where: {
            categoryId: cat.id,
            menuItemId: uniqueProductIds[i],
          },
          data: { sortOrder: i },
        });
      }
    }
  });

  return { ok: true };
}
