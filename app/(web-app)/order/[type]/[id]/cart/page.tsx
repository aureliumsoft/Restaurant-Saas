import CartPageClient from '@/components/order/cart-page';
import { notFound } from 'next/navigation';
import { orderInfoFromSearchParams } from '@/lib/order-search-params';

type CartPageProps = {
  params: Promise<{
    type: string;
    id: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CartPage({ params, searchParams }: CartPageProps) {
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

  return <CartPageClient orderType={orderType} orderId={orderId} orderInfo={orderInfo} />;
}