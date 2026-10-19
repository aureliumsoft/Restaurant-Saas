import { cookies } from 'next/headers';

import { KioskBranchClient } from '@/components/kiosk/kiosk-branch-client';
import { FeatureDisabledScreen } from '@/components/common/feature-disabled-screen';
import { PlanUpgradeScreen } from '@/components/premium/plan-upgrade-screen';
import { getPublicModuleGate } from '@/lib/entitlements';
import {
  KIOSK_TABLE_QR_COOKIE,
  kioskTableQrCookieMatches,
  parseKioskTableQrCookie,
} from '@/lib/kiosk-qr-cookie';
import { parseKioskDeepLinkParams } from '@/lib/kiosk-path';
import { resolveRouteId } from '@/lib/resolve-route-id';
import { db } from '@/lib/db';

import '../../kiosk-light.css';

type Props = {
  params: Promise<{ slug: string; branchId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function searchParamsToURLSearchParams(
  raw: Record<string, string | string[] | undefined> | undefined
): URLSearchParams {
  const out = new URLSearchParams();
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) out.append(key, v);
    } else {
      out.set(key, value);
    }
  }
  return out;
}

export default async function KioskBranchPage({ params, searchParams }: Props) {
  const { slug, branchId: rawBranchId } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const branchUrlId = decodeURIComponent(rawBranchId);
  const branchId = resolveRouteId(branchUrlId);

  const sp = searchParamsToURLSearchParams(
    searchParams ? await searchParams : undefined
  );
  const deepLink = parseKioskDeepLinkParams(sp);
  const cookieStore = await cookies();
  const qrCookie = parseKioskTableQrCookie(
    cookieStore.get(KIOSK_TABLE_QR_COOKIE)?.value
  );
  const isTableQrNav =
    Boolean(deepLink.tableId) ||
    kioskTableQrCookieMatches(qrCookie, decodedSlug, branchId) ||
    kioskTableQrCookieMatches(qrCookie, decodedSlug, branchUrlId);

  const planGate = await getPublicModuleGate(decodedSlug, 'kiosk');
  if (planGate.found && planGate.paid && !isTableQrNav) {
    return (
      <PlanUpgradeScreen
        featureLabel="Kiosk"
        restaurantName={planGate.restaurantName ?? undefined}
      />
    );
  }

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
