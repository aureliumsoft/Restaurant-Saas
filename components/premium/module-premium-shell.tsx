'use client';

import type { ReactNode } from 'react';

import { PremiumGate } from '@/components/premium/premium-gate';
import { useEntitlements } from '@/hooks/use-entitlements';
import type { ModuleKey } from '@/lib/entitlements';

type Props = {
  module: ModuleKey;
  children: ReactNode;
  className?: string;
};

/** Soft-locks Paid modules: page still opens, content blurred + Upgrade. */
export function ModulePremiumShell({ module, children, className }: Props) {
  const { isPaid, loading } = useEntitlements();
  if (loading) return <>{children}</>;
  return (
    <PremiumGate locked={isPaid(module)} className={className}>
      {children}
    </PremiumGate>
  );
}
