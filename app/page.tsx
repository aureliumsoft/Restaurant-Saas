'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Smartphone,
  Store,
  Truck,
  LayoutGrid,
  Users,
  Package,
  TrendingUp,
  Phone,
  Mail,
  Clock,
  Play,
  Layers,
  Star,
  Send,
  Loader2,
  SendHorizonal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Footer from '@/components/main/footer';
import Header from '@/components/main/header';
import { LandingFaqSection } from '@/components/marketing/landing-faq-section';

export default function Home() {
  return (
    <div className="marketing-site-shell relative min-h-screen w-full overflow-x-hidden bg-white text-zinc-900 transition-colors dark:bg-black dark:text-white">
      <Header />

      <main className="marketing-site-main relative w-full overflow-x-hidden">
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <ContactSection />
      <LandingFaqSection />
      <NewsletterSection />
      <Footer />
      </main>
    </div>
  );
}

function HeroSection() {
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
    <section className="relative overflow-hidden">
      <div className="relative grid w-full grid-cols-1 items-center gap-10 px-6 pb-20 pt-10 sm:px-10 md:pb-28 md:pt-16 lg:grid-cols-2 lg:px-16 xl:px-24 2xl:px-32">
        {/* Left: copy */}
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

        {/* Right: hero image */}
        <div className="relative mx-auto w-full lg:ml-auto lg:mr-0 lg:max-w-none my-10 md:my-0">
          <Image
            src="/circles.png"
            alt="Foodluk on phone, tablet and laptop"
            width={900}
            height={1200}
            priority
            className="h-auto w-full object-contain absolute -top-20 left-0"
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

function FeaturesSection() {
  const { t } = useTranslation();

  const features = [
    {
      icon: <Smartphone className="h-5 w-5" strokeWidth={2} />,
      image:
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop&q=80',
      title: t('marketing.features.card1Title'),
      description: t('marketing.features.card1Body'),
    },
    {
      icon: <Store className="h-5 w-5" strokeWidth={2} />,
      image:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&auto=format&fit=crop&q=80',
      title: t('marketing.features.card2Title'),
      description: t('marketing.features.card2Body'),
    },
    {
      icon: <Truck className="h-5 w-5" strokeWidth={2} />,
      image:
        'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=900&auto=format&fit=crop&q=80',
      title: t('marketing.features.card3Title'),
      description: t('marketing.features.card3Body'),
    },
    {
      icon: <LayoutGrid className="h-5 w-5" strokeWidth={2} />,
      image:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&auto=format&fit=crop&q=80',
      title: t('marketing.features.card4Title'),
      description: t('marketing.features.card4Body'),
    },
  ];

  return (
    <section className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto max-w-7xl px-6">
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

          {/* Decorative divider: fire line + diamond + fire line */}
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

      {/* Real product image */}
      <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Subtle bottom fade for legibility */}
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

function StatsSection() {
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
      <div className="mx-auto max-w-7xl px-6">
        {/* Gradient fire-glow border wrapper */}
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

function ContactSection() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<
    { kind: 'success'; text: string } | { kind: 'error'; text: string } | null
  >(null);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          email,
          company,
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const text =
          typeof data?.error === 'string'
            ? data.error
            : 'Something went wrong. Please try again.';
        toast.error(text);
        setStatus({ kind: 'error', text });
        return;
      }
      const successText = 'Thanks — your message has been sent.';
      toast.success(successText);
      setStatus({ kind: 'success', text: successText });
      setFirstName('');
      setEmail('');
      setCompany('');
      setMessage('');
    } catch {
      const text = 'Network error. Please try again.';
      toast.error(text);
      setStatus({ kind: 'error', text });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy + contact info */}
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
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Phone className="h-4 w-4" />
                </span>
                +62-8234-5674-8901
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Mail className="h-4 w-4" />
                </span>
                hello@foodluk.com
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Clock className="h-4 w-4" />
                </span>
                {t('marketing.contact.businessHours')}
              </li>
            </ul>
          </div>

          {/* Right: glass form card */}
          <div className="relative">
            {/* Outer fire-orange ambient glow */}
            <div
              className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-fire-500/40 via-fire-700/10 to-transparent blur-2xl"
              aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-3xl border border-fire-200/70 bg-gradient-to-br from-white via-fire-50/50 to-zinc-50 p-6 shadow-[0_30px_80px_-20px] shadow-fire-500/20 backdrop-blur-2xl dark:border-white/10 dark:from-fire-500/25 dark:via-fire-700/15 dark:to-zinc-900/70 dark:shadow-fire-500/30 md:p-8">
              {/* Inner top-right highlight */}
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fire-500/40 blur-3xl"
                aria-hidden="true"
              />
              {/* Subtle bottom-left fade */}
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

              <form
                className="relative mt-8 space-y-6"
                onSubmit={handleContactSubmit}
              >
                <FormField
                  id="contact-first-name"
                  label={t('marketing.contact.firstNameLabel')}
                  placeholder={t('marketing.contact.firstNamePlaceholder')}
                  value={firstName}
                  onChange={setFirstName}
                  required
                />
                <FormField
                  id="contact-email"
                  label={t('marketing.contact.emailLabel')}
                  placeholder={t('marketing.contact.emailPlaceholder')}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <FormField
                  id="contact-company"
                  label={t('marketing.contact.companyLabel')}
                  placeholder={t('marketing.contact.companyPlaceholder')}
                  value={company}
                  onChange={setCompany}
                />
                <div>
                  <label
                    htmlFor="contact-message"
                    className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-white"
                  >
                    {t('marketing.contact.messageLabel')}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      t('marketing.contact.messagePlaceholder') as string
                    }
                    className="w-full resize-none border-0 border-b border-zinc-300/80 bg-transparent px-0 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-fire-500 focus:outline-none focus:ring-0 dark:border-white/30 dark:text-white dark:placeholder:text-white/50 dark:focus:border-fire-400"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_18px_40px_-12px] shadow-fire-500/60 transition-all hover:from-fire-400 hover:to-fire-500 hover:shadow-fire-500/80 disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>{t('marketing.contact.submit')}</span>
                      <SendHorizonal className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
                {status && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={
                      status.kind === 'success'
                        ? 'rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300'
                        : 'rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300'
                    }
                  >
                    {status.text}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsletterSection() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'already' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: 'homepage',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const text =
          typeof data?.error === 'string'
            ? data.error
            : t('marketing.newsletter.error');
        setErrorMessage(text);
        setStatus('error');
        toast.error(text);
        return;
      }
      if (data.alreadySubscribed) {
        setStatus('already');
        toast.success(t('marketing.newsletter.already'));
        return;
      }
      setStatus('success');
      setEmail('');
      toast.success(t('marketing.newsletter.success'));
    } catch {
      const text = t('marketing.newsletter.error');
      setErrorMessage(text);
      setStatus('error');
      toast.error(text);
    }
  }

  return (
    <section className="relative overflow-hidden border-y border-zinc-200 bg-zinc-50 py-20 dark:border-zinc-900 dark:bg-zinc-950 md:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(237,110,64,0.12),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(237,110,64,0.18),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-fire-500">
          {t('marketing.newsletter.eyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
          {t('marketing.newsletter.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          {t('marketing.newsletter.subtitle')}
        </p>

        {status === 'success' || status === 'already' ? (
          <p className="mt-8 text-base font-medium text-fire-600 dark:text-fire-400">
            {status === 'already'
              ? t('marketing.newsletter.already')
              : t('marketing.newsletter.success')}
          </p>
        ) : (
          <form
            onSubmit={(e) => void handleSubscribe(e)}
            className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              placeholder={t('marketing.newsletter.placeholder')}
              disabled={status === 'loading'}
              className="h-12 flex-1 border-zinc-200 bg-white text-base dark:border-zinc-800 dark:bg-zinc-900"
            />
            <Button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="h-12 shrink-0 bg-fire-500 px-6 text-white hover:bg-fire-600"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('marketing.newsletter.submitting')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t('marketing.newsletter.submit')}
                </>
              )}
            </Button>
          </form>
        )}
        {status === 'error' && errorMessage ? (
          <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    </section>
  );
}

function FormField({
  id,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-white"
      >
        {label}
      </label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-11 rounded-none border-0 border-b border-zinc-300/80 bg-transparent px-0 text-sm text-zinc-900 shadow-none placeholder:text-zinc-500 focus-visible:border-fire-500 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-white/30 dark:text-white dark:placeholder:text-white/50 dark:focus-visible:border-fire-400"
      />
    </div>
  );
}

function RecommendationsSection() {
  const { t } = useTranslation();

  const items = [
    { name: 'The Garden Bistro', tone: 'from-fire-600/40 to-amber-700/30' },
    { name: 'Urban Diner', tone: 'from-rose-600/40 to-fire-700/30' },
    { name: 'Sunset Grill', tone: 'from-amber-500/40 to-fire-600/30' },
    { name: 'Bloom Cafe', tone: 'from-emerald-600/30 to-teal-700/30' },
    { name: 'Harbor Kitchen', tone: 'from-fire-500/40 to-rose-700/30' },
  ];

  return (
    <section className="relative bg-white pb-24 dark:bg-black">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t('marketing.recommendations.titleA')}{' '}
            <span className="text-fire-500">
              {t('marketing.recommendations.titleHighlight')}
            </span>{' '}
            {t('marketing.recommendations.titleB')}
          </h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            {t('marketing.recommendations.subtitle')}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <article
              key={item.name}
              className={`group relative aspect-[3/4] overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br ${item.tone} ring-1 ring-black/5 transition-transform hover:-translate-y-1 dark:border-zinc-800 dark:ring-white/5`}
            >
              <div className="absolute inset-0 bg-black/30 transition-opacity group-hover:bg-black/20 dark:bg-black/40 dark:group-hover:bg-black/30" />

              {/* Stylized restaurant interior placeholder */}
              <div className="absolute inset-0 opacity-70">
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute left-4 right-4 top-6 grid grid-cols-3 gap-2">
                  <div className="aspect-square rounded-lg bg-white/10" />
                  <div className="aspect-square rounded-lg bg-white/10" />
                  <div className="aspect-square rounded-lg bg-white/10" />
                </div>
                <div className="absolute bottom-12 left-4 right-4 space-y-1.5">
                  <div className="h-1.5 w-2/3 rounded-full bg-white/40" />
                  <div className="h-1.5 w-1/2 rounded-full bg-white/20" />
                </div>
              </div>

              {/* Play button */}
              <button
                type="button"
                aria-label={
                  t('marketing.recommendations.playLabel', {
                    name: item.name,
                  }) as string
                }
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-fire-600 shadow-2xl transition-transform group-hover:scale-110">
                  <Play className="h-6 w-6 fill-current" />
                </span>
              </button>

              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-xs text-white">
                <span className="font-medium">{item.name}</span>
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Star className="h-3 w-3 fill-current" />
                  4.9
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
