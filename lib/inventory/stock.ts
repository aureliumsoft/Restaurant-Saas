import type { IngredientUnit, Prisma } from '@prisma/client';

import { db } from '@/lib/db';

import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { INGREDIENT_UNIT_VALUES } from '@/lib/inventory/validation';
import {
  decrementBranchIngredientStock,
  loadBranchStockQuantities,
  resolveBranchIdForStock,
} from '@/lib/inventory/branch-stock';

export const INGREDIENT_UNITS: IngredientUnit[] = [...INGREDIENT_UNIT_VALUES];

export function formatIngredientUnit(unit: IngredientUnit | string): string {
  switch (unit) {
    case 'PCS':
      return 'pcs';
    case 'G':
      return 'g';
    case 'KG':
      return 'kg';
    case 'ML':
      return 'ml';
    case 'L':
      return 'L';
    default:
      return String(unit);
  }
}

export class MajorIngredientOutOfStockError extends Error {
  ingredientName: string;

  constructor(ingredientName: string) {
    super(`${ingredientName} ingredient is not exist in stock`);
    this.name = 'MajorIngredientOutOfStockError';
    this.ingredientName = ingredientName;
  }
}

export type StockOrderModifierGroup = {
  selections: Array<{
    menuItemId?: string | null;
    variationId?: string | null;
  }>;
};

export type StockOrderLine = {
  menuItemId: string;
  quantity: number;
  variationId?: string | null;
  modifiers?: StockOrderModifierGroup[];
};

type RecipeIngredient = {
  id: string;
  name: string;
  isMajor: boolean;
  isActive: boolean;
};

type RecipeRow = {
  quantity: number;
  menuItemVariationId: string | null;
  ingredientId: string;
  ingredient: RecipeIngredient;
};

type MenuItemWithRecipes = {
  id: string;
  variations: Array<{ id: string }>;
  ingredientRecipes: RecipeRow[];
};

type InventoryReadTx = Pick<typeof db, 'menuItem' | 'branchIngredientStock'>;

type InventoryTx = Pick<
  typeof db,
  'menuItem' | 'ingredient' | 'branchIngredientStock' | 'ingredientStockEntry'
>;

function collectMenuItemIds(lines: StockOrderLine[]): string[] {
  const ids = new Set<string>();
  for (const line of lines) {
    if (line.menuItemId) ids.add(line.menuItemId);
    for (const group of line.modifiers ?? []) {
      for (const sel of group.selections) {
        const id = sel.menuItemId?.trim();
        if (!id || isPersonalizeModifierMenuItemId(id)) continue;
        ids.add(id);
      }
    }
  }
  return [...ids];
}

function recipesForLine(
  item: MenuItemWithRecipes,
  variationId: string | null | undefined,
  strictVariation: boolean
) {
  if (item.variations.length > 0) {
    const vid = variationId?.trim() || item.variations[0]?.id || null;
    if (!vid) {
      if (strictVariation) {
        throw new Error('Select a variation for this product.');
      }
      return recipesForAddon(item, vid);
    }
    return item.ingredientRecipes.filter((r) => r.menuItemVariationId === vid);
  }
  return item.ingredientRecipes.filter((r) => r.menuItemVariationId == null);
}

/** Addon/recommendation products may be simple or variation-based. */
function recipesForAddon(
  item: MenuItemWithRecipes,
  variationId: string | null | undefined
) {
  const vid = variationId?.trim() || null;
  if (vid) {
    const matched = item.ingredientRecipes.filter(
      (r) => r.menuItemVariationId === vid
    );
    if (matched.length > 0) return matched;
  }
  const simple = item.ingredientRecipes.filter(
    (r) => r.menuItemVariationId == null
  );
  if (simple.length > 0) return simple;
  const firstVar = item.variations[0]?.id;
  if (!firstVar) return [];
  return item.ingredientRecipes.filter(
    (r) => r.menuItemVariationId === firstVar
  );
}

async function applyBranchOnHand(
  tx: InventoryReadTx,
  branchId: string,
  needed: Map<string, { name: string; needed: number; onHand: number }>
): Promise<void> {
  const ids = [...needed.keys()];
  const stockMap = await loadBranchStockQuantities(tx, branchId, ids);
  for (const [ingredientId, row] of needed) {
    row.onHand = stockMap.get(ingredientId) ?? 0;
  }
}

/**
 * Plan recipe usage for cart lines. Throws if a variation is required and missing.
 */
async function computeIngredientPlan(
  tx: InventoryReadTx,
  options: {
    restaurantId: string;
    branchId: string;
    lines: StockOrderLine[];
    requireVariation: boolean;
  }
): Promise<{
  needed: Map<string, { name: string; needed: number; onHand: number }>;
  parts: Map<
    string,
    {
      ingredientId: string;
      menuItemId: string;
      menuItemVariationId: string | null;
      quantity: number;
    }
  >;
}> {
  const menuItemIds = collectMenuItemIds(options.lines);
  const needed = new Map<
    string,
    { name: string; needed: number; onHand: number }
  >();
  const parts = new Map<
    string,
    {
      ingredientId: string;
      menuItemId: string;
      menuItemVariationId: string | null;
      quantity: number;
    }
  >();
  if (menuItemIds.length === 0) return { needed, parts };

  const items = await tx.menuItem.findMany({
    where: {
      restaurantId: options.restaurantId,
      id: { in: menuItemIds },
    },
    select: {
      id: true,
      variations: { select: { id: true } },
      ingredientRecipes: {
        select: {
          quantity: true,
          menuItemVariationId: true,
          ingredientId: true,
          ingredient: {
            select: {
              id: true,
              name: true,
              isMajor: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const addNeeded = (
    recipeQty: number,
    lineQty: number,
    ingredient: RecipeIngredient,
    menuItemId: string,
    variationId: string | null
  ) => {
    if (!ingredient.isActive) return;
    const amount = recipeQty * lineQty;
    if (!(amount > 0)) return;
    const prev = needed.get(ingredient.id);
    if (prev) {
      prev.needed += amount;
    } else {
      needed.set(ingredient.id, {
        name: ingredient.name,
        needed: amount,
        onHand: 0,
      });
    }
    const partKey = `${ingredient.id}|${menuItemId}|${variationId ?? ''}`;
    const part = parts.get(partKey);
    if (part) {
      part.quantity += amount;
    } else {
      parts.set(partKey, {
        ingredientId: ingredient.id,
        menuItemId,
        menuItemVariationId: variationId,
        quantity: amount,
      });
    }
  };

  for (const line of options.lines) {
    const item = itemMap.get(line.menuItemId);
    const lineVariationId = line.variationId?.trim() || null;
    if (item) {
      for (const recipe of recipesForLine(
        item,
        line.variationId,
        options.requireVariation
      )) {
        addNeeded(
          recipe.quantity,
          line.quantity,
          recipe.ingredient,
          line.menuItemId,
          lineVariationId
        );
      }
    }
    for (const group of line.modifiers ?? []) {
      for (const sel of group.selections) {
        const addonId = sel.menuItemId?.trim();
        if (!addonId || isPersonalizeModifierMenuItemId(addonId)) continue;
        const addon = itemMap.get(addonId);
        if (!addon) continue;
        const addonVariationId = sel.variationId?.trim() || null;
        for (const recipe of recipesForAddon(addon, addonVariationId)) {
          addNeeded(
            recipe.quantity,
            line.quantity,
            recipe.ingredient,
            addonId,
            addonVariationId
          );
        }
      }
    }
  }

  await applyBranchOnHand(tx, options.branchId, needed);

  return { needed, parts };
}

/** Throws MajorIngredientOutOfStockError if any recipe ingredient is short at this branch. */
export async function assertIngredientsAvailableForOrder(
  tx: InventoryReadTx,
  options: {
    restaurantId: string;
    branchId?: string | null;
    lines: StockOrderLine[];
    requireVariation?: boolean;
  }
): Promise<void> {
  const branchId = await resolveBranchIdForStock(
    options.restaurantId,
    options.branchId
  );
  if (!branchId) {
    throw new Error('No branch configured for inventory.');
  }

  const { needed } = await computeIngredientPlan(tx, {
    restaurantId: options.restaurantId,
    branchId,
    lines: options.lines,
    requireVariation: options.requireVariation !== false,
  });
  for (const row of needed.values()) {
    if (row.onHand < row.needed) {
      throw new MajorIngredientOutOfStockError(row.name);
    }
  }
}

/**
 * Deduct recipe quantities for an order from the order branch only.
 */
export async function consumeIngredientsForOrder(
  tx: InventoryTx,
  options: {
    restaurantId: string;
    branchId?: string | null;
    orderId: string;
    lines: StockOrderLine[];
    createdByUserId?: string | null;
    requireAvailableStock?: boolean;
    requireVariation?: boolean;
  }
): Promise<void> {
  const requireAvailableStock = options.requireAvailableStock !== false;
  const requireVariation = options.requireVariation !== false;
  const branchId = await resolveBranchIdForStock(
    options.restaurantId,
    options.branchId
  );
  if (!branchId) {
    throw new Error('No branch configured for inventory.');
  }

  const { needed, parts } = await computeIngredientPlan(tx, {
    restaurantId: options.restaurantId,
    branchId,
    lines: options.lines,
    requireVariation,
  });

  if (needed.size === 0) return;

  if (requireAvailableStock) {
    for (const row of needed.values()) {
      if (row.onHand < row.needed) {
        throw new MajorIngredientOutOfStockError(row.name);
      }
    }
  }

  for (const [ingredientId, row] of needed) {
    const deduct = row.needed;
    if (!(deduct > 0)) continue;
    const ok = await decrementBranchIngredientStock(tx, {
      branchId,
      ingredientId,
      amount: deduct,
      requireAvailable: requireAvailableStock,
    });
    if (requireAvailableStock && !ok) {
      throw new MajorIngredientOutOfStockError(row.name);
    }
  }

  const entries: Prisma.IngredientStockEntryCreateManyInput[] = [];
  for (const part of parts.values()) {
    if (!(part.quantity > 0)) continue;
    entries.push({
      restaurantId: options.restaurantId,
      branchId,
      ingredientId: part.ingredientId,
      menuItemId: part.menuItemId,
      menuItemVariationId: part.menuItemVariationId,
      quantity: part.quantity,
      reason: 'Order consumption',
      source: 'ORDER',
      orderId: options.orderId,
      createdByUserId: options.createdByUserId ?? null,
    });
  }

  if (entries.length > 0) {
    await tx.ingredientStockEntry.createMany({ data: entries });
  }
}

export function isMajorIngredientOutOfStockError(
  e: unknown
): e is MajorIngredientOutOfStockError {
  return e instanceof MajorIngredientOutOfStockError;
}
