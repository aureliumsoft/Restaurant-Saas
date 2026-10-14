'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function RecommendationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModulePremiumShell module="configuration">{children}</ModulePremiumShell>
  );
}
