'use client';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

const STEP_KEYS = [
  { n: 1 as const, key: 'basics' as const },
  { n: 2 as const, key: 'branding' as const },
  { n: 3 as const, key: 'branches' as const },
];

export function OnboardingSteps({ active }: { active: 1 | 2 | 3 }) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 flex items-center justify-between gap-2">
      {STEP_KEYS.map((s) => (
        <div
          key={s.n}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-center text-xs font-medium',
            active === s.n
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-transparent bg-muted/50 text-muted-foreground'
          )}
        >
          <span className="text-[0.65rem] uppercase tracking-wide">
            {t('onboarding.stepLabel', { n: s.n })}
          </span>
          <span>{t(`onboarding.steps.${s.key}`)}</span>
        </div>
      ))}
    </div>
  );
}
