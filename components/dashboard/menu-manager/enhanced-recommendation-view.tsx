'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ChevronDown, ChevronRight, GripVertical, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BILINGUAL_SEPARATOR, resolveBilingualText } from '@/lib/menu/bilingual-text';
import { variationLabel } from '@/lib/menu/recommendation-category-limits';
import {
  buildWizardRuleDraft,
  defaultCategorySettings,
  emptyRuleDraft,
} from '@/lib/menu/configuration-wizard-draft';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { useOwnerRestaurantRegional } from '@/hooks/use-restaurant-regional';
import type { RecommendationRuleDraft } from '@/components/dashboard/menu-manager/recommendation-rule-form';
import type { MenuItemRow } from '@/components/dashboard/menu-manager/types';
import {
  ChoiceCard,
  StepHeader,
  WizardActions,
  WizardProgress,
  type ConfigurationWizardProps,
  type WizardStep,
} from '@/components/dashboard/menu-manager/configuration-wizard';
import { SelectableList, SelectableRow } from '@/components/dashboard/menu-manager/selectable-list';
import { LazyProductImage } from '@/components/dashboard/menu-manager/lazy-product-image';
import { useTranslation } from 'react-i18next';

type PickerProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
};

type ParentVar = { id: string; name: string; min: number; max: number };

type Block = {
  id: string;
  discount: string;
  extra: string;
  freeQty: string;
  min: number;
  max: number;
  parentVars: ParentVar[];
  productIds: string[];
  freeIds: string[];
  defaultProductId: string;
};


function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return copy;
}

export function EnhancedRecommendationView(
  props: ConfigurationWizardProps
) {
  const { t } = useTranslation();
  const w = (key: string, opts?: Record<string, string>) =>
    t(`dashboard.menuManager.wizard.${key}`, opts);
  const uiLang = useUiLanguage();
  const { formatMoney } = useOwnerRestaurantRegional();
  const {
    selected,
    linkedOptions,
    savingRules,
    onSaveDraft,
    draftChangeHandlers,
    onViewModeChange,
    viewMode,
    dealCategoryIds,
    setDealCategoryIds,
    selectedDealProductIds,
    setSelectedDealProductIds,
    dealProductsFromSelectedCategories,
    offerCategoryIds,
    setOfferCategoryIds,
    selectedOfferProductIds,
    setSelectedOfferProductIds,
    offeredProductsFromSelectedCategories,
    savingDeals,
    onSaveDeals,
    savingOffers,
    onSaveOffers,
    toggleInArray,
  } = props;

  const parentSizes = useMemo(
    () =>
      (selected.variations ?? []).map((v) => ({
        id: v.id,
        name: variationLabel(v),
      })),
    [selected.variations]
  );

  const [step, setStep] = useState<WizardStep>(0);
  const [backTo, setBackTo] = useState<WizardStep>(0);
  const [rearrange, setRearrange] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuQuery, setMenuQuery] = useState('');
  const [productListQuery, setProductListQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [closedCats, setClosedCats] = useState<Record<string, boolean>>({});
  const [dealCategorySearch, setDealCategorySearch] = useState('');
  const [dealProductSearch, setDealProductSearch] = useState('');
  const [offerCategorySearch, setOfferCategorySearch] = useState('');
  const [offerProductSearch, setOfferProductSearch] = useState('');
  const [title, setTitle] = useState('');
  const [requiredChoice, setRequiredChoice] = useState(false);
  const dragKey = useRef<string | null>(null);
  const [source, setSource] = useState<'category' | 'product' | null>(null);
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([]);
  const [linkedProductId, setLinkedProductId] = useState('');
  const [mode, setMode] = useState<'one' | 'many'>('one');
  const [severalStyle, setSeveralStyle] = useState<'check' | 'qty'>('check');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, PickerProduct[]>
  >({});
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null);

  const parentRows = (): ParentVar[] =>
    parentSizes.map((v) => ({ id: v.id, name: v.name, min: 1, max: 3 }));

  const loadCategoryProducts = async (categoryId: string) => {
    if (productsByCategory[categoryId]) return;
    setLoadingCategoryId(categoryId);
    try {
      const collected: PickerProduct[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 20) {
        const res = await axios.get<{
          data: {
            products: PickerProduct[];
            pagination: { hasNextPage: boolean };
          };
        }>('/api/restaurant/menu/products', {
          params: {
            page,
            limit: 24,
            categoryIds: categoryId,
            includeCategories: '0',
          },
        });
        collected.push(...(res.data.data.products ?? []));
        hasMore = res.data.data.pagination.hasNextPage;
        page += 1;
      }
      setProductsByCategory((prev) => ({ ...prev, [categoryId]: collected }));
    } finally {
      setLoadingCategoryId(null);
    }
  };

  const addCategory = (categoryId: string) => {
    if (!categoryId || blocks.some((b) => b.id === categoryId)) return;
    setBlocks((prev) => [
      ...prev,
      {
        id: categoryId,
        discount: '',
        extra: '',
        freeQty: '',
        min: 0,
        max: mode === 'one' ? 1 : 3,
        parentVars: parentRows(),
        productIds: [],
        freeIds: [],
        defaultProductId: '',
      },
    ]);
    void loadCategoryProducts(categoryId);
  };

  const draft = useMemo(() => {
    if (source === 'product') {
      const next = buildWizardRuleDraft({
        kind: 'prod-one',
        required: requiredChoice,
        multipleMode: 'CHECKBOX',
        selectedCategoryIds: [],
        productCategoryIds,
        linkedProductIds: linkedProductId ? [linkedProductId] : [],
        categorySettings: {},
        productSettings: {},
        baseVariations: parentSizes,
      });
      next.required = requiredChoice;
      if (title.trim()) next.guestTitle = title.trim();
      return next;
    }
    const categorySettings: Parameters<typeof buildWizardRuleDraft>[0]['categorySettings'] =
      {};
    for (const block of blocks) {
      const products = productsByCategory[block.id] ?? [];
      const productOverrides: Record<string, { excluded: boolean; free: boolean }> =
        {};
      for (const product of products) {
        const picked = block.productIds.includes(product.id);
        const free = picked && block.freeIds.includes(product.id);
        if (!picked || free) {
          productOverrides[product.id] = { excluded: !picked, free };
        }
      }
      const usePerSize = mode === 'many' && block.parentVars.length > 0;
      const base = defaultCategorySettings(block.min, block.max);
      categorySettings[block.id] = {
        ...base,
        discountPercent: block.discount === '' ? null : Number(block.discount) || 0,
        extraCostPercent: block.extra === '' ? null : Number(block.extra) || 0,
        freeQuantity:
          mode === 'many' && block.freeQty !== ''
            ? Math.max(0, Number(block.freeQty) || 0)
            : undefined,
        usePerSizeLimits: usePerSize,
        perSizeLimits: usePerSize
          ? block.parentVars.map((v) => ({
              variationId: v.id,
              minItems: v.min,
              maxItems: Math.max(1, v.max),
            }))
          : [],
        defaultItemId: block.defaultProductId,
        productOverrides,
      };
    }
    const next = buildWizardRuleDraft({
      kind: mode === 'one' ? 'cat-one' : 'cat-many',
      required: requiredChoice,
      multipleMode: severalStyle === 'qty' ? 'QUANTITY' : 'CHECKBOX',
      selectedCategoryIds: blocks.map((b) => b.id),
      productCategoryIds: [],
      linkedProductIds: [],
      categorySettings,
      productSettings: {},
      baseVariations: parentSizes,
    });
    next.required = requiredChoice;
    if (title.trim()) next.guestTitle = title.trim();
    if (mode === 'many') {
      for (const block of blocks) {
        if (block.freeQty === '') continue;
        next.categoryFreeQuantity[block.id] = Math.max(0, Number(block.freeQty) || 0);
      }
    }
    return next;
  }, [
    blocks,
    linkedProductId,
    mode,
    parentSizes,
    productCategoryIds,
    productsByCategory,
    requiredChoice,
    severalStyle,
    source,
    title,
  ]);

  const handlersRef = useRef(draftChangeHandlers);
  handlersRef.current = draftChangeHandlers;
  useEffect(() => {
    const handlers = handlersRef.current;
    if (source === 'product') {
      handlers['product-single'](draft);
      handlers['category-single'](emptyRuleDraft('CATEGORY', 'SINGLE'));
      handlers['category-multiple'](emptyRuleDraft('CATEGORY', 'MULTIPLE'));
      return;
    }
    const variant = mode === 'one' ? 'category-single' : 'category-multiple';
    const other = mode === 'one' ? 'category-multiple' : 'category-single';
    handlers[variant](draft);
    handlers[other](
      emptyRuleDraft('CATEGORY', other === 'category-single' ? 'SINGLE' : 'MULTIPLE')
    );
    handlers['product-single'](emptyRuleDraft('PRODUCT', 'SINGLE'));
  }, [draft, mode, source]);

  const go = (next: WizardStep, back?: WizardStep) => {
    if (back != null) setBackTo(back);
    setOpenMenu(null);
    setStep(next);
  };

  const saveRecommendation = async () => {
    if (!title.trim()) return;
    if (source === 'product') {
      if (!linkedProductId || productCategoryIds.length === 0) return;
    } else if (blocks.length === 0 || blocks.some((b) => b.productIds.length === 0)) {
      return;
    }
    const ok = await onSaveDraft(draft as RecommendationRuleDraft);
    if (ok) go(3, 2);
  };

  const matches = (value: string, query: string) =>
    resolveBilingualText(value, uiLang).toLowerCase().includes(query);

  const available = linkedOptions.filter((c) => !blocks.some((b) => b.id === c.id));
  const productCategoryOptions = linkedOptions.filter((c) => !productCategoryIds.includes(c.id));
  const productChoices = productCategoryIds.flatMap((id) => productsByCategory[id] ?? []).filter((product, index, list) => (
    product.id !== selected.id && list.findIndex((row) => row.id === product.id) === index
  ));
  const chosenProduct = productChoices.find((product) => product.id === linkedProductId) ?? null;

  function placeMenu(key: string, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove : spaceBelow));
    setMenuPos({
      top: openUp ? Math.max(8, rect.top - 4 - maxHeight) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
    setMenuQuery('');
    setOpenMenu((current) => (current === key ? null : key));
  }

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-recommendation-menu]')) return;
      setOpenMenu(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  return (
    <div className="space-y-4">
      <ViewSwitch
        viewMode={viewMode}
        selected={selected}
        onViewModeChange={onViewModeChange}
      />
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <WizardProgress step={step} />
        </div>
        <div className={cn('px-4 py-4 sm:px-5', step === 2 && 'px-0 sm:px-0')}>
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
              description={t('dashboard.menuManager.wizard.yesCustomizeDesc')}
              onClick={() => go(1, 0)}
            />
            <ChoiceCard
              active={false}
              title={t('dashboard.menuManager.wizard.noCustomize')}
              description={t('dashboard.menuManager.wizard.noCustomizeDesc')}
              onClick={() => go(4, 0)}
            />
          </div>
          <WizardActions>
            <Button type="button" onClick={() => go(1, 0)}>
              {t('continue')}
            </Button>
          </WizardActions>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <StepHeader title={w('sourceQuestion')} hint={w('sourceHint')} />
          <div className="space-y-2">
            <ChoiceCard
              active={source === 'category'}
              title={w('categoryRecommendation')}
              description={w('categoryRecommendationDesc')}
              onClick={() => {
                setSource('category');
                go(2, 1);
              }}
            />
            <ChoiceCard
              active={source === 'product'}
              title={w('productRecommendation')}
              description={w('productRecommendationDesc')}
              onClick={() => {
                setSource('product');
                go(2, 1);
              }}
            />
          </div>
          <WizardActions>
            <Button type="button" variant="outline" onClick={() => go(0)}>
              {t('dashboard.common.back')}
            </Button>
          </WizardActions>
        </div>
      ) : null}

      {step === 2 && source !== 'product' ? (
        <section className="rounded-[14px] border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3 px-[18px] pb-2 pt-[18px]">
            <div className="text-base font-bold">{w('recommendation')}</div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex rounded-full border border-border bg-muted p-[3px]">
                <SegButton on={mode === 'one'} onClick={() => setMode('one')}>{w('single')}</SegButton>
                <SegButton on={mode === 'many'} onClick={() => setMode('many')}>{w('several')}</SegButton>
              </div>
              {mode === 'many' ? (
                <div className="flex rounded-full border border-border bg-muted p-[3px]">
                  <SegButton small on={severalStyle === 'check'} onClick={() => setSeveralStyle('check')}>{w('checkboxes')}</SegButton>
                  <SegButton small on={severalStyle === 'qty'} onClick={() => setSeveralStyle('qty')}>{w('quantity')}</SegButton>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mx-[18px] mb-3.5">
            <label className="mb-2 block text-sm font-semibold">
              {w('titleLabel')} <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              placeholder={w('titlePlaceholder', { separator: BILINGUAL_SEPARATOR })}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-[10px] border-border bg-background"
            />
           
          </div>
          <div className="flex items-center justify-between px-[18px] pb-2.5">
            <h3 className="text-base font-bold">{w('categories')}</h3>
            <div className="flex items-center gap-2">
            <label className="flex items-center text-sm text-destructive font-semibold cursor-pointer gap-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={requiredChoice}
                  onChange={(e) => setRequiredChoice(e.target.checked)}
                />
                {w('required')}
              </label>
            <button type="button" className="inline-flex items-center gap-1 text-sm underline" onClick={() => setRearrange((v) => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M7 3v18" /><path d="M3 17l4 4 4-4" /><path d="M17 21V3" /><path d="M13 7l4-4 4 4" />
              </svg>
              {rearrange ? w('doneRearrange') : w('rearrange')}
            </button>
            </div>
            

          </div>
          <p className="-mt-1 mb-3 px-[18px] text-[13px] text-muted-foreground">
            {w('modeHint')}
          </p>
          <div className="relative mx-[18px] mb-3.5">
            <button
              type="button"
              className="w-full rounded-[10px] border border-border bg-background px-3 py-[11px] text-left text-muted-foreground"
              onClick={(e) => placeMenu('cat', e.currentTarget)}
            >
              {w('addCategory')}
            </button>
            {openMenu === 'cat'
              ? createPortal(
                  <div
                    data-recommendation-menu
                    className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                    style={menuPos ?? undefined}
                  >
                    <MenuSearch
                      value={menuQuery}
                      placeholder={w('searchCategories')}
                      onChange={setMenuQuery}
                    />
                    {available.length === 0 ? (
                      <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('allCategoriesAdded')}</p>
                    ) : available.filter((cat) => matches(cat.name, menuQuery.trim().toLowerCase())).length === 0 ? (
                      <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('noCategoriesMatch')}</p>
                    ) : available.filter((cat) => matches(cat.name, menuQuery.trim().toLowerCase())).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className="flex w-full justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => { addCategory(cat.id); setOpenMenu(null); }}
                      >
                        <span>{resolveBilingualText(cat.name, uiLang)}</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              : null}
          </div>

            <div className="mt-3 space-y-3">
              {blocks.map((block, index) => {
                const cat = linkedOptions.find((c) => c.id === block.id);
                const products = productsByCategory[block.id] ?? [];
                const byParent = mode === 'many' && block.parentVars.length > 0;
                const open = !closedCats[block.id];
                const left = products.filter((p) => !block.productIds.includes(p.id));
                const pickedProducts = block.productIds
                  .map((id) => products.find((p) => p.id === id))
                  .filter((p): p is PickerProduct => Boolean(p));
                return (
                  <div
                    key={block.id}
                    className="relative mx-3 mb-3 rounded-xl border border-border"
                    onDragOver={(e) => {
                      if (!dragKey.current?.startsWith('cat:')) return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = (e.dataTransfer.getData('text/plain') || dragKey.current || '').replace(/^cat:/, '');
                      if (!from || from === block.id) return;
                      setBlocks((prev) => {
                        const i = prev.findIndex((b) => b.id === from);
                        const j = prev.findIndex((b) => b.id === block.id);
                        if (i < 0 || j < 0) return prev;
                        const copy = [...prev];
                        const [row] = copy.splice(i, 1);
                        copy.splice(j, 0, row);
                        return copy;
                      });
                      dragKey.current = null;
                    }}
                  >
                    <div className="flex items-center gap-2 bg-card px-3 py-3">
                      <button type="button" className="w-7 text-xs" onClick={() => setClosedCats((prev) => ({ ...prev, [block.id]: !prev[block.id] }))}>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      {rearrange ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            draggable
                            title={w('dragToReorder')}
                            className="cursor-grab text-muted-foreground active:cursor-grabbing"
                            onDragStart={(e) => {
                              const key = `cat:${block.id}`;
                              dragKey.current = key;
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', key);
                            }}
                            onDragEnd={() => { dragKey.current = null; }}
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <button type="button" className="rounded-lg border border-border bg-card px-1.5" onClick={() => setBlocks((prev) => moveItem(prev, index, -1))}>↑</button>
                          <button type="button" className="rounded-lg border border-border bg-card px-1.5" onClick={() => setBlocks((prev) => moveItem(prev, index, 1))}>↓</button>
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {cat ? resolveBilingualText(cat.name, uiLang) : w('categoryFallback')}
                        <span className="ml-1 font-medium text-muted-foreground">({block.productIds.length})</span>
                      </span>
                      <button
                        type="button"
                        className="text-sm font-semibold text-destructive"
                        onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                      >
                        ✕ {w('removeItem')}
                      </button>
                    </div>
                    {open ? <div className="border-t border-border px-3 py-3">
                      <details>
                        <summary className="w-fit cursor-pointer rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
                          {w('showMore')}
                        </summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-5">
                          <Num label={w('discountPercent')} value={block.discount} onChange={(v) => patchBlock(setBlocks, block.id, { discount: v })} />
                          <Num label={w('extraPayPercent')} value={block.extra} onChange={(v) => patchBlock(setBlocks, block.id, { extra: v })} />
                          <Num
                            label={w('freeItems')}
                            value={block.freeQty}
                            disabled={mode !== 'many'}
                            onChange={(v) => patchBlock(setBlocks, block.id, { freeQty: v })}
                          />
                          {byParent ? null : (
                            <>
                              <Num label={w('min')} value={String(block.min)} disabled={mode === 'one'} onChange={(v) => patchBlock(setBlocks, block.id, { min: Math.max(0, Number(v) || 0) })} />
                              <Num label={w('max')} value={String(block.max)} disabled={mode === 'one'} onChange={(v) => patchBlock(setBlocks, block.id, { max: Math.max(1, Number(v) || 1) })} />
                            </>
                          )}
                        </div>
                        <label className="mt-3 block text-xs font-medium text-muted-foreground">
                          {t('dashboard.menuManager.wizardConfig.defaultItemBaseline')}
                          <select
                            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                            value={block.defaultProductId}
                            onChange={(e) => patchBlock(setBlocks, block.id, { defaultProductId: e.target.value })}
                          >
                            <option value="">{t('dashboard.menuManager.wizardConfig.noneChargeFullPrice')}</option>
                            {(productsByCategory[block.id] ?? []).map((product) => (
                              <option key={product.id} value={product.id}>
                                {resolveBilingualText(product.name, uiLang)} — {formatMoney(product.price)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {byParent ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-border">
                            <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
                              {w('byParentLimits', { name: resolveBilingualText(selected.name, uiLang) })}
                            </p>
                            {block.parentVars.map((v) => (
                              <div key={v.id} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 border-t border-border px-3 py-2 text-sm">
                                <span>{v.name}</span>
                                <Input type="number" min={0} value={v.min} onChange={(e) => patchVar(setBlocks, block.id, v.id, 'min', Math.max(0, Number(e.target.value) || 0))} />
                                <Input type="number" min={1} value={v.max} onChange={(e) => patchVar(setBlocks, block.id, v.id, 'max', Math.max(1, Number(e.target.value) || 1))} />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </details>

                      <div className="relative my-3">
                        <button
                          type="button"
                          className="w-full rounded-[10px] border border-border bg-background px-3 py-[11px] text-left text-muted-foreground"
                          onClick={(e) => placeMenu(`prod:${block.id}`, e.currentTarget)}
                        >
                          {w('addProducts')}
                        </button>
                        {openMenu === `prod:${block.id}` ? createPortal(
                          <div
                            data-recommendation-menu
                    className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                            style={menuPos ?? undefined}
                          >
                            <MenuSearch
                              value={menuQuery}
                              placeholder={t('dashboard.menuManager.recommendations.searchProductsPlaceholder')}
                              onChange={setMenuQuery}
                            />
                            {left.length === 0 ? (
                              <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('allProductsAdded')}</p>
                            ) : left.filter((product) => matches(product.name, menuQuery.trim().toLowerCase())).length === 0 ? (
                              <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('noProductsMatch')}</p>
                            ) : left.filter((product) => matches(product.name, menuQuery.trim().toLowerCase())).map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="flex w-full justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => {
                                  setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, productIds: [...b.productIds, product.id] } : b));
                                  setOpenMenu(null);
                                }}
                              >
                                <span>{resolveBilingualText(product.name, uiLang)}</span>
                                <span className="text-muted-foreground">{formatMoney(product.price)}</span>
                              </button>
                            ))}
                          </div>,
                          document.body
                        ) : null}
                      </div>
                      {left.length > 0 ? (
                        <button
                          type="button"
                          className="mb-2 block text-[13px] underline"
                          onClick={() => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, productIds: products.map((p) => p.id) } : b))}
                        >
                          {w('useEveryProduct', { name: cat ? resolveBilingualText(cat.name, uiLang) : w('thisCategory') })}
                        </button>
                      ) : null}
                      {loadingCategoryId === block.id ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('dashboard.menuManager.ruleForm.loadingProducts')}
                        </p>
                      ) : pickedProducts.map((product, productIndex) => (
                        <div
                          key={product.id}
                          className={cn('grid items-center gap-2 rounded-[10px] px-2 py-2.5', rearrange ? 'grid-cols-[auto_40px_1fr_auto]' : 'grid-cols-[28px_40px_1fr_auto]', productIndex % 2 === 1 && 'bg-muted/60')}
                          onDragOver={(e) => {
                            if (!dragKey.current?.startsWith(`prod:${block.id}:`)) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const from = (e.dataTransfer.getData('text/plain') || dragKey.current || '');
                            const prefix = `prod:${block.id}:`;
                            if (!from.startsWith(prefix)) return;
                            const fromId = from.slice(prefix.length);
                            setBlocks((prev) => prev.map((b) => {
                              if (b.id !== block.id) return b;
                              const i = b.productIds.indexOf(fromId);
                              const j = b.productIds.indexOf(product.id);
                              if (i < 0 || j < 0 || i === j) return b;
                              const productIds = [...b.productIds];
                              const [row] = productIds.splice(i, 1);
                              productIds.splice(j, 0, row);
                              return { ...b, productIds };
                            }));
                            dragKey.current = null;
                          }}
                        >
                          <div className="inline-flex items-center gap-1 text-muted-foreground">
                            <span
                              draggable={rearrange}
                              title={w('dragToReorder')}
                              className={cn(rearrange ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')}
                              onDragStart={(e) => {
                                if (!rearrange) return;
                                const key = `prod:${block.id}:${product.id}`;
                                dragKey.current = key;
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', key);
                              }}
                              onDragEnd={() => { dragKey.current = null; }}
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>
                            {rearrange ? (
                              <>
                                <button type="button" className="rounded-lg border border-border bg-card px-1.5 text-foreground" onClick={() => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, productIds: moveItem(b.productIds, productIndex, -1) } : b))}>↑</button>
                                <button type="button" className="rounded-lg border border-border bg-card px-1.5 text-foreground" onClick={() => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, productIds: moveItem(b.productIds, productIndex, 1) } : b))}>↓</button>
                              </>
                            ) : null}
                          </div>
                          <LazyProductImage src={product.imageUrl} hasImage={Boolean(product.imageUrl)} alt="" className="h-10 w-10 rounded-full" emptyLabel={resolveBilingualText(product.name, uiLang).slice(0, 1)} />
                          <div>
                            <div className="text-sm font-bold">{resolveBilingualText(product.name, uiLang)}</div>
                            <div className="text-[13px] text-muted-foreground">
                              {block.freeIds.includes(product.id) ? t('dashboard.menuManager.ruleForm.free') : formatMoney(product.price)}
                            </div>
                            
                          </div>
                          <div className="flex items-center gap-10">
                          <label className="flex items-center gap-2 text-sm font-semibold">
                              <input
                                type="checkbox"
                                checked={block.freeIds.includes(product.id)}
                                onChange={(e) => setBlocks((prev) => prev.map((b) => {
                                  if (b.id !== block.id) return b;
                                  const freeIds = e.target.checked
                                    ? [...b.freeIds, product.id]
                                    : b.freeIds.filter((id) => id !== product.id);
                                  return { ...b, freeIds };
                                }))}
                              />
                              {t('dashboard.menuManager.ruleForm.free')}
                            </label>
                          <button
                            type="button"
                            className="text-sm font-semibold text-destructive"
                            onClick={() => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, productIds: b.productIds.filter((id) => id !== product.id), freeIds: b.freeIds.filter((id) => id !== product.id) } : b))}
                          >
                            ✕ {w('removeItem')}
                          </button>
                          </div>
                        </div>
                      ))}
                    </div> : null}
                  </div>
                );
              })}
            </div>

          <div className="flex justify-end gap-2 px-[18px] pb-[18px] pt-2">
            <button type="button" className="rounded-[10px] border border-border bg-card px-4 py-2.5 font-semibold" onClick={() => go(1)}>
              {w('back')}
            </button>
            <button
              type="button"
              className="rounded-[10px] bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              disabled={savingRules || !title.trim() || blocks.length === 0 || blocks.some((b) => b.productIds.length === 0)}
              onClick={() => void saveRecommendation()}
            >
              {savingRules ? w('saving') : w('saveRecommendation')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && source === 'product' ? (
        <section className="rounded-[14px] border border-border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3 px-[18px] pb-2 pt-[18px]">
            <div className="text-base font-bold">{w('productRecommendation')}</div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={requiredChoice}
                onChange={(e) => setRequiredChoice(e.target.checked)}
              />
              {w('required')}
            </label>
          </div>
          <div className="mx-[18px] mb-3.5">
            <label className="mb-2 block text-sm font-semibold">
              {w('titleLabel')} <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              placeholder={w('titlePlaceholder', { separator: BILINGUAL_SEPARATOR })}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-[10px] border-border bg-background"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {w('titleHint', { separator: BILINGUAL_SEPARATOR })}
            </p>
            <span className="mt-2 inline-block rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{w('visibleToGuest')}</span>
          </div>
          <div className="px-[18px] pb-2">
            <h3 className="text-base font-bold">{w('findProductCategories')}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">{w('oneProductNote')}</p>
          </div>
          <div className="relative mx-[18px] mb-3">
            <button
              type="button"
              className="w-full rounded-[10px] border border-border bg-background px-3 py-[11px] text-left text-muted-foreground"
              onClick={(e) => placeMenu('prod-cat', e.currentTarget)}
            >
              {w('addCategory')}
            </button>
            {openMenu === 'prod-cat'
              ? createPortal(
                  <div
                    data-recommendation-menu
                    className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                    style={menuPos ?? undefined}
                  >
                    <MenuSearch
                      value={menuQuery}
                      placeholder={w('searchCategories')}
                      onChange={setMenuQuery}
                    />
                    {productCategoryOptions.length === 0 ? (
                      <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('allCategoriesAdded')}</p>
                    ) : productCategoryOptions.filter((cat) => matches(cat.name, menuQuery.trim().toLowerCase())).length === 0 ? (
                      <p className="px-2.5 py-2 text-[13px] text-muted-foreground">{w('noCategoriesMatch')}</p>
                    ) : productCategoryOptions.filter((cat) => matches(cat.name, menuQuery.trim().toLowerCase())).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setProductCategoryIds((prev) => prev.includes(cat.id) ? prev : [...prev, cat.id]);
                          void loadCategoryProducts(cat.id);
                          setOpenMenu(null);
                        }}
                      >
                        {resolveBilingualText(cat.name, uiLang)}
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              : null}
          </div>
          {productCategoryIds.length > 0 ? (
            <div className="mx-[18px] mb-3 flex flex-wrap gap-2">
              {productCategoryIds.map((id) => {
                const cat = linkedOptions.find((row) => row.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-sm"
                    onClick={() => {
                      setProductCategoryIds((prev) => prev.filter((row) => row !== id));
                      const remaining = productCategoryIds.filter((row) => row !== id);
                      const stillThere = remaining.some((row) =>
                        (productsByCategory[row] ?? []).some((product) => product.id === linkedProductId)
                      );
                      if (!stillThere) setLinkedProductId('');
                    }}
                  >
                    {cat ? resolveBilingualText(cat.name, uiLang) : w('categoryFallback')} ✕
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="mx-[18px] mb-4">
            <h3 className="mb-2 text-base font-bold">{w('chooseOneProduct')}</h3>
            {loadingCategoryId && productCategoryIds.includes(loadingCategoryId) ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('dashboard.menuManager.ruleForm.loadingProducts')}
              </p>
            ) : productCategoryIds.length === 0 ? null : productChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{w('noProductsInCategories')}</p>
            ) : (
              <SelectableList
                emptyMessage={w('noProductsInCategories')}
                maxHeightClass="max-h-72"
                search={productListQuery}
                onSearchChange={setProductListQuery}
                searchPlaceholder={t('dashboard.menuManager.recommendations.searchProductsPlaceholder')}
              >
                {productChoices.filter((product) => matches(product.name, productListQuery.trim().toLowerCase())).map((product) => (
                  <SelectableRow
                    key={product.id}
                    active={linkedProductId === product.id}
                    title={resolveBilingualText(product.name, uiLang)}
                    subtitle={formatMoney(product.price)}
                    imageUrl={product.imageUrl}
                    onClick={() => setLinkedProductId(product.id)}
                  />
                ))}
              </SelectableList>
            )}
            {chosenProduct ? (
              <p className="mt-2 text-sm font-semibold">
                {resolveBilingualText(chosenProduct.name, uiLang)}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 px-[18px] pb-[18px]">
            <button type="button" className="rounded-[10px] border border-border bg-card px-4 py-2.5 font-semibold" onClick={() => go(1)}>
              {w('back')}
            </button>
            <button
              type="button"
              className="rounded-[10px] bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              disabled={savingRules || !title.trim() || !linkedProductId || productCategoryIds.length === 0}
              onClick={() => void saveRecommendation()}
            >
              {savingRules ? w('saving') : w('saveRecommendation')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <StepHeader
            title={t('dashboard.menuManager.wizard.anythingElse')}
            hint={t('dashboard.menuManager.wizard.anythingElseHint')}
          />
          <div className="space-y-2.5">
            <ChoiceCard
              active
              title={t('dashboard.menuManager.wizard.recommendedDealsPopup')}
              description={t('dashboard.menuManager.wizard.recommendedDealsPopupDesc')}
              onClick={() => go(4, 3)}
            />
            <ChoiceCard
              active={false}
              title={t('dashboard.menuManager.wizard.recommendedProductsCart')}
              description={t('dashboard.menuManager.wizard.recommendedProductsCartDesc')}
              onClick={() => go(5, 3)}
            />
            <ChoiceCard
              active={false}
              title={t('dashboard.menuManager.wizard.imFinished')}
              description={t('dashboard.menuManager.wizard.imFinishedDesc')}
              onClick={() => go('done', 3)}
            />
          </div>
          <WizardActions>
            <Button type="button" variant="outline" onClick={() => go(backTo)}>
              {t('dashboard.common.back')}
            </Button>
          </WizardActions>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <StepHeader
            title={w('dealsWithProduct', { name: resolveBilingualText(selected.name, uiLang) })}
            hint={w('dealsHint')}
          />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{w('fromCategories')}</p>
            <SelectableList
              search={dealCategorySearch}
              onSearchChange={setDealCategorySearch}
              searchPlaceholder={w('searchCategories')}
              emptyMessage={w('noCategoriesMatch')}
            >
              {linkedOptions
                .filter((cat) => matches(cat.name, dealCategorySearch.trim().toLowerCase()))
                .map((cat) => (
                  <SelectableRow
                    key={cat.id}
                    multi
                    active={dealCategoryIds.includes(cat.id)}
                    title={resolveBilingualText(cat.name, uiLang)}
                    imageUrl={cat.imageUrl}
                    onClick={() => {
                      setDealCategoryIds((prev) => toggleInArray(prev, cat.id));
                      setSelectedDealProductIds([]);
                    }}
                  />
                ))}
            </SelectableList>
          </div>
          {dealCategoryIds.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{w('dealsToOffer')}</p>
              {dealProductsFromSelectedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{w('noDealProducts')}</p>
              ) : (
                <SelectableList
                  search={dealProductSearch}
                  onSearchChange={setDealProductSearch}
                  searchPlaceholder={t('dashboard.menuManager.recommendations.searchProductsPlaceholder')}
                  emptyMessage={w('noProductsMatch')}
                >
                  {dealProductsFromSelectedCategories
                    .filter((p) => matches(p.name, dealProductSearch.trim().toLowerCase()))
                    .map((p) => (
                      <SelectableRow
                        key={p.id}
                        multi
                        active={selectedDealProductIds.includes(p.id)}
                        title={resolveBilingualText(p.name, uiLang)}
                        subtitle={resolveBilingualText(p.categoryName, uiLang)}
                        imageUrl={p.imageUrl}
                        onClick={() => setSelectedDealProductIds((prev) => toggleInArray(prev, p.id))}
                      />
                    ))}
                </SelectableList>
              )}
            </div>
          ) : null}
          <WizardActions>
            <Button type="button" variant="outline" onClick={() => go(backTo === 0 ? 0 : 3)}>
              {t('dashboard.common.back')}
            </Button>
            <Button type="button" variant="outline" onClick={() => go(5, 4)}>
              {w('skip')}
            </Button>
            <Button
              type="button"
              disabled={selectedDealProductIds.length === 0 || savingDeals}
              onClick={() => void onSaveDeals()}
            >
              {savingDeals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('dashboard.menuManager.wizard.saveRecommendedDeals')}
            </Button>
          </WizardActions>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <StepHeader
            title={w('cartWithProduct', { name: resolveBilingualText(selected.name, uiLang) })}
            hint={w('cartHint')}
          />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{w('fromCategories')}</p>
            <SelectableList
              search={offerCategorySearch}
              onSearchChange={setOfferCategorySearch}
              searchPlaceholder={w('searchCategories')}
              emptyMessage={w('noCategoriesMatch')}
            >
              {linkedOptions
                .filter((cat) => matches(cat.name, offerCategorySearch.trim().toLowerCase()))
                .map((cat) => (
                  <SelectableRow
                    key={cat.id}
                    multi
                    active={offerCategoryIds.includes(cat.id)}
                    title={resolveBilingualText(cat.name, uiLang)}
                    imageUrl={cat.imageUrl}
                    onClick={() => {
                      setOfferCategoryIds((prev) => toggleInArray(prev, cat.id));
                      setSelectedOfferProductIds([]);
                    }}
                  />
                ))}
            </SelectableList>
          </div>
          {offerCategoryIds.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{w('cartProducts')}</p>
              {offeredProductsFromSelectedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{w('noCartProducts')}</p>
              ) : (
                <SelectableList
                  search={offerProductSearch}
                  onSearchChange={setOfferProductSearch}
                  searchPlaceholder={t('dashboard.menuManager.recommendations.searchProductsPlaceholder')}
                  emptyMessage={w('noProductsMatch')}
                >
                  {offeredProductsFromSelectedCategories
                    .filter((p) => matches(p.name, offerProductSearch.trim().toLowerCase()))
                    .map((p) => (
                      <SelectableRow
                        key={p.id}
                        multi
                        active={selectedOfferProductIds.includes(p.id)}
                        title={resolveBilingualText(p.name, uiLang)}
                        subtitle={resolveBilingualText(p.categoryName, uiLang)}
                        imageUrl={p.imageUrl}
                        onClick={() => setSelectedOfferProductIds((prev) => toggleInArray(prev, p.id))}
                      />
                    ))}
                </SelectableList>
              )}
            </div>
          ) : null}
          <WizardActions>
            <Button type="button" variant="outline" onClick={() => go(4)}>
              {t('dashboard.common.back')}
            </Button>
            <Button type="button" variant="outline" onClick={() => go('done')}>
              {w('skip')}
            </Button>
            <Button
              type="button"
              disabled={selectedOfferProductIds.length === 0 || savingOffers}
              onClick={async () => {
                const ok = await onSaveOffers();
                if (ok) go('done');
              }}
            >
              {savingOffers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('dashboard.menuManager.wizard.saveCartRecommendations')}
            </Button>
          </WizardActions>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className="space-y-3">
          <StepHeader
            title={t('dashboard.menuManager.wizard.youreAllSet')}
            hint={t('dashboard.menuManager.wizard.youreAllSetHint')}
          />
          <WizardActions>
            <Button type="button" variant="outline" onClick={() => go(3)}>
              {t('dashboard.common.back')}
            </Button>
          </WizardActions>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}

function patchBlock(
  setBlocks: Dispatch<SetStateAction<Block[]>>,
  id: string,
  patch: Partial<Block>
) {
  setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

function patchVar(
  setBlocks: Dispatch<SetStateAction<Block[]>>,
  blockId: string,
  varId: string,
  field: 'min' | 'max',
  value: number
) {
  setBlocks((prev) => prev.map((b) => {
    if (b.id !== blockId) return b;
    return {
      ...b,
      parentVars: b.parentVars.map((v) => (v.id === varId ? { ...v, [field]: value } : v)),
    };
  }));
}

function ViewSwitch({
  selected,
  viewMode,
  onViewModeChange,
}: {
  selected: MenuItemRow & { categoryName: string };
  viewMode?: ConfigurationWizardProps['viewMode'];
  onViewModeChange?: ConfigurationWizardProps['onViewModeChange'];
}) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div>
        <p className="font-semibold">{resolveBilingualText(selected.name, uiLang)}</p>
        <p className="text-sm text-muted-foreground">
          {resolveBilingualText(selected.categoryName, uiLang)}
          {(selected.variations?.length ?? 0) > 0
            ? ` · ${selected.variations!.map((v) => variationLabel(v)).join(', ')}`
            : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1 text-xs">
        {(['classic', 'advanced', 'enhanced'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange?.(mode)}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium',
              viewMode === mode ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            {mode === 'classic'
              ? t('dashboard.menuManager.wizard.classicView')
              : mode === 'advanced'
                ? t('dashboard.menuManager.wizard.advancedView')
                : t('dashboard.menuManager.wizard.enhancedView')}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuSearch({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-popover pb-1.5">
      <Input
        autoFocus
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-9 rounded-lg border-border bg-background"
      />
    </div>
  );
}

function SegButton({
  on,
  small,
  children,
  onClick,
}: {
  on: boolean;
  small?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full font-semibold',
        small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
        on ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground'
      )}
    >
      {children}
    </button>
  );
}

function Num({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <Input
        type="number"
        min={0}
        className="mt-1"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

