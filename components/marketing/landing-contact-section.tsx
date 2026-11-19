'use client';

import Link from 'next/link';
import { ArrowRight, Clock, Mail, MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { marketingWhatsAppUrl } from '@/lib/marketing/whatsapp';

export function LandingContactSection() {
  const { t } = useTranslation();
  const whatsappHref = marketingWhatsAppUrl(
    t('marketing.contact.whatsappPrefill')
  );

  return (
    <section id="contact" className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-fire-500">
              {t('marketing.contact.eyebrow')}
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
              {t('marketing.contact.title')}
            </h2>
            <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
              {t('marketing.contact.body1')}{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {t('marketing.contact.bodyEmphasis')}
              </span>{' '}
              {t('marketing.contact.body2')}
            </p>

            <h3 className="mt-10 text-lg font-semibold text-fire-500">
              {t('marketing.contact.directHeading')}
            </h3>

            <ul className="mt-5 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-400"
                >
                  {t('marketing.contact.whatsappCta')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Phone className="h-4 w-4" />
                </span>
                <a
                  href={`tel:${t('marketing.contact.phone')}`}
                  className="hover:text-fire-500"
                >
                  {t('marketing.contact.phone')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Mail className="h-4 w-4" />
                </span>
                <a
                  href={`mailto:${t('marketing.contact.email')}`}
                  className="hover:text-fire-500"
                >
                  {t('marketing.contact.email')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Clock className="h-4 w-4" />
                </span>
                {t('marketing.contact.businessHours')}
              </li>
            </ul>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-fire-500/40 via-fire-700/10 to-transparent blur-2xl"
              aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-3xl border border-fire-200/70 bg-gradient-to-br from-white via-fire-50/50 to-zinc-50 p-6 shadow-[0_30px_80px_-20px] shadow-fire-500/20 backdrop-blur-2xl dark:border-white/10 dark:from-fire-500/25 dark:via-fire-700/15 dark:to-zinc-900/70 dark:shadow-fire-500/30 md:p-8">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fire-500/40 blur-3xl"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-black/50 blur-3xl"
                aria-hidden="true"
              />

              <h3 className="relative text-2xl font-bold text-zinc-900 dark:text-white md:text-3xl">
                {t('marketing.contact.formTitle')}
              </h3>
              <p className="relative mt-2 text-sm text-zinc-600 dark:text-white/75">
                {t('marketing.contact.formSubtitle')}
              </p>
              <Button
                asChild
                className="relative mt-8 h-12 w-full rounded-2xl bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_18px_40px_-12px] shadow-fire-500/60 transition-all hover:from-fire-400 hover:to-fire-500 hover:shadow-fire-500/80"
              >
                <Link href="/register">
                  <span>{t('marketing.hero.ctaPrimary')}</span>
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
