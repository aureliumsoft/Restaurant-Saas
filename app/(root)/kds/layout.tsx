'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function KdsLayout({ children }: { children: React.ReactNode }) {
  return <ModulePremiumShell module="kds">{children}</ModulePremiumShell>;
}
