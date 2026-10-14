'use client';

import { ModulePremiumShell } from '@/components/premium/module-premium-shell';

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModulePremiumShell module="expenses">{children}</ModulePremiumShell>;
}
