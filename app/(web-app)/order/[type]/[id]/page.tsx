import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import OrderPageClient from '@/components/order/order-page';
import { orderInfoFromSearchParams } from '@/lib/order-search-params';

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

  const orderInfo = orderInfoFromSearchParams(searchParamsResolved, orderType);

  return (
    <Suspense fallback={null}>
      <OrderPageClient orderType={orderType} orderId={orderId} orderInfo={orderInfo} />
    </Suspense>
  );
}
