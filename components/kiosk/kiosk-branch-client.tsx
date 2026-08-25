'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import {
  CustomerAccountProvider,
  useCustomerAccount,
} from '@/components/customer-app/customer-account-context';
import { KioskApp } from '@/components/kiosk/kiosk-app';

function KioskCustomerSlugSync({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const { setRestaurantContext } = useCustomerAccount();

  useEffect(() => {
    setRestaurantContext({ restaurantSlug: slug });
  }, [slug, setRestaurantContext]);

  return <>{children}</>;
}

function KioskAuthErrorToast() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    const err = searchParams.get('customerAuthError')?.trim();
    if (!err) return;
    toast.error(t('customerAuthGoogleError'));
  }, [searchParams, t]);

  return null;
}

type Props = {
  slug: string;
  branchId: string;
};

export function KioskBranchClient({ slug, branchId }: Props) {
  return (
    <CustomerAccountProvider>
      <KioskCustomerSlugSync slug={slug}>
        <Suspense fallback={null}>
          <KioskAuthErrorToast />
        </Suspense>
        <KioskApp slug={slug} branchId={branchId} />
      </KioskCustomerSlugSync>
    </CustomerAccountProvider>
  );
}
