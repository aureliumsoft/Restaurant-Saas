'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ChevronLeft,
  ChevronRight,
  Cross,
  ListFilter,
  Loader2,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DeleteConfirmation,
  SaveConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { filterCategoriesWithProducts } from '@/lib/menu/category-visibility';
import { effectiveMenuItemUnitPrice } from '@/lib/menu/recommendation-addon-price';

import {
  buildDraftPreviewGroups,
  draftHasContent,
  RECOMMENDATION_FORM_VARIANTS,
  RECOMMENDATION_SECTION_LABELS,
  type RecommendationFormVariant,
  type PreviewAttrGroup,
} from '@/lib/menu/recommendation-preview-groups';

import { RecommendationConfigSections } from './recommendation-config-sections';
import { RecommendationPreviewPanel } from './recommendation-preview-panel';
import type { RecommendationRuleDraft } from './recommendation-rule-form';
import type { AttrGroupRow, MenuCategoryRow, MenuItemRow } from './types';

function effectiveUnitPrice(price: number, salePrice: number | null) {
  return effectiveMenuItemUnitPrice(price, salePrice);
}

function validateRecommendationDraft(
  draft: RecommendationRuleDraft,
  localCategories: MenuCategoryRow[], 
  selected: MenuItemRow
): string | null {
  if (draft.sourceType === 'CATEGORY' && draft.ruleCategoryIds.length === 0) {
    return 'Choose at least one recommendation category.';
  }
  if (draft.sourceType === 'CATEGORY') {
    for (const catId of draft.ruleCategoryIds) {
      if (!draft.categoryDefaults[catId]) {
        const cat = localCategories.find((c) => c.id === catId);
        return `Select a default item for ${cat?.name ?? 'the category'}.`;
      }
    }
  }
  const linkedProductIds =
    draft.linkedProductIds.length > 0
      ? draft.linkedProductIds
      : draft.linkedProductId
        ? [draft.linkedProductId]
        : [];
  if (draft.sourceType === 'PRODUCT' && linkedProductIds.length === 0) {
    return 'Choose at least one product.';
  }
  if (draft.sourceType === 'PRODUCT' && draft.productCategoryIds.length === 0) {
    return 'Choose at least one category for product recommendations.';
  }

  const useVariationLimits =
    draft.selectionType === 'MULTIPLE' &&
    draft.sourceType === 'CATEGORY' &&
    (selected.variations?.length ?? 0) > 0 &&
    draft.variationLimits.length > 0;

  if (draft.selectionType === 'MULTIPLE' && !useVariationLimits) {
    if (draft.maxItems < draft.minItems) {
      return 'Maximum must be >= minimum.';
    }
  }
  return null;
}

function buildRecommendationPayloads(
  draft: RecommendationRuleDraft,
  context: {
    selected: MenuItemRow & { categoryName: string };
    localCategories: MenuCategoryRow[];
    allProducts: (MenuItemRow & { categoryName: string })[];
    sortOrderBase: number;
  }
): Record<string, unknown>[] {
  const { selected, localCategories, allProducts, sortOrderBase } = context;
  const payloads: Record<string, unknown>[] = [];
  const linkedProductIds =
    draft.linkedProductIds.length > 0
      ? draft.linkedProductIds
      : draft.linkedProductId
        ? [draft.linkedProductId]
        : [];

  const useVariationLimits =
    draft.selectionType === 'MULTIPLE' &&
    draft.sourceType === 'CATEGORY' &&
    (selected.variations?.length ?? 0) > 0 &&
    draft.variationLimits.length > 0;

  if (draft.sourceType === 'CATEGORY') {
    const cats = localCategories.filter((c) =>
      draft.ruleCategoryIds.includes(c.id)
    );
    for (const [index, cat] of cats.entries()) {
      payloads.push({
        name:
          draft.selectionType === 'SINGLE'
            ? `Choose ${cat.name}`
            : `Choose from ${cat.name}`,
        sourceType: 'CATEGORY',
        selectionType: draft.selectionType,
        required: draft.required,
        linkedCategoryId: cat.id,
        defaultLinkedMenuItemId: draft.categoryDefaults[cat.id],
        useVariationPricing: draft.useVariationPricing,
        sortOrder: sortOrderBase + index,
        ...(draft.selectionType === 'MULTIPLE'
          ? {
              multipleMode: draft.multipleMode,
              freeQuantity:
                draft.multipleMode === 'QUANTITY' ? draft.freeQuantity : null,
              ...(useVariationLimits
                ? { variationLimits: draft.variationLimits }
                : {
                    minItems: draft.minItems,
                    maxItems: draft.maxItems,
                  }),
            }
          : {}),
      });
    }
  } else {
    const catNames = localCategories
      .filter((c) => draft.productCategoryIds.includes(c.id))
      .map((c) => c.name);
    linkedProductIds.forEach((productId, index) => {
      const product = allProducts.find((p) => p.id === productId);
      payloads.push({
        name: product
          ? catNames.length > 1
            ? `Choose add-ons (${catNames.join(', ')})`
            : draft.selectionType === 'SINGLE'
              ? `Choose ${product.name}`
              : `Choose from ${catNames[0] ?? product.categoryName}`
          : 'Recommended products',
        sourceType: 'PRODUCT',
        selectionType: draft.selectionType,
        required: draft.required,
        linkedProductId: productId,
        productCategoryIds: draft.productCategoryIds,
        sortOrder: sortOrderBase + index,
        ...(draft.selectionType === 'MULTIPLE'
          ? {
              multipleMode: draft.multipleMode,
              freeQuantity:
                draft.multipleMode === 'QUANTITY' ? draft.freeQuantity : null,
              minItems: draft.minItems,
              maxItems: draft.maxItems,
            }
          : {}),
      });
    });
  }
  return payloads;
}

async function persistRecommendationDraft(
  draft: RecommendationRuleDraft,
  context: {
    selected: MenuItemRow & { categoryName: string };
    localCategories: MenuCategoryRow[];
    allProducts: (MenuItemRow & { categoryName: string })[];
    sortOrderBase: number;
  }
): Promise<AttrGroupRow[]> {
  const payloads = buildRecommendationPayloads(draft, context);
  const responses = await Promise.all(
    payloads.map((body) =>
      axios.post<{ data: AttrGroupRow }>(
        `/api/restaurant/menu/items/${context.selected.id}/attributes`,
        body
      )
    )
  );
  return responses.map((res) => res.data.data);
}

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function RecommendationsTab({
  categories,
  onRefresh: _onRefresh,
  loading,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [localCategories, setLocalCategories] =
    useState<MenuCategoryRow[]>(categories);

  useEffect(() => {
    setLocalCategories(filterCategoriesWithProducts(categories));
  }, [categories]);

  const allProducts = useMemo(
    () =>
      localCategories.flatMap((c) =>
        c.items.map((i) => ({ ...i, categoryName: c.name }))
      ),
    [localCategories]
  );

  const [selectedId, setSelectedId] = useState<string>('');
  /** Checked category ids for the product strip + search. Empty = none. */
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>(() =>
    categories.map((c) => c.id)
  );
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);

  const categoryIdsSignature = useMemo(
    () =>
      localCategories
        .map((c) => c.id)
        .sort()
        .join(','),
    [localCategories]
  );

  useEffect(() => {
    const ids = localCategories.map((c) => c.id);
    if (ids.length === 0) {
      setFilterCategoryIds([]);
      return;
    }
    setFilterCategoryIds((prev) => {
      const idSet = new Set(ids);
      const kept = prev.filter((id) => idSet.has(id));
      const newcomers = ids.filter((id) => !prev.includes(id));
      if (kept.length === 0) return [...ids];
      if (newcomers.length > 0) return [...kept, ...newcomers];
      return kept;
    });
  }, [categoryIdsSignature, localCategories]);

  const selected = useMemo(
    () => allProducts.find((p) => p.id === selectedId) ?? null,
    [allProducts, selectedId]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (filterCategoryIds.length === 0) return [];
    const allow = new Set(filterCategoryIds);
    let list = allProducts.filter((p) => allow.has(p.categoryId));
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProducts, filterCategoryIds, productSearch]);

  const activeCategoryFilterLabel = useMemo(() => {
    const allIds = localCategories.map((c) => c.id);
    if (filterCategoryIds.length === 0) return 'None';
    const isAll =
      allIds.length > 0 &&
      filterCategoryIds.length === allIds.length &&
      allIds.every((id) => filterCategoryIds.includes(id));
    if (isAll) return 'All categories';
    if (filterCategoryIds.length === 1) {
      return (
        localCategories.find((c) => c.id === filterCategoryIds[0])?.name ??
        '1 category'
      );
    }
    return `${filterCategoryIds.length} categories`;
  }, [filterCategoryIds, localCategories]);

  const filteredProductIdsKey = useMemo(
    () => filteredProducts.map((p) => p.id).join(','),
    [filteredProducts]
  );

  const productStripRef = useRef<HTMLDivElement>(null);
  const [productStripScroll, setProductStripScroll] = useState({
    back: false,
    forward: false,
  });

  const syncProductStripScroll = useCallback(() => {
    const el = productStripRef.current;
    if (!el) {
      setProductStripScroll({ back: false, forward: false });
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = Math.max(0, scrollWidth - clientWidth);
    setProductStripScroll({
      back: scrollLeft > 4,
      forward: max > 4 && scrollLeft < max - 4,
    });
  }, []);

  useLayoutEffect(() => {
    syncProductStripScroll();
  }, [filteredProductIdsKey, syncProductStripScroll]);

  useEffect(() => {
    const el = productStripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncProductStripScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncProductStripScroll]);

  const scrollProductStrip = useCallback((direction: 'back' | 'forward') => {
    const el = productStripRef.current;
    if (!el) return;
    const amount = Math.min(Math.max(el.clientWidth * 0.65, 140), 280);
    el.scrollBy({
      left: direction === 'forward' ? amount : -amount,
      behavior: 'smooth',
    });
  }, []);

  const [savingRules, setSavingRules] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllConfirmOpen, setSaveAllConfirmOpen] = useState(false);
  const [ruleSelectionType, setRuleSelectionType] = useState<
    'SINGLE' | 'MULTIPLE'
  >('SINGLE');
  const [ruleRequired, setRuleRequired] = useState(true);
  const [ruleMinItems, setRuleMinItems] = useState(1);
  const [ruleMaxItems, setRuleMaxItems] = useState(3);
  const [ruleCategoryIds, setRuleCategoryIds] = useState<string[]>([]);

  const [offerCategoryIds, setOfferCategoryIds] = useState<string[]>([]);
  const [selectedOfferProductIds, setSelectedOfferProductIds] = useState<
    string[]
  >([]);
  const [savingOffers, setSavingOffers] = useState(false);
  const [saveOffersConfirmOpen, setSaveOffersConfirmOpen] = useState(false);

  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [deleteRuleConfirmOpen, setDeleteRuleConfirmOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState(false);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [deleteOfferConfirmOpen, setDeleteOfferConfirmOpen] = useState(false);
  const [deletingOffer, setDeletingOffer] = useState(false);
  /** Local-only preview of how single / multiple picks look at checkout (not persisted). */
  const [previewByGroup, setPreviewByGroup] = useState<
    Record<string, string[]>
  >({});
  const [draftByVariant, setDraftByVariant] = useState<
    Partial<Record<RecommendationFormVariant, RecommendationRuleDraft>>
  >({});

  const defaultRuleDraft = useMemo(
    () => ({
      selectionType: 'SINGLE' as const,
      required: true,
      minItems: 1,
      maxItems: 3,
    }),
    []
  );

  const [ruleDraftBaseline, setRuleDraftBaseline] = useState(defaultRuleDraft);

  useEffect(() => {
    if (!selectedId) return;
    setRuleDraftBaseline(defaultRuleDraft);
    setDraftByVariant({});
  }, [selectedId, defaultRuleDraft]);

  const isDirty = useMemo(() => {
    if (!selectedId) return false;
    if (
      ruleCategoryIds.length > 0 ||
      offerCategoryIds.length > 0 ||
      selectedOfferProductIds.length > 0
    ) {
      return true;
    }
    return (
      ruleSelectionType !== ruleDraftBaseline.selectionType ||
      ruleRequired !== ruleDraftBaseline.required ||
      ruleMinItems !== ruleDraftBaseline.minItems ||
      ruleMaxItems !== ruleDraftBaseline.maxItems
    );
  }, [
    selectedId,
    ruleCategoryIds,
    offerCategoryIds,
    selectedOfferProductIds,
    ruleSelectionType,
    ruleRequired,
    ruleMinItems,
    ruleMaxItems,
    ruleDraftBaseline,
  ]);

  const {
    leaveOpen,
    leaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty, {
    message:
      'You have unsaved recommendation or offer selections. Leave without saving?',
  });

  const resetDraftState = useCallback(() => {
    setRuleCategoryIds([]);
    setOfferCategoryIds([]);
    setSelectedOfferProductIds([]);
    setRuleSelectionType(defaultRuleDraft.selectionType);
    setRuleRequired(defaultRuleDraft.required);
    setRuleMinItems(defaultRuleDraft.minItems);
    setRuleMaxItems(defaultRuleDraft.maxItems);
    setRuleDraftBaseline(defaultRuleDraft);
    setDraftByVariant({});
  }, [defaultRuleDraft]);

  const selectProduct = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      requestLeave(() => {
        resetDraftState();
        setDraftByVariant({});
        setSelectedId(id);
      });
    },
    [selectedId, requestLeave, resetDraftState]
  );

  useEffect(() => {
    if (!isDirty) return;

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest(
        'a[href]'
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }

      let path = href;
      if (href.startsWith('http')) {
        try {
          const url = new URL(href);
          if (url.origin !== window.location.origin) return;
          path = url.pathname + url.search + url.hash;
        } catch {
          return;
        }
      }

      if (path === pathname || path.startsWith(`${pathname}?`)) return;

      e.preventDefault();
      e.stopPropagation();
      requestLeave(() => {
        resetDraftState();
        router.push(path);
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty, pathname, requestLeave, resetDraftState, router]);

  /** Non-empty categories for offered-product picker (except the product’s own). */
  const linkedOptions = useMemo(
    () =>
      localCategories.filter(
        (c) => c.items.length > 0 && c.id !== selected?.categoryId
      ),
    [localCategories, selected?.categoryId]
  );

  /** Categories not yet used as a recommendation rule for this product (cannot assign twice). */
  const assignableRuleCategories = useMemo(() => {
    if (!selected) return [];
    const alreadyLinked = new Set(
      selected.attributeGroups
        .filter((g) => g.linkedCategory)
        .map((g) => g.linkedCategory!.id)
    );
    return localCategories.filter(
      (c) => c.id !== selected.categoryId && !alreadyLinked.has(c.id)
    );
  }, [localCategories, selected]);

  const assignedCategoryIdsKey = useMemo(() => {
    if (!selected?.attributeGroups.length) return '';
    return selected.attributeGroups
      .map((g) => g.linkedCategory?.id ?? g.linkedProduct?.id ?? '')
      .filter(Boolean)
      .sort()
      .join(',');
  }, [selected?.attributeGroups]);

  const currentOffers = selected?.offersFromThis ?? [];
  const offeredProductsFromSelectedCategories = useMemo(() => {
    if (!selected || offerCategoryIds.length === 0) return [];
    const blockedIds = new Set<string>([
      selected.id,
      ...currentOffers.map((o) => o.offeredItem.id),
    ]);
    const byId = new Map<string, (typeof allProducts)[number]>();
    for (const p of allProducts) {
      if (blockedIds.has(p.id)) continue;
      if (!offerCategoryIds.includes(p.categoryId)) continue;
      byId.set(p.id, p);
    }
    return Array.from(byId.values());
  }, [allProducts, currentOffers, offerCategoryIds, selected]);

  const toggleInArray = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  useEffect(() => {
    setPreviewByGroup({});
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const stillVisible =
      filterCategoryIds.length > 0 &&
      (() => {
        const p = allProducts.find((x) => x.id === selectedId);
        return p != null && filterCategoryIds.includes(p.categoryId);
      })();

    if (stillVisible) return;

    const clearSelection = () => {
      resetDraftState();
      setSelectedId('');
    };

    if (isDirty) {
      requestLeave(clearSelection);
    } else {
      clearSelection();
    }
  }, [
    filterCategoryIds,
    selectedId,
    allProducts,
    isDirty,
    requestLeave,
    resetDraftState,
  ]);

  useEffect(() => {
    if (!selected) {
      setRuleCategoryIds([]);
      return;
    }
    const alreadyLinked = new Set(
      selected.attributeGroups
        .filter((g) => g.linkedCategory)
        .map((g) => g.linkedCategory!.id)
    );
    setRuleCategoryIds((prev) =>
      prev.filter(
        (id) =>
          id !== selected.categoryId &&
          !alreadyLinked.has(id) &&
          localCategories.some((c) => c.id === id)
      )
    );
  }, [selectedId, assignedCategoryIdsKey, selected, localCategories]);

  const updateSelectedItem = (updater: (item: MenuItemRow) => MenuItemRow) => {
    if (!selectedId) return;
    setLocalCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) =>
          item.id === selectedId ? updater(item) : item
        ),
      }))
    );
  };

  const saveRecommendationDraft = async (
    draft: RecommendationRuleDraft,
    options?: { resetAfter?: boolean }
  ) => {
    if (!selected) {
      toast.error('Select a product first.');
      return false;
    }

    const validationError = validateRecommendationDraft(
      draft,
      localCategories,
      selected
    );
    if (validationError) {
      toast.error(validationError);
      return false;
    }

    setSavingRules(true);
    try {
      const createdGroups = await persistRecommendationDraft(draft, {
        selected,
        localCategories,
        allProducts,
        sortOrderBase: selected.attributeGroups.length,
      });
      updateSelectedItem((item) => ({
        ...item,
        attributeGroups: [
          ...item.attributeGroups,
          ...createdGroups.filter(
            (group) =>
              !item.attributeGroups.some((existing) => existing.id === group.id)
          ),
        ],
      }));
      if (options?.resetAfter !== false) {
        toast.success('Recommendation saved');
        allowNextNavigation();
        resetDraftState();
        setDraftByVariant({});
      }
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Could not save');
      return false;
    } finally {
      setSavingRules(false);
    }
  };

  const saveOfferedProducts = async (options?: { resetAfter?: boolean }) => {
    if (!selected) {
      toast.error('Select a product first.');
      return false;
    }
    if (selectedOfferProductIds.length === 0) {
      toast.error('Select offered products first.');
      return false;
    }
    setSavingOffers(true);
    try {
      const responses = await Promise.all(
        selectedOfferProductIds.map((itemId, index) =>
          axios.post<{
            data: NonNullable<MenuItemRow['offersFromThis']>[number];
          }>(`/api/restaurant/menu/items/${selected.id}/offers`, {
            offeredItemId: itemId,
            sortOrder: (selected.offersFromThis?.length ?? 0) + index,
          })
        )
      );
      const createdOffers = responses.map((res) => res.data.data);
      updateSelectedItem((item) => ({
        ...item,
        offersFromThis: [
          ...(item.offersFromThis ?? []),
          ...createdOffers.filter(
            (offer) =>
              !(item.offersFromThis ?? []).some(
                (existing) => existing.id === offer.id
              )
          ),
        ],
      }));
      if (options?.resetAfter !== false) {
        toast.success('Offered products added');
        allowNextNavigation();
        resetDraftState();
      }
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(
        err.response?.data?.error || 'Could not add offered products'
      );
      return false;
    } finally {
      setSavingOffers(false);
    }
  };

  const hasPendingConfiguration = useMemo(() => {
    const hasRuleDrafts = RECOMMENDATION_FORM_VARIANTS.some((variant) => {
      const draft = draftByVariant[variant];
      return draft != null && draftHasContent(variant, draft);
    });
    return hasRuleDrafts || selectedOfferProductIds.length > 0;
  }, [draftByVariant, selectedOfferProductIds]);

  const saveAllConfiguration = async () => {
    if (!selected) {
      toast.error('Select a product first.');
      return;
    }

    const draftsToSave: RecommendationRuleDraft[] = [];
    for (const variant of RECOMMENDATION_FORM_VARIANTS) {
      const draft = draftByVariant[variant];
      if (!draft || !draftHasContent(variant, draft)) continue;
      const validationError = validateRecommendationDraft(
        draft,
        localCategories,
        selected
      );
      if (validationError) {
        toast.error(`${RECOMMENDATION_SECTION_LABELS[variant]}: ${validationError}`);
        return;
      }
      draftsToSave.push(draft);
    }

    const hasOffers = selectedOfferProductIds.length > 0;
    if (draftsToSave.length === 0 && !hasOffers) {
      toast.error('Nothing to save. Configure at least one section first.');
      return;
    }

    setSavingAll(true);
    try {
      let sortOrderBase = selected.attributeGroups.length;
      const allCreatedGroups: AttrGroupRow[] = [];

      for (const draft of draftsToSave) {
        const created = await persistRecommendationDraft(draft, {
          selected,
          localCategories,
          allProducts,
          sortOrderBase,
        });
        allCreatedGroups.push(...created);
        sortOrderBase += created.length;
      }

      let createdOffers: NonNullable<MenuItemRow['offersFromThis']> = [];
      if (hasOffers) {
        const responses = await Promise.all(
          selectedOfferProductIds.map((itemId, index) =>
            axios.post<{
              data: NonNullable<MenuItemRow['offersFromThis']>[number];
            }>(`/api/restaurant/menu/items/${selected.id}/offers`, {
              offeredItemId: itemId,
              sortOrder: (selected.offersFromThis?.length ?? 0) + index,
            })
          )
        );
        createdOffers = responses.map((res) => res.data.data);
      }

      updateSelectedItem((item) => ({
        ...item,
        attributeGroups: [
          ...item.attributeGroups,
          ...allCreatedGroups.filter(
            (group) =>
              !item.attributeGroups.some((existing) => existing.id === group.id)
          ),
        ],
        ...(hasOffers
          ? {
              offersFromThis: [
                ...(item.offersFromThis ?? []),
                ...createdOffers.filter(
                  (offer) =>
                    !(item.offersFromThis ?? []).some(
                      (existing) => existing.id === offer.id
                    )
                ),
              ],
            }
          : {}),
      }));

      const parts: string[] = [];
      if (draftsToSave.length > 0) {
        parts.push(
          `${draftsToSave.length} recommendation section${draftsToSave.length === 1 ? '' : 's'}`
        );
      }
      if (hasOffers) {
        parts.push('associated products');
      }
      toast.success(`Saved ${parts.join(' and ')}`);
      allowNextNavigation();
      resetDraftState();
      setDraftByVariant({});
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Could not save configuration');
    } finally {
      setSavingAll(false);
    }
  };

  const deleteRule = async () => {
    if (!deletingRuleId) return;
    setDeletingRule(true);
    try {
      await axios.delete(`/api/restaurant/menu/attributes/${deletingRuleId}`);
      const removedId = deletingRuleId;
      updateSelectedItem((item) => ({
        ...item,
        attributeGroups: item.attributeGroups.filter(
          (g) => g.id !== removedId
        ),
      }));
      setPreviewByGroup((prev) => {
        if (!(removedId in prev)) return prev;
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      toast.success('Removed');
      setDeleteRuleConfirmOpen(false);
      setDeletingRuleId(null);
    } catch {
      toast.error('Could not remove');
    } finally {
      setDeletingRule(false);
    }
  };

  const deleteOffer = async () => {
    if (!deletingOfferId) return;
    setDeletingOffer(true);
    try {
      await axios.delete(`/api/restaurant/menu/offers/${deletingOfferId}`);
      updateSelectedItem((item) => ({
        ...item,
        offersFromThis: (item.offersFromThis ?? []).filter(
          (o) => o.id !== deletingOfferId
        ),
      }));
      toast.success('Removed offered product');
    } catch {
      toast.error('Could not remove offered product');
    } finally {
      setDeletingOfferId(null);
      setDeleteOfferConfirmOpen(false);
      setDeletingOffer(false);
    }
  };

  const allOtherProductsExist = selected != null && linkedOptions.length > 0;

  const previewGroups = useMemo((): PreviewAttrGroup[] => {
    if (!selected) return [];
    const saved = selected.attributeGroups as PreviewAttrGroup[];
    const drafts = buildDraftPreviewGroups(
      draftByVariant,
      localCategories,
      allProducts,
      selected
    );
    return [...saved, ...drafts];
  }, [selected, draftByVariant, localCategories, allProducts]);

  const offeredPreviewItems = useMemo(() => {
    const saved = currentOffers.map((o) => ({
      id: o.offeredItem.id,
      name: o.offeredItem.name,
      imageUrl: o.offeredItem.imageUrl,
      isDraft: false as const,
    }));
    const draft = selectedOfferProductIds
      .map((id) => allProducts.find((p) => p.id === id))
      .filter((p): p is (typeof allProducts)[number] => Boolean(p))
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        isDraft: true as const,
      }));
    return [...saved, ...draft];
  }, [allProducts, currentOffers, selectedOfferProductIds]);

  const draftChangeHandlers = useMemo(
    (): Record<
      RecommendationFormVariant,
      (draft: RecommendationRuleDraft) => void
    > => ({
      'category-single': (draft) =>
        setDraftByVariant((prev) => ({ ...prev, 'category-single': draft })),
      'category-multiple': (draft) =>
        setDraftByVariant((prev) => ({ ...prev, 'category-multiple': draft })),
      'product-single': (draft) =>
        setDraftByVariant((prev) => ({ ...prev, 'product-single': draft })),
      'product-multiple': (draft) =>
        setDraftByVariant((prev) => ({ ...prev, 'product-multiple': draft })),
    }),
    []
  );

  const savedGroupsByType = useMemo(() => {
    if (!selected) {
      return {
        categorySingle: [] as AttrGroupRow[],
        categoryMultiple: [] as AttrGroupRow[],
        productSingle: [] as AttrGroupRow[],
        productMultiple: [] as AttrGroupRow[],
      };
    }
    const groups = selected.attributeGroups;
    return {
      categorySingle: groups.filter(
        (g) => g.sourceType !== 'PRODUCT' && g.selectionType === 'SINGLE'
      ),
      categoryMultiple: groups.filter(
        (g) => g.sourceType !== 'PRODUCT' && g.selectionType === 'MULTIPLE'
      ),
      productSingle: groups.filter(
        (g) => g.sourceType === 'PRODUCT' && g.selectionType === 'SINGLE'
      ),
      productMultiple: groups.filter(
        (g) => g.sourceType === 'PRODUCT' && g.selectionType === 'MULTIPLE'
      ),
    };
  }, [selected]);

  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="space-y-1.5 px-4 sm:px-6">
        <CardTitle className="text-xl sm:text-2xl">
          Recommendations & Add-ons
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 max-w-full space-y-6 px-4 pb-6 sm:px-6">
        {loading ? (
          <div
            className="flex min-h-[min(420px,70vh)] w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 py-16"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2
              className=" animate-spin text-primary text-center mx-auto"
            />
          </div>
        ) : allProducts?.length === 0 ? (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
      <p className="text-sm text-muted-foreground">
        Add products first — configuration rules are attached to a product.
      </p>
      <Button type="button" asChild className="w-fit">
        <Link href="/product">Go to Products</Link>
      </Button>
    </div>
  ) : (
    <div className="min-w-0 max-w-full space-y-6 sm:space-y-8">
      <section className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl border border-border bg-muted/20 p-3 sm:space-y-4 sm:p-5">
        <div className="flex min-w-0 w-full max-w-full flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
          <div className="relative min-h-10 min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search in selected categories…"
              className="h-11 min-h-11 bg-background pl-9 text-base sm:h-10 sm:text-sm"
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search products in filtered categories"
            />
          </div>
          <Popover
            open={categoryFilterOpen}
            onOpenChange={setCategoryFilterOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 w-full shrink-0 gap-2 bg-background px-3 sm:h-10 sm:min-h-10 sm:w-auto sm:min-w-[10rem]"
              >
                <ListFilter className="h-4 w-4 shrink-0" />
                <span className="shrink-0">Filter</span>
                <Badge
                  variant="secondary"
                  className="min-w-0 max-w-[9rem] truncate font-normal sm:max-w-[140px]"
                >
                  {activeCategoryFilterLabel}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(calc(100vw-2rem),20rem)] p-0 sm:w-80"
              align="end"
              sideOffset={8}
              collisionPadding={16}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <p className="text-sm font-medium">Categories</p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      setFilterCategoryIds(
                        localCategories.map((c) => c.id)
                      )
                    }
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setFilterCategoryIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[min(260px,40dvh)] sm:h-[min(280px,45vh)]">
                <div className="flex flex-col gap-0.5 p-2">
                  {localCategories.map((cat) => {
                    const checked = filterCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent sm:min-h-10',
                          checked && 'bg-primary/10'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={checked}
                          onChange={() =>
                            setFilterCategoryIds((prev) =>
                              toggleInArray(prev, cat.id)
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {cat.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {cat.items.length}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                Search only applies to products in checked categories.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 w-full max-w-full min-h-0 overflow-x-clip">
          {filterCategoryIds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-background/80 px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
              Turn on at least one category in the filter, or tap{' '}
              <span className="font-medium text-foreground">All</span>.
            </p>
          ) : filteredProducts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-background/80 px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
              No products match the checked categories and search. Adjust
              the filter or clear the search.
            </p>
          ) : (
            <div className="relative isolate w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border/60 bg-background/50">
              <div className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 px-1 py-1 sm:gap-2 sm:px-1.5 sm:py-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
                  disabled={!productStripScroll.back}
                  aria-label="Scroll products back"
                  onClick={() => scrollProductStrip('back')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div
                  ref={productStripRef}
                  onScroll={syncProductStripScroll}
                  className="min-h-0 min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div className="flex w-max items-stretch gap-3 py-1 pe-1 ps-1">
                    {filteredProducts.map((p) => {
                      const isActive = p.id === selectedId;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProduct(p.id)}
                          className={cn(
                            'group relative w-[9.5rem] shrink-0 overflow-hidden rounded-xl border bg-card text-left shadow-sm outline-none ring-offset-background transition sm:w-[10.5rem]',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            'hover:border-primary/40 hover:shadow-md active:scale-[0.98]',
                            isActive
                              ? 'border-primary ring-2 ring-primary/25'
                              : 'border-border'
                          )}
                        >
                          <div className="relative aspect-[4/3] w-full bg-muted">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- dashboard menu URLs
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
                            <span
                              className={cn(
                                'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background/90 text-xs font-bold shadow-sm backdrop-blur-sm transition',
                                isActive
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-transparent group-hover:border-primary/50'
                              )}
                              aria-hidden
                            >
                              ✓
                            </span>
                          </div>
                          <div className="space-y-0.5 p-2.5">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug">
                              {p.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {p.categoryName}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-sm"
                  disabled={!productStripScroll.forward}
                  aria-label="Scroll products forward"
                  onClick={() => scrollProductStrip('forward')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid min-w-0 max-w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:gap-10 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,440px)]">
        <div className="min-w-0 w-full max-w-full space-y-6 lg:mx-auto">
          {selected ? (
            <RecommendationConfigSections
              selected={selected}
              localCategories={localCategories}
              allProducts={allProducts}
              linkedOptions={linkedOptions}
              savedGroupsByType={savedGroupsByType}
              savingRules={savingRules}
              savingAll={savingAll}
              onSaveDraft={(draft) => void saveRecommendationDraft(draft)}
              draftChangeHandlers={draftChangeHandlers}
              onDeleteGroup={(groupId) => {
                setDeletingRuleId(groupId);
                setDeleteRuleConfirmOpen(true);
              }}
              offerCategoryIds={offerCategoryIds}
              setOfferCategoryIds={setOfferCategoryIds}
              selectedOfferProductIds={selectedOfferProductIds}
              setSelectedOfferProductIds={setSelectedOfferProductIds}
              offeredProductsFromSelectedCategories={
                offeredProductsFromSelectedCategories
              }
              currentOffers={currentOffers}
              savingOffers={savingOffers}
              onSaveOffers={() => setSaveOffersConfirmOpen(true)}
              onDeleteOffer={(offerId) => {
                setDeletingOfferId(offerId);
                setDeleteOfferConfirmOpen(true);
              }}
              deletingOffer={deletingOffer}
              deletingOfferId={deletingOfferId}
              toggleInArray={toggleInArray}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-10 text-center sm:px-6 sm:py-12">
              <p className="text-sm font-medium text-foreground">
                Select a product
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Tap a card in the horizontal strip to configure
                recommendations and associated products for that item.
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-2xl border border-border bg-muted/25 p-1 lg:sticky lg:top-4 lg:flex lg:max-h-[min(100dvh-8rem,calc(100dvh-10rem))] lg:flex-col lg:overflow-hidden">
          <RecommendationPreviewPanel
            selected={selected}
            localCategories={localCategories}
            previewGroups={previewGroups}
            previewByGroup={previewByGroup}
            onPreviewChange={(groupId, ids) =>
              setPreviewByGroup((prev) => ({ ...prev, [groupId]: ids }))
            }
            offeredItems={offeredPreviewItems}
            onDeleteGroup={(groupId, isDraft) => {
              if (isDraft) return;
              setDeletingRuleId(groupId);
              setDeleteRuleConfirmOpen(true);
            }}
            deletingRuleId={deletingRuleId}
            deletingRule={deletingRule}
            savingAll={savingAll}
            saveAllDisabled={
              savingRules ||
              savingOffers ||
              savingAll ||
              !hasPendingConfiguration
            }
            onSaveAll={
              selected ? () => setSaveAllConfirmOpen(true) : undefined
            }
          />
        </aside>
      </div>
    </div>
        )}

      </CardContent>

      <SaveConfirmation
        open={saveAllConfirmOpen}
        title="Save all configuration"
        description="Save every configured recommendation section and associated products for this product in one step?"
        itemName={selected?.name || 'Selected product'}
        loading={savingAll}
        onConfirm={() => {
          setSaveAllConfirmOpen(false);
          void saveAllConfiguration();
        }}
        onCancel={() => setSaveAllConfirmOpen(false)}
      />

      <SaveConfirmation
        open={saveOffersConfirmOpen}
        title="Save offered products"
        description="Add selected products as offers for this product?"
        itemName={selected?.name || 'Selected product'}
        loading={savingOffers}
        onConfirm={() => {
          setSaveOffersConfirmOpen(false);
          void saveOfferedProducts();
        }}
        onCancel={() => setSaveOffersConfirmOpen(false)}
      />

      <DeleteConfirmation
        open={deleteRuleConfirmOpen}
        title="Remove rule"
        description="This add-on rule will be removed from this product."
        itemName={
          selected?.attributeGroups.find((g) => g.id === deletingRuleId)?.name
        }
        loading={deletingRule}
        onConfirm={() => void deleteRule()}
        onCancel={() => {
          setDeleteRuleConfirmOpen(false);
          setDeletingRuleId(null);
        }}
      />

      <DeleteConfirmation
        open={deleteOfferConfirmOpen}
        title="Remove offered product"
        description="This offered product link will be removed."
        itemName={
          currentOffers.find((o) => o.id === deletingOfferId)?.offeredItem.name
        }
        loading={deletingOffer}
        onConfirm={() => void deleteOffer()}
        onCancel={() => {
          setDeleteOfferConfirmOpen(false);
          setDeletingOfferId(null);
        }}
      />

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>{leaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">
              <>
                <X className="h-4 w-4 mr-2" />
                <span>Keep Editing</span>
              </>
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Leave Without Saving</span>
              </>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
