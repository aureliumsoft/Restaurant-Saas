import { KioskBranchClient } from '@/components/kiosk/kiosk-branch-client';
import { resolveRouteId } from '@/lib/resolve-route-id';

import '../../kiosk-light.css';

type Props = {
  params: Promise<{ slug: string; branchId: string }>;
};

export default async function KioskBranchPage({ params }: Props) {
  const { slug, branchId: rawBranchId } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const branchUrlId = decodeURIComponent(rawBranchId);
  const branchId = resolveRouteId(branchUrlId);
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
