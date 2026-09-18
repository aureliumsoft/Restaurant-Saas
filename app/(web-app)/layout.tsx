import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import { RestaurantThemeStyle } from '@/components/customer-app/restaurant-theme-style';
import { WebAppLayoutShell } from '@/components/customer-app/web-app-layout-shell';
import {
  parseRestaurantThemeCookie,
  RESTAURANT_THEME_COOKIE,
} from '@/lib/restaurant-theme-persist';

import './web-app-customer.css';

export const metadata: Metadata = {
  title: {
    default: 'Order online',
    template: '%s',
  },
  description: 'Browse the menu and order from your restaurant.',
};

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const fromCookie = parseRestaurantThemeCookie(
    cookieStore.get(RESTAURANT_THEME_COOKIE)?.value
  );

  return (
    <>
      <RestaurantThemeStyle
        color={fromCookie?.color}
        styleId="restaurant-theme-cookie"
      />
      <WebAppLayoutShell>{children}</WebAppLayoutShell>
    </>
  );
}
