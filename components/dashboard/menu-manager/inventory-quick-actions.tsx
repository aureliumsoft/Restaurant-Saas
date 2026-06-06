'use client';

import { useState } from 'react';
import { FolderPlus, Layers, PlusSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDashboardPermissions } from '@/hooks/use-dashboard-permissions';

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
}: Props) {
  const { canEdit } = useDashboardPermissions();
  const canEditCategories = canEdit('categories');
  const canEditVariations = canEdit('variations');

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);

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
          <Button
            type="button"
            variant={buttonVariant}
            size={buttonSize}
            onClick={() => setCategoryOpen(true)}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Add category
          </Button>
        ) : null}
        {showVar ? (
          <Button
            type="button"
            variant={buttonVariant}
            size={buttonSize}
            onClick={() => setVariationOpen(true)}
          >
            <PlusSquare className="mr-2 h-4 w-4" />
            Add variation
          </Button>
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
