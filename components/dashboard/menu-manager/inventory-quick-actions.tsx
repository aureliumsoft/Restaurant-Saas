'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { FolderPlus, PlusSquare } from 'lucide-react';

import { PremiumDisabledControl } from '@/components/premium/premium-disabled-control';
import { Button } from '@/components/ui/button';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';
import { useEntitlements } from '@/hooks/use-entitlements';

import { AddCategoryFormDialog } from './add-category-form-dialog';
import { AddVariationFormDialog } from './add-variation-form-dialog';
import type { RestaurantVariationRow } from './types';

type Props = {
  onMenuRefresh?: () => Promise<void>;
  onVariationTemplatesReload?: () => Promise<void>;
  onCategoryCreated?: (categoryId: string) => void;
  onVariationCreated?: (variation: RestaurantVariationRow) => void;
  /** Toolbar across the page; inline sits beside field labels. */
  variant?: 'toolbar' | 'inline';
  showCategory?: boolean;
  showVariation?: boolean;
  className?: string;
  /** Optional counts; when omitted, totals are fetched for cap checks. */
  categoryCount?: number;
  variationCount?: number;
};

export function InventoryQuickActions({
  onMenuRefresh,
  onVariationTemplatesReload,
  onCategoryCreated,
  onVariationCreated,
  variant = 'toolbar',
  showCategory = true,
  showVariation = true,
  className,
  categoryCount: categoryCountProp,
  variationCount: variationCountProp,
}: Props) {
  const { t } = useTranslation();
  const { canEdit } = useDashboardPermissions();
  const { canCreateMore } = useEntitlements();
  const canEditCategories = canEdit('categories');
  const canEditVariations = canEdit('variations');

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const [fetchedCategoryCount, setFetchedCategoryCount] = useState(0);
  const [fetchedVariationCount, setFetchedVariationCount] = useState(0);

  const needFetchCounts =
    (showCategory && canEditCategories && categoryCountProp == null) ||
    (showVariation && canEditVariations && variationCountProp == null);

  useEffect(() => {
    if (!needFetchCounts) return;
    let cancelled = false;
    void (async () => {
      try {
        const [cats, vars] = await Promise.all([
          categoryCountProp == null && showCategory && canEditCategories
            ? axios.get<{
                data?: { pagination?: { total?: number }; categories?: unknown[] };
              }>('/api/restaurant/menu/categories', {
                params: { mode: 'management', page: 1, limit: 1 },
              })
            : Promise.resolve(null),
          variationCountProp == null && showVariation && canEditVariations
            ? axios.get<{ data?: unknown[] }>('/api/restaurant/variations')
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const catTotal = cats?.data?.data?.pagination?.total;
        if (typeof catTotal === 'number') {
          setFetchedCategoryCount(catTotal);
        } else if (Array.isArray(cats?.data?.data?.categories)) {
          setFetchedCategoryCount(cats.data.data.categories.length);
        }
        if (Array.isArray(vars?.data?.data)) {
          setFetchedVariationCount(vars.data.data.length);
        }
      } catch {
        /* ignore — keep zeros */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    needFetchCounts,
    categoryCountProp,
    variationCountProp,
    showCategory,
    showVariation,
    canEditCategories,
    canEditVariations,
  ]);

  const categoryCount = categoryCountProp ?? fetchedCategoryCount;
  const variationCount = variationCountProp ?? fetchedVariationCount;
  const categoryLocked = !canCreateMore('categories', categoryCount);
  const variationLocked = !canCreateMore('variations', variationCount);

  const showCat = showCategory && canEditCategories;
  const showVar = showVariation && canEditVariations;

  if (!showCat && !showVar) return null;

  const buttonSize = variant === 'inline' ? 'default' : 'default';
  const buttonVariant = variant === 'inline' ? 'default' : 'default';

  return (
    <>
      <div
        className={
          className ??
          (variant === 'toolbar'
            ? 'flex flex-wrap gap-2'
            : 'flex flex-wrap gap-2')
        }
      >
        {showCat ? (
          <PremiumDisabledControl
            locked={categoryLocked}
            label={t('dashboard.menuManager.category.add')}
          >
            <Button
              type="button"
              variant={buttonVariant}
              size={buttonSize}
              onClick={() => setCategoryOpen(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {t('dashboard.menuManager.category.add')}
            </Button>
          </PremiumDisabledControl>
        ) : null}
        {showVar ? (
          <PremiumDisabledControl
            locked={variationLocked}
            label={t('dashboard.menuManager.variation.add')}
          >
            <Button
              type="button"
              variant={buttonVariant}
              size={buttonSize}
              onClick={() => setVariationOpen(true)}
            >
              <PlusSquare className="mr-2 h-4 w-4" />
              {t('dashboard.menuManager.variation.add')}
            </Button>
          </PremiumDisabledControl>
        ) : null}
      </div>

      {showCat ? (
        <AddCategoryFormDialog
          open={categoryOpen}
          onOpenChange={setCategoryOpen}
          onMenuRefresh={onMenuRefresh}
          onCreated={(cat) => onCategoryCreated?.(cat.id)}
        />
      ) : null}

      {showVar ? (
        <AddVariationFormDialog
          open={variationOpen}
          onOpenChange={setVariationOpen}
          onTemplatesReload={onVariationTemplatesReload}
          onCreated={onVariationCreated}
        />
      ) : null}
    </>
  );
}
