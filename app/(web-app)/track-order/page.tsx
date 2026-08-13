import { redirect } from 'next/navigation';
import { OrderTrackingPage } from '@/components/order/order-tracking-page';
import { restaurantTrackOrderPath } from '@/lib/customer-storefront-paths';

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
    redirect(
      restaurantTrackOrderPath(restaurantSlug.trim(), {
        orderId: initialOrderId || undefined,
      })
    );
  }
  return (
    <OrderTrackingPage
      initialOrderId={initialOrderId}
      restaurantSlug={restaurantSlug.trim()}
    />
  );
}
