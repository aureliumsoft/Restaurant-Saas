import { OrderTrackingPage } from '@/components/order/order-tracking-page';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orderId?: string }>;
};

export default async function SlugTrackOrderPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const initialOrderId =
    typeof sp.orderId === 'string' ? sp.orderId.trim() : '';
  return (
    <OrderTrackingPage
      initialOrderId={initialOrderId}
      restaurantSlug={decodeURIComponent(slug)}
    />
  );
}
