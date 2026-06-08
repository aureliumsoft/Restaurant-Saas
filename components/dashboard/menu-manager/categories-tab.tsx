'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

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

  const canAdd = Boolean(name.trim()) && !adding;

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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                checked={showInFront}
                onChange={(e) => setShowInFront(e.target.checked)}
              />
              <span>Show in front (website, kiosk, POS)</span>
            </label>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mx-auto animate-spin text-primary" />
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  toggling={togglingId === c.id}
                  onRename={rename}
                  onImageChange={updateImage}
                  onToggleShowInFront={setCategoryShowInFront}
                  onDelete={(id) => {
                    setDeletingId(id);
                    setConfirmDeleteOpen(true);
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
  onRename,
  onImageChange,
  onToggleShowInFront,
  onDelete,
}: {
  category: MenuCategoryRow;
  toggling: boolean;
  onRename: (id: string, name: string) => void;
  onImageChange: (id: string, imageUrl: string) => void;
  onToggleShowInFront: (id: string, showInFront: boolean) => void;
  onDelete: (id: string) => void;
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
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {category.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={category.imageUrl}
          alt=""
          className="aspect-[16/7] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/7] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No category image
        </div>
      )}
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          {!hasProducts ? (
            <Badge variant="outline" className="shrink-0">
              Empty — hidden
            </Badge>
          ) : (
            <Badge variant={visible ? 'default' : 'secondary'} className="shrink-0">
              {visible ? 'Storefront' : 'Recommendations only'}
            </Badge>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(category.id)}
            aria-label="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              disabled={saving}
              autoFocus
              aria-label="Category name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveEdits();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <Base64ImageUploadField
              label="Category image"
              value={imageVal}
              onChange={setImageVal}
              helperText="Shown on website, kiosk, and POS."
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={saving || savingImage || !val.trim()}
                onClick={() => void saveEdits()}
              >
                {saving || savingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || savingImage}
                onClick={cancelEdit}
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{category.name}</CardTitle>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setEditing(true)}
              aria-label="Edit category"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {category.items.length}{' '}
          {category.items.length === 1 ? 'product' : 'products'}
          {!hasProducts ? ' — add products to show on menu or recommendations' : ''}
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={toggling || !hasProducts}
          onClick={() => onToggleShowInFront(category.id, !visible)}
        >
          {toggling ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : visible ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide from front
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Show in front
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
