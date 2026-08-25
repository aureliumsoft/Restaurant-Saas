'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Layers,
  LayoutGrid,
  Package,
  Play,
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

export function LandingHeroSection() {
  const { t } = useTranslation();

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
      <div className="relative grid w-full grid-cols-1 items-center gap-10 px-6 pb-20 pt-10 sm:px-10 lg:px-16 xl:px-24 md:pb-28 md:pt-16 lg:grid-cols-2 2xl:px-32">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-fire-500/40 bg-fire-500/5 px-4 py-1.5 text-xs font-medium text-fire-500 dark:text-fire-400">
            <Sparkles className="h-3.5 w-3.5 text-fire-500" />
            {t('marketing.hero.badge')}
          </span>

          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            {t('marketing.hero.headline')}
            <br />
            <span className="text-fire-500">
              {t('marketing.hero.headlineHighlight')}
            </span>
          </h1>

          <p className="mt-6 max-w-md text-base text-zinc-600 dark:text-zinc-400 md:text-lg">
            {t('marketing.hero.subhead1')}{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {t('marketing.hero.subhead2')}
            </span>{' '}
            {t('marketing.hero.subhead3')}
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="h-12 rounded-lg bg-gradient-to-br from-fire-400 via-fire-500 to-fire-600 pl-2 pr-7 text-base font-semibold text-white shadow-[0_14px_40px_-10px] shadow-fire-500/60 transition-all hover:from-fire-500 hover:to-fire-700 hover:shadow-fire-500/80"
            >
              <Link href="/register" className="inline-flex items-center gap-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-fire-500">
                  <Play className="h-4 w-4 fill-current" />
                </span>
                {t('marketing.hero.ctaPrimary')}
              </Link>
            </Button>

            <Button
              asChild
              className="h-12 rounded-lg border border-zinc-200 bg-white px-7 text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
            >
              <Link
                href="/demo-request"
                className="inline-flex items-center gap-3"
              >
                {t('marketing.hero.ctaSecondary')}
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-800">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
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

        <div className="relative mx-auto my-10 w-full md:my-0 lg:ml-auto lg:mr-0 lg:max-w-none">
          <Image
            src="/circles.png"
            alt="Foodluk on phone, tablet and laptop"
            width={900}
            height={1200}
            priority
            className="absolute left-0 top-[-5rem] h-auto w-full object-contain"
          />
          <Image
            src="/FoodLuk.png"
            alt="Foodluk on phone, tablet and laptop"
            width={1280}
            height={1100}
            priority
            className="h-auto w-full object-contain drop-shadow-[10px_-30px_100px_rgba(290,90,32,0.9)]"
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
