import { Prisma, type IngredientUnit } from '@prisma/client';

import { db } from '@/lib/db';

import { isPersonalizeModifierMenuItemId } from '@/lib/menu/personalize-modifiers';
import { INGREDIENT_UNIT_VALUES } from '@/lib/inventory/validation';
import {
  loadBranchStockQuantities,
  resolveBranchIdForStock,
} from '@/lib/inventory/branch-stock';
import { DEFAULT_UI_LANGUAGE } from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';

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
    const label =
      resolveBilingualText(ingredientName, DEFAULT_UI_LANGUAGE).trim() ||
      String(ingredientName ?? '').trim() ||
      'Ingredient';
    super(`${label} ingredient is not exist in stock`);
    this.name = 'MajorIngredientOutOfStockError';
    this.ingredientName = label;
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
> & {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
  $executeRaw: (query: Prisma.Sql) => Promise<number>;
};

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
    const vid = variationId?.trim() || null;
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

  const hasIngredientModel = 'ingredient' in (tx as Record<string, unknown>);
  const items = await tx.menuItem.findMany({
    where: {
      restaurantId: options.restaurantId,
      id: { in: menuItemIds },
    },
    select: {
      id: true,
      variations: { select: { id: true } },
      ...(hasIngredientModel
        ? {
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
          }
        : {}),
    },
  });
  const itemMap = new Map(
    items.map((i: any) => [
      i.id,
      { ...i, ingredientRecipes: i.ingredientRecipes ?? [] },
    ])
  );

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
 * One update for every ingredient on the order, then one catalog total refresh.
 * The old path ran three queries per ingredient and held the order transaction open.
 */
async function deductBranchIngredients(
  tx: InventoryTx,
  branchId: string,
  needed: Map<string, { name: string; needed: number; onHand: number }>,
  requireAvailableStock: boolean
): Promise<void> {
  const rows = [...needed.entries()].filter(([, row]) => row.needed > 0);
  if (rows.length === 0) return;

  const values = Prisma.join(
    rows.map(
      ([ingredientId, row]) =>
        Prisma.sql`(${ingredientId}, ${row.needed}::double precision)`
    )
  );

  const updated = await tx.$queryRaw<Array<{ ingredientId: string }>>(
    Prisma.sql`
      UPDATE "BranchIngredientStock" AS s
      SET quantity = s.quantity - v.amount,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM (VALUES ${values}) AS v(ingredient_id, amount)
      WHERE s."branchId" = ${branchId}
        AND s."ingredientId" = v.ingredient_id
        AND (
          ${requireAvailableStock} = FALSE
          OR s.quantity >= v.amount
        )
      RETURNING s."ingredientId" AS "ingredientId"
    `
  );

  if (requireAvailableStock) {
    const updatedIds = new Set(updated.map((row) => row.ingredientId));
    for (const [ingredientId, row] of rows) {
      if (!updatedIds.has(ingredientId)) {
        throw new MajorIngredientOutOfStockError(row.name);
      }
    }
  }

  const ids = rows.map(([ingredientId]) => ingredientId);
  await tx.$executeRaw(
    Prisma.sql`
      UPDATE "Ingredient" AS i
      SET quantity = COALESCE(sums.total, 0),
          "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        SELECT b."ingredientId" AS id, SUM(b.quantity) AS total
        FROM "BranchIngredientStock" b
        WHERE b."ingredientId" IN (${Prisma.join(ids)})
        GROUP BY b."ingredientId"
      ) AS sums
      WHERE i.id = sums.id
    `
  );
}

/**
 * Put an order's previous consumption back on the branch, then drop those
 * ledger rows so a later edit can deduct the new cart once.
 */
export async function restoreIngredientsForOrder(
  tx: InventoryTx,
  orderId: string
): Promise<void> {
  const entries = await tx.ingredientStockEntry.findMany({
    where: { orderId, source: 'ORDER' },
    select: { id: true, branchId: true, ingredientId: true, quantity: true },
  });
  if (entries.length === 0) return;

  const byBranch = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    if (!entry.branchId || !(entry.quantity > 0)) continue;
    const amounts = byBranch.get(entry.branchId) ?? new Map<string, number>();
    amounts.set(
      entry.ingredientId,
      (amounts.get(entry.ingredientId) ?? 0) + entry.quantity
    );
    byBranch.set(entry.branchId, amounts);
  }

  for (const [branchId, amounts] of byBranch) {
    const rows = [...amounts.entries()];
    if (rows.length === 0) continue;
    const values = Prisma.join(
      rows.map(
        ([ingredientId, amount]) =>
          Prisma.sql`(${ingredientId}, ${amount}::double precision)`
      )
    );
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "BranchIngredientStock" AS s
        SET quantity = s.quantity + v.amount,
            "updatedAt" = CURRENT_TIMESTAMP
        FROM (VALUES ${values}) AS v(ingredient_id, amount)
        WHERE s."branchId" = ${branchId}
          AND s."ingredientId" = v.ingredient_id
      `
    );
    const ids = rows.map(([ingredientId]) => ingredientId);
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Ingredient" AS i
        SET quantity = COALESCE(sums.total, 0),
            "updatedAt" = CURRENT_TIMESTAMP
        FROM (
          SELECT b."ingredientId" AS id, SUM(b.quantity) AS total
          FROM "BranchIngredientStock" b
          WHERE b."ingredientId" IN (${Prisma.join(ids)})
          GROUP BY b."ingredientId"
        ) AS sums
        WHERE i.id = sums.id
      `
    );
  }

  await tx.ingredientStockEntry.deleteMany({
    where: { id: { in: entries.map((entry) => entry.id) } },
  });
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

  await deductBranchIngredients(tx, branchId, needed, requireAvailableStock);

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
