'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';

import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getMinVariationPrice } from '@/lib/menu-item-pricing';
import {
  filterDecimalInput,
  filterNameTextInput,
} from '@/lib/validation/fields';

import { InventoryQuickActions } from './inventory-quick-actions';
import type {
  MenuCategoryRow,
  MenuItemRow,
  RestaurantVariationRow,
} from './types';

export type ProductFormState = {
  name: string;
  description: string;
  categoryId: string;
  imageUrl: string;
  price: string;
  salePrice: string;
};

export type VariationFormRow = {
  /** Synced from template; not edited on the product form. */
  name: string;
  priceDelta: string;
  imageUrl: string;
  restaurantVariationId?: string;
};

/** Shared list of restaurant variation templates (products + Variations page). */
export function useRestaurantVariationTemplates() {
  const [variationTemplates, setVariationTemplates] = useState<
    RestaurantVariationRow[]
  >([]);
  const [loading, setLoading] = useState(true);

  const reloadVariationTemplates = useCallback(async () => {
    try {
      const res = await axios.get<{ data: RestaurantVariationRow[] }>(
        '/api/restaurant/variations'
      );
      setVariationTemplates(res.data.data ?? []);
    } catch {
      setVariationTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadVariationTemplates();
  }, [reloadVariationTemplates]);

  return { variationTemplates, reloadVariationTemplates, loading };
}

type Props = {
  categories: MenuCategoryRow[];
  form: ProductFormState;
  onFormChange: (patch: Partial<ProductFormState>) => void;
  variationRows: VariationFormRow[];
  onVariationRowsChange: (rows: VariationFormRow[]) => void;
  /** Show asterisks on category, name, and price (create flow). */
  showRequired?: boolean;
  onMenuRefresh?: () => Promise<void>;
  variationTemplates?: RestaurantVariationRow[];
  onVariationTemplatesReload?: () => Promise<void>;
};

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <Label>
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );
}

function templateName(
  templates: RestaurantVariationRow[],
  id: string | undefined
) {
  if (!id) return '';
  return templates.find((t) => t.id === id)?.name ?? '';
}

function parseVariationRows(
  rows: VariationFormRow[],
  templates: RestaurantVariationRow[]
) {
  return rows
    .map((r) => {
      const name = templateName(templates, r.restaurantVariationId);
      return {
        name,
        priceDelta: Number(r.priceDelta),
        imageUrl: r.imageUrl.trim() || null,
        restaurantVariationId: r.restaurantVariationId || null,
      };
    })
    .filter((r) => r.restaurantVariationId && r.name.length > 0);
}

function isVariationRowValid(
  row: VariationFormRow,
  templates: RestaurantVariationRow[]
) {
  if (!row.restaurantVariationId) return false;
  if (!templates.some((t) => t.id === row.restaurantVariationId)) return false;
  const price = Number(row.priceDelta);
  return !Number.isNaN(price) && price > 0;
}

export function ProductFormFields({
  categories,
  form,
  onFormChange,
  variationRows,
  onVariationRowsChange,
  showRequired = false,
  onMenuRefresh,
  variationTemplates: variationTemplatesProp,
  onVariationTemplatesReload,
}: Props) {
  const internalTemplates = useRestaurantVariationTemplates();
  const variationTemplates =
    variationTemplatesProp ?? internalTemplates.variationTemplates;
  const reloadVariationTemplates =
    onVariationTemplatesReload ?? internalTemplates.reloadVariationTemplates;

  const usedTemplateIds = useMemo(
    () =>
      new Set(
        variationRows
          .map((r) => r.restaurantVariationId)
          .filter((id): id is string => Boolean(id))
      ),
    [variationRows]
  );

  const availableTemplates = useMemo(
    () => variationTemplates.filter((t) => !usedTemplateIds.has(t.id)),
    [variationTemplates, usedTemplateIds]
  );

  const validVariations = parseVariationRows(variationRows, variationTemplates);
  const hasVariations = validVariations.length > 0;
  const minVariation = hasVariations
    ? getMinVariationPrice(
        validVariations.map((v) => ({ priceDelta: v.priceDelta }))
      )
    : null;

  const updateVariation = (index: number, patch: Partial<VariationFormRow>) => {
    onVariationRowsChange(
      variationRows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleVariationCreated = (variation: RestaurantVariationRow) => {
    const alreadyUsed = variationRows.some(
      (r) => r.restaurantVariationId === variation.id
    );
    if (!alreadyUsed) {
      onVariationRowsChange([
        ...variationRows,
        {
          name: variation.name,
          priceDelta: '',
          imageUrl: '',
          restaurantVariationId: variation.id,
        },
      ]);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel required={showRequired}>Category</FieldLabel>
          <InventoryQuickActions
            variant="inline"
            showVariation={false}
            onMenuRefresh={onMenuRefresh}
            
            onCategoryCreated={(categoryId) =>
              onFormChange({ categoryId })
            }
          />
        </div>
        <Select
          value={form.categoryId}
          onValueChange={(v) => onFormChange({ categoryId: v })}
        >
          <SelectTrigger aria-required={showRequired || undefined}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.showInFront === false ? ' (configuration only)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 ">
        <FieldLabel required={showRequired}>Name</FieldLabel>
        <Input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={form.name}
          onChange={(e) =>
            onFormChange({ name: filterNameTextInput(e.target.value) })
          }
          placeholder="Product name"
          required={showRequired}
          aria-required={showRequired || undefined}
        />
      </div>

      <div className="grid gap-2 ">
        <Label>Description</Label>
        <textarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          placeholder="Optional description"
        />
      </div>

      <div >
        <Base64ImageUploadField
          label="Photo"
          value={form.imageUrl}
          onChange={(v) => onFormChange({ imageUrl: v })}
          helperText="Upload image stores base64 directly in the database."
        />
      </div>

      {!hasVariations ? (
        <div className="grid  grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <FieldLabel required={showRequired}>Price (€)</FieldLabel>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) =>
                onFormChange({ price: filterDecimalInput(e.target.value) })
              }
              required={showRequired}
              aria-required={showRequired || undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label>Sale price (optional)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="—"
              value={form.salePrice}
              onChange={(e) =>
                onFormChange({ salePrice: filterDecimalInput(e.target.value) })
              }
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Variable product pricing</p>
          <p className="mt-1 text-muted-foreground">
            Base price and sale price are hidden while variations exist. The menu
            shows{' '}
            <span className="font-medium text-foreground">
              From €{minVariation != null ? minVariation.toFixed(2) : '—'}
            </span>{' '}
            (lowest variation price).
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Label className="text-base">Variations</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a variation template, then set its price and photo. Menu list
              price uses the lowest variation price.
            </p>
          </div>
          <InventoryQuickActions
            variant="inline"
            showCategory={false}
            onVariationTemplatesReload={reloadVariationTemplates}
            onVariationCreated={handleVariationCreated}
          />
        </div>

        {variationTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No variation templates yet. Use &quot;Add variation&quot; above to
            create one, then assign it to this product.
          </p>
        ) : variationRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No variations on this product yet.
          </p>
        ) : (
          <div className="space-y-3">
            {variationRows.map((row, index) => {
              const selectableTemplates = [
                ...variationTemplates.filter(
                  (t) =>
                    t.id === row.restaurantVariationId ||
                    !usedTemplateIds.has(t.id)
                ),
              ];
              const selectedTemplate = variationTemplates.find(
                (t) => t.id === row.restaurantVariationId
              );
              return (
                <div
                  key={`variation-${row.restaurantVariationId ?? index}`}
                  className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1fr),120px,1fr,auto]"
                >
                  <div className="grid gap-1">
                    <FieldLabel required={showRequired}>Variation</FieldLabel>
                    <Select
                      value={row.restaurantVariationId ?? ''}
                      onValueChange={(v) => {
                        const tpl = variationTemplates.find((t) => t.id === v);
                        updateVariation(index, {
                          restaurantVariationId: v,
                          name: tpl?.name ?? '',
                        });
                      }}
                    >
                      <SelectTrigger aria-required={showRequired || undefined}>
                        <SelectValue placeholder="Select variation" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.shortLabel ? ` (${t.shortLabel})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <FieldLabel required={showRequired}>Price (€)</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.priceDelta}
                      onChange={(e) =>
                        updateVariation(index, {
                          priceDelta: filterDecimalInput(e.target.value),
                        })
                      }
                      required={showRequired}
                      aria-required={showRequired || undefined}
                    />
                  </div>
                  <Base64ImageUploadField
                    label="Photo"
                    value={row.imageUrl}
                    onChange={(v) => updateVariation(index, { imageUrl: v })}
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() =>
                        onVariationRowsChange(
                          variationRows.filter((_, i) => i !== index)
                        )
                      }
                      aria-label="Remove variation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={
            variationTemplates.length === 0 || availableTemplates.length === 0
          }
          onClick={() => {
            const next = availableTemplates[0];
            if (!next) return;
            onVariationRowsChange([
              ...variationRows,
              {
                name: next.name,
                priceDelta: '',
                imageUrl: '',
                restaurantVariationId: next.id,
              },
            ]);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add variation to product
        </Button>
      </div>
    </div>
  );
}

export function productFormStateFromItem(item: MenuItemRow): ProductFormState {
  return {
    name: item.name,
    description: item.description ?? '',
    categoryId: item.categoryId,
    imageUrl: item.imageUrl ?? '',
    price: String(item.price),
    salePrice: item.salePrice != null ? String(item.salePrice) : '',
  };
}

export function variationRowsFromItem(item: MenuItemRow): VariationFormRow[] {
  return (item.variations ?? []).map((v) => ({
    name: (v.name ?? v.title ?? '').trim(),
    priceDelta: String(v.priceDelta),
    imageUrl: v.imageUrl ?? '',
    restaurantVariationId: v.restaurantVariationId ?? undefined,
  }));
}

function formStatesEqual(a: ProductFormState, b: ProductFormState) {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.categoryId === b.categoryId &&
    a.imageUrl === b.imageUrl &&
    a.price === b.price &&
    a.salePrice === b.salePrice
  );
}

function variationRowsEqual(a: VariationFormRow[], b: VariationFormRow[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.restaurantVariationId === b[i].restaurantVariationId &&
      row.priceDelta === b[i].priceDelta &&
      row.imageUrl === b[i].imageUrl
  );
}

export function isProductEditFormDirty(
  initial: { form: ProductFormState; variationRows: VariationFormRow[] },
  current: { form: ProductFormState; variationRows: VariationFormRow[] }
): boolean {
  return (
    !formStatesEqual(initial.form, current.form) ||
    !variationRowsEqual(initial.variationRows, current.variationRows)
  );
}

export function isProductFormValid(
  form: ProductFormState,
  variationRows: VariationFormRow[],
  variationTemplates: RestaurantVariationRow[] = []
): boolean {
  if (!form.name.trim() || !form.categoryId) return false;

  if (variationRows.length > 0) {
    return variationRows.every((row) =>
      isVariationRowValid(row, variationTemplates)
    );
  }

  const price = Number(form.price);
  if (Number.isNaN(price) || price <= 0) return false;

  const sale =
    form.salePrice.trim() === '' ? null : Number(form.salePrice);
  if (sale != null && (Number.isNaN(sale) || sale <= 0)) return false;

  return true;
}

export function isProductCreateFormDirty(
  form: ProductFormState,
  variationRows: VariationFormRow[]
): boolean {
  if (
    form.name.trim() ||
    form.description.trim() ||
    form.imageUrl.trim() ||
    form.price.trim() ||
    form.salePrice.trim() ||
    form.categoryId.trim()
  ) {
    return true;
  }
  return variationRows.some(
    (r) =>
      r.restaurantVariationId ||
      r.priceDelta.trim() ||
      r.imageUrl.trim()
  );
}

export function buildProductPayload(
  form: ProductFormState,
  variationRows: VariationFormRow[],
  variationTemplates: RestaurantVariationRow[] = []
): {
  ok: true;
  body: {
    name: string;
    description: string | null;
    categoryId: string;
    imageUrl: string | null;
    price: number;
    salePrice: number | null;
    variations?: {
      name: string;
      imageUrl: string | null;
      priceDelta: number;
      restaurantVariationId?: string | null;
    }[];
  };
} | { ok: false; error: string } {
  if (!form.name.trim() || !form.categoryId) {
    return { ok: false, error: 'Name and category are required.' };
  }

  const variations = parseVariationRows(variationRows, variationTemplates).map(
    (v) => ({
    name: v.name,
    imageUrl: v.imageUrl,
    priceDelta: v.priceDelta,
    restaurantVariationId: v.restaurantVariationId,
  })
  );

  if (variations.some((v) => Number.isNaN(v.priceDelta) || v.priceDelta <= 0)) {
    return {
      ok: false,
      error: 'Every variation needs a valid price greater than zero.',
    };
  }

  const hasVariations = variations.length > 0;

  if (hasVariations) {
    const minPrice = Math.min(...variations.map((v) => v.priceDelta));
    return {
      ok: true,
      body: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId,
        imageUrl: form.imageUrl.trim() || null,
        price: minPrice,
        salePrice: null,
        variations,
      },
    };
  }

  const price = Number(form.price);
  if (Number.isNaN(price) || price <= 0) {
    return { ok: false, error: 'Enter a valid price greater than zero.' };
  }
  const sale =
    form.salePrice.trim() === '' ? null : Number(form.salePrice);
  if (sale != null && (Number.isNaN(sale) || sale <= 0)) {
    return {
      ok: false,
      error: 'Sale price must be empty or a positive number.',
    };
  }

  return {
    ok: true,
    body: {
      name: form.name.trim(),
      description: form.description.trim() || null,
      categoryId: form.categoryId,
      imageUrl: form.imageUrl.trim() || null,
      price,
      salePrice: sale,
    },
  };
}
