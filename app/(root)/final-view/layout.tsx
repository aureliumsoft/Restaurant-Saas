'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function MenuLayoutGate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModulePremiumShell module="menuLayout">{children}</ModulePremiumShell>
  );
}
