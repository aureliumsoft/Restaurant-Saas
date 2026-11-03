'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

const ITEM_KEYS = ['i1', 'i2', 'i3'] as const;

export function LandingProofSection() {
  const { t } = useTranslation();

  return (
    <section className="relative bg-zinc-50 py-20 dark:bg-zinc-950 md:py-24">
      <div className="mx-auto w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-fire-500">
            {t('marketing.proof.eyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
            {t('marketing.proof.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
            {t('marketing.proof.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
          {ITEM_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <CheckCircle2 className="h-6 w-6 text-fire-500" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
                {t(`marketing.proof.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`marketing.proof.items.${key}.body`)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            asChild
            className="h-12 rounded-lg bg-gradient-to-br from-fire-400 via-fire-500 to-fire-600 px-8 text-base font-semibold text-white shadow-[0_14px_40px_-10px] shadow-fire-500/60"
          >
            <Link href="/demo-request">{t('marketing.proof.cta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
