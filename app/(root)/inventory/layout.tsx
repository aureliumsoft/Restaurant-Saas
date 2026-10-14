'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModulePremiumShell module="inventory">{children}</ModulePremiumShell>
  );
}
