import type { Prisma } from '@prisma/client';

export type RecipeInput = {
  ingredientId: string;
  quantity: number;
  restaurantVariationId?: string | null;
};

type RecipeTx = {
  ingredient: {
    findMany: (args: {
      where: { restaurantId: string; id: { in: string[] }; isActive: boolean };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
  menuItemIngredient: {
    deleteMany: (args: { where: { menuItemId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.MenuItemIngredientCreateManyInput[];
    }) => Promise<unknown>;
  };
};

export async function syncMenuItemIngredients(
  tx: RecipeTx,
  options: {
    restaurantId: string;
    menuItemId: string;
    variations: Array<{ id: string; restaurantVariationId: string | null }>;
    recipes: RecipeInput[];
  }
): Promise<void> {
  const hasVariations = options.variations.length > 0;
  const variationByTemplate = new Map<string, string>();
  for (const v of options.variations) {
    if (v.restaurantVariationId) {
      variationByTemplate.set(v.restaurantVariationId, v.id);
    }
  }

  const cleaned: Prisma.MenuItemIngredientCreateManyInput[] = [];
  const seen = new Set<string>();

  for (const [index, raw] of options.recipes.entries()) {
    const ingredientId = raw.ingredientId?.trim();
    const quantity = Number(raw.quantity);
    if (!ingredientId) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Ingredient quantity must be greater than zero.');
    }

    let menuItemVariationId: string | null = null;
    if (hasVariations) {
      const templateId = raw.restaurantVariationId?.trim() || '';
      const variationId = variationByTemplate.get(templateId);
      if (!variationId) {
        throw new Error(
          'Each ingredient must be linked to a product variation.'
        );
      }
      menuItemVariationId = variationId;
    } else if (raw.restaurantVariationId) {
      throw new Error(
        'This product has no variations. Remove variation from ingredient rows.'
      );
    }

    const key = `${menuItemVariationId ?? 'simple'}:${ingredientId}`;
    if (seen.has(key)) {
      throw new Error('Duplicate ingredient on the same product or variation.');
    }
    seen.add(key);

    cleaned.push({
      menuItemId: options.menuItemId,
      menuItemVariationId,
      ingredientId,
      quantity,
      sortOrder: index,
    });
  }

  if (cleaned.length > 0) {
    const ids = [...new Set(cleaned.map((r) => r.ingredientId))];
    const found = await tx.ingredient.findMany({
      where: {
        restaurantId: options.restaurantId,
        id: { in: ids },
        isActive: true,
      },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new Error('One or more ingredients are invalid for this restaurant.');
    }
  }

  await tx.menuItemIngredient.deleteMany({
    where: { menuItemId: options.menuItemId },
  });

  if (cleaned.length > 0) {
    await tx.menuItemIngredient.createMany({ data: cleaned });
  }
}

export const recipeInputSchemaShape = {
  ingredientId: true,
  quantity: true,
  restaurantVariationId: true,
} as const;
