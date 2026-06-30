'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Loader2, Tag } from 'lucide-react';

import { GlassPanel, SectionHeading } from '@/components/customer-app/storefront/glass-panel';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  salePrice?: number | null;
  categoryName: string;
};

function pickFeatured(items: MenuItem[]): MenuItem[] {
  const scored = [...items].sort((a, b) => {
    const score = (x: MenuItem) => {
      let s = 0;
      if (x.salePrice != null && x.salePrice < x.price) s += 3;
      if (x.imageUrl?.trim()) s += 2;
      return s;
    };
    return score(b) - score(a);
  });
  return scored.slice(0, 6);
}

export function StorefrontFeatured({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { formatMoney } = useRestaurantRegional(slug);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/customer/menu?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const menus = (json?.data?.menus ?? []) as {
          id: string;
          name: string;
          items: Omit<MenuItem, 'categoryName'>[];
        }[];
        const flat: MenuItem[] = menus.flatMap((cat) =>
          (cat.items ?? []).map((item) => ({
            ...item,
            categoryName: cat.name,
          }))
        );
        if (!cancelled) setItems(pickFeatured(flat));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const featured = useMemo(() => items, [items]);

  if (!loading && featured.length === 0) return null;

  return (
    <GlassPanel>
      <SectionHeading
        title={t('storefrontFeaturedTitle')}
        subtitle={t('storefrontFeaturedSubtitle')}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item) => {
            const onSale =
              item.salePrice != null && item.salePrice < item.price;
            const displayPrice = onSale ? item.salePrice! : item.price;

            return (
              <a
                key={item.id}
                href="#menu"
                className="group flex gap-4 rounded-2xl border border-[var(--restaurant-glass-border,#e2e8f0)] bg-white/90 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
                  {item.imageUrl?.trim() ? (
                    <img
                      src={item.imageUrl.trim()}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary/40">
                      {item.name.charAt(0)}
                    </span>
                  )}
                  {onSale ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                      <Tag className="h-2.5 w-2.5" />
                      Sale
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {item.categoryName}
                  </p>
                  <p className="truncate font-semibold text-[#0f172a] group-hover:text-primary">
                    {item.name}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#64748b]">
                      {item.description}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-baseline gap-2">
                    {onSale ? (
                      <span className="text-xs text-[#94a3b8] line-through">
                        {formatMoney(item.price)}
                      </span>
                    ) : null}
                    <span className="font-bold text-primary">
                      {formatMoney(displayPrice)}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[#64748b]">
        <Flame className="h-3.5 w-3.5 text-primary" aria-hidden />
        {t('storefrontFeaturedHint')}
      </p>
    </GlassPanel>
  );
}
