'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { useEntitlements } from '@/hooks/use-entitlements';
import type { CapUsageKey } from '@/lib/entitlements';
import { cn } from '@/lib/utils';

const RESOURCE_I18N: Record<CapUsageKey, string> = {
  products: 'dashboard.planCaps.resources.products',
  categories: 'dashboard.planCaps.resources.categories',
  variations: 'dashboard.planCaps.resources.variations',
  branches: 'dashboard.planCaps.resources.branches',
};

type Props = {
  /** When set, only show for this resource if over limit. */
  resource?: CapUsageKey;
  /** When true with no resource, list every over-limit resource. */
  showAll?: boolean;
  className?: string;
};

export function PlanCapOverLimitBanner({
  resource,
  showAll = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const { plan, caps, capUsage, isOverCap } = useEntitlements();

  if (!capUsage || !caps) return null;

  const planName = plan?.planId ?? 'FREE';

  const keys: CapUsageKey[] = resource
    ? isOverCap(resource)
      ? [resource]
      : []
    : showAll
      ? (Object.keys(capUsage.overLimit) as CapUsageKey[]).filter(
          (k) => capUsage.overLimit[k]
        )
      : [];

  if (keys.length === 0) return null;

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border border-dashed border-destructive bg-destructive/10 p-3 text-sm text-destructive',
        className
      )}
      role="status"
    >
      {keys.map((key) => {
        const used = capUsage.usage[key];
        const cap = caps[key];
        const capLabel = cap == null ? '∞' : String(cap);
        return (
          <p key={key}>
            {t('dashboard.planCaps.overLimit', {
              plan: planName,
              used,
              cap: capLabel,
              resource: t(RESOURCE_I18N[key]),
            })}{' '}
            {t('dashboard.planCaps.overLimitHint')}{' '}
            <Link
              href="/pricing"
              className="font-medium underline underline-offset-2"
            >
              {t('dashboard.planCaps.upgrade')}
            </Link>
          </p>
        );
      })}
    </div>
  );
}
