import { KioskBranchClient } from '@/components/kiosk/kiosk-branch-client';

import '../../kiosk-light.css';

type Props = {
  params: Promise<{ slug: string; branchId: string }>;
};

export default async function KioskBranchPage({ params }: Props) {
  const { slug, branchId } = await params;
  return (
    <div className="kiosk-light-root min-h-screen bg-[#f8fafc]">
      <KioskBranchClient
        slug={decodeURIComponent(slug)}
        branchId={decodeURIComponent(branchId)}
      />
    </div>
  );
}
