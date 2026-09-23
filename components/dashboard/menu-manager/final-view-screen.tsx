'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  Save,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import type {
  FinalViewCategory,
  FinalViewProduct,
} from '@/lib/menu/final-view';
import { cn } from '@/lib/utils';
import { extractApiErrorMessage } from '@/lib/extract-api-error';

type FinalViewTab = 'storefront' | 'recommendations';

function catalogFingerprint(categories: FinalViewCategory[]): string {
  return JSON.stringify(
    categories.map((c) => ({
      id: c.id,
      productIds: c.products.map((p) => p.id),
    }))
  );
}

function filterCatalog(
  categories: FinalViewCategory[],
  tab: FinalViewTab,
  search: string,
  lang: 'en' | 'es'
): FinalViewCategory[] {
  const forTab = categories.filter((c) =>
    tab === 'storefront' ? c.showInFront !== false : c.showInFront === false
  );
  const q = search.trim().toLowerCase();
  if (!q) return forTab;
  return forTab.filter((c) => {
    const name = resolveBilingualText(c.name, lang).toLowerCase();
    if (name.includes(q)) return true;
    return c.products.some((p) =>
      resolveBilingualText(p.name, lang).toLowerCase().includes(q)
    );
  });
}

export function FinalViewScreen() {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const [tab, setTab] = useState<FinalViewTab>('storefront');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<FinalViewCategory[]>([]);
  const [draft, setDraft] = useState<FinalViewCategory[]>([]);
  const [baselineFp, setBaselineFp] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [categoryDragId, setCategoryDragId] = useState<string | null>(null);
  const [categoryDropTarget, setCategoryDropTarget] = useState<{
    categoryId: string;
    side: 'before' | 'after';
  } | null>(null);
  const [productDrag, setProductDrag] = useState<{
    categoryId: string;
    productId: string;
  } | null>(null);
  const [productDropTarget, setProductDropTarget] = useState<{
    categoryId: string;
    productId: string;
    side: 'before' | 'after';
  } | null>(null);

  const isDirty =
    editing && catalogFingerprint(draft) !== baselineFp;

  const {
    leaveOpen,
    leaveMessage,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty, {
    message: t('dashboard.finalView.unsavedLeave'),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{
        data: { categories: FinalViewCategory[] };
      }>('/api/restaurant/menu/final-view');
      const categories = res.data.data.categories ?? [];
      setAllCategories(categories);
      setEditing(false);
      setDraft([]);
      setBaselineFp('');
    } catch (e) {
      toast.error(
        extractApiErrorMessage(e, t('dashboard.finalView.loadError'))
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleDraft = useMemo(
    () => filterCatalog(draft, tab, appliedSearch, uiLang),
    [draft, tab, appliedSearch, uiLang]
  );

  const visibleReadonly = useMemo(
    () => filterCatalog(allCategories, tab, appliedSearch, uiLang),
    [allCategories, tab, appliedSearch, uiLang]
  );

  const displayCategories = editing ? visibleDraft : visibleReadonly;

  const beginEdit = () => {
    const forTab = allCategories.filter((c) =>
      tab === 'storefront' ? c.showInFront !== false : c.showInFront === false
    );
    const next = forTab.map((c) => ({
      ...c,
      products: [...c.products],
    }));
    setDraft(next);
    setBaselineFp(catalogFingerprint(next));
    setEditing(true);
  };

  const requestTabChange = (next: FinalViewTab) => {
    if (next === tab) return;
    if (isDirty) {
      toast.warn(t('dashboard.finalView.saveOrDiscardFirst'));
      return;
    }
    setEditing(false);
    setDraft([]);
    setBaselineFp('');
    setTab(next);
  };

  const applySearch = () => setAppliedSearch(searchDraft.trim());

  const clearSearch = () => {
    setSearchDraft('');
    setAppliedSearch('');
  };

  const reorderCategories = (
    fromId: string,
    toId: string,
    side: 'before' | 'after' = 'before'
  ) => {
    if (!editing || tab !== 'storefront' || fromId === toId) return;
    setDraft((prev) => {
      const fromIndex = prev.findIndex((c) => c.id === fromId);
      const toIndex = prev.findIndex((c) => c.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      let insertAt = side === 'after' ? toIndex + 1 : toIndex;
      if (fromIndex < toIndex) insertAt -= 1;
      insertAt = Math.max(0, Math.min(insertAt, next.length));
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

  const reorderProducts = (
    categoryId: string,
    fromProductId: string,
    toProductId: string,
    side: 'before' | 'after' = 'before'
  ) => {
    if (!editing || fromProductId === toProductId) return;
    setDraft((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const fromIndex = cat.products.findIndex((p) => p.id === fromProductId);
        const toIndex = cat.products.findIndex((p) => p.id === toProductId);
        if (fromIndex < 0 || toIndex < 0) return cat;
        const products = [...cat.products];
        const [moved] = products.splice(fromIndex, 1);
        if (!moved) return cat;
        let insertAt = side === 'after' ? toIndex + 1 : toIndex;
        if (fromIndex < toIndex) insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, products.length));
        products.splice(insertAt, 0, moved);
        return { ...cat, products };
      })
    );
  };

  const persistSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/restaurant/menu/final-view', {
        tab,
        categories: draft.map((c) => ({
          id: c.id,
          productIds: c.products.map((p) => p.id),
        })),
      });
      toast.success(t('dashboard.finalView.saveSuccess'));
      setSaveConfirmOpen(false);
      allowNextNavigation();
      setEditing(false);
      setDraft([]);
      setBaselineFp('');
      await load();
    } catch (e) {
      toast.error(
        extractApiErrorMessage(e, t('dashboard.finalView.saveError'))
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <MenuPageShell
      title={t('dashboard.finalView.title')}
      description={t('dashboard.finalView.description')}
      loading={false}
    >
      <div className="space-y-4">
        <Tabs
          value={tab}
          onValueChange={(v) => requestTabChange(v as FinalViewTab)}
          className="w-full"
        >
          <TabsList className="grid h-12 w-full grid-cols-2 rounded-full p-1">
            <TabsTrigger
              value="storefront"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t('dashboard.finalView.tabStorefront')}
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t('dashboard.finalView.tabRecommendations')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder={t('dashboard.finalView.searchPlaceholder')}
              className="h-10 bg-background pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
              aria-label={t('dashboard.finalView.searchPlaceholder')}
            />
            {appliedSearch && searchDraft.trim() === appliedSearch ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={clearSearch}
                aria-label={t('dashboard.common.clear')}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <Button type="button" variant="secondary" onClick={applySearch}>
            <Search className="mr-2 h-4 w-4" />
            {t('dashboard.common.search')}
          </Button>
          {editing ? (
            <Button
              type="button"
              onClick={() => setSaveConfirmOpen(true)}
              disabled={!isDirty || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('dashboard.common.save')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={beginEdit}
              disabled={loading || displayCategories.length === 0}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('dashboard.common.edit')}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : displayCategories.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {appliedSearch
              ? t('dashboard.finalView.emptySearch')
              : tab === 'storefront'
                ? t('dashboard.finalView.emptyStorefront')
                : t('dashboard.finalView.emptyRecommendations')}
          </p>
        ) : (
          <div className="space-y-4">
            {displayCategories.map((category) => (
              <FinalViewCategoryBlock
                key={category.id}
                category={category}
                sortableCategory={editing && tab === 'storefront'}
                sortableProducts={editing}
                lang={uiLang}
                categoryDragId={categoryDragId}
                categoryDropTarget={categoryDropTarget}
                productDrag={productDrag}
                productDropTarget={productDropTarget}
                onCategoryDragStart={(id) => {
                  setCategoryDragId(id);
                  setProductDrag(null);
                  setProductDropTarget(null);
                }}
                onCategoryDragEnd={() => {
                  setCategoryDragId(null);
                  setCategoryDropTarget(null);
                }}
                onCategoryDragOver={(categoryId, side) => {
                  if (!categoryDragId || categoryDragId === categoryId) {
                    setCategoryDropTarget(null);
                    return;
                  }
                  setCategoryDropTarget({ categoryId, side });
                }}
                onCategoryDrop={(toId, side) => {
                  if (categoryDragId) {
                    reorderCategories(categoryDragId, toId, side);
                  }
                  setCategoryDragId(null);
                  setCategoryDropTarget(null);
                }}
                onProductDragStart={(categoryId, productId) => {
                  setProductDrag({ categoryId, productId });
                  setCategoryDragId(null);
                  setCategoryDropTarget(null);
                }}
                onProductDragEnd={() => {
                  setProductDrag(null);
                  setProductDropTarget(null);
                }}
                onProductDragOver={(categoryId, productId, side) => {
                  if (
                    !productDrag ||
                    productDrag.categoryId !== categoryId ||
                    productDrag.productId === productId
                  ) {
                    setProductDropTarget(null);
                    return;
                  }
                  setProductDropTarget({ categoryId, productId, side });
                }}
                onProductDrop={(categoryId, toProductId, side) => {
                  if (
                    productDrag &&
                    productDrag.categoryId === categoryId
                  ) {
                    reorderProducts(
                      categoryId,
                      productDrag.productId,
                      toProductId,
                      side
                    );
                  }
                  setProductDrag(null);
                  setProductDropTarget(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <SaveConfirmation
        open={saveConfirmOpen}
        title={t('dashboard.finalView.saveConfirmTitle')}
        description={t('dashboard.finalView.saveConfirmDescription')}
        loading={saving}
        onConfirm={() => void persistSave()}
        onCancel={() => {
          if (!saving) setSaveConfirmOpen(false);
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
            <AlertDialogTitle>
              {t('dashboard.finalView.unsavedTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{leaveMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>
              {t('dashboard.finalView.leaveWithoutSaving')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MenuPageShell>
  );
}

function FinalViewCategoryBlock({
  category,
  sortableCategory,
  sortableProducts,
  lang,
  categoryDragId,
  categoryDropTarget,
  productDrag,
  productDropTarget,
  onCategoryDragStart,
  onCategoryDragEnd,
  onCategoryDragOver,
  onCategoryDrop,
  onProductDragStart,
  onProductDragEnd,
  onProductDragOver,
  onProductDrop,
}: {
  category: FinalViewCategory;
  sortableCategory: boolean;
  sortableProducts: boolean;
  lang: 'en' | 'es';
  categoryDragId: string | null;
  categoryDropTarget: {
    categoryId: string;
    side: 'before' | 'after';
  } | null;
  productDrag: { categoryId: string; productId: string } | null;
  productDropTarget: {
    categoryId: string;
    productId: string;
    side: 'before' | 'after';
  } | null;
  onCategoryDragStart: (id: string) => void;
  onCategoryDragEnd: () => void;
  onCategoryDragOver: (categoryId: string, side: 'before' | 'after') => void;
  onCategoryDrop: (toId: string, side: 'before' | 'after') => void;
  onProductDragStart: (categoryId: string, productId: string) => void;
  onProductDragEnd: () => void;
  onProductDragOver: (
    categoryId: string,
    productId: string,
    side: 'before' | 'after'
  ) => void;
  onProductDrop: (
    categoryId: string,
    toProductId: string,
    side: 'before' | 'after'
  ) => void;
}) {
  const title = resolveBilingualText(category.name, lang);
  const draggingCategory = categoryDragId === category.id;
  const categoryDropSide =
    categoryDropTarget?.categoryId === category.id
      ? categoryDropTarget.side
      : null;
  const categoryDragActive = Boolean(categoryDragId);

  const resolveVerticalSide = (
    clientY: number,
    el: HTMLElement
  ): 'before' | 'after' => {
    const rect = el.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  return (
    <section
      className={cn(
        'relative rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors',
        draggingCategory && 'border-primary bg-muted/40 opacity-70'
      )}
      draggable={sortableCategory}
      onDragStart={(e) => {
        if (!sortableCategory) return;
        e.dataTransfer.effectAllowed = 'move';
        onCategoryDragStart(category.id);
      }}
      onDragEnd={onCategoryDragEnd}
      onDragOver={(e) => {
        if (!sortableCategory || draggingCategory || !categoryDragActive) return;
        e.preventDefault();
        onCategoryDragOver(
          category.id,
          resolveVerticalSide(e.clientY, e.currentTarget)
        );
      }}
      onDrop={(e) => {
        if (!sortableCategory || draggingCategory || !categoryDragActive) return;
        e.preventDefault();
        onCategoryDrop(
          category.id,
          resolveVerticalSide(e.clientY, e.currentTarget)
        );
      }}
    >
      {categoryDropSide === 'before' ? (
        <span
          className="pointer-events-none absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center text-primary"
          aria-hidden
        >
          <ChevronUp className="h-4 w-4 drop-shadow-sm" strokeWidth={3} />
          <span className="h-0.5 w-16 rounded-full bg-primary" />
        </span>
      ) : null}
      {categoryDropSide === 'after' ? (
        <span
          className="pointer-events-none absolute -bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center text-primary"
          aria-hidden
        >
          <span className="h-0.5 w-16 rounded-full bg-primary" />
          <ChevronDown className="h-4 w-4 drop-shadow-sm" strokeWidth={3} />
        </span>
      ) : null}

      <div className="mb-3 flex items-center gap-2">
        {sortableCategory ? (
          <GripVertical
            className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-hidden
          />
        ) : null}
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-muted-foreground">
          ({category.products.length})
        </span>
      </div>

      {category.products.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {category.products.map((product) => {
            const dropHere =
              productDropTarget?.categoryId === category.id &&
              productDropTarget.productId === product.id
                ? productDropTarget.side
                : null;
            return (
              <FinalViewProductPill
                key={product.id}
                product={product}
                lang={lang}
                sortable={sortableProducts && !categoryDragActive}
                dragging={
                  productDrag?.categoryId === category.id &&
                  productDrag.productId === product.id
                }
                dropSide={dropHere}
                onDragStart={() =>
                  onProductDragStart(category.id, product.id)
                }
                onDragEnd={onProductDragEnd}
                onDragOverSide={(side) =>
                  onProductDragOver(category.id, product.id, side)
                }
                onDrop={(side) =>
                  onProductDrop(category.id, product.id, side)
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function FinalViewProductPill({
  product,
  lang,
  sortable,
  dragging,
  dropSide,
  onDragStart,
  onDragEnd,
  onDragOverSide,
  onDrop,
}: {
  product: FinalViewProduct;
  lang: 'en' | 'es';
  sortable: boolean;
  dragging: boolean;
  dropSide: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverSide: (side: 'before' | 'after') => void;
  onDrop: (side: 'before' | 'after') => void;
}) {
  const name = resolveBilingualText(product.name, lang);

  const resolveSide = (clientX: number, el: HTMLElement): 'before' | 'after' => {
    const rect = el.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? 'before' : 'after';
  };

  return (
    <div
      className={cn(
        'relative inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm shadow-sm',
        sortable && 'cursor-grab active:cursor-grabbing',
        dragging && 'border-primary opacity-70'
      )}
      draggable={sortable}
      onDragStart={(e) => {
        if (!sortable) return;
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      onDragOver={(e) => {
        if (!sortable || dragging) return;
        e.preventDefault();
        e.stopPropagation();
        onDragOverSide(resolveSide(e.clientX, e.currentTarget));
      }}
      onDrop={(e) => {
        if (!sortable || dragging) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(resolveSide(e.clientX, e.currentTarget));
      }}
    >
      {dropSide === 'before' ? (
        <span
          className="pointer-events-none absolute -left-2 top-1/2 z-10 flex -translate-y-1/2 items-center text-primary"
          aria-hidden
        >
          <ChevronLeft className="h-4 w-4 drop-shadow-sm" strokeWidth={3} />
          <span className="h-7 w-0.5 rounded-full bg-primary" />
        </span>
      ) : null}
      {dropSide === 'after' ? (
        <span
          className="pointer-events-none absolute -right-2 top-1/2 z-10 flex -translate-y-1/2 items-center text-primary"
          aria-hidden
        >
          <span className="h-7 w-0.5 rounded-full bg-primary" />
          <ChevronRight className="h-4 w-4 drop-shadow-sm" strokeWidth={3} />
        </span>
      ) : null}
      {sortable ? (
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full object-cover"
        />
      ) : null}
      <span className="truncate font-medium">{name}</span>
    </div>
  );
}
