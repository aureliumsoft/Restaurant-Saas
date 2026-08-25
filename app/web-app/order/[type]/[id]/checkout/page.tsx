import CheckoutPageClient from '@/components/order/checkout-page';
import { notFound } from 'next/navigation';
import { orderInfoFromSearchParams } from '@/lib/order-search-params';

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

  const orderInfo = orderInfoFromSearchParams(searchParamsResolved, orderType);

  return <CheckoutPageClient orderType={orderType} orderId={orderId} orderInfo={orderInfo} />;
}