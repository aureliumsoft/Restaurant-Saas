import type { Metadata } from 'next';

import { HomePage } from '@/components/marketing/home-page';

export const metadata: Metadata = {
  title: 'Foodluk — Restaurant ordering, POS, kiosk and kitchen',
  description:
    'Own your customers with a branded website and app, then take the same menu on kiosk, POS, kitchen display and a ready board. No aggregator commission on your own channels.',
};

export default function Home() {
  return <HomePage />;
}
