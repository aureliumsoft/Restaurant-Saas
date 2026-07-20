'use client';

import { AlertCircle } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { useProgressiveCustomerMenu } from '@/hooks/use-progressive-customer-menu';
import {
  buildCustomerMenuCategoriesUrl,
  buildCustomerMenuCategoryItemsUrl,
} from '@/lib/customer-menu-client';
import { LazyMenuProductImage } from '@/components/menu/lazy-menu-product-image';
import { ProductCardSkeletonGrid } from '@/components/menu/product-card-skeleton';

type MenuItemLite = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  price: number;
  salePrice?: number | null;
};

export function StoreMenu({ slug }: { slug: string }) {
  const { formatMoney } = useRestaurantRegional(slug);

  const categoryItemsUrl = useCallback(
    (categoryId: string, page: number, limit: number) =>
      buildCustomerMenuCategoryItemsUrl(categoryId, slug, null, null, {
        page,
        limit,
      }),
    [slug]
  );

  const {
    categories: progressiveCategories,
    categoriesLoading,
    error,
  } = useProgressiveCustomerMenu<MenuItemLite>({
    categoriesUrl: buildCustomerMenuCategoriesUrl(slug, null, null),
    categoryItemsUrl,
    enabled: Boolean(slug),
  });

  const categories = useMemo(
    () =>
      progressiveCategories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items,
        loading: c.loading,
        loaded: c.loaded,
      })),
    [progressiveCategories]
  );

  const menuLoading = categoriesLoading && categories.length === 0;

  if (error) {
    return <AlertCircle className="mx-auto text-destructive" />;
  }

  if (!menuLoading && categories.length === 0) {
    return (
      <p className="text-sm text-[#64748b]">
        No menu published for this restaurant yet. Run{' '}
        <code className="rounded bg-[#f1f5f9] px-1 text-[#0f172a]">
          npx prisma db seed
        </code>{' '}
        to load the demo data.
      </p>
    );
  }

  return (
    <div className="space-y-10 text-[#0f172a]">
      {menuLoading ? (
        <ProductCardSkeletonGrid
          count={4}
          variant="online"
          gridClassName="grid gap-4 sm:grid-cols-2"
        />
      ) : (
        categories.map((cat) => (
          <section key={cat.id} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">
              {cat.name}
            </h3>
            {cat.loading || (!cat.loaded && cat.items.length === 0) ? (
              <ProductCardSkeletonGrid
                count={2}
                variant="online"
                gridClassName="grid gap-4 sm:grid-cols-2"
              />
            ) : cat.items.length === 0 ? null : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {cat.items.map((item) => (
                  <li
                    key={item.id}
                    className="group flex gap-4 rounded-2xl border border-[var(--restaurant-glass-border,#e2e8f0)] bg-white/90 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                  >
                    <LazyMenuProductImage
                      src={item.imageUrl ?? null}
                      hasImage={item.hasImage ?? Boolean(item.imageUrl)}
                      alt={item.name}
                      className="h-20 w-20 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f172a] group-hover:text-primary">
                            {item.name}
                          </p>
                          {item.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {item.salePrice != null &&
                          item.salePrice < item.price ? (
                            <>
                              <span className="text-sm text-[#94a3b8] line-through">
                                {formatMoney(item.price)}
                              </span>
                              <p className="font-semibold text-primary">
                                {formatMoney(item.salePrice)}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold text-[#0f172a]">
                              {formatMoney(item.price)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
