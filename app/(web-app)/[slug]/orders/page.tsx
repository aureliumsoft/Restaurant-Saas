'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { useCustomerAccount } from '@/components/customer-app/customer-account-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import {
  restaurantOrderDetailPath,
  restaurantOrdersPath,
  restaurantStorefrontPath,
} from '@/lib/customer-storefront-paths';

type OrderListItem = {
  id: string;
  shortOrderId: string;
  status: string;
  total: number;
  createdAt: string;
  fulfillment: 'delivery' | 'pickUp';
  branchName: string | null;
  paymentStatus: string | null;
  itemPreview: string[];
  itemCount: number;
};

export default function CustomerOrdersPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? '');
  const { t } = useTranslation();
  const router = useRouter();
  const { account, loading: accountLoading, openAccountSheet, setRestaurantContext } =
    useCustomerAccount();
  const { formatMoney } = useRestaurantRegional(slug);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRestaurantContext({ restaurantSlug: slug });
  }, [setRestaurantContext, slug]);

  useEffect(() => {
    if (accountLoading) return;
    if (!account) {
      setLoading(false);
      openAccountSheet({ restaurantSlug: slug });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/customer/me/orders?restaurantSlug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: { orders?: OrderListItem[] };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || t('customerAuthGenericError'));
          setOrders([]);
          return;
        }
        setOrders(json.data?.orders ?? []);
      } catch {
        if (!cancelled) setError(t('customerAuthGenericError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, accountLoading, openAccountSheet, slug, t]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push(restaurantStorefrontPath(slug))}
          aria-label={t('back')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-[#1f1235]">
          {t('customerOrdersTitle')}
        </h1>
      </div>

      {!account && !accountLoading ? (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-muted-foreground">{t('customerOrdersEmptyHint')}</p>
            <Button
              type="button"
              onClick={() => openAccountSheet({ restaurantSlug: slug })}
            >
              {t('storefrontLogin')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : null}

      {!loading && account && orders.length === 0 && !error ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-semibold">{t('customerOrdersEmpty')}</p>
            <p className="text-sm text-muted-foreground">
              {t('customerOrdersEmptyHint')}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={restaurantOrderDetailPath(slug, order.id)}
            className="block rounded-2xl border border-[#ececf0] bg-white p-4 shadow-sm transition hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-[#1f1235]">#{order.shortOrderId}</p>
                <p className="mt-1 text-sm text-[#64748b]">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#64748b]">
                  {order.fulfillment === 'delivery' ? 'Delivery' : 'Pick-up'}
                  {order.branchName ? ` · ${order.branchName}` : ''}
                </p>
                {order.itemPreview.length > 0 ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[#334155]">
                    {order.itemPreview.join(' · ')}
                    {order.itemCount > order.itemPreview.length
                      ? ` · +${order.itemCount - order.itemPreview.length}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{formatMoney(order.total)}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#64748b]">
                  {order.status}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
