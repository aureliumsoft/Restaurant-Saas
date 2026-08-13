'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2 } from 'lucide-react';

import { useCustomerAccount } from '@/components/customer-app/customer-account-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRestaurantRegional } from '@/hooks/use-restaurant-regional';
import { restaurantOrdersPath } from '@/lib/customer-storefront-paths';

type OrderDetail = {
  id: string;
  shortOrderId: string;
  status: string;
  total: number;
  serviceChargeAmount: number;
  createdAt: string;
  fulfillment: 'delivery' | 'pickUp';
  customerComment: string | null;
  cutleryRequested: boolean;
  scheduleMode: string | null;
  scheduleSlot: string | null;
  branch: { id: string; name: string; address: string | null } | null;
  payments: Array<{
    id: string;
    status: string;
    method: string;
    amount: number;
  }>;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    name: string;
    imageUrl: string | null;
    modifiers: Array<{
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
    }>;
  }>;
};

export default function CustomerOrderDetailPage() {
  const params = useParams<{ slug: string; orderId: string }>();
  const slug = decodeURIComponent(params.slug ?? '');
  const orderId = decodeURIComponent(params.orderId ?? '');
  const { t } = useTranslation();
  const router = useRouter();
  const { account, loading: accountLoading, openAccountSheet, setRestaurantContext } =
    useCustomerAccount();
  const { formatMoney } = useRestaurantRegional(slug);
  const [order, setOrder] = useState<OrderDetail | null>(null);
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
          `/api/customer/me/orders/${encodeURIComponent(orderId)}?restaurantSlug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: { order?: OrderDetail };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || t('customerOrderNotFound'));
          setOrder(null);
          return;
        }
        setOrder(json.data?.order ?? null);
      } catch {
        if (!cancelled) setError(t('customerAuthGenericError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, accountLoading, openAccountSheet, orderId, slug, t]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push(restaurantOrdersPath(slug))}
          aria-label={t('customerOrderBack')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-[#1f1235]">
          {t('customerOrderDetailTitle')}
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : null}

      {order ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-lg">
                <span>#{order.shortOrderId}</span>
                <span className="text-sm font-medium uppercase text-muted-foreground">
                  {order.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#334155]">
              <p>{new Date(order.createdAt).toLocaleString()}</p>
              <p>
                {order.fulfillment === 'delivery' ? 'Delivery' : 'Pick-up'}
                {order.branch?.name ? ` · ${order.branch.name}` : ''}
              </p>
              {order.scheduleSlot ? (
                <p>
                  {order.scheduleMode === 'later' ? 'Scheduled' : 'ASAP'}
                  {`: ${order.scheduleSlot}`}
                </p>
              ) : null}
              {order.cutleryRequested ? <p>Cutlery requested</p> : null}
              {order.customerComment ? (
                <p>Note: {order.customerComment}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('customerOrderItems')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-[#ececf0] pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {item.quantity}× {item.name}
                    </p>
                    {item.modifiers.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {item.modifiers.map((mod) => (
                          <p
                            key={mod.id}
                            className="text-xs text-muted-foreground"
                          >
                            - {mod.name}
                            {mod.unitPrice > 0
                              ? ` (+${formatMoney(mod.unitPrice)})`
                              : ''}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatMoney(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('customerOrderPayment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.serviceChargeAmount > 0 ? (
                <div className="flex justify-between">
                  <span>Service charge</span>
                  <span>{formatMoney(order.serviceChargeAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between text-muted-foreground"
                >
                  <span>
                    {payment.method} · {payment.status}
                  </span>
                  <span>{formatMoney(payment.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
