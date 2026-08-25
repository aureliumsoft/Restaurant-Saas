import { KioskPaymentSuccess } from '@/components/kiosk/kiosk-payment-success';

type Props = {
  params: Promise<{ slug: string; branchId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function KioskBranchSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug, branchId } = await params;
  const sp = await searchParams;
  const orderId = pick(sp, 'orderId').trim() || null;
  const sessionId = pick(sp, 'session_id').trim() || null;
  const token = pick(sp, 'token').trim() || null;
  const ticketRaw = pick(sp, 'ticket').trim();
  const ticketFromQuery = ticketRaw ? Number(ticketRaw) : null;
  const mobileRaw = (pick(sp, 'Mobile') || pick(sp, 'mobile')).trim().toLowerCase();
  const isMobile = mobileRaw === 'true' || mobileRaw === '1' || mobileRaw === 'yes';
  return (
    <KioskPaymentSuccess
      slug={decodeURIComponent(slug)}
      branchId={decodeURIComponent(branchId)}
      orderId={orderId}
      sessionId={sessionId}
      token={token}
      ticketFromQuery={Number.isFinite(ticketFromQuery) ? ticketFromQuery : null}
      isMobile={isMobile}
    />
  );
}
