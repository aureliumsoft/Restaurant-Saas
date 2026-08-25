'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatIngredientUnit } from '@/lib/inventory/stock';
import { filterDecimalInput } from '@/lib/validation/fields';

import type { MenuItemRow, RestaurantVariationRow } from './types';

type VariationLink = {
  name: string;
  restaurantVariationId?: string;
};

export type IngredientRecipeRow = {
  ingredientId: string;
  quantity: string;
  restaurantVariationId: string | null;
};

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
};

export function emptyIngredientRecipeRow(
  restaurantVariationId: string | null = null
): IngredientRecipeRow {
  return { ingredientId: '', quantity: '', restaurantVariationId };
}

export function ingredientRowsFromItem(item: MenuItemRow): IngredientRecipeRow[] {
  return (item.ingredientRecipes ?? []).map((r) => ({
    ingredientId: r.ingredientId,
    quantity: String(r.quantity),
    restaurantVariationId: r.variation?.restaurantVariationId ?? null,
  }));
}

export function ingredientRowsEqual(
  a: IngredientRecipeRow[],
  b: IngredientRecipeRow[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.ingredientId === b[i].ingredientId &&
      row.quantity === b[i].quantity &&
      row.restaurantVariationId === b[i].restaurantVariationId
  );
}

export function isIngredientRowsValid(rows: IngredientRecipeRow[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const empty = !row.ingredientId && !row.quantity.trim();
    if (empty) continue;
    const qty = Number(row.quantity);
    if (!row.ingredientId || !Number.isFinite(qty) || qty <= 0) return false;
    const key = `${row.restaurantVariationId ?? 'simple'}:${row.ingredientId}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

export function serializeIngredientPayload(
  rows: IngredientRecipeRow[],
  hasVariations: boolean
): Array<{
  ingredientId: string;
  quantity: number;
  restaurantVariationId?: string | null;
}> {
  return rows
    .filter((row) => row.ingredientId && row.quantity.trim())
    .map((row) => ({
      ingredientId: row.ingredientId,
      quantity: Number(row.quantity),
      restaurantVariationId: hasVariations
        ? row.restaurantVariationId
        : null,
    }))
    .filter((row) => Number.isFinite(row.quantity) && row.quantity > 0)
    .filter((row) => !hasVariations || Boolean(row.restaurantVariationId));
}

export function syncIngredientRowsWithVariations(
  prevVariations: VariationLink[],
  nextVariations: VariationLink[],
  ingredientRows: IngredientRecipeRow[]
): IngredientRecipeRow[] {
  const prevIds = prevVariations
    .map((r) => r.restaurantVariationId)
    .filter((id): id is string => Boolean(id));
  const nextIds = nextVariations
    .map((r) => r.restaurantVariationId)
    .filter((id): id is string => Boolean(id));

  let rows = ingredientRows;

  if (prevIds.length === 0 && nextIds.length > 0) {
    const first = nextIds[0]!;
    rows = rows.map((r) =>
      r.restaurantVariationId == null
        ? { ...r, restaurantVariationId: first }
        : r
    );
  }

  if (prevIds.length > 0 && nextIds.length === 0) {
    const seen = new Set<string>();
    const collapsed: IngredientRecipeRow[] = [];
    for (const r of rows) {
      if (!r.ingredientId || seen.has(r.ingredientId)) continue;
      seen.add(r.ingredientId);
      collapsed.push({ ...r, restaurantVariationId: null });
    }
    rows = collapsed;
  }

  const nextSet = new Set(nextIds);
  rows = rows.filter(
    (r) =>
      r.restaurantVariationId == null || nextSet.has(r.restaurantVariationId)
  );

  if (prevVariations.length === nextVariations.length) {
    for (let i = 0; i < prevVariations.length; i++) {
      const oldId = prevVariations[i]?.restaurantVariationId;
      const newId = nextVariations[i]?.restaurantVariationId;
      if (oldId && newId && oldId !== newId) {
        rows = rows.map((r) =>
          r.restaurantVariationId === oldId
            ? { ...r, restaurantVariationId: newId }
            : r
        );
      }
    }
  }

  return rows;
}

export function ProductIngredientRecipes({
  variationRows,
  variationTemplates,
  ingredientRows,
  onIngredientRowsChange,
}: {
  variationRows: VariationLink[];
  variationTemplates: RestaurantVariationRow[];
  ingredientRows: IngredientRecipeRow[];
  onIngredientRowsChange: (rows: IngredientRecipeRow[]) => void;
}) {
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void axios
      .get<{ data: IngredientOption[] }>(
        '/api/restaurant/inventory/ingredients',
        { params: { page: 1, limit: 100, active: '1' } }
      )
      .then((res) => {
        if (!cancelled) setIngredients(res.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setIngredients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const optionsForRow = useCallback(
    (currentId: string, usedInSection: Set<string>) => {
      const list = [...ingredients];
      if (currentId && !list.some((i) => i.id === currentId)) {
        list.push({
          id: currentId,
          name: 'Ingredient',
          unit: 'PCS',
          quantity: 0,
        });
      }
      return list
        .filter((i) => i.id === currentId || !usedInSection.has(i.id))
        .map((i) => ({
          value: i.id,
          label: i.name,
          hint: `${i.quantity} ${formatIngredientUnit(i.unit)}`,
        }));
    },
    [ingredients]
  );

  const hasVariations = variationRows.some((r) => r.restaurantVariationId);
  const sections = hasVariations
    ? variationRows
        .filter((r) => r.restaurantVariationId)
        .map((r) => ({
          key: r.restaurantVariationId as string,
          title:
            variationTemplates.find((t) => t.id === r.restaurantVariationId)
              ?.name ?? r.name,
        }))
    : [{ key: null as string | null, title: 'Product' }];

  const updateRow = (
    index: number,
    patch: Partial<IngredientRecipeRow>
  ) => {
    onIngredientRowsChange(
      ingredientRows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const renderRows = (
    variationId: string | null,
    title: string
  ) => {
    const indexes = ingredientRows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) =>
        variationId
          ? row.restaurantVariationId === variationId
          : row.restaurantVariationId == null
      );
    const used = new Set(
      indexes.map(({ row }) => row.ingredientId).filter(Boolean)
    );

    return (
      <div key={variationId ?? 'simple'} className="space-y-3">
        {hasVariations ? (
          <p className="text-sm font-medium">{title}</p>
        ) : null}
        {indexes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ingredients on this {hasVariations ? 'variation' : 'product'} yet.
          </p>
        ) : (
          <div className="space-y-2">
            {indexes.map(({ row, i }) => (
              <div
                key={`${variationId ?? 'simple'}-${i}`}
                className="grid gap-2 sm:grid-cols-[minmax(0,1fr),120px,auto]"
              >
                <SearchableSelect
                  value={row.ingredientId}
                  onChange={(ingredientId) => updateRow(i, { ingredientId })}
                  options={optionsForRow(row.ingredientId, used)}
                  placeholder="Select ingredient"
                  searchPlaceholder="Search ingredient…"
                />
                <Input
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(i, {
                      quantity: filterDecimalInput(e.target.value),
                    })
                  }
                  inputMode="decimal"
                  placeholder="Qty"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() =>
                    onIngredientRowsChange(
                      ingredientRows.filter((_, idx) => idx !== i)
                    )
                  }
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onIngredientRowsChange([
              ...ingredientRows,
              emptyIngredientRecipeRow(variationId),
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add ingredient
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base">Ingredients</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasVariations
            ? 'Set a recipe for each variation. Orders deduct these quantities from inventory.'
            : 'Link ingredients used by this product. Orders deduct these quantities from inventory.'}
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading ingredients…</p>
      ) : ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ingredients yet.{' '}
          <Link href="/inventory" className="underline underline-offset-2">
            Add them in Inventory
          </Link>{' '}
          first.
        </p>
      ) : null}
      <div className="space-y-6">
        {sections.map((section) => renderRows(section.key, section.title))}
      </div>
    </div>
  );
}
