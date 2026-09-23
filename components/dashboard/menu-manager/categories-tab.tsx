'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { AddCategoryFormDialog } from '@/components/dashboard/menu-manager/add-category-form-dialog';
import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useUiLanguage } from '@/hooks/use-ui-language';
import {
  bilingualInputFromStored,
  parseBilingualInput,
  resolveBilingualText,
  serializeBilingualInput,
} from '@/lib/menu/bilingual-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DeleteConfirmation } from '@/components/ui/confirmation-dialogs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  categoryHasProducts,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';
import { cn } from '@/lib/utils';

import type { MenuCategoryRow } from './types';

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: (search?: string) => Promise<void>;
  loading: boolean;
  loadingMore?: boolean;
  search?: string;
};

function CategoryCardSkeleton() {
  const bone = 'bg-[#e2e8f0] dark:bg-[#3f3f46] animate-pulse';
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className={cn('aspect-[4/3] w-full', bone)} />
      <div className="space-y-3 p-3">
        <div className={cn('h-4 w-3/4 rounded', bone)} />
        <div className={cn('h-3 w-1/2 rounded', bone)} />
        <div className={cn('h-6 w-24 rounded-full', bone)} />
        <div className="flex gap-2">
          <div className={cn('h-9 flex-1 rounded-md', bone)} />
          <div className={cn('h-9 flex-1 rounded-md', bone)} />
        </div>
      </div>
    </div>
  );
}

export function CategoriesTab({
  categories,
  onRefresh,
  loading,
  loadingMore = false,
  search: appliedSearch = '',
}: Props) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const { activeBranchId, branches, loading: branchesLoading } = useBranchContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(appliedSearch);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    setSearchDraft(appliedSearch);
  }, [appliedSearch]);

  const applySearch = () => {
    void onRefresh(searchDraft.trim());
  };

  const clearSearch = () => {
    setSearchDraft('');
    void onRefresh('');
  };

  const updateImage = async (id: string, next: string) => {
    try {
      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        imageUrl: next.trim() || null,
      });
      toast.success(t('dashboard.menuManager.wizard.saved'));
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update image');
    }
  };

  const rename = async (id: string, next: string) => {
    if (!next.trim()) return;
    if (!parseBilingualInput(next).en) {
      toast.error('English name (before &&&&) is required.');
      return;
    }
    try {
      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        name: serializeBilingualInput(next),
      });
      toast.success('Saved');
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update');
    }
  };

  const setCategoryShowInFront = async (id: string, next: boolean) => {
    setTogglingId(id);
    try {
      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        showInFront: next,
      });
      toast.success(
        next
          ? 'Category visible on website, kiosk, and POS'
          : 'Category hidden from storefront and available for recommendations'
      );
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update storefront visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const setCategoryBranchVisibility = async (id: string, visible: boolean) => {
    if (!activeBranchId) {
      toast.error('Select a branch first');
      return;
    }

    setTogglingId(id);
    try {
      const category = categories.find((item) => item.id === id);
      const hiddenBranchIds = new Set(category?.hiddenBranchIds ?? []);
      if (visible) hiddenBranchIds.delete(activeBranchId);
      else hiddenBranchIds.add(activeBranchId);

      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        hiddenBranchIds: [...hiddenBranchIds],
      });
      toast.success(
        visible
          ? `Category visible on ${branches.find((branch) => branch.id === activeBranchId)?.name ?? 'selected branch'}`
          : `Category hidden on ${branches.find((branch) => branch.id === activeBranchId)?.name ?? 'selected branch'}`
      );
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update branch visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`/api/restaurant/menu/categories/${deletingId}`);
      toast.success('Deleted');
      await onRefresh(appliedSearch);
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not delete'));
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CategoryCardSkeleton key={`category-skeleton-${i}`} />
          ))}
        </div>
      );
    }

    if (categories.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {appliedSearch
            ? t('dashboard.categories.emptySearch')
            : t('dashboard.categories.empty')}
        </p>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <CategoryCard
            key={c.id}
            category={c}
            toggling={togglingId === c.id}
            activeBranchId={activeBranchId}
            activeBranchName={
              branches.find((branch) => branch.id === activeBranchId)?.name ?? null
            }
            branchesLoading={branchesLoading}
            onRename={rename}
            onImageChange={updateImage}
            onToggleShowInFront={setCategoryShowInFront}
            onToggleBranchVisibility={setCategoryBranchVisibility}
            onDelete={(id) => {
              setDeletingId(id);
              setConfirmDeleteOpen(true);
            }}
          />
        ))}
        {loadingMore
          ? Array.from({ length: 2 }).map((_, i) => (
              <CategoryCardSkeleton key={`category-loading-more-${i}`} />
            ))
          : null}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                {t('dashboard.categories.cardTitle')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.categories.cardDescription')}
              </CardDescription>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              {t('dashboard.categories.newCategory')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t('dashboard.categories.searchPlaceholder')}
                className="h-10 bg-background pr-10 [&::-webkit-search-cancel-button]:hidden"
                aria-label={t('dashboard.categories.searchAria')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
              />
              {appliedSearch && searchDraft.trim() === appliedSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  aria-label={t('dashboard.categories.clearSearchAria')}
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <Button type="button" variant="secondary" onClick={applySearch}>
              <Search className="mr-2 h-4 w-4" />
              {t('dashboard.common.search')}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">{renderList()}</CardContent>
      </Card>

      <AddCategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultShowInFront
        onMenuRefresh={() => onRefresh(appliedSearch)}
      />

      <DeleteConfirmation
        open={confirmDeleteOpen}
        title="Delete category"
        description="This category will be removed. Products in this category may need reassignment."
        itemName={resolveBilingualText(
          categories.find((c) => c.id === deletingId)?.name,
          uiLang
        )}
        loading={deleting}
        onConfirm={() => {
          setDeleting(true);
          void remove();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}

function CategoryCard({
  category,
  toggling,
  activeBranchId,
  activeBranchName,
  branchesLoading,
  onRename,
  onImageChange,
  onToggleShowInFront,
  onToggleBranchVisibility,
  onDelete,
}: {
  category: MenuCategoryRow;
  toggling: boolean;
  activeBranchId: string | null;
  activeBranchName: string | null;
  branchesLoading: boolean;
  onRename: (id: string, name: string) => void;
  onImageChange: (id: string, imageUrl: string) => void;
  onToggleShowInFront: (id: string, visible: boolean) => Promise<void>;
  onToggleBranchVisibility: (id: string, visible: boolean) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const uiLang = useUiLanguage();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(() => bilingualInputFromStored(category.name));
  const [imageVal, setImageVal] = useState(category.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [hiddenBranchIds, setHiddenBranchIds] = useState<string[]>(
    category.hiddenBranchIds ?? []
  );
  const displayName = resolveBilingualText(category.name, uiLang);

  useEffect(() => {
    setVal(bilingualInputFromStored(category.name));
    setImageVal(category.imageUrl ?? '');
    setHiddenBranchIds(category.hiddenBranchIds ?? []);
    setEditing(false);
  }, [category.name, category.imageUrl, category.hiddenBranchIds]);

  const hasProducts = categoryHasProducts(category);
  const productCount =
    typeof category.itemCount === 'number'
      ? category.itemCount
      : category.items.length;
  const visible = isMenuCategoryShownInFront(category);
  const branchVisible =
    activeBranchId !== null &&
    !(category.hiddenBranchIds ?? []).includes(activeBranchId);

  const cancelEdit = () => {
    setVal(bilingualInputFromStored(category.name));
    setImageVal(category.imageUrl ?? '');
    setEditing(false);
  };

  const saveEdits = async () => {
    const nextName = val.trim();
    if (!nextName) return;

    const nextImage = imageVal.trim();
    const currentImage = (category.imageUrl ?? '').trim();
    const nameChanged =
      nextName !== bilingualInputFromStored(category.name);
    const imageChanged = nextImage !== currentImage;
    const hiddenBranchIdsChanged =
      activeBranchId !== null &&
      JSON.stringify([...hiddenBranchIds].sort()) !==
        JSON.stringify([...(category.hiddenBranchIds ?? [])].sort());

    if (!nameChanged && !imageChanged && !hiddenBranchIdsChanged) {
      cancelEdit();
      return;
    }

    setSaving(true);
    setSavingImage(true);
    try {
      if (nameChanged) await onRename(category.id, nextName);
      if (imageChanged) await onImageChange(category.id, nextImage);
      if (hiddenBranchIdsChanged) {
        await onToggleBranchVisibility(
          category.id,
          activeBranchId !== null && !hiddenBranchIds.includes(activeBranchId)
        );
      }
      setEditing(false);
    } finally {
      setSaving(false);
      setSavingImage(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/20">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {category.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={category.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No Image
            </div>
          )}
          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-background/90 shadow-sm"
              onClick={() => setEditing(true)}
              aria-label={t('dashboard.menuManager.category.editAria')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-background/90 text-destructive shadow-sm hover:text-destructive"
              onClick={() => onDelete(category.id)}
              aria-label={t('dashboard.menuManager.category.deleteAria')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="min-w-0 space-y-1">
            <h3 className="line-clamp-2 font-semibold leading-snug">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </p>
          </div>

          <div>
            {!hasProducts ? (
              <Badge variant="outline">Empty</Badge>
            ) : (
              <Badge variant={visible ? 'default' : 'secondary'}>
                {visible
                  ? t('dashboard.categories.tabStorefront')
                  : t('dashboard.categories.tabRecommendations')}
              </Badge>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={toggling || !hasProducts}
              onClick={() => onToggleShowInFront(category.id, !visible)}
            >
              {visible ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show
                </>
              )}
            </Button>

            <Button
              variant={branchVisible ? 'outline' : 'default'}
              size="sm"
              className="w-full"
              disabled={toggling || branchesLoading || !activeBranchId}
              onClick={() =>
                onToggleBranchVisibility(category.id, !branchVisible)
              }
            >
              {branchVisible ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  {t('dashboard.menuManager.category.notVisible')}
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  {t('dashboard.menuManager.category.visible')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dashboard.menuManager.category.edit')}</DialogTitle>
            <DialogDescription>
              Update the category information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t('dashboard.common.name')}</Label>
              <Input
                value={val}
                placeholder={`English name ${'&&&&'} Spanish name`}
                onChange={(e) => setVal(e.target.value)}
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveEdits();
                }}
              />
              <p className="text-xs text-muted-foreground">
                First English, then separator &&&&, then Spanish.
              </p>
            </div>

            <Base64ImageUploadField
              label={t('dashboard.menuManager.category.categoryImage')}
              value={imageVal}
              onChange={setImageVal}
              helperText={t('dashboard.menuManager.category.categoryImageHelper')}
            />

            <div className="space-y-2 rounded-md border p-3">
              <Label>Show on selected branch</Label>
              <p className="text-sm text-muted-foreground">
                {branchesLoading
                  ? 'Loading branch...'
                  : activeBranchName
                    ? `Controls visibility for ${activeBranchName}.`
                    : 'Select a branch to manage branch visibility.'}
              </p>
              <Button
                type="button"
                variant={
                  activeBranchId && !hiddenBranchIds.includes(activeBranchId)
                    ? 'default'
                    : 'outline'
                }
                disabled={saving || branchesLoading || !activeBranchId}
                onClick={() => {
                  if (!activeBranchId) return;
                  setHiddenBranchIds((current) =>
                    current.includes(activeBranchId)
                      ? current.filter((id) => id !== activeBranchId)
                      : [...current, activeBranchId]
                  );
                }}
              >
                {activeBranchId && !hiddenBranchIds.includes(activeBranchId) ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hidden
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Visible
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelEdit}
                disabled={saving || savingImage}
              >
                {t('dashboard.common.cancel')}
              </Button>
              <Button
                disabled={saving || savingImage || !val.trim()}
                onClick={() => void saveEdits()}
              >
                {(saving || savingImage) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('dashboard.menuManager.saveChanges')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
