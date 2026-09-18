import CheckoutPageClient from '@/components/order/checkout-page';
import { notFound } from 'next/navigation';
import { RestaurantThemeStyle } from '@/components/customer-app/restaurant-theme-style';
import { loadRestaurantThemePrimary } from '@/lib/load-restaurant-theme-primary';
import { resolveInitialOrderInfo } from '@/lib/load-order-info-from-location';

type CheckoutPageProps = {
  params: Promise<{
    type: string;
    id: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
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
    <>
      <RestaurantThemeStyle
        color={initialThemePrimaryColor}
        styleId="restaurant-theme-order"
      />
      <CheckoutPageClient
        orderType={orderType}
        orderId={orderId}
        orderInfo={orderInfo}
        initialThemePrimaryColor={initialThemePrimaryColor}
      />
    </>
  );
}