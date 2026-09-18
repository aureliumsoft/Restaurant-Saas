import { WebAppStorefront } from '@/components/customer-app/web-app-storefront';
import { loadRestaurantThemePrimary } from '@/lib/load-restaurant-theme-primary';

export default async function WebAppBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initialThemePrimaryColor = await loadRestaurantThemePrimary(slug);
  return (
    <div className="flex flex-1 flex-col bg-transparent text-inherit">
      <WebAppStorefront
        slug={slug}
        initialThemePrimaryColor={initialThemePrimaryColor}
      />
    </div>
  );
}
