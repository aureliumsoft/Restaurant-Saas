'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import {
  ProductFormFields,
  ProductFormSkeleton,
  buildProductPayload,
  categoriesWithSelectedIds,
  isProductEditFormDirty,
  productFormStateFromItem,
  useRestaurantVariationTemplates,
  variationRowsFromItem,
  type ProductFormState,
  type VariationFormRow,
} from '@/components/dashboard/menu-manager/product-form-fields';
import { InventoryQuickActions } from '@/components/dashboard/menu-manager/inventory-quick-actions';
import {
  ingredientRowsFromItem,
  type IngredientRecipeRow,
} from '@/components/dashboard/menu-manager/product-ingredient-recipes';
import type { MenuItemRow } from '@/components/dashboard/menu-manager/types';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveConfirmation } from '@/components/ui/confirmation-dialogs';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

export default function ProductEditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const productId = typeof params.id === 'string' ? params.id : '';

  const {
    categories,
    loading: categoriesLoading,
    refresh: refreshCategories,
  } = useMenuCategoriesCatalog();
  const [productLoading, setProductLoading] = useState(true);
  const [productNotFound, setProductNotFound] = useState(false);
  const [item, setItem] = useState<MenuItemRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>({
    name: '',
    description: '',
    categoryIds: [],
    imageUrl: '',
    price: '',
    salePrice: '',
  });
  const [variationRows, setVariationRows] = useState<VariationFormRow[]>([]);
  const [ingredientRows, setIngredientRows] = useState<IngredientRecipeRow[]>(
    []
  );
  const { variationTemplates, reloadVariationTemplates } =
    useRestaurantVariationTemplates();
  const initialRef = useRef<{
    form: ProductFormState;
    variationRows: VariationFormRow[];
    ingredientRows: IngredientRecipeRow[];
  } | null>(null);
  const hydratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setProductLoading(false);
      setProductNotFound(true);
      setItem(null);
      return;
    }

    let cancelled = false;
    hydratedIdRef.current = null;
    initialRef.current = null;
    setProductLoading(true);
    setProductNotFound(false);
    setItem(null);

    void axios
      .get<{ data: MenuItemRow }>(`/api/restaurant/menu/items/${productId}`)
      .then((res) => {
        if (cancelled) return;
        setItem(res.data.data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { status?: number } };
        if (err.response?.status === 404) {
          setProductNotFound(true);
        } else {
          toast.error('Could not load product.');
          setProductNotFound(true);
        }
        setItem(null);
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!item || hydratedIdRef.current === item.id) return;
    const nextForm = productFormStateFromItem(item);
    const nextVariations = variationRowsFromItem(item);
    const nextIngredients = ingredientRowsFromItem(item);
    setForm(nextForm);
    setVariationRows(nextVariations);
    setIngredientRows(nextIngredients);
    initialRef.current = {
      form: nextForm,
      variationRows: nextVariations,
      ingredientRows: nextIngredients,
    };
    hydratedIdRef.current = item.id;
  }, [item]);

  const categoriesForForm = useMemo(
    () => categoriesWithSelectedIds(categories, form.categoryIds),
    [categories, form.categoryIds]
  );

  const isDirty = useMemo(() => {
    if (!initialRef.current) return false;
    return isProductEditFormDirty(initialRef.current, {
      form,
      variationRows,
      ingredientRows,
    });
  }, [form, variationRows, ingredientRows]);

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

  const save = async () => {
    if (!productId) return;
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
      await axios.patch(
        `/api/restaurant/menu/items/${productId}`,
        payload.body
      );
      toast.success('Product updated');
      allowNextNavigation();
      router.push('/product');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      toast.error(
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Could not update product'
      );
    } finally {
      setSaving(false);
      setSaveConfirmOpen(false);
    }
  };

  const showEmptyCategories =
    !categoriesLoading && categories.length === 0 && !productLoading;
  const showForm = Boolean(item) && !productNotFound;
  const showFormSkeleton =
    productLoading || (showForm && categoriesLoading && categories.length === 0);

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Edit product"
          description="Update menu item details, pricing, and variations."
          loading={false}
        >
          {productNotFound ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <p className="text-sm text-muted-foreground">
                  Product not found. It may have been deleted.
                </p>
                <Button type="button" asChild className="w-fit">
                  <Link href="/product">Back to products</Link>
                </Button>
              </CardContent>
            </Card>
          ) : showEmptyCategories ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <p className="text-sm text-muted-foreground">
                  Create at least one category before editing products.
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col gap-4 space-y-0">
                <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">
                    {item?.name ?? 'Edit product'}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToProducts}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to products
                  </Button>
                </div>
                <InventoryQuickActions
                  onMenuRefresh={refreshCategories}
                  onVariationTemplatesReload={reloadVariationTemplates}
                  onCategoryCreated={(categoryId) =>
                    setForm((f) => ({
                      ...f,
                      categoryIds: f.categoryIds.includes(categoryId)
                        ? f.categoryIds
                        : [...f.categoryIds, categoryId],
                    }))
                  }
                />
              </CardHeader>
              <CardContent className="space-y-6">
                {showFormSkeleton ? (
                  <ProductFormSkeleton />
                ) : showForm ? (
                  <>
                    <ProductFormFields
                      categories={categoriesForForm}
                      form={form}
                      onFormChange={(patch) =>
                        setForm((f) => ({ ...f, ...patch }))
                      }
                      variationRows={variationRows}
                      onVariationRowsChange={setVariationRows}
                      ingredientRows={ingredientRows}
                      onIngredientRowsChange={setIngredientRows}
                      onMenuRefresh={refreshCategories}
                      variationTemplates={variationTemplates}
                      onVariationTemplatesReload={reloadVariationTemplates}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        type="button"
                        disabled={saving || !isDirty}
                        onClick={() => setSaveConfirmOpen(true)}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goToProducts}
                        disabled={saving}
                      >
                        <>
                          <X className="h-4 w-4 mr-2" />
                          <span>Cancel</span>
                        </>
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
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
              <AlertDialogCancel
                type="button"
                className="bg-gray-100 text-gray-900 hover:bg-gray-200 hover:text-gray-900"
              >
                <>
                  <X className="h-4 w-4 mr-2" />
                  <span>Keep Editing</span>
                </>
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={confirmLeave}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Leave Without Saving</span>
                </>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SaveConfirmation
          open={saveConfirmOpen}
          title="Update product"
          description="Save changes to this product?"
          itemName={form.name.trim() || item?.name || 'Product'}
          loading={saving}
          onConfirm={() => void save()}
          onCancel={() => setSaveConfirmOpen(false)}
        />
      </ErrorBoundary>
    </div>
  );
}
