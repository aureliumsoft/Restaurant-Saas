import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import OrderPageClient from '@/components/order/order-page';
import { RestaurantThemeStyle } from '@/components/customer-app/restaurant-theme-style';
import { loadRestaurantThemePrimary } from '@/lib/load-restaurant-theme-primary';
import { resolveInitialOrderInfo } from '@/lib/load-order-info-from-location';

type OrderSummaryProps = {
  params: Promise<{
    type: string;
    id: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function OrderSummaryPage({ params, searchParams }: OrderSummaryProps) {
  const { type: typeParam, id: orderId } = await params;
  const searchParamsResolved = await searchParams;

  const mode =
    typeParam === 'pickUp' || typeParam.toLowerCase() === 'pickup'
      ? 'pickUp'
      : typeParam === 'delivery'
        ? 'delivery'
        : null;

  if (mode !== 'delivery' && mode !== 'pickUp') {
    notFound();
  }

  const orderType = mode === 'pickUp' ? 'pickUp' : 'delivery';

  const orderInfo = await resolveInitialOrderInfo(
    orderId,
    searchParamsResolved,
    orderType
  );
  const initialThemePrimaryColor = await loadRestaurantThemePrimary(
    orderInfo.restaurantSlug
  );

  return (
    <Suspense fallback={null}>
      <RestaurantThemeStyle
        color={initialThemePrimaryColor}
        styleId="restaurant-theme-order"
      />
      <OrderPageClient
        orderType={orderType}
        orderId={orderId}
        orderInfo={orderInfo}
        initialThemePrimaryColor={initialThemePrimaryColor}
      />
    </Suspense>
  );
}
