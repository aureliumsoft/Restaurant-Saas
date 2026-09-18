import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { RestaurantThemeStyle } from '@/components/customer-app/restaurant-theme-style';
import { loadRestaurantThemePrimary } from '@/lib/load-restaurant-theme-primary';
import { metadataForRestaurantSlug } from '@/lib/restaurant-page-metadata';

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataForRestaurantSlug(slug);
}

export default async function WebAppSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  const color = await loadRestaurantThemePrimary(slug);
  return (
    <>
      <RestaurantThemeStyle color={color} />
      {children}
    </>
  );
}
