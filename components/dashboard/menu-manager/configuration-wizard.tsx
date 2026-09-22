'use client';

import { useEffect, useMemo, useState, Children } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';
import { ChevronDown, Loader2, Save, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import {
  isCategoryEligibleForRecommendations,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';
import { menuItemCategoryIds } from '@/lib/menu/menu-item-category-ids';
import {
  reservedRecommendationCategoryIds,
  reservedRecommendationProductIds,
} from '@/lib/menu/recommendation-reserved-ids';
import {
  RECOMMENDATION_SECTION_LABELS,
  type RecommendationFormVariant,
} from '@/lib/menu/recommendation-preview-groups';
import { buildRestaurantDefaultVariationOptions } from '@/lib/menu/recommendation-default-variation-options';
import {
  buildWizardRuleDraft,
  defaultCategorySettings,
  defaultProductSettings,
  isCategoryKind,
  isManyKind,
  isOneKind,
  isProductKind,
  wizardKindToVariant,
  type CategoryWizardSettings,
  type ProductWizardSettings,
  type WizardChoiceKind,
} from '@/lib/menu/configuration-wizard-draft';

import {
  RecommendationRuleForm,
  type RecommendationRuleDraft,
} from './recommendation-rule-form';
import {
  PersonalizeConfigSection,
  emptyPersonalizeGroup,
  type PersonalizeGroupDraft,
} from './personalize-config-section';
import { RecommendationConfigSectionShell } from './recommendation-config-section-shell';
import { LazyProductImage } from './lazy-product-image';
import { useRestaurantVariationTemplates } from './product-form-fields';
import { ConfigurationWizardConfigureStep } from './configuration-wizard-configure-step';
import { SelectableList, SelectableRow } from './selectable-list';
import type { AttrGroupRow, MenuCategoryRow, MenuItemRow } from './types';

type ProductWithCategory = MenuItemRow & { categoryName: string };

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 'done';
type ChoiceKind = WizardChoiceKind;

export type ConfigurationWizardProps = {
  viewMode?: 'classic' | 'advanced';
  onViewModeChange?: (mode: 'classic' | 'advanced') => void;
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
  savingAll: boolean;
  onSaveDraft: (draft: RecommendationRuleDraft) => Promise<boolean> | boolean;
  draftChangeHandlers: Record<
    RecommendationFormVariant,
    (draft: RecommendationRuleDraft) => void
  >;
  onDeleteGroup: (groupId: string) => void;
  dealCategoryIds: string[];
  setDealCategoryIds: Dispatch<SetStateAction<string[]>>;
  selectedDealProductIds: string[];
  setSelectedDealProductIds: Dispatch<SetStateAction<string[]>>;
  dealProductsFromSelectedCategories: ProductWithCategory[];
  currentDeals: NonNullable<MenuItemRow['dealsFromThis']>;
  savingDeals: boolean;
  onSaveDeals: () => Promise<boolean> | boolean;
  onDeleteDeal: (dealId: string) => void;
  deletingDeal: boolean;
  deletingDealId: string | null;
  offerCategoryIds: string[];
  setOfferCategoryIds: Dispatch<SetStateAction<string[]>>;
  selectedOfferProductIds: string[];
  setSelectedOfferProductIds: Dispatch<SetStateAction<string[]>>;
  offeredProductsFromSelectedCategories: ProductWithCategory[];
  currentOffers: NonNullable<MenuItemRow['offersFromThis']>;
  savingOffers: boolean;
  onSaveOffers: () => Promise<boolean> | boolean;
  onDeleteOffer: (offerId: string) => void;
  deletingOffer: boolean;
  deletingOfferId: string | null;
  toggleInArray: (arr: string[], id: string) => string[];
  personalizeDraft: PersonalizeGroupDraft[];
  onPersonalizeDraftChange: (groups: PersonalizeGroupDraft[]) => void;
  savingPersonalize: boolean;
  loadingPersonalize?: boolean;
  onSavePersonalize: (
    groups?: PersonalizeGroupDraft[]
  ) => Promise<boolean> | boolean;
  formResetKeys: Record<RecommendationFormVariant, number>;
  draftByVariant: Partial<
    Record<RecommendationFormVariant, RecommendationRuleDraft>
  >;
};

function ChoiceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
        active
          ? 'border-foreground bg-muted/50'
          : 'border-border bg-background hover:bg-muted/30'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          active
            ? 'border-foreground bg-foreground'
            : 'border-muted-foreground/40'
        )}
        aria-hidden
      >
        {active ? (
          <span className="h-1.5 w-1.5 rounded-full bg-background" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}



function WizardProgress({ step }: { step: WizardStep }) {
  const current = step === 'done' ? 5 : typeof step === 'number' ? step : 0;
  const total = 6;
  const ratio = step === 'done' ? 1 : current / (total - 1);
  const pct = Math.round(ratio * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {step === 'done' ? 'Complete' : `Step ${current + 1} of ${total}`}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300"
          style={{ width: `${Math.max(step === 'done' ? 100 : 8, pct)}%` }}
        />
      </div>
    </div>
  );
}

function StepHeader({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function WizardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
  );
}

function SavedSummaryList({
  selected,
  savedGroups,
  currentDeals,
  currentOffers,
  personalizeDraft,
  onDeleteGroup,
  onDeleteDeal,
  onDeleteOffer,
  onDeletePersonalizeGroup,
  deletingDeal,
  deletingDealId,
  deletingOffer,
  deletingOfferId,
  savingPersonalize,
}: {
  selected: ProductWithCategory;
  savedGroups: AttrGroupRow[];
  currentDeals: NonNullable<MenuItemRow['dealsFromThis']>;
  currentOffers: NonNullable<MenuItemRow['offersFromThis']>;
  personalizeDraft: PersonalizeGroupDraft[];
  onDeleteGroup: (groupId: string) => void;
  onDeleteDeal: (dealId: string) => void;
  onDeleteOffer: (offerId: string) => void;
  onDeletePersonalizeGroup?: (index: number) => void;
  deletingDeal: boolean;
  deletingDealId: string | null;
  deletingOffer: boolean;
  deletingOfferId: string | null;
  savingPersonalize?: boolean;
}) {
  const { t } = useTranslation();
  const sizeLabel =
    (selected.variations?.length ?? 0) > 0
      ? selected
        .variations!.map((v) => v.title || v.name)
        .filter(Boolean)
        .join(' · ')
      : null;

  const personalizeLive = personalizeDraft.filter(
    (g) =>
      g.parentName.trim() && g.options.some((o) => o.name.trim().length > 0)
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        On this product so far
      </p>
      {sizeLabel ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {t('dashboard.menuManager.wizard.size')}
            </p>
            <p className="text-xs text-muted-foreground">{sizeLabel}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Ready
          </Badge>
        </div>
      ) : null}

      {savedGroups.map((g) => (
        <div
          key={g.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {resolveBilingualText(g.name, 'en')}
            </p>
            <p className="text-xs text-muted-foreground">
              {g.sourceType === 'PRODUCT'
                ? (g.linkedProduct?.name ?? 'Product')
                : (g.linkedCategory?.name ?? 'Category')}
              {g.required ? ' · Required' : ' · Optional'}
              {g.selectionType === 'SINGLE'
                ? ' · Choose one'
                : g.maxItems != null
                  ? ` · Up to ${g.maxItems}`
                  : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {g.selectionType === 'SINGLE' ? 'One' : 'Extras'}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => onDeleteGroup(g.id)}
              aria-label={`Remove ${resolveBilingualText(g.name, 'en')}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {personalizeLive.map((g, i) => (
        <div
          key={g.id ?? `pref-${i}`}
          className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {resolveBilingualText(g.parentName, 'en')}
            </p>
            <p className="text-xs text-muted-foreground">
              {g.options
                .filter((o) => o.name.trim())
                .map((o) => o.name)
                .join(', ')}{' '}
              · up to {g.maxItems} · free
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="secondary" className="text-[10px]">
              Free
            </Badge>
            {onDeletePersonalizeGroup ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                disabled={savingPersonalize}
                onClick={() => onDeletePersonalizeGroup(i)}
                aria-label={`Remove ${resolveBilingualText(g.parentName, 'en')}`}
              >
                {savingPersonalize ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      {currentDeals.length > 0 ? (
        <div className="rounded-xl border border-border px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t('dashboard.menuManager.wizard.recommendedDealsPopup')}
            </p>
            <Badge variant="secondary" className="text-[10px]">
              Deals
            </Badge>
          </div>
          <ul className="space-y-1">
            {currentDeals.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span className="truncate">{deal.dealItem.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  disabled={deletingDeal && deletingDealId === deal.id}
                  onClick={() => onDeleteDeal(deal.id)}
                  aria-label={`Remove ${deal.dealItem.name}`}
                >
                  {deletingDeal && deletingDealId === deal.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {currentOffers.length > 0 ? (
        <div className="rounded-xl border border-border px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t('dashboard.menuManager.wizard.recommendedProductsCart')}
            </p>
            <Badge variant="secondary" className="text-[10px]">
              Cart
            </Badge>
          </div>
          <ul className="space-y-1">
            {currentOffers.map((offer) => (
              <li
                key={offer.id}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span className="truncate">{offer.offeredItem.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  disabled={deletingOffer && deletingOfferId === offer.id}
                  onClick={() => onDeleteOffer(offer.id)}
                  aria-label={`Remove ${offer.offeredItem.name}`}
                >
                  {deletingOffer && deletingOfferId === offer.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {savedGroups.length === 0 &&
        personalizeLive.length === 0 &&
        currentDeals.length === 0 &&
        currentOffers.length === 0 &&
        !sizeLabel ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          Nothing configured yet — answer the questions above.
        </p>
      ) : null}
    </div>
  );
}

export function ConfigurationWizard(props: ConfigurationWizardProps) {
  const {
    viewMode = 'advanced',
    selected,
    localCategories,
    allProducts,
    linkedOptions,
    savedGroupsByType,
    savingRules,
    savingAll,
    onSaveDraft,
    draftChangeHandlers,
    onDeleteGroup,
    dealCategoryIds,
    setDealCategoryIds,
    selectedDealProductIds,
    setSelectedDealProductIds,
    dealProductsFromSelectedCategories,
    currentDeals,
    savingDeals,
    onSaveDeals,
    onDeleteDeal,
    deletingDeal,
    deletingDealId,
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
    personalizeDraft,
    onPersonalizeDraftChange,
    savingPersonalize,
    formResetKeys,
    draftByVariant,
  } = props;

  const { t } = useTranslation();

  const isSaving =
    savingRules ||
    savingDeals ||
    savingOffers ||
    savingAll ||
    savingPersonalize;

  const { variationTemplates } = useRestaurantVariationTemplates();
  const defaultVariationOptions = useMemo(
    () => buildRestaurantDefaultVariationOptions(variationTemplates),
    [variationTemplates]
  );

  const [step, setStep] = useState<WizardStep>(0);
  const [kind, setKind] = useState<ChoiceKind>('cat-many');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([]);
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [required, setRequired] = useState(false);
  const [multipleMode, setMultipleMode] = useState<'CHECKBOX' | 'QUANTITY'>(
    'CHECKBOX'
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [categorySettings, setCategorySettings] = useState<
    Record<string, CategoryWizardSettings>
  >({});
  const [productSettings, setProductSettings] = useState<
    Record<string, ProductWizardSettings>
  >({});
  const [wizardPrefDraft, setWizardPrefDraft] = useState<PersonalizeGroupDraft[]>(
    []
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [productFilterSearch, setProductFilterSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [dealCategorySearch, setDealCategorySearch] = useState('');
  const [dealProductSearch, setDealProductSearch] = useState('');
  const [offerCategorySearch, setOfferCategorySearch] = useState('');
  const [offerProductSearch, setOfferProductSearch] = useState('');

  const allSavedGroups = useMemo(
    () => [
      ...savedGroupsByType.categoryMultiple,
      ...savedGroupsByType.categorySingle,
      ...savedGroupsByType.productMultiple,
      ...savedGroupsByType.productSingle,
    ],
    [savedGroupsByType]
  );

  const baseVariations = selected.variations ?? [];

  const reservedCategoryIds = useMemo(() => {
    const exclude =
      kind === 'prefs' ? undefined : wizardKindToVariant(kind);
    return reservedRecommendationCategoryIds(
      selected,
      draftByVariant,
      exclude && isCategoryKind(kind) ? exclude : undefined
    );
  }, [selected, draftByVariant, kind]);

  const reservedProductIds = useMemo(() => {
    const exclude =
      kind === 'prefs' ? undefined : wizardKindToVariant(kind);
    return reservedRecommendationProductIds(
      selected,
      draftByVariant,
      exclude && isProductKind(kind) ? exclude : undefined
    );
  }, [selected, draftByVariant, kind]);

  const eligibleCategories = useMemo(() => {
    const ownIds = new Set(menuItemCategoryIds(selected));
    return localCategories.filter((cat) => {
      if (ownIds.has(cat.id)) return false;
      if (!isCategoryEligibleForRecommendations(cat)) return false;
      if (
        reservedCategoryIds.has(cat.id) &&
        !selectedCategoryIds.includes(cat.id)
      ) {
        return false;
      }
      return true;
    });
  }, [localCategories, selected, reservedCategoryIds, selectedCategoryIds]);

  const filteredEligibleCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return eligibleCategories;
    return eligibleCategories.filter((cat) =>
      cat.name.toLowerCase().includes(q)
    );
  }, [eligibleCategories, categorySearch]);

  const productPickerCategories = useMemo(() => {
    return localCategories.filter((cat) =>
      allProducts.some(
        (p) =>
          p.id !== selected.id && menuItemCategoryIds(p).includes(cat.id)
      )
    );
  }, [localCategories, allProducts, selected.id]);

  const filteredProductPickerCategories = useMemo(() => {
    const q = productFilterSearch.trim().toLowerCase();
    if (!q) return productPickerCategories;
    return productPickerCategories.filter((cat) =>
      cat.name.toLowerCase().includes(q)
    );
  }, [productPickerCategories, productFilterSearch]);

  const productsFromSelectedCategories = useMemo(() => {
    if (productCategoryIds.length === 0) return [];
    return allProducts.filter((p) => {
      if (reservedProductIds.has(p.id) && !linkedProductIds.includes(p.id)) {
        return false;
      }
      return menuItemCategoryIds(p).some((id) =>
        productCategoryIds.includes(id)
      );
    });
  }, [
    allProducts,
    productCategoryIds,
    reservedProductIds,
    linkedProductIds,
  ]);

  const filteredLinkedProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productsFromSelectedCategories;
    return productsFromSelectedCategories.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [productsFromSelectedCategories, productSearch]);

  const filteredDealCategories = useMemo(() => {
    const q = dealCategorySearch.trim().toLowerCase();
    if (!q) return linkedOptions;
    return linkedOptions.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [linkedOptions, dealCategorySearch]);

  const filteredDealProducts = useMemo(() => {
    const q = dealProductSearch.trim().toLowerCase();
    if (!q) return dealProductsFromSelectedCategories;
    return dealProductsFromSelectedCategories.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [dealProductsFromSelectedCategories, dealProductSearch]);

  const filteredOfferCategories = useMemo(() => {
    const q = offerCategorySearch.trim().toLowerCase();
    if (!q) return linkedOptions;
    return linkedOptions.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [linkedOptions, offerCategorySearch]);

  const filteredOfferProducts = useMemo(() => {
    const q = offerProductSearch.trim().toLowerCase();
    if (!q) return offeredProductsFromSelectedCategories;
    return offeredProductsFromSelectedCategories.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [offeredProductsFromSelectedCategories, offerProductSearch]);

  const categoryProducts = useMemo(() => {
    if (selectedCategoryIds.length === 0) return [];
    return allProducts.filter((p) =>
      menuItemCategoryIds(p).some((id) => selectedCategoryIds.includes(id))
    );
  }, [allProducts, selectedCategoryIds]);

  const resetConfigureState = () => {
    setSelectedCategoryIds([]);
    setProductCategoryIds([]);
    setLinkedProductIds([]);
    setRequired(false);
    setMultipleMode('CHECKBOX');
    setShowAdvanced(false);
    setCategorySettings({});
    setProductSettings({});
    setCategorySearch('');
    setProductFilterSearch('');
    setProductSearch('');
  };

  useEffect(() => {
    setStep(0);
    setKind('cat-many');
    resetConfigureState();
    setWizardPrefDraft([]);
    setDealCategorySearch('');
    setDealProductSearch('');
    setOfferCategorySearch('');
    setOfferProductSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on product change only
  }, [selected.id, viewMode]);

  const currentDraftInput = useMemo(() => {
    if (kind === 'prefs') return null;
    return {
      kind,
      required,
      multipleMode,
      selectedCategoryIds,
      productCategoryIds,
      linkedProductIds,
      categorySettings,
      productSettings,
      baseVariations,
    };
  }, [
    kind,
    required,
    multipleMode,
    selectedCategoryIds,
    productCategoryIds,
    linkedProductIds,
    categorySettings,
    productSettings,
    baseVariations,
  ]);

  useEffect(() => {
    if (step !== 2 || !currentDraftInput) return;
    const canPreview =
      (isCategoryKind(currentDraftInput.kind) &&
        currentDraftInput.selectedCategoryIds.length > 0) ||
      (isProductKind(currentDraftInput.kind) &&
        currentDraftInput.linkedProductIds.length > 0 &&
        currentDraftInput.productCategoryIds.length > 0);
    if (!canPreview) return;
    const draft = buildWizardRuleDraft(currentDraftInput);
    draftChangeHandlers[wizardKindToVariant(currentDraftInput.kind)]?.(draft);
  }, [step, currentDraftInput, draftChangeHandlers]);

  const applyKindDefaults = (nextKind: ChoiceKind) => {
    setKind(nextKind);
    resetConfigureState();
    if (nextKind === 'cat-one') {
      setRequired(true);
      setMultipleMode('CHECKBOX');
    } else if (nextKind === 'cat-many') {
      setRequired(false);
      setMultipleMode('CHECKBOX');
    } else if (nextKind === 'prod-one') {
      setRequired(true);
      setMultipleMode('CHECKBOX');
    } else if (nextKind === 'prod-many') {
      setRequired(false);
      setMultipleMode('CHECKBOX');
    } else if (nextKind === 'prefs') {
      setWizardPrefDraft(
        personalizeDraft.length > 0
          ? personalizeDraft
          : [
            {
              parentName: 'Personalize',
              maxItems: 2,
              sortOrder: 0,
              options: [
                { name: 'Well done', imageUrl: '', sortOrder: 0 },
                { name: 'Cut in 8', imageUrl: '', sortOrder: 1 },
              ],
            },
          ]
      );
    }
  };

  const toggleCategoryId = (id: string) => {
    setSelectedCategoryIds((prev) => {
      if (kind === 'cat-one') {
        setCategorySettings({ [id]: defaultCategorySettings(1, 1) });
        return [id];
      }
      if (prev.includes(id)) {
        setCategorySettings((settings) => {
          const next = { ...settings };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      setCategorySettings((settings) => ({
        ...settings,
        [id]: settings[id] ?? defaultCategorySettings(0, 5),
      }));
      return [...prev, id];
    });
  };

  const toggleProductCategoryId = (id: string) => {
    setProductCategoryIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return next;
    });
    setLinkedProductIds([]);
    setProductSettings({});
  };

  const toggleLinkedProduct = (id: string) => {
    if (kind === 'prod-one') {
      setLinkedProductIds([id]);
      setProductSettings({ [id]: defaultProductSettings(1, 1) });
      return;
    }
    setLinkedProductIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      setProductSettings((settings) => {
        const copy = { ...settings };
        for (const pid of next) {
          if (!copy[pid]) copy[pid] = defaultProductSettings(0, 3);
        }
        for (const key of Object.keys(copy)) {
          if (!next.includes(key)) delete copy[key];
        }
        return copy;
      });
      return next;
    });
  };

  const saveRuleChoice = async () => {
    if (!currentDraftInput) return;
    if (
      isCategoryKind(currentDraftInput.kind) &&
      currentDraftInput.selectedCategoryIds.length === 0
    ) {
      return;
    }
    if (
      isProductKind(currentDraftInput.kind) &&
      (currentDraftInput.linkedProductIds.length === 0 ||
        currentDraftInput.productCategoryIds.length === 0)
    ) {
      return;
    }
    const draft = buildWizardRuleDraft(currentDraftInput);
    const ok = await onSaveDraft(draft);
    if (!ok) return;
    resetConfigureState();
    setStep(3);
  };

  const savePreferences = async () => {
    const groups =
      wizardPrefDraft.length > 0
        ? wizardPrefDraft
        : [emptyPersonalizeGroup(0)];
    const valid = groups.every(
      (g) =>
        g.parentName.trim().length > 0 &&
        g.options.some((o) => o.name.trim().length > 0)
    );
    if (!valid) return;
    onPersonalizeDraftChange(groups);
    const ok = await props.onSavePersonalize(groups);
    if (!ok) return;
    setStep(3);
  };

  const saveDeals = async () => {
    if (selectedDealProductIds.length === 0) return;
    const ok = await onSaveDeals();
    if (!ok) return;
    setDealCategorySearch('');
    setDealProductSearch('');
    setStep(5);
  };

  const saveUpsells = async () => {
    if (selectedOfferProductIds.length === 0) return;
    const ok = await onSaveOffers();
    if (!ok) return;
    setOfferCategorySearch('');
    setOfferProductSearch('');
    setStep('done');
  };

  const canSaveRule = useMemo(() => {
    if (!currentDraftInput) return false;
    if (isCategoryKind(currentDraftInput.kind)) {
      return currentDraftInput.selectedCategoryIds.length > 0;
    }
    if (isProductKind(currentDraftInput.kind)) {
      return (
        currentDraftInput.linkedProductIds.length > 0 &&
        currentDraftInput.productCategoryIds.length > 0
      );
    }
    return false;
  }, [currentDraftInput]);

  const sizeHint =
    (selected.variations?.length ?? 0) > 0
      ? `${selected.variations!.length} sizes`
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <LazyProductImage
              src={selected.imageUrl}
              hasImage={Boolean(selected.imageUrl)}
              alt=""
              emptyLabel="—"
              className="h-10 w-10 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-foreground">
                {selected.name}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {selected.categoryName}
                {sizeHint ? ` · ${sizeHint}` : ''}
              </p>
            </div>
          </div>
          {props.onViewModeChange ? (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 text-xs">
              <button
                type="button"
                onClick={() => props.onViewModeChange?.('classic')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  viewMode === 'classic'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Classic View
              </button>
              <button
                type="button"
                onClick={() => props.onViewModeChange?.('advanced')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  viewMode === 'advanced'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Advanced View
              </button>
            </div>
          ) : null}
        </div>

        {viewMode === 'classic' ? (
          <div className="p-4 sm:p-5">
            <ClassicConfigSections {...props} />
          </div>
        ) : (
          <>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <WizardProgress step={step} />

              {step === 0 ? (
                <div className="space-y-4">
                  <StepHeader
                    title={t('dashboard.menuManager.wizard.customizeQuestion')}
                    hint={t('dashboard.menuManager.wizard.customizeHint')}
                  />
                  <div className="space-y-2">
                    <ChoiceCard
                      active
                      title={t('dashboard.menuManager.wizard.yesCustomize')}
                      description={t(
                        'dashboard.menuManager.wizard.yesCustomizeDesc'
                      )}
                      onClick={() => setStep(1)}
                    />
                    <ChoiceCard
                      active={false}
                      title={t('dashboard.menuManager.wizard.noCustomize')}
                      description={t(
                        'dashboard.menuManager.wizard.noCustomizeDesc'
                      )}
                      onClick={() => setStep(4)}
                    />
                  </div>
                  <WizardActions>
                    <Button type="button" onClick={() => setStep(1)}>
                      {t('continue')}
                    </Button>
                  </WizardActions>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <StepHeader
                    title={t('dashboard.menuManager.wizard.whatAreTheyChoosing')}
                    hint={t(
                      'dashboard.menuManager.wizard.whatAreTheyChoosingHint'
                    )}
                  />
                  <div className="space-y-2">
                    <ChoiceCard
                      active={kind === 'cat-many'}
                      title={t('dashboard.menuManager.wizard.manyFromCategory')}
                      description={t(
                        'dashboard.menuManager.wizard.manyFromCategoryDesc'
                      )}
                      onClick={() => applyKindDefaults('cat-many')}
                    />
                    <ChoiceCard
                      active={kind === 'cat-one'}
                      title={t('dashboard.menuManager.wizard.oneFromCategory')}
                      description={t(
                        'dashboard.menuManager.wizard.oneFromCategoryDesc'
                      )}
                      onClick={() => applyKindDefaults('cat-one')}
                    />
                    <ChoiceCard
                      active={kind === 'prod-many'}
                      title={t('dashboard.menuManager.wizard.manyProducts')}
                      description={t(
                        'dashboard.menuManager.wizard.manyProductsDesc'
                      )}
                      onClick={() => applyKindDefaults('prod-many')}
                    />
                    <ChoiceCard
                      active={kind === 'prod-one'}
                      title={t('dashboard.menuManager.wizard.oneProduct')}
                      description={t(
                        'dashboard.menuManager.wizard.oneProductDesc'
                      )}
                      onClick={() => applyKindDefaults('prod-one')}
                    />
                    <ChoiceCard
                      active={kind === 'prefs'}
                      title={t('dashboard.menuManager.wizard.freePreferences')}
                      description={t(
                        'dashboard.menuManager.wizard.freePreferencesDesc'
                      )}
                      onClick={() => applyKindDefaults('prefs')}
                    />
                  </div>
                  <WizardActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(0)}
                    >
                      {t('dashboard.common.back')}
                    </Button>
                    <Button type="button" onClick={() => setStep(2)}>
                      {t('continue')}
                    </Button>
                  </WizardActions>
                </div>
              ) : null}

              {step === 2 && kind !== 'prefs' ? (
                <ConfigurationWizardConfigureStep
                  kind={kind}
                  isSaving={isSaving}
                  savingRules={savingRules}
                  onBack={() => setStep(1)}
                  onSave={() => void saveRuleChoice()}
                  canSave={canSaveRule}
                  filteredEligibleCategories={filteredEligibleCategories}
                  categorySearch={categorySearch}
                  setCategorySearch={setCategorySearch}
                  selectedCategoryIds={selectedCategoryIds}
                  toggleCategoryId={toggleCategoryId}
                  categoryProducts={categoryProducts}
                  allProducts={allProducts}
                  filteredProductPickerCategories={filteredProductPickerCategories}
                  productFilterSearch={productFilterSearch}
                  setProductFilterSearch={setProductFilterSearch}
                  productCategoryIds={productCategoryIds}
                  toggleProductCategoryId={toggleProductCategoryId}
                  filteredLinkedProducts={filteredLinkedProducts}
                  productSearch={productSearch}
                  setProductSearch={setProductSearch}
                  linkedProductIds={linkedProductIds}
                  toggleLinkedProduct={toggleLinkedProduct}
                  multipleMode={multipleMode}
                  setMultipleMode={setMultipleMode}
                  required={required}
                  setRequired={setRequired}
                  categorySettings={categorySettings}
                  setCategorySettings={setCategorySettings}
                  productSettings={productSettings}
                  setProductSettings={setProductSettings}
                  showAdvanced={showAdvanced}
                  setShowAdvanced={setShowAdvanced}
                  defaultVariationOptions={defaultVariationOptions}
                  baseVariations={baseVariations}
                />
              ) : null}

              {step === 2 && kind === 'prefs' ? (
                <div className="space-y-4">
                  <StepHeader
                    title={t('dashboard.menuManager.wizard.preferencesQuestion')}
                    hint={t('dashboard.menuManager.wizard.preferencesHint')}
                  />
                  <PersonalizeConfigSection
                    groups={wizardPrefDraft}
                    onChange={setWizardPrefDraft}
                    saving={savingPersonalize}
                    onSave={() => void savePreferences()}
                  />
                  <WizardActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                    >
                      {t('dashboard.common.back')}
                    </Button>
                  </WizardActions>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <StepHeader
                    title={t('dashboard.menuManager.wizard.anythingElse')}
                    hint={t('dashboard.menuManager.wizard.anythingElseHint')}
                  />
                  <div className="space-y-2.5">
                    <ChoiceCard
                      active={false}
                      title={t('dashboard.menuManager.wizard.addAnotherChoice')}
                      description={t(
                        'dashboard.menuManager.wizard.addAnotherChoiceDesc'
                      )}
                      onClick={() => {
                        resetConfigureState();
                        setStep(1);
                      }}
                    />
                    <ChoiceCard
                      active
                      title={t(
                        'dashboard.menuManager.wizard.recommendedDealsPopup'
                      )}
                      description={t(
                        'dashboard.menuManager.wizard.recommendedDealsPopupDesc'
                      )}
                      onClick={() => setStep(4)}
                    />
                    <ChoiceCard
                      active={false}
                      title={t(
                        'dashboard.menuManager.wizard.recommendedProductsCart'
                      )}
                      description={t(
                        'dashboard.menuManager.wizard.recommendedProductsCartDesc'
                      )}
                      onClick={() => setStep(5)}
                    />
                    <ChoiceCard
                      active={false}
                      title={t('dashboard.menuManager.wizard.imFinished')}
                      description={t(
                        'dashboard.menuManager.wizard.imFinishedDesc'
                      )}
                      onClick={() => setStep('done')}
                    />
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <StepHeader
                    title={`What recommended deals should appear with ${selected.name}?`}
                    hint="Optional. When guests tap this item, a popup will ask if they want the product alone or one of these deals."
                  />

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      From categories
                    </p>
                    <SelectableList
                      search={dealCategorySearch}
                      onSearchChange={setDealCategorySearch}
                      searchPlaceholder="Search categories…"
                      emptyMessage="No categories match your search."
                    >
                      {filteredDealCategories.map((cat) => (
                        <SelectableRow
                          key={cat.id}
                          multi
                          active={dealCategoryIds.includes(cat.id)}
                          title={cat.name}
                          imageUrl={cat.imageUrl}
                          onClick={() => {
                            setDealCategoryIds((prev) =>
                              toggleInArray(prev, cat.id)
                            );
                            setSelectedDealProductIds([]);
                          }}
                        />
                      ))}
                    </SelectableList>
                  </div>

                  {dealCategoryIds.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Recommended deals to offer
                      </p>
                      {dealProductsFromSelectedCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No products in these categories (or already offered as deals).
                        </p>
                      ) : (
                        <SelectableList
                          search={dealProductSearch}
                          onSearchChange={setDealProductSearch}
                          searchPlaceholder="Search products…"
                          emptyMessage="No products match your search."
                        >
                          {filteredDealProducts.map((p) => (
                            <SelectableRow
                              key={p.id}
                              multi
                              active={selectedDealProductIds.includes(p.id)}
                              title={p.name}
                              subtitle={p.categoryName}
                              imageUrl={p.imageUrl}
                              onClick={() =>
                                setSelectedDealProductIds((prev) =>
                                  toggleInArray(prev, p.id)
                                )
                              }
                            />
                          ))}
                        </SelectableList>
                      )}
                    </div>
                  ) : null}

                  <WizardActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(3)}
                    >
                      {t('dashboard.common.back')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(5)}
                    >
                      Skip
                    </Button>
                    <Button
                      type="button"
                      disabled={selectedDealProductIds.length === 0 || isSaving}
                      onClick={() => void saveDeals()}
                    >
                      {savingDeals ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('onboarding.step2.saving')}
                        </>
                      ) : (
                        t('dashboard.menuManager.wizard.saveRecommendedDeals')
                      )}
                    </Button>
                  </WizardActions>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  <StepHeader
                    title={`What products should we recommend in the cart with ${selected.name}?`}
                    hint="Optional. Add-on items suggested on the cart page/drawer when this product is in the cart."
                  />

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      From categories
                    </p>
                    <SelectableList
                      search={offerCategorySearch}
                      onSearchChange={setOfferCategorySearch}
                      searchPlaceholder="Search categories…"
                      emptyMessage="No categories match your search."
                    >
                      {filteredOfferCategories.map((cat) => (
                        <SelectableRow
                          key={cat.id}
                          multi
                          active={offerCategoryIds.includes(cat.id)}
                          title={cat.name}
                          imageUrl={cat.imageUrl}
                          onClick={() => {
                            setOfferCategoryIds((prev) =>
                              toggleInArray(prev, cat.id)
                            );
                            setSelectedOfferProductIds([]);
                          }}
                        />
                      ))}
                    </SelectableList>
                  </div>

                  {offerCategoryIds.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Products to recommend in cart
                      </p>
                      {offeredProductsFromSelectedCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No products in these categories (or already offered).
                        </p>
                      ) : (
                        <SelectableList
                          search={offerProductSearch}
                          onSearchChange={setOfferProductSearch}
                          searchPlaceholder="Search products…"
                          emptyMessage="No products match your search."
                        >
                          {filteredOfferProducts.map((p) => (
                            <SelectableRow
                              key={p.id}
                              multi
                              active={selectedOfferProductIds.includes(p.id)}
                              title={p.name}
                              subtitle={p.categoryName}
                              imageUrl={p.imageUrl}
                              onClick={() =>
                                setSelectedOfferProductIds((prev) =>
                                  toggleInArray(prev, p.id)
                                )
                              }
                            />
                          ))}
                        </SelectableList>
                      )}
                    </div>
                  ) : null}

                  <WizardActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(4)}
                    >
                      {t('dashboard.common.back')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep('done')}
                    >
                      Skip
                    </Button>
                    <Button
                      type="button"
                      disabled={selectedOfferProductIds.length === 0 || isSaving}
                      onClick={() => void saveUpsells()}
                    >
                      {savingOffers ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('onboarding.step2.saving')}
                        </>
                      ) : (
                        t('dashboard.menuManager.wizard.saveCartRecommendations')
                      )}
                    </Button>
                  </WizardActions>
                </div>
              ) : null}

              {step === 'done' ? (
                <div className="space-y-4">
                  <StepHeader
                    title={t('dashboard.menuManager.wizard.youreAllSet')}
                    hint={t('dashboard.menuManager.wizard.youreAllSetHint')}
                  />
                  <WizardActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetConfigureState();
                        setStep(0);
                      }}
                    >
                      Add more
                    </Button>
                  </WizardActions>
                </div>
              ) : null}
            </div>

            <div className="border-t border-border px-4 py-4 sm:px-5">
              <SavedSummaryList
                selected={selected}
                savedGroups={allSavedGroups}
                currentDeals={currentDeals}
                currentOffers={currentOffers}
                personalizeDraft={personalizeDraft}
                onDeleteGroup={onDeleteGroup}
                onDeleteDeal={onDeleteDeal}
                onDeleteOffer={onDeleteOffer}
                onDeletePersonalizeGroup={(index) => {
                  const next = personalizeDraft.filter((_, i) => i !== index);
                  onPersonalizeDraftChange(next);
                  void props.onSavePersonalize(next);
                }}
                deletingDeal={deletingDeal}
                deletingDealId={deletingDealId}
                deletingOffer={deletingOffer}
                deletingOfferId={deletingOfferId}
                savingPersonalize={savingPersonalize}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClassicConfigSections({
  selected,
  localCategories,
  allProducts,
  linkedOptions,
  savedGroupsByType,
  savingRules,
  savingAll,
  onSaveDraft,
  draftChangeHandlers,
  onDeleteGroup,
  dealCategoryIds,
  setDealCategoryIds,
  selectedDealProductIds,
  setSelectedDealProductIds,
  dealProductsFromSelectedCategories,
  currentDeals,
  savingDeals,
  onSaveDeals,
  onDeleteDeal,
  deletingDeal,
  deletingDealId,
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
  personalizeDraft,
  onPersonalizeDraftChange,
  savingPersonalize,
  loadingPersonalize = false,
  onSavePersonalize,
  formResetKeys,
  draftByVariant,
}: ConfigurationWizardProps) {
  const { t } = useTranslation();
  const isSaving =
    savingRules ||
    savingDeals ||
    savingOffers ||
    savingAll ||
    savingPersonalize;

  const formProps = {
    selected,
    localCategories,
    allProducts,
    saving: isSaving,
    onSave: onSaveDraft,
    draftByVariant,
  };

  return (
    <div className="space-y-5">
      {(
        [
          ['category-single', savedGroupsByType.categorySingle],
          ['category-multiple', savedGroupsByType.categoryMultiple],
          ['product-single', savedGroupsByType.productSingle],
          ['product-multiple', savedGroupsByType.productMultiple],
        ] as const
      ).map(([variant, groups], index) => (
        <RecommendationConfigSectionShell
          key={variant}
          step={index + 1}
          title={RECOMMENDATION_SECTION_LABELS[variant]}
          description=""
        >
          <SavedGroupList groups={groups} onDelete={onDeleteGroup} />
          <RecommendationRuleForm
            variant={variant}
            {...formProps}
            resetKey={`${selected.id}:${formResetKeys[variant]}`}
            saveLabel={`Save ${RECOMMENDATION_SECTION_LABELS[variant]}`}
            onDraftChange={draftChangeHandlers[variant]}
          />
        </RecommendationConfigSectionShell>
      ))}

      <RecommendationConfigSectionShell
        step={5}
        title={t('dashboard.menuManager.wizard.personalizeTitle')}
        description={t('dashboard.menuManager.wizard.personalizeDesc')}
      >
        <PersonalizeConfigSection
          groups={personalizeDraft}
          onChange={onPersonalizeDraftChange}
          saving={savingPersonalize}
          loading={loadingPersonalize}
          onSave={() => void onSavePersonalize()}
        />
      </RecommendationConfigSectionShell>

      <RecommendationConfigSectionShell
        step={6}
        title={t('dashboard.menuManager.wizard.recommendedDeals')}
        description={t('dashboard.menuManager.wizard.recommendedDealsDesc')}
      >
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Categories to offer deals from (scrollable list)
          </p>
          <SelectableList
            emptyMessage="No categories available."
            maxHeightClass="max-h-48"
          >
            {linkedOptions.map((cat) => {
              const checked = dealCategoryIds.includes(cat.id);
              return (
                <SelectableRow
                  key={`deal-cat-${cat.id}`}
                  multi
                  active={checked}
                  title={cat.name}
                  imageUrl={cat.imageUrl}
                  subtitle={
                    isMenuCategoryShownInFront(cat)
                      ? t('dashboard.menuManager.wizard.onCustomerMenu')
                      : t('dashboard.menuManager.wizard.addonOnly')
                  }
                  onClick={() => {
                    setDealCategoryIds((prev) => toggleInArray(prev, cat.id));
                    setSelectedDealProductIds([]);
                  }}
                />
              );
            })}
          </SelectableList>
        </div>

        {dealCategoryIds.length > 0 &&
          dealProductsFromSelectedCategories.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Select specific products for the deal (scrollable)
            </p>
            <div className="max-h-72 overflow-y-auto overscroll-contain p-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border bg-muted/10">
              {dealProductsFromSelectedCategories.map((p) => {
                const checked = selectedDealProductIds.includes(p.id);
                return (
                  <label
                    key={`deal-product-${p.id}`}
                    className="group relative block cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() =>
                        setSelectedDealProductIds((prev) =>
                          toggleInArray(prev, p.id)
                        )
                      }
                    />
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 text-sm transition',
                        checked
                          ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <LazyProductImage
                        src={p.imageUrl}
                        hasImage={Boolean(p.imageUrl)}
                        alt=""
                        emptyLabel="—"
                        className="h-11 w-11 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.categoryName}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={() => void onSaveDeals()}
          disabled={isSaving || selectedDealProductIds.length === 0}
          className="w-full"
        >
          {savingDeals ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('onboarding.step2.saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('dashboard.menuManager.wizard.saveRecommendedDeals')}
            </>
          )}
        </Button>

        {currentDeals.length > 0 ? (
          <ul className="space-y-2 border-t border-border pt-4">
            {currentDeals.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{deal.dealItem.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onDeleteDeal(deal.id)}
                  disabled={deletingDeal && deletingDealId === deal.id}
                >
                  {deletingDeal && deletingDealId === deal.id ? (
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

      <RecommendationConfigSectionShell
        step={7}
        title={t('dashboard.menuManager.wizard.recommendedProductsCart')}
        description={t('dashboard.menuManager.wizard.recommendedProductsCartDesc')}
      >
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Categories to recommend products in cart from (scrollable list)
          </p>
          <SelectableList
            emptyMessage="No categories available."
            maxHeightClass="max-h-48"
          >
            {linkedOptions.map((cat) => {
              const checked = offerCategoryIds.includes(cat.id);
              return (
                <SelectableRow
                  key={`offer-cat-${cat.id}`}
                  multi
                  active={checked}
                  title={cat.name}
                  imageUrl={cat.imageUrl}
                  subtitle={
                    isMenuCategoryShownInFront(cat)
                      ? t('dashboard.menuManager.wizard.onCustomerMenu')
                      : t('dashboard.menuManager.wizard.addonOnly')
                  }
                  onClick={() => {
                    setOfferCategoryIds((prev) => toggleInArray(prev, cat.id));
                    setSelectedOfferProductIds([]);
                  }}
                />
              );
            })}
          </SelectableList>
        </div>

        {offerCategoryIds.length > 0 &&
          offeredProductsFromSelectedCategories.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Select specific products for cart recommendations (scrollable)
            </p>
            <div className="max-h-72 overflow-y-auto overscroll-contain p-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border bg-muted/10">
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
                        'flex items-center gap-3 rounded-xl border p-3 text-sm transition',
                        checked
                          ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <LazyProductImage
                        src={p.imageUrl}
                        hasImage={Boolean(p.imageUrl)}
                        alt=""
                        emptyLabel="—"
                        className="h-11 w-11 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.categoryName}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={() => void onSaveOffers()}
          disabled={isSaving || selectedOfferProductIds.length === 0}
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
              Save recommended products
            </>
          )}
        </Button>

        {currentOffers.length > 0 ? (
          <ul className="space-y-2 border-t border-border pt-4">
            {currentOffers.map((offer) => (
              <li
                key={offer.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{offer.offeredItem.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onDeleteOffer(offer.id)}
                  disabled={deletingOffer && deletingOfferId === offer.id}
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
            <p className="font-medium">
              {resolveBilingualText(g.name, 'en')}
            </p>
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
