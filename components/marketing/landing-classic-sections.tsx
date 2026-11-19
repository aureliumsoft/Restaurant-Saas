'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Layers,
  LayoutGrid,
  Package,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { marketingWhatsAppUrl } from '@/lib/marketing/whatsapp';

export function LandingHeroSection() {
  const { t } = useTranslation();
  const whatsappHref = marketingWhatsAppUrl(
    t('marketing.hero.whatsappPrefill')
  );

  const features = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t('marketing.hero.chip1'),
    },
    { icon: <Clock className="h-5 w-5" />, label: t('marketing.hero.chip2') },
    { icon: <Star className="h-5 w-5" />, label: t('marketing.hero.chip3') },
    { icon: <Layers className="h-5 w-5" />, label: t('marketing.hero.chip4') },
  ];

  return (
    <section className="relative overflow-hidden bg-white dark:bg-black">
      <div className="relative grid w-full grid-cols-1 items-center gap-8 px-6 pb-16 pt-10 sm:px-10 md:pb-24 md:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-6 lg:px-16 xl:px-24">
        <div className="relative z-10 min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-fire-500/40 bg-fire-500/5 px-4 py-1.5 text-xs font-medium text-fire-500 dark:text-fire-400">
            <Sparkles className="h-3.5 w-3.5 text-fire-500" />
            {t('marketing.hero.badge')}
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            {t('marketing.hero.headline')}
            <br />
            <span className="block whitespace-nowrap text-[clamp(1.7rem,3.2vw,3.25rem)] text-fire-500">
              {t('marketing.hero.headlineHighlight')}
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-base text-zinc-600 dark:text-zinc-400 md:text-lg">
            {t('marketing.hero.subhead1')}{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {t('marketing.hero.subhead2')}
            </span>{' '}
            {t('marketing.hero.subhead3')}
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              className="h-12 rounded-lg bg-gradient-to-br from-fire-400 via-fire-500 to-fire-600 pl-2 pr-7 text-base font-semibold text-white shadow-[0_14px_40px_-10px] shadow-fire-500/60 transition-all hover:from-fire-500 hover:to-fire-700 hover:shadow-fire-500/80"
            >
              <Link
                href="/register"
                className="inline-flex items-center gap-3"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-fire-500">
                  <ArrowRight className="h-4 w-4" />
                </span>
                {t('marketing.hero.ctaPrimary')}
              </Link>
            </Button>

            <Button
              asChild
              className="h-12 rounded-lg border border-zinc-200 bg-white px-7 text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            >
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3"
              >
                {t('marketing.hero.ctaSecondary')}
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current">
                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.64-.24-.37a9.86 9.86 0 0 1-1.51-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.98c0 5.45-4.44 9.9-9.9 9.9Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
                  </svg>
                </span>
              </a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
            {t('marketing.hero.fineprint')}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-x-2">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex flex-col items-start gap-2"
              >
                <span className="text-fire-500">{feature.icon}</span>
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-0 mx-auto w-full min-w-0 lg:max-w-none">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[28%] -z-10"
          >
            <div className="absolute -bottom-6 left-1/2 h-[78%] w-[96%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(240,90,32,0.95),rgba(255,122,61,0.55)_38%,transparent_70%)] blur-3xl" />
            <div className="absolute bottom-0 left-[4%] h-[52%] w-[48%] rounded-full bg-[radial-gradient(circle,rgba(255,163,118,0.85),transparent_68%)] blur-2xl" />
            <div className="absolute bottom-0 right-[2%] h-[56%] w-[46%] rounded-full bg-[radial-gradient(circle,rgba(225,68,17,0.8),transparent_66%)] blur-2xl" />
          </div>
          <Image
            src="/circles.png"
            alt=""
            width={900}
            height={1200}
            priority
            className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 object-contain"
          />
          <Image
            src="/FoodLuk.png"
            alt="Foodluk on phone, tablet and laptop"
            width={1280}
            height={1100}
            priority
            className="relative h-auto w-full object-contain [filter:drop-shadow(0_36px_48px_rgba(240,90,32,0.45))]"
          />
        </div>
      </div>
    </section>
  );
}

export function LandingFeaturesSection() {
  const { t } = useTranslation();

  const features = [
    {
      icon: <Smartphone className="h-5 w-5" strokeWidth={2} />,
      image: '/marketing/feature-branded-app.png',
      title: t('marketing.features.card1Title'),
      description: t('marketing.features.card1Body'),
    },
    {
      icon: <Store className="h-5 w-5" strokeWidth={2} />,
      image: '/marketing/feature-branches.png',
      title: t('marketing.features.card2Title'),
      description: t('marketing.features.card2Body'),
    },
    {
      icon: <Truck className="h-5 w-5" strokeWidth={2} />,
      image: '/marketing/feature-channels.png',
      title: t('marketing.features.card3Title'),
      description: t('marketing.features.card3Body'),
    },
    {
      icon: <LayoutGrid className="h-5 w-5" strokeWidth={2} />,
      image: '/marketing/feature-smart-menu.png',
      title: t('marketing.features.card4Title'),
      description: t('marketing.features.card4Body'),
    },
  ];

  return (
    <section className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t('marketing.features.titleA')}{' '}
            <span className="text-fire-500">
              {t('marketing.features.titleHighlight1')}
            </span>{' '}
            {t('marketing.features.titleAnd')}{' '}
            <span className="text-fire-500">
              {t('marketing.features.titleHighlight2')}
            </span>{' '}
            {t('marketing.features.titleB')}
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {t('marketing.features.subtitle')}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <span
              className="h-px w-16 bg-gradient-to-r from-transparent to-fire-500"
              aria-hidden="true"
            />
            <span
              className="block h-2 w-2 rotate-45 border border-fire-500"
              aria-hidden="true"
            />
            <span
              className="h-px w-16 bg-gradient-to-l from-transparent to-fire-500"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, idx) => (
            <FeatureCard
              key={feature.title}
              index={idx + 1}
              icon={feature.icon}
              image={feature.image}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  index,
  icon,
  image,
  title,
  description,
}: {
  index: number;
  icon: React.ReactNode;
  image: string;
  title: string;
  description: string;
}) {
  const { t } = useTranslation();
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-fire-500/40 hover:shadow-[0_30px_60px_-25px] hover:shadow-fire-500/40 dark:border-zinc-800/80 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-fire-500 text-white shadow-[0_10px_25px_-8px] shadow-fire-500/60 ring-1 ring-fire-400/50">
          {icon}
        </span>
        <span className="text-base font-bold tracking-wide text-zinc-300 dark:text-zinc-600">
          {String(index).padStart(2, '0')}
        </span>
      </div>

      <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-6 text-xl font-bold text-zinc-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {description}
      </p>

      <Link
        href="/register"
        className="mt-6 inline-flex items-center justify-between gap-2 rounded-full border border-fire-500/60 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-fire-500 hover:bg-fire-500/5 dark:text-white"
      >
        <span>{t('marketing.features.findOutMore')}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-fire-500 text-white transition-transform group-hover:translate-x-1">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </article>
  );
}

export function LandingStatsSection() {
  const { t } = useTranslation();

  const stats = [
    {
      icon: <Users className="h-8 w-8" strokeWidth={1.75} />,
      value: '100',
      suffix: '+',
      label: t('marketing.stats.stat1'),
    },
    {
      icon: <Store className="h-8 w-8" strokeWidth={1.75} />,
      value: '25',
      suffix: '+',
      label: t('marketing.stats.stat2'),
    },
    {
      icon: <Package className="h-8 w-8" strokeWidth={1.75} />,
      value: '5K',
      suffix: '+',
      label: t('marketing.stats.stat3'),
    },
    {
      icon: <TrendingUp className="h-8 w-8" strokeWidth={1.75} />,
      value: '30%',
      suffix: '+',
      label: t('marketing.stats.stat4'),
    },
  ];

  return (
    <section className="relative bg-white pb-20 dark:bg-black">
      <div className="mx-auto w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="relative rounded-3xl bg-gradient-to-br from-fire-500/60 via-zinc-300 to-fire-500/60 p-px shadow-[0_30px_80px_-30px] shadow-fire-500/30 dark:via-zinc-800 dark:shadow-fire-500/20">
          <div className="rounded-[calc(1.5rem-1px)] bg-white dark:bg-black">
            <div className="grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800/80 sm:grid-cols-2 sm:divide-y-0 md:grid-cols-4 md:divide-x">
              {stats.map((stat, idx) => (
                <div
                  key={stat.label}
                  className={`flex items-center gap-5 px-6 py-7 md:px-8 ${
                    idx > 0
                      ? 'sm:border-l sm:border-zinc-200 sm:dark:border-zinc-800/80 md:border-l-0'
                      : ''
                  }`}
                >
                  <span className="shrink-0 text-fire-500" aria-hidden="true">
                    {stat.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-3xl font-extrabold leading-none tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                      {stat.value}
                      <span className="text-fire-500">{stat.suffix}</span>
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
