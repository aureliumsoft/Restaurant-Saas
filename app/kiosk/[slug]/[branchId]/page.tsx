import { KioskBranchClient } from '@/components/kiosk/kiosk-branch-client';
import { resolveRouteId } from '@/lib/resolve-route-id';
import { db } from '@/lib/db';
import { FeatureDisabledScreen } from '@/components/common/feature-disabled-screen';

import '../../kiosk-light.css';

type Props = {
  params: Promise<{ slug: string; branchId: string }>;
};

export default async function KioskBranchPage({ params }: Props) {
  const { slug, branchId: rawBranchId } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const branchUrlId = decodeURIComponent(rawBranchId);
  const branchId = resolveRouteId(branchUrlId);

  const restaurant = await db.restaurant.findUnique({
    where: { slug: decodedSlug },
    select: { name: true, kioskEnabled: true, dineInEnabled: true },
  });

  if (restaurant && !restaurant.kioskEnabled && !restaurant.dineInEnabled) {
    return (
      <FeatureDisabledScreen
        feature="kiosk"
        restaurantName={restaurant.name}
        homeUrl="/"
      />
    );
  }

  return (
    <div className="kiosk-light-root min-h-screen bg-[#f8fafc]">
      <KioskBranchClient
        slug={decodedSlug}
        branchId={branchId}
        branchUrlId={branchUrlId}
      />
    </div>
  );
}
