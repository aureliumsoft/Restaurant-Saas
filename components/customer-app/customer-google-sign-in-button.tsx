'use client';

import { IconBrandGoogleFilled } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function startCustomerGoogleSignIn(restaurantSlug: string) {
  const slug = restaurantSlug.trim();
  if (!slug) return;

  const pathAndSearch = `${window.location.pathname}${window.location.search}`;
  const returnTo =
    pathAndSearch.startsWith('/') && !pathAndSearch.startsWith('//')
      ? pathAndSearch
      : `/${encodeURIComponent(slug)}`;

  const params = new URLSearchParams({
    restaurantSlug: slug,
    returnTo,
  });
  window.location.assign(`/api/customer-auth/google/start?${params.toString()}`);
}

export function CustomerGoogleSignInButton({
  restaurantSlug,
  disabled,
  className,
}: {
  restaurantSlug: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!restaurantSlug?.trim()) return null;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        'h-12 w-full rounded-xl border-[#dadce0] bg-white text-base font-semibold text-[#3c4043] shadow-none',
        'hover:bg-[#f8f9fa]',
        className
      )}
      onClick={() => startCustomerGoogleSignIn(restaurantSlug)}
    >
      <IconBrandGoogleFilled className="mr-2 h-5 w-5 text-[#ea4335]" />
      {t('customerAuthContinueWithGoogle')}
    </Button>
  );
}

export function CustomerAuthOrDivider() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[#ececf0]" />
      <span className="text-xs font-medium uppercase tracking-wide text-[#8b8698]">
        {t('customerAuthOr')}
      </span>
      <div className="h-px flex-1 bg-[#ececf0]" />
    </div>
  );
}
