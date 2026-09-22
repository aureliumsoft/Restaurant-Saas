'use client';

import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  PRICING_COMPARISON_ROWS,
  planIncludesComparisonFeature,
} from '@/lib/pricing-comparison';
import { cn } from '@/lib/utils';

function useComparisonLabel(rowId: string, fallback: string) {
  const { t } = useTranslation();
  const key = `marketingExtras.pricing.comparison.${rowId}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

type PlanColumn = {
  plan: string;
  name: string;
};

function FeatureIcon({ included }: { included: boolean }) {
  const { t } = useTranslation();
  return included ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">
        {t('marketingExtras.pricing.includedSr')}
      </span>
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
      <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">
        {t('marketingExtras.pricing.notIncludedSr')}
      </span>
    </span>
  );
}

/** Side-by-side comparison table for all plans. */
export function PricingComparisonTable({ plans }: { plans: PlanColumn[] }) {
  const { t } = useTranslation();
  if (plans.length === 0) return null;

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {t('marketingExtras.pricing.compareTitle')}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t('marketingExtras.pricing.compareSubtitle')}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/40">
              <th className="px-5 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-200">
                {t('marketingExtras.pricing.featureColumn')}
              </th>
              {plans.map((p) => (
                <th
                  key={p.plan}
                  className="px-4 py-3 text-center font-semibold text-zinc-900 dark:text-white"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICING_COMPARISON_ROWS.map((row, index) => (
              <ComparisonRow
                key={row.id}
                row={row}
                index={index}
                plans={plans}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonRow({
  row,
  index,
  plans,
}: {
  row: (typeof PRICING_COMPARISON_ROWS)[number];
  index: number;
  plans: PlanColumn[];
}) {
  const label = useComparisonLabel(row.id, row.label);
  return (
    <tr
      className={cn(
        'border-b border-zinc-100 dark:border-zinc-800',
        index % 2 === 1 && 'bg-zinc-50/50 dark:bg-zinc-950/20'
      )}
    >
      <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </td>
      {plans.map((p) => {
        const included = planIncludesComparisonFeature(p.plan, row);
        return (
          <td key={p.plan} className="px-4 py-3 text-center">
            <div className="flex justify-center">
              <FeatureIcon included={included} />
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function FeatureListItem({
  plan,
  row,
}: {
  plan: string;
  row: (typeof PRICING_COMPARISON_ROWS)[number];
}) {
  const included = planIncludesComparisonFeature(plan, row);
  const label = useComparisonLabel(row.id, row.label);
  return (
    <li
      className={cn(
        'flex items-start gap-2.5',
        included
          ? 'text-zinc-700 dark:text-zinc-300'
          : 'text-zinc-500 dark:text-zinc-500'
      )}
    >
      <span className="mt-0.5 shrink-0">
        <FeatureIcon included={included} />
      </span>
      <span>{label}</span>
    </li>
  );
}

/** Feature list for a single plan card — tick for included, cross for not. */
export function PricingPlanFeatureList({ plan }: { plan: string }) {
  return (
    <ul className="mt-3 flex-1 space-y-2 text-sm">
      {PRICING_COMPARISON_ROWS.map((row) => (
        <FeatureListItem key={row.id} plan={plan} row={row} />
      ))}
    </ul>
  );
}
