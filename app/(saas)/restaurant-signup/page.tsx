'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export default function RestaurantSignupPage() {
  const { t } = useTranslation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-fire-500/20 blur-3xl dark:bg-fire-500/25" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-fire-300/20 blur-3xl dark:bg-fire-700/20" />
      <div className="relative mx-auto max-w-3xl rounded-3xl border border-zinc-200/80 bg-white/95 p-8 shadow-[0_30px_80px_-30px] shadow-black/20 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">
        <h1 className="text-3xl font-bold md:text-4xl">
          {t('marketingExtras.signup.title')}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {t('marketingExtras.signup.subtitle')}
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <p>{t('marketingExtras.signup.step1')}</p>
          <p>{t('marketingExtras.signup.step2')}</p>
          <p>{t('marketingExtras.signup.step3')}</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-between">
          <Button variant="outline" asChild>
            <Link href="/pricing">
              <span>{t('marketingExtras.signup.viewPricing')}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white hover:from-fire-400 hover:to-fire-500"
          >
            <Link href="/register">
              <>
                <span>{t('marketingExtras.signup.continueSignup')}</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
