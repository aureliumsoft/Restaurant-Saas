'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2, Plus, Trash2, X } from 'lucide-react';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import {
  ProductFormFields,
  buildProductPayload,
  isProductCreateFormDirty,
  isProductFormValid,
  useRestaurantVariationTemplates,
  type ProductFormState,
  type VariationFormRow,
} from '@/components/dashboard/menu-manager/product-form-fields';
import { InventoryQuickActions } from '@/components/dashboard/menu-manager/inventory-quick-actions';
import type { IngredientRecipeRow } from '@/components/dashboard/menu-manager/product-ingredient-recipes';
import { useMenuCategoriesCatalog } from '@/hooks/use-menu-categories-catalog';
import ErrorBoundary from '@/components/toaster/toaster';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateProductSaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: '',
  description: '',
  categoryIds: [],
  imageUrl: '',
  price: '',
  salePrice: '',
};

export default function ProductCreatePage() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    categories,
    loading: categoriesLoading,
    refresh: refreshCategories,
  } = useMenuCategoriesCatalog();
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [variationRows, setVariationRows] = useState<VariationFormRow[]>([]);
  const [ingredientRows, setIngredientRows] = useState<IngredientRecipeRow[]>(
    []
  );
  const { variationTemplates, reloadVariationTemplates } =
    useRestaurantVariationTemplates();

  const showEmptyCategories =
    !categoriesLoading && categories.length === 0;

  const isDirty = useMemo(
    () => isProductCreateFormDirty(form, variationRows, ingredientRows),
    [form, variationRows, ingredientRows]
  );

  const canCreate = useMemo(
    () =>
      isProductFormValid(
        form,
        variationRows,
        variationTemplates,
        ingredientRows
      ),
    [form, variationRows, variationTemplates, ingredientRows]
  );

  const {
    leaveOpen,
    leaveMessage,
    requestLeave,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  } = useUnsavedChangesGuard(isDirty);

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
      requestLeave(() => router.push(path));
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty, pathname, requestLeave, router]);

  const goToProducts = () => requestLeave(() => router.push('/product'));

  const resetForm = () => {
    setForm({ ...EMPTY_PRODUCT_FORM });
    setVariationRows([]);
    setIngredientRows([]);
  };

  const save = async (mode: 'close' | 'add-new') => {
    const payload = buildProductPayload(
      form,
      variationRows,
      variationTemplates,
      ingredientRows
    );
    if (!payload.ok) {
      toast.error(payload.error);
      return;
    }

    setSaving(true);
    try {
      await axios.post('/api/restaurant/menu/items', payload.body);
      toast.success('Product created');

      if (mode === 'close') {
        allowNextNavigation();
        router.push('/product');
      } else {
        resetForm();
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Could not create product'
      );
    } finally {
      setSaving(false);
      setSaveConfirmOpen(false);
    }
  };

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Add product"
          description="Create a menu item with photo, category, pricing, and optional variations."
          loading={false}
        >
          <Card>
            <CardHeader className="flex flex-col gap-4 space-y-0">
              <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Create product</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToProducts}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to products
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showEmptyCategories ? (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                  <p className="text-sm text-muted-foreground">
                    Create at least one category before adding products.
                  </p>
                  <InventoryQuickActions
                    variant="toolbar"
                    showVariation={false}
                    onMenuRefresh={refreshCategories}
                    onCategoryCreated={(categoryId) =>
                      setForm((f) => ({
                        ...f,
                        categoryIds: f.categoryIds.includes(categoryId)
                          ? f.categoryIds
                          : [...f.categoryIds, categoryId],
                      }))
                    }
                  />
                </div>
              ) : (
                <>
                  <ProductFormFields
                    categories={categories}
                    categoriesLoading={categoriesLoading}
                    form={form}
                    onFormChange={(patch) =>
                      setForm((f) => ({ ...f, ...patch }))
                    }
                    variationRows={variationRows}
                    onVariationRowsChange={setVariationRows}
                    ingredientRows={ingredientRows}
                    onIngredientRowsChange={setIngredientRows}
                    showRequired
                    onMenuRefresh={refreshCategories}
                    variationTemplates={variationTemplates}
                    onVariationTemplatesReload={reloadVariationTemplates}
                  />
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      disabled={saving || !canCreate}
                      onClick={() => setSaveConfirmOpen(true)}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          <span>Create product</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToProducts}
                    >
                      <span>Cancel</span>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </MenuPageShell>

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
                <X className="h-4 w-4 mr-2" />
                <span>Keep Editing</span>
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

        <CreateProductSaveConfirmation
          open={saveConfirmOpen}
          itemName={form.name.trim() || undefined}
          loading={saving}
          onCancel={() => setSaveConfirmOpen(false)}
          onSaveAndClose={() => void save('close')}
          onSaveAndAddNew={() => void save('add-new')}
        />
      </ErrorBoundary>
    </div>
  );
}
