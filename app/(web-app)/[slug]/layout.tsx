import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { metadataForRestaurantSlug } from '@/lib/restaurant-page-metadata';

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return metadataForRestaurantSlug(slug);
}

export default function WebAppSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
