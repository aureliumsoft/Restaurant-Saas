import { redirect } from 'next/navigation';
import { OrderTrackingPage } from '@/components/order/order-tracking-page';

type Props = {
  searchParams: Promise<{ orderId?: string; restaurantSlug?: string; slug?: string }>;
};

export default async function TrackOrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const initialOrderId =
    typeof sp.orderId === 'string' ? sp.orderId.trim() : '';
  const restaurantSlug =
    (typeof sp.restaurantSlug === 'string' ? sp.restaurantSlug : '') ||
    (typeof sp.slug === 'string' ? sp.slug : '');
  if (restaurantSlug.trim()) {
    const q = initialOrderId
      ? `?orderId=${encodeURIComponent(initialOrderId)}`
      : '';
    redirect(`/web-app/${encodeURIComponent(restaurantSlug.trim())}/track-order${q}`);
  }
  return (
    <OrderTrackingPage
      initialOrderId={initialOrderId}
      restaurantSlug={restaurantSlug.trim()}
    />
  );
}
