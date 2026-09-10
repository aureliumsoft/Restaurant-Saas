'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  GripVertical,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  categoryHasProducts,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';
import { cn } from '@/lib/utils';

import type { MenuCategoryRow } from './types';

type CategoryTab = 'storefront' | 'recommendations';

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: (search?: string) => Promise<void>;
  loading: boolean;
  loadingMore?: boolean;
  search?: string;
};

function CategoryCardSkeleton({ showGrip = true }: { showGrip?: boolean }) {
  const bone = 'bg-[#e2e8f0] dark:bg-[#3f3f46] animate-pulse';
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      {showGrip ? (
        <div className="flex w-14 items-center gap-2">
          <div className={cn('h-4 w-4 rounded', bone)} />
          <div className={cn('h-4 w-6 rounded', bone)} />
        </div>
      ) : null}
      <div className={cn('h-16 w-24 shrink-0 rounded-md border', bone)} />
      <div className="flex-1 space-y-2">
        <div className={cn('h-5 w-40 rounded', bone)} />
        <div className={cn('h-4 w-24 rounded', bone)} />
      </div>
      <div className={cn('h-6 w-24 rounded-full', bone)} />
      <div className="flex items-center gap-2">
        <div className={cn('h-9 w-9 rounded-md', bone)} />
        <div className={cn('h-9 w-9 rounded-md', bone)} />
      </div>
      <div className={cn('h-9 w-20 rounded-md', bone)} />
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
  const { activeBranchId, branches, loading: branchesLoading } = useBranchContext();
  const [activeTab, setActiveTab] = useState<CategoryTab>('storefront');
  const [createOpen, setCreateOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(appliedSearch);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [orderedCategories, setOrderedCategories] = useState<MenuCategoryRow[]>(
    []
  );

  useEffect(() => {
    setSearchDraft(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    setOrderedCategories(
      [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
  }, [categories]);

  const storefrontCategories = useMemo(
    () => orderedCategories.filter((c) => isMenuCategoryShownInFront(c)),
    [orderedCategories]
  );
  const recommendationCategories = useMemo(
    () => orderedCategories.filter((c) => !isMenuCategoryShownInFront(c)),
    [orderedCategories]
  );

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
      toast.success('Image saved');
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update image');
    }
  };

  const rename = async (id: string, next: string) => {
    if (!next.trim()) return;
    try {
      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        name: next.trim(),
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

  /** Reorder only within the storefront subset; leave recommendation-only order untouched. */
  const moveStorefrontCategory = async (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;

    const fromIndex = storefrontCategories.findIndex((c) => c.id === fromId);
    const toIndex = storefrontCategories.findIndex((c) => c.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reorderedStorefront = [...storefrontCategories];
    const [moved] = reorderedStorefront.splice(fromIndex, 1);
    if (!moved) return;
    reorderedStorefront.splice(toIndex, 0, moved);

    const nextOrdered = [...reorderedStorefront, ...recommendationCategories];
    setOrderedCategories(nextOrdered);
    setDraggingId(null);
    setReorderingId(fromId);
    try {
      await Promise.all(
        reorderedStorefront.map((category, position) =>
          axios.patch(`/api/restaurant/menu/categories/${category.id}`, {
            sortOrder: position,
          })
        )
      );
      toast.success('Category order updated');
      await onRefresh(appliedSearch);
    } catch {
      toast.error('Could not update category order');
      setOrderedCategories(
        [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      );
    } finally {
      setReorderingId(null);
    }
  };

  const renderList = (
    list: MenuCategoryRow[],
    opts: { draggable: boolean; emptyMessage: string }
  ) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CategoryCardSkeleton
              key={`category-skeleton-${i}`}
              showGrip={opts.draggable}
            />
          ))}
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">{opts.emptyMessage}</p>
      );
    }

    return (
      <div className="space-y-3">
        {list.map((c, index) => (
          <CategoryCard
            key={c.id}
            category={c}
            displayOrder={index + 1}
            draggable={opts.draggable}
            toggling={togglingId === c.id}
            activeBranchId={activeBranchId}
            activeBranchName={
              branches.find((branch) => branch.id === activeBranchId)?.name ?? null
            }
            branchesLoading={branchesLoading}
            dragging={draggingId === c.id}
            reordering={reorderingId === c.id}
            onRename={rename}
            onImageChange={updateImage}
            onToggleShowInFront={setCategoryShowInFront}
            onToggleBranchVisibility={setCategoryBranchVisibility}
            onDelete={(id) => {
              setDeletingId(id);
              setConfirmDeleteOpen(true);
            }}
            onReorder={moveStorefrontCategory}
            activeDragId={activeDragId}
            onDragStart={(id) => {
              setDraggingId(id);
              setActiveDragId(id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setActiveDragId(null);
            }}
          />
        ))}
        {loadingMore
          ? Array.from({ length: 2 }).map((_, i) => (
            <CategoryCardSkeleton
              key={`category-loading-more-${i}`}
              showGrip={opts.draggable}
            />
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
              <CardTitle className="text-lg">Menu categories</CardTitle>
              <CardDescription>
                Storefront categories appear on web, kiosk, and POS.
                Recommendations categories are add-on pools only.
              </CardDescription>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New category
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search categories by name…"
                className="h-10 bg-background pr-10 [&::-webkit-search-cancel-button]:hidden"
                aria-label="Search categories"
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
                  aria-label="Clear search"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <Button type="button" variant="secondary" onClick={applySearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CategoryTab)}
            className="w-full"
          >
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="storefront" className="w-full">
                Storefront
                <span className="ml-2 text-xs text-muted-foreground">
                  ({storefrontCategories.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="w-full">
                Recommendations
                <span className="ml-2 text-xs text-muted-foreground">
                  ({recommendationCategories.length})
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="storefront" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Drag rows to change the order guests see on storefront.
              </p>
              {renderList(storefrontCategories, {
                draggable: true,
                emptyMessage: appliedSearch
                  ? 'No storefront categories match your search.'
                  : 'No storefront categories yet. Create one with “Show in front” enabled.',
              })}
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Add-on / recommendation pools — not shown on the storefront
                browse.
              </p>
              {renderList(recommendationCategories, {
                draggable: false,
                emptyMessage: appliedSearch
                  ? 'No recommendation categories match your search.'
                  : 'No recommendation-only categories yet. Hide a category from the storefront to use it here.',
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AddCategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultShowInFront={activeTab === 'storefront'}
        onMenuRefresh={() => onRefresh(appliedSearch)}
      />

      <DeleteConfirmation
        open={confirmDeleteOpen}
        title="Delete category"
        description="This category will be removed. Products in this category may need reassignment."
        itemName={categories.find((c) => c.id === deletingId)?.name}
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
  displayOrder,
  draggable,
  toggling,
  activeBranchId,
  activeBranchName,
  branchesLoading,
  dragging,
  reordering,
  onRename,
  onImageChange,
  onToggleShowInFront,
  onToggleBranchVisibility,
  onDelete,
  onReorder,
  activeDragId,
  onDragStart,
  onDragEnd,
}: {
  category: MenuCategoryRow;
  displayOrder: number;
  draggable: boolean;
  toggling: boolean;
  activeBranchId: string | null;
  activeBranchName: string | null;
  branchesLoading: boolean;
  dragging: boolean;
  reordering: boolean;
  onRename: (id: string, name: string) => void;
  onImageChange: (id: string, imageUrl: string) => void;
  onToggleShowInFront: (id: string, visible: boolean) => Promise<void>;
  onToggleBranchVisibility: (id: string, visible: boolean) => Promise<void>;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  activeDragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(category.name);
  const [imageVal, setImageVal] = useState(category.imageUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [hiddenBranchIds, setHiddenBranchIds] = useState<string[]>(
    category.hiddenBranchIds ?? []
  );

  useEffect(() => {
    setVal(category.name);
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
  const canDrag = draggable && !editing && !reordering;

  const cancelEdit = () => {
    setVal(category.name);
    setImageVal(category.imageUrl ?? '');
    setEditing(false);
  };

  const saveEdits = async () => {
    const nextName = val.trim();
    if (!nextName) return;

    const nextImage = imageVal.trim();
    const currentImage = (category.imageUrl ?? '').trim();
    const nameChanged = nextName !== category.name;
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
      <div
        className={`flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors ${dragging ? 'border-primary bg-muted/50' : 'hover:bg-muted/30'}`}
        draggable={canDrag}
        onDragStart={() => {
          if (!canDrag) return;
          onDragStart(category.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!draggable) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!draggable) return;
          event.preventDefault();
          if (!activeDragId || activeDragId === category.id) {
            onDragEnd();
            return;
          }
          onReorder(activeDragId, category.id);
        }}
      >
        {draggable ? (
          <div className="flex w-14 items-center gap-2">
            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
            <span className="text-sm font-medium">{displayOrder}</span>
          </div>
        ) : null}

        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
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
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{category.name}</h3>
          <p className="text-sm text-muted-foreground">
            {productCount} {productCount === 1 ? 'product' : 'products'}
          </p>
        </div>

        <div className="w-40">
          {!hasProducts ? (
            <Badge variant="outline">Empty</Badge>
          ) : (
            <Badge variant={visible ? 'default' : 'secondary'}>
              {visible ? 'Storefront' : 'Recommendations'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="Edit category"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={() => onDelete(category.id)}
            aria-label="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {draggable ? (
          <p className="hidden text-xs text-muted-foreground lg:block">
            Drag to reorder
          </p>
        ) : null}

        <Button
          variant="outline"
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
          disabled={toggling || branchesLoading || !activeBranchId}
          onClick={() =>
            onToggleBranchVisibility(category.id, !branchVisible)
          }
        >
          {branchVisible ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              No Visible            
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Visible
            </>
          )}
        </Button>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveEdits();
                }}
              />
            </div>

            <Base64ImageUploadField
              label="Category image"
              value={imageVal}
              onChange={setImageVal}
              helperText="Shown on website, kiosk and POS."
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
                Cancel
              </Button>
              <Button
                disabled={saving || savingImage || !val.trim()}
                onClick={() => void saveEdits()}
              >
                {(saving || savingImage) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
