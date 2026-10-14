'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function OrderDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModulePremiumShell module="orderDisplay">{children}</ModulePremiumShell>
  );
}
