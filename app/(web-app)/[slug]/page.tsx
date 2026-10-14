import { WebAppStorefront } from '@/components/customer-app/web-app-storefront';
import { PlanUpgradeScreen } from '@/components/premium/plan-upgrade-screen';
import { getPublicModuleGate } from '@/lib/entitlements';
import { loadRestaurantThemePrimary } from '@/lib/load-restaurant-theme-primary';

export default async function WebAppBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await getPublicModuleGate(slug, 'website');
  if (gate.found && gate.paid) {
    return (
      <PlanUpgradeScreen
        featureLabel="Website ordering"
        restaurantName={gate.restaurantName ?? undefined}
      />
    );
  }
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
