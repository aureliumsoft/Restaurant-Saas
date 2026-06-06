'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecommendationFormVariant } from '@/lib/menu/recommendation-preview-groups';

import { RecommendationConfigSectionShell } from './recommendation-config-section-shell';
import {
  RecommendationRuleForm,
  type RecommendationRuleDraft,
} from './recommendation-rule-form';
import type { AttrGroupRow, MenuCategoryRow, MenuItemRow } from './types';

type ProductWithCategory = MenuItemRow & { categoryName: string };

type Props = {
  selected: ProductWithCategory;
  localCategories: MenuCategoryRow[];
  allProducts: ProductWithCategory[];
  linkedOptions: MenuCategoryRow[];
  savedGroupsByType: {
    categorySingle: AttrGroupRow[];
    categoryMultiple: AttrGroupRow[];
    productSingle: AttrGroupRow[];
    productMultiple: AttrGroupRow[];
  };
  savingRules: boolean;
  onSaveDraft: (draft: RecommendationRuleDraft) => void;
  draftChangeHandlers: Record<
    RecommendationFormVariant,
    (draft: RecommendationRuleDraft) => void
  >;
  onDeleteGroup: (groupId: string) => void;
  offerCategoryIds: string[];
  setOfferCategoryIds: Dispatch<SetStateAction<string[]>>;
  selectedOfferProductIds: string[];
  setSelectedOfferProductIds: Dispatch<SetStateAction<string[]>>;
  offeredProductsFromSelectedCategories: ProductWithCategory[];
  currentOffers: NonNullable<MenuItemRow['offersFromThis']>;
  savingOffers: boolean;
  onSaveOffers: () => void;
  onDeleteOffer: (offerId: string) => void;
  deletingOffer: boolean;
  deletingOfferId: string | null;
  toggleInArray: (arr: string[], id: string) => string[];
};

function SavedGroupList({
  groups,
  onDelete,
}: {
  groups: AttrGroupRow[];
  onDelete: (groupId: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved rules in this section yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li
          key={g.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">{g.name}</p>
            <p className="text-xs text-muted-foreground">
              {g.sourceType === 'PRODUCT'
                ? `Product · ${g.linkedProduct?.name ?? '—'}`
                : `Category · ${g.linkedCategory?.name ?? '—'}`}
              {g.required ? ' · Required' : ' · Optional'}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 text-destructive"
            onClick={() => onDelete(g.id)}
            aria-label="Remove rule"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function RecommendationConfigSections({
  selected,
  localCategories,
  allProducts,
  linkedOptions,
  savedGroupsByType,
  savingRules,
  onSaveDraft,
  draftChangeHandlers,
  onDeleteGroup,
  offerCategoryIds,
  setOfferCategoryIds,
  selectedOfferProductIds,
  setSelectedOfferProductIds,
  offeredProductsFromSelectedCategories,
  currentOffers,
  savingOffers,
  onSaveOffers,
  onDeleteOffer,
  deletingOffer,
  deletingOfferId,
  toggleInArray,
}: Props) {
  const formProps = {
    selected,
    localCategories,
    allProducts,
    saving: savingRules,
    onSave: onSaveDraft,
  };

  return (
    <div className="space-y-5">
      <RecommendationConfigSectionShell
        step={1}
        title="Category · single selection"
        description="Guests pick one item from each linked category. Set a default item for delta pricing."
      >
        <SavedGroupList
          groups={savedGroupsByType.categorySingle}
          onDelete={onDeleteGroup}
        />
        <RecommendationRuleForm
          variant="category-single"
          {...formProps}
          onDraftChange={draftChangeHandlers['category-single']}
        />
      </RecommendationConfigSectionShell>

      <RecommendationConfigSectionShell
        step={2}
        title="Category · multiple selection"
        description="Guests pick several items (checkboxes or quantities) from linked categories."
      >
        <SavedGroupList
          groups={savedGroupsByType.categoryMultiple}
          onDelete={onDeleteGroup}
        />
        <RecommendationRuleForm
          variant="category-multiple"
          {...formProps}
          onDraftChange={draftChangeHandlers['category-multiple']}
        />
      </RecommendationConfigSectionShell>

      <RecommendationConfigSectionShell
        step={3}
        title="Product · single selection"
        description="Link one anchor product from selected categories (e.g. a drink or side)."
      >
        <SavedGroupList
          groups={savedGroupsByType.productSingle}
          onDelete={onDeleteGroup}
        />
        <RecommendationRuleForm
          variant="product-single"
          {...formProps}
          onDraftChange={draftChangeHandlers['product-single']}
        />
      </RecommendationConfigSectionShell>

      <RecommendationConfigSectionShell
        step={4}
        title="Product · multiple selection"
        description="Assign several products at once — each becomes its own configuration group."
      >
        <SavedGroupList
          groups={savedGroupsByType.productMultiple}
          onDelete={onDeleteGroup}
        />
        <RecommendationRuleForm
          variant="product-multiple"
          {...formProps}
          onDraftChange={draftChangeHandlers['product-multiple']}
        />
      </RecommendationConfigSectionShell>

      <RecommendationConfigSectionShell
        step={5}
        title="Associated products"
        description="Optional cross-sell items shown with this product. Select categories, then pick products."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {linkedOptions.map((cat) => {
            const checked = offerCategoryIds.includes(cat.id);
            return (
              <label
                key={`offer-cat-${cat.id}`}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm',
                  checked ? 'border-primary bg-primary/10' : 'border-border'
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => {
                    setOfferCategoryIds((prev) => toggleInArray(prev, cat.id));
                    setSelectedOfferProductIds([]);
                  }}
                >
                  {cat.name}
                </button>
              </label>
            );
          })}
        </div>

        {offerCategoryIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select at least one category to load products.
          </p>
        ) : offeredProductsFromSelectedCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products found in selected categories (or already offered).
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offeredProductsFromSelectedCategories.map((p) => {
              const checked = selectedOfferProductIds.includes(p.id);
              return (
                <label
                  key={`offer-product-${p.id}`}
                  className="group relative block cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    onChange={() =>
                      setSelectedOfferProductIds((prev) =>
                        toggleInArray(prev, p.id)
                      )
                    }
                  />
                  <div
                    className={cn(
                      'flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md',
                      checked
                        ? 'border-primary ring-2 ring-primary/25'
                        : 'border-border'
                    )}
                  >
                    <div className="relative aspect-[4/3] w-full shrink-0 bg-muted">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.categoryName}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          onClick={onSaveOffers}
          disabled={savingOffers || selectedOfferProductIds.length === 0}
          className="w-full"
        >
          {savingOffers ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save associated products
            </>
          )}
        </Button>

        {currentOffers.length > 0 ? (
          <ul className="space-y-2 border-t border-border pt-4">
            {currentOffers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {offer.offeredItem.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offer.offeredItem.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
                      —
                    </div>
                  )}
                  <span className="font-medium">{offer.offeredItem.name}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onDeleteOffer(offer.id)}
                  disabled={deletingOffer && deletingOfferId === offer.id}
                  aria-label="Remove associated product"
                >
                  {deletingOffer && deletingOfferId === offer.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </RecommendationConfigSectionShell>
    </div>
  );
}
