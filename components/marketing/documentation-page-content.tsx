'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

const CHANNEL_IDS = [
  'customer-website',
  'kiosk',
  'pos',
  'kds',
] as const;

export type DocumentationGuideLink = {
  href: string;
  label: string;
  description: string;
};

type DocumentationPageContentProps = {
  guides: DocumentationGuideLink[];
};

export function DocumentationPageContent({
  guides,
}: DocumentationPageContentProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-4xl pb-8">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        {t('marketingExtras.documentation.title')}
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
        {t('marketingExtras.documentation.intro')}
      </p>

      <nav
        aria-label={t('marketingExtras.documentation.onThisPageAria')}
        className="mt-10 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <p className="font-medium text-zinc-900 dark:text-white">
          {t('marketingExtras.documentation.onThisPage')}
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <a
              href="#channels"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              {t('marketingExtras.documentation.navChannels')}
            </a>
          </li>
          <li>
            <a
              href="#modules"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              {t('marketingExtras.documentation.navModules')}
            </a>
          </li>
          <li>
            <a
              href="#getting-started"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              {t('marketingExtras.documentation.navGettingStarted')}
            </a>
          </li>
          {guides.length > 0 ? (
            <li>
              <a
                href="#guides"
                className="text-fire-600 hover:underline dark:text-fire-400"
              >
                {t('marketingExtras.documentation.navGuides')}
              </a>
            </li>
          ) : null}
        </ul>
      </nav>

      <section id="channels" className="mt-14 scroll-mt-24">
        <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
          {t('marketingExtras.documentation.channelsHeading')}
        </h2>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t('marketingExtras.documentation.channelsIntro')}
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {CHANNEL_IDS.map((id) => (
            <article
              key={id}
              id={id}
              className="scroll-mt-24 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <h3 className="text-lg font-semibold">
                {t(`marketingExtras.documentation.channels.${id}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`marketingExtras.documentation.channels.${id}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="getting-started" className="mt-16 scroll-mt-24">
        <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
          {t('marketingExtras.documentation.gettingStartedHeading')}
        </h2>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>{t('marketingExtras.documentation.gettingStartedSteps.1')}</li>
          <li>
            {t('marketingExtras.documentation.gettingStartedSteps.2Prefix')}{' '}
            <strong className="text-zinc-900 dark:text-white">
              {t('marketingExtras.documentation.gettingStartedSteps.settings')}
            </strong>{' '}
            {t('marketingExtras.documentation.gettingStartedSteps.2Suffix')}
          </li>
          <li>
            {t('marketingExtras.documentation.gettingStartedSteps.3Open')}{' '}
            <strong className="text-zinc-900 dark:text-white">POS</strong>{' '}
            {t('marketingExtras.documentation.gettingStartedSteps.3Or')}{' '}
            <strong className="text-zinc-900 dark:text-white">KDS</strong>{' '}
            {t('marketingExtras.documentation.gettingStartedSteps.3Suffix')}
          </li>
          <li>
            {t('marketingExtras.documentation.gettingStartedSteps.4Prefix')}{' '}
            <Link
              href="/pricing"
              className="text-fire-600 underline dark:text-fire-400"
            >
              {t('marketingExtras.documentation.gettingStartedSteps.pricingLink')}
            </Link>{' '}
            {t('marketingExtras.documentation.gettingStartedSteps.4Suffix')}
          </li>
        </ol>
      </section>

      {guides.length > 0 ? (
        <section id="guides" className="mt-16 scroll-mt-24">
          <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
            {t('marketingExtras.documentation.guidesHeading')}
          </h2>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {t('marketingExtras.documentation.guidesIntro')}
          </p>
          <ul className="mt-6 space-y-3">
            {guides.map((g) => (
              <li key={g.href}>
                <Link
                  href={g.href}
                  className="block rounded-xl border border-zinc-200/80 px-4 py-3 transition-colors hover:border-fire-500/40 dark:border-zinc-800 dark:hover:border-fire-500/40"
                >
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {g.label}
                  </span>
                  {g.description ? (
                    <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
                      {g.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-12 text-sm text-zinc-600 dark:text-zinc-400">
        {t('marketingExtras.documentation.needWalkthrough')}{' '}
        <Link
          href="/demo-request"
          className="text-fire-600 underline dark:text-fire-400"
        >
          {t('marketingExtras.demo.ctaLink')}
        </Link>
        .
      </p>
    </div>
  );
}
