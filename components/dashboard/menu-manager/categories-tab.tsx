'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AddCategoryConfirmation,
  DeleteConfirmation,
} from '@/components/ui/confirmation-dialogs';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  categoryHasProducts,
  isMenuCategoryShownInFront,
} from '@/lib/menu/category-visibility';

import type { MenuCategoryRow } from './types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type Props = {
  categories: MenuCategoryRow[];
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function CategoriesTab({ categories, onRefresh, loading }: Props) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showInFront, setShowInFront] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [orderedCategories, setOrderedCategories] = useState<MenuCategoryRow[]>([]);

  const canAdd = Boolean(name.trim()) && !adding;

  useEffect(() => {
    setOrderedCategories(
      [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
  }, [categories]);

  const add = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await axios.post('/api/restaurant/menu/categories', {
        name: name.trim(),
        showInFront,
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      });
      toast.success('Category created');
      setName('');
      setImageUrl('');
      setShowInFront(true);
      await onRefresh();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not create category'));
    } finally {
      setAdding(false);
    }
  };

  const updateImage = async (id: string, next: string) => {
    try {
      await axios.patch(`/api/restaurant/menu/categories/${id}`, {
        imageUrl: next.trim() || null,
      });
      toast.success('Image saved');
      await onRefresh();
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
      await onRefresh();
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
          : 'Category hidden from storefront — use in recommendations only'
      );
      await onRefresh();
    } catch {
      toast.error('Could not update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`/api/restaurant/menu/categories/${deletingId}`);
      toast.success('Deleted');
      await onRefresh();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, 'Could not delete'));
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const moveCategory = async (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;

    const fromIndex = orderedCategories.findIndex((c) => c.id === fromId);
    const toIndex = orderedCategories.findIndex((c) => c.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...orderedCategories];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setOrderedCategories(reordered);
    setDraggingId(null);
    setReorderingId(fromId);
    try {
      await Promise.all(
        reordered.map((category, position) =>
          axios.patch(`/api/restaurant/menu/categories/${category.id}`, {
            sortOrder: position,
          })
        )
      );
      toast.success('Category order updated');
      await onRefresh();
    } catch {
      toast.error('Could not update category order');
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <label htmlFor="new-category-name" className="text-sm font-medium">
              Category Name
            </label>
            <Input
              placeholder="New category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background"
              disabled={adding}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canAdd) setConfirmAddOpen(true);
              }}
            />
            <Base64ImageUploadField
              label="Category image"
              value={imageUrl}
              onChange={setImageUrl}
              helperText="Optional — shown on website, kiosk, and POS."
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                checked={showInFront}
                onChange={(e) => setShowInFront(e.target.checked)}
              />
              <span>Show in front on (website, kiosk, POS)</span>
            </label>

            <Button
              type="button"
              disabled={!canAdd}
              onClick={() => setConfirmAddOpen(true)}
            >
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="mr-2 h-4 w-4" aria-hidden />
              )}
              {adding ? 'Adding…' : 'Add category'}
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mx-auto animate-spin text-primary" />
            </p>
          ) : (
            <div className="space-y-3">
              {orderedCategories.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  toggling={togglingId === c.id}
                  dragging={draggingId === c.id}
                  reordering={reorderingId === c.id}
                  onRename={rename}
                  onImageChange={updateImage}
                  onToggleShowInFront={setCategoryShowInFront}
                  onDelete={(id) => {
                    setDeletingId(id);
                    setConfirmDeleteOpen(true);
                  }}
                  onReorder={moveCategory}
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
            </div>
          )}

          {!loading && categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No categories yet. Add your first one above.
            </p>
          )}
        </CardContent>
      </Card>
      <AddCategoryConfirmation
        open={confirmAddOpen}
        categoryName={name}
        loading={adding}
        onCancel={() => setConfirmAddOpen(false)}
        onConfirm={async () => {
          await add();
          setConfirmAddOpen(false);
        }}
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
  toggling,
  dragging,
  reordering,
  onRename,
  onImageChange,
  onToggleShowInFront,
  onDelete,
  onReorder,
  activeDragId,
  onDragStart,
  onDragEnd,
}: {
  category: MenuCategoryRow;
  toggling: boolean;
  dragging: boolean;
  reordering: boolean;
  onRename: (id: string, name: string) => void;
  onImageChange: (id: string, imageUrl: string) => void;
  onToggleShowInFront: (id: string, showInFront: boolean) => void;
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

  useEffect(() => {
    setVal(category.name);
    setImageVal(category.imageUrl ?? '');
    setEditing(false);
  }, [category.name, category.imageUrl]);

  const hasProducts = categoryHasProducts(category);
  const visible = isMenuCategoryShownInFront(category);

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

    if (!nameChanged && !imageChanged) {
      cancelEdit();
      return;
    }

    setSaving(true);
    setSavingImage(true);
    try {
      if (nameChanged) await onRename(category.id, nextName);
      if (imageChanged) await onImageChange(category.id, nextImage);
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
        draggable={!editing && !reordering}
        onDragStart={() => onDragStart(category.id)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!activeDragId || activeDragId === category.id) {
            onDragEnd();
            return;
          }
          onReorder(activeDragId, category.id);
        }}
      >
        {/* Sort */}
        <div className="flex w-14 items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
          <span className="text-sm font-medium">
            {category.sortOrder + 1}
          </span>
        </div>

        {/* Image */}
        <div className="h-16 w-24 overflow-hidden rounded-md border bg-muted shrink-0">
          {category.imageUrl ? (
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

        {/* Name */}
        <div className="flex-1">
          {editing ? (
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
            />
          ) : (
            <>
              <h3 className="font-semibold">{category.name}</h3>

              <p className="text-sm text-muted-foreground">
                {category.items.length}{" "}
                {category.items.length === 1 ? "product" : "products"}
              </p>
            </>
          )}
        </div>

        {/* Visibility */}
        <div className="w-40">
          {!hasProducts ? (
            <Badge variant="outline">
              Empty
            </Badge>
          ) : (
            <Badge variant={visible ? "default" : "secondary"}>
              {visible ? "Storefront" : "Recommendations"}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={() => onDelete(category.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">Drag to reorder</p>

        {/* Show / Hide */}
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
                  if (e.key === "Enter") void saveEdits();
                }}
              />
            </div>

            <Base64ImageUploadField
              label="Category image"
              value={imageVal}
              onChange={setImageVal}
              helperText="Shown on website, kiosk and POS."
            />

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
