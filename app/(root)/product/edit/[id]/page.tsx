'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  ArrowRight,
  Cross,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import { MenuPageShell } from '@/components/dashboard/menu-manager/menu-page-shell';
import {
  ProductFormFields,
  buildProductPayload,
  isProductEditFormDirty,
  productFormStateFromItem,
  useRestaurantVariationTemplates,
  variationRowsFromItem,
  type ProductFormState,
  type VariationFormRow,
} from '@/components/dashboard/menu-manager/product-form-fields';
import { useRestaurantMenu } from '@/components/dashboard/menu-manager/use-restaurant-menu';
import type { MenuItemRow } from '@/components/dashboard/menu-manager/types';
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

function findMenuItem(
  categories: { items: MenuItemRow[] }[],
  id: string
): MenuItemRow | null {
  for (const category of categories) {
    const found = category.items.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

export default function ProductEditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const productId = typeof params.id === 'string' ? params.id : '';

  const { loading, categories, load } = useRestaurantMenu();
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>({
    name: '',
    description: '',
    categoryId: '',
    imageUrl: '',
    price: '',
    salePrice: '',
  });
  const [variationRows, setVariationRows] = useState<VariationFormRow[]>([]);
  const variationTemplates = useRestaurantVariationTemplates();
  const initialRef = useRef<{
    form: ProductFormState;
    variationRows: VariationFormRow[];
  } | null>(null);
  const hydratedIdRef = useRef<string | null>(null);

  const item = useMemo(
    () => (productId ? findMenuItem(categories, productId) : null),
    [categories, productId]
  );

  useEffect(() => {
    if (!item || hydratedIdRef.current === item.id) return;
    const nextForm = productFormStateFromItem(item);
    const nextVariations = variationRowsFromItem(item);
    setForm(nextForm);
    setVariationRows(nextVariations);
    initialRef.current = {
      form: nextForm,
      variationRows: nextVariations,
    };
    hydratedIdRef.current = item.id;
  }, [item]);

  const resolvedCategoryId = form.categoryId || item?.categoryId || '';

  const isDirty = useMemo(() => {
    if (!initialRef.current) return false;
    return isProductEditFormDirty(initialRef.current, {
      form: { ...form, categoryId: resolvedCategoryId },
      variationRows,
    });
  }, [form, resolvedCategoryId, variationRows]);

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
      { ...form, categoryId: resolvedCategoryId },
      variationRows,
      variationTemplates
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
      await load();
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

  const showNotFound = !loading && productId && !item;

  return (
    <div className="w-full">
      <ErrorBoundary>
        <MenuPageShell
          title="Edit product"
          description="Update menu item details, pricing, and variations."
          loading={false}
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="animate-spin text-primary text-center mx-auto" />
            </p>
          ) : (
            <>
              {showNotFound ? (
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
              ) : categories?.length === 0 && !loading ? (
                <Card>
                  <CardContent className="flex flex-col gap-3 p-6">
                    <p className="text-sm text-muted-foreground">
                      Create at least one category before editing products.
                    </p>
                    <Button type="button" asChild className="w-fit">
                      <Link href="/categories">
                        <span>Go to Categories</span>
                        <ArrowRight className="ml-2 h-4 w-4" />{' '}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : item ? (
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToProducts}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to products
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ProductFormFields
                      categories={categories}
                      form={{ ...form, categoryId: resolvedCategoryId }}
                      onFormChange={(patch) =>
                        setForm((f) => ({ ...f, ...patch }))
                      }
                      variationRows={variationRows}
                      onVariationRowsChange={setVariationRows}
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
                  </CardContent>
                </Card>
              ) : null}
            </>
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
