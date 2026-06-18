import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WebAppLayoutShell } from '@/components/customer-app/web-app-layout-shell';

import './web-app-customer.css';

export const metadata: Metadata = {
  title: {
    default: 'Order online',
    template: '%s',
  },
  description: 'Browse the menu and order from your restaurant.',
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <WebAppLayoutShell>{children}</WebAppLayoutShell>;
}
