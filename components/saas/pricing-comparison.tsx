'use client';

import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  PRICING_MODULE_ROWS,
  getModuleAccess,
  isCustomSelectableModule,
  type ModuleAccess,
  type PricingModuleRow,
} from '@/lib/pricing-comparison';
import { cn } from '@/lib/utils';

function useModuleLabel(rowId: string, fallback: string) {
  const { t } = useTranslation();
  const key = `marketingExtras.pricing.modules.${rowId}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

type PlanColumn = {
  plan: string;
  name: string;
};

/**
 * Legend display:
 * ✓ = free (full)
 * ✓ + (L) = free limited
 * ✕ = paid
 * checkbox = selection (Custom)
 */
export function AccessMark({
  access,
  checked,
  interactive,
  onCheckedChange,
  showScaleStar,
  showCustomDagger,
  className,
}: {
  access: ModuleAccess;
  checked?: boolean;
  interactive?: boolean;
  onCheckedChange?: (next: boolean) => void;
  showScaleStar?: boolean;
  showCustomDagger?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  if (access === 'selection') {
    return (
      <label
        className={cn(
          'inline-flex items-center justify-center',
          interactive ? 'cursor-pointer' : 'pointer-events-none',
          className
        )}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-zinc-400 text-fire-600 focus:ring-fire-500/40 dark:border-zinc-500"
          checked={Boolean(checked)}
          disabled={!interactive}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          aria-label={t('marketingExtras.pricing.access.selection')}
        />
      </label>
    );
  }

  if (access === 'paid') {
    return (
      <span
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400',
          className
        )}
      >
        <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{t('marketingExtras.pricing.access.paid')}</span>
      </span>
    );
  }

  if (access === 'limited' || access === 'limited_single') {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </span>
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          {access === 'limited_single'
            ? t('marketingExtras.pricing.access.limitedSingleTag')
            : t('marketingExtras.pricing.access.limitedTag')}
          {showCustomDagger ? '†' : ''}
        </span>
        <span className="sr-only">
          {t('marketingExtras.pricing.access.limited')}
        </span>
      </span>
    );
  }

  // full
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">
          {t('marketingExtras.pricing.access.full')}
        </span>
      </span>
      {showScaleStar ? (
        <span
          className="text-xs font-semibold text-fire-600 dark:text-fire-400"
          title={t('marketingExtras.pricing.footnotes.scaleDashboard')}
        >
          *
        </span>
      ) : null}
    </span>
  );
}

/** Side-by-side module matrix (docs/pricing-plans.md §3). */
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
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/40">
              <th className="sticky left-0 z-10 bg-zinc-50/95 px-5 py-3 text-left font-semibold text-zinc-700 dark:bg-zinc-950/95 dark:text-zinc-200">
                {t('marketingExtras.pricing.moduleColumn')}
              </th>
              {plans.map((p) => (
                <th
                  key={p.plan}
                  className="px-3 py-3 text-center font-semibold text-zinc-900 dark:text-white"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICING_MODULE_ROWS.map((row, index) => (
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

      <div className="space-y-2 border-t border-zinc-200/80 px-5 py-4 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <LegendItem
            icon={
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            }
            label={t('marketingExtras.pricing.access.fullMeaning')}
          />
          <LegendItem
            icon={
              <span className="inline-flex items-center gap-0.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-800">
                  L
                </span>
              </span>
            }
            label={t('marketingExtras.pricing.access.limitedMeaning')}
          />
          <LegendItem
            icon={
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-red-600">
                <X className="h-3 w-3" strokeWidth={2.5} />
              </span>
            }
            label={t('marketingExtras.pricing.access.paidMeaning')}
          />
          <LegendItem
            icon={
              <input
                type="checkbox"
                disabled
                className="h-3.5 w-3.5 rounded border-zinc-400"
                aria-hidden
              />
            }
            label={t('marketingExtras.pricing.access.selectionMeaning')}
          />
        </div>
        <p>* {t('marketingExtras.pricing.footnotes.scaleDashboard')}</p>
        <p>† {t('marketingExtras.pricing.footnotes.customBasicLimits')}</p>
      </div>
    </section>
  );
}

function LegendItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function ComparisonRow({
  row,
  index,
  plans,
}: {
  row: PricingModuleRow;
  index: number;
  plans: PlanColumn[];
}) {
  const label = useModuleLabel(row.id, row.label);
  return (
    <tr
      className={cn(
        'border-b border-zinc-100 dark:border-zinc-800',
        index % 2 === 1 && 'bg-zinc-50/50 dark:bg-zinc-950/20'
      )}
    >
      <td className="sticky left-0 z-10 bg-inherit px-5 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </td>
      {plans.map((p) => {
        const access = getModuleAccess(p.plan, row) ?? 'paid';
        const planKey = p.plan.toUpperCase();
        return (
          <td key={p.plan} className="px-2 py-2.5 text-center">
            <div className="flex justify-center">
              <AccessMark
                access={access}
                checked={false}
                interactive={false}
                showScaleStar={
                  row.note === 'scale_dashboard' &&
                  planKey === 'SCALE' &&
                  access === 'full'
                }
                showCustomDagger={
                  row.note === 'custom_basic_limits' &&
                  planKey === 'CUSTOM' &&
                  access === 'limited'
                }
              />
            </div>
          </td>
        );
      })}
    </tr>
  );
}

type FeatureListProps = {
  plan: string;
  /** Custom plan: selected selectable module ids */
  selectedModules?: Set<string>;
  /** When true, hide unpaid selection modules that are not selected */
  filterToSelected?: boolean;
  onToggleModule?: (moduleId: string, next: boolean) => void;
};

/**
 * Full module list for a plan card.
 * Custom plan uses interactive checkboxes for Selection modules.
 */
export function PricingPlanFeatureList({
  plan,
  selectedModules,
  filterToSelected = false,
  onToggleModule,
}: FeatureListProps) {
  const isCustom = plan.toUpperCase() === 'CUSTOM';
  const selected = selectedModules ?? new Set<string>();

  const rows = PRICING_MODULE_ROWS.filter((row) => {
    if (!isCustom || !filterToSelected) return true;
    const access = row.byPlan.CUSTOM;
    if (access === 'full') return true;
    if (access === 'limited') return true; // always show limited base (or unlocked)
    if (access === 'selection') return selected.has(row.id);
    return false;
  });

  return (
    <ul className="mt-3 flex-1 space-y-2 text-sm">
      {rows.map((row) => (
        <FeatureListItem
          key={row.id}
          plan={plan}
          row={row}
          selected={selected.has(row.id)}
          interactive={isCustom && isCustomSelectableModule(row)}
          onToggle={
            onToggleModule
              ? (next) => onToggleModule(row.id, next)
              : undefined
          }
        />
      ))}
    </ul>
  );
}

function FeatureListItem({
  plan,
  row,
  selected,
  interactive,
  onToggle,
}: {
  plan: string;
  row: PricingModuleRow;
  selected: boolean;
  interactive: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const label = useModuleLabel(row.id, row.label);
  const access = getModuleAccess(plan, row) ?? 'paid';
  const isCustom = plan.toUpperCase() === 'CUSTOM';

  // Custom limited: unchecked = ✓(L), checked = ✓ (unlocked)
  let displayAccess: ModuleAccess = access;
  if (isCustom && access === 'limited' && interactive) {
    displayAccess = selected ? 'full' : 'limited';
  }
  // Custom selection: show checkbox (interactive)
  if (isCustom && access === 'selection') {
    displayAccess = 'selection';
  }

  return (
    <li className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
      <span className="shrink-0">
        {interactive && access === 'limited' ? (
          <label className="inline-flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-400 text-fire-600 focus:ring-fire-500/40"
              checked={selected}
              onChange={(e) => onToggle?.(e.target.checked)}
              aria-label={label}
            />
            {!selected ? (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                L
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}
          </label>
        ) : (
          <AccessMark
            access={displayAccess}
            checked={selected}
            interactive={interactive && access === 'selection'}
            onCheckedChange={onToggle}
          />
        )}
      </span>
      <span
        className={cn(
          access === 'paid' && !isCustom && 'text-zinc-400 dark:text-zinc-500'
        )}
      >
        {label}
      </span>
    </li>
  );
}
