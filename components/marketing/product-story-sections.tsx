'use client';

import { useState } from 'react';
import {
  Banknote,
  Printer,
  QrCode,
  Radio,
  Shield,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import {
  HOME_STORY,
  storyLangFromI18n,
  type HomeStoryCopy,
  type StoryLang,
} from '@/lib/marketing/home-story';

const PATHS = {
  en: {
    tabs: [
      { id: 'web', label: 'Website' },
      { id: 'kiosk', label: 'Kiosk' },
      { id: 'app', label: 'App' },
    ],
    web: ['Browse', 'Customize', 'Pay', 'Track'],
    kiosk: ['Dine in', 'Add extras', 'Pay', 'Ticket'],
    app: ['Menu', 'Cart', 'Pay', 'Orders'],
  },
  es: {
    tabs: [
      { id: 'web', label: 'Web' },
      { id: 'kiosk', label: 'Kiosco' },
      { id: 'app', label: 'App' },
    ],
    web: ['Ver menú', 'Extras', 'Pagar', 'Seguir'],
    kiosk: ['Comer aquí', 'Extras', 'Pagar', 'Ticket'],
    app: ['Menú', 'Carrito', 'Pagar', 'Pedidos'],
  },
} as const;

const FLOOR_ICONS = [WifiOff, Printer, Banknote, QrCode, Radio, Shield];

const GUEST_STATIONS = new Set(['WEB', 'APP', 'KSK']);

type StationCode = 'WEB' | 'APP' | 'KSK' | 'POS' | 'KDS' | 'DSP';

function useLang() {
  const { i18n } = useTranslation();
  return storyLangFromI18n(i18n.language);
}

export function ProductStoryFontScope({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export function ProductStorySections() {
  const lang = useLang();
  const copy = HOME_STORY[lang];

  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-white">
      <SellSection copy={copy.sell} />
      <StationsSection copy={copy.stations} />
      <PathSection lang={lang} copy={copy.path} />
      <FloorSection copy={copy.floor} />
    </div>
  );
}

function SellSection({
  copy,
}: {
  copy: HomeStoryCopy['sell'];
}) {
  return (
    <section
      id="levers"
      className="scroll-mt-36 px-6 py-20 sm:px-10 md:py-28 lg:px-16 xl:px-24"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fire-500">
            {copy.eyebrow}
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            {copy.title}
            <span className="mt-1 block text-fire-500">{copy.titleAccent}</span>
          </h2>
        </div>

        <ol className="relative">
          <span
            className="absolute bottom-6 left-[1.15rem] top-6 w-px bg-zinc-200 dark:bg-zinc-800"
            aria-hidden
          />
          {copy.items.map((item) => (
            <li key={item.n} className="relative flex gap-5 py-6 pl-12 sm:pl-16">
              <span className="absolute left-0 top-6 flex h-9 w-9 items-center justify-center rounded-full border-2 border-fire-500 bg-white text-[11px] font-bold text-fire-600 dark:bg-black dark:text-fire-400">
                {item.n}
              </span>
              <div>
                <h3 className="text-2xl font-bold tracking-tight">{item.title}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StationsSection({
  copy,
}: {
  copy: HomeStoryCopy['stations'];
}) {
  const [selected, setSelected] = useState<StationCode>('WEB');
  const active = copy.items.find((item) => item.code === selected) ?? copy.items[0];
  const isGuest = GUEST_STATIONS.has(active.code);

  return (
    <section
      id="stations"
      className="relative scroll-mt-36 overflow-hidden bg-zinc-950 py-16 text-white md:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        aria-hidden
      />

      <div className="relative px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fire-400">
              {copy.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              {copy.title}{' '}
              <span className="text-fire-500">{copy.titleAccent}</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-zinc-400 md:text-base">
              {copy.hint}
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-fire-500" />
              {copy.guest}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              {copy.staff}
            </span>
          </div>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-[0_24px_80px_-32px_rgba(240,90,32,0.45)]">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.75fr)]">
            <div className="relative min-h-[280px] bg-zinc-900/80 md:min-h-[340px]">
              <span className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-fire-500/40 bg-zinc-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-fire-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fire-500" />
                {copy.live}
              </span>
              <StationSketch kind={active.code} featured />
            </div>
            <div className="flex flex-col justify-center border-t border-white/10 p-7 lg:border-l lg:border-t-0 lg:p-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-fire-400">
                {active.code}
              </p>
              <h3 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
                {active.name}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 md:text-base">
                {active.line}
              </p>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {isGuest ? copy.guest : copy.staff}
                <span className="mx-2 text-zinc-700">/</span>
                {String(copy.items.findIndex((item) => item.code === active.code) + 1).padStart(2, '0')}
                <span className="text-zinc-600"> / 06</span>
              </p>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
                {active.body}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-6">
            {copy.items.map((item) => {
              const on = item.code === active.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(item.code)}
                  className={cn(
                    'relative bg-zinc-950 px-4 py-5 text-left transition-colors',
                    on ? 'bg-zinc-900' : 'hover:bg-zinc-900/70'
                  )}
                >
                  {on ? (
                    <span className="absolute inset-x-0 top-0 h-0.5 bg-fire-500" />
                  ) : null}
                  <div className="pointer-events-none mb-4 h-24 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                    <StationSketch kind={item.code} compact />
                  </div>
                  <p
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-[0.22em]',
                      on ? 'text-fire-400' : 'text-zinc-500'
                    )}
                  >
                    {item.code}
                  </p>
                  <h3 className="mt-1.5 text-sm font-bold tracking-tight">{item.name}</h3>
                  <p className="mt-1 hidden text-xs text-zinc-500 sm:block">{item.line}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StationSketch({
  kind,
  featured = false,
  compact = false,
}: {
  kind: string;
  featured?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex items-end justify-center',
        featured
          ? 'h-full min-h-[280px] px-8 pb-0 pt-16 md:min-h-[340px] md:px-16'
          : compact
            ? 'h-full px-3 pt-3'
            : 'h-40 px-4 pt-5',
        featured ? 'bg-transparent' : 'bg-zinc-900'
      )}
    >
      {kind === 'WEB' ? (
        <div
          className={cn(
            'w-full overflow-hidden rounded-t-xl border border-b-0 border-white/15 bg-zinc-800 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]',
            featured ? 'max-w-md' : 'max-w-[180px]',
            compact ? 'h-full' : 'h-full'
          )}
        >
          <div className="flex items-center gap-1.5 border-b border-white/10 px-2.5 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-fire-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            {featured ? (
              <span className="ml-2 h-4 flex-1 rounded-sm bg-zinc-700/80 text-[8px] leading-4 text-zinc-500">
                &nbsp;&nbsp;your-restaurant.com
              </span>
            ) : null}
          </div>
          <div className={cn('grid grid-cols-3', featured ? 'gap-2 p-3' : 'gap-1 p-2')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-sm bg-zinc-700',
                  featured ? 'aspect-[4/3]' : 'aspect-square',
                  i === 0 && 'bg-fire-500/40',
                  featured && i === 0 && 'animate-pulse'
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      {kind === 'APP' ? (
        <div
          className={cn(
            'overflow-hidden rounded-t-[1.6rem] border border-b-0 border-white/15 bg-zinc-800',
            featured ? 'h-full w-36 md:w-40' : compact ? 'mx-auto h-full w-14' : 'h-full w-20'
          )}
        >
          <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-zinc-600" />
          <div className={cn('mt-2 space-y-1.5', featured ? 'px-2.5' : 'px-1.5')}>
            <div className="h-8 rounded-md bg-fire-500/40" />
            <div className="h-7 rounded-md bg-zinc-700" />
            <div className="h-7 rounded-md bg-zinc-700" />
            {featured ? (
              <>
                <div className="h-7 rounded-md bg-zinc-700/70" />
                <div className="mt-3 h-8 rounded-full bg-fire-500" />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {kind === 'KSK' ? (
        <div
          className={cn(
            'flex h-full flex-col overflow-hidden rounded-t-md border border-b-0 border-white/15 bg-zinc-800',
            featured ? 'w-40 md:w-44' : compact ? 'mx-auto w-16' : 'w-24'
          )}
        >
          <div className="grid flex-1 grid-cols-2 gap-1.5 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn('rounded-sm bg-zinc-700', i === 1 ? 'ring-1 ring-fire-500/70' : '')}
              />
            ))}
          </div>
          <div className="h-6 bg-fire-500" />
        </div>
      ) : null}
      {kind === 'POS' ? (
        <div
          className={cn(
            'flex h-full overflow-hidden rounded-t-md border border-b-0 border-white/15 bg-zinc-800',
            featured ? 'w-full max-w-md' : 'w-full max-w-[180px]'
          )}
        >
          <div className="grid flex-1 grid-cols-3 gap-1.5 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-sm bg-zinc-700" />
            ))}
          </div>
          <div className="w-14 border-l border-white/10 p-2">
            <div className="h-2 rounded bg-fire-500/90" />
            <div className="mt-2 h-1.5 rounded bg-zinc-600" />
            <div className="mt-1.5 h-1.5 rounded bg-zinc-600" />
            {featured ? (
              <>
                <div className="mt-1.5 h-1.5 rounded bg-zinc-600" />
                <div className="mt-4 h-8 rounded-sm bg-fire-500" />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {kind === 'KDS' ? (
        <div
          className={cn(
            'flex h-full gap-1.5 overflow-hidden rounded-t-md border border-b-0 border-white/15 bg-black p-2',
            featured ? 'w-full max-w-md' : 'w-full max-w-[180px]'
          )}
        >
          {(featured ? ['IN', 'COOK', 'OUT'] : ['IN', 'OUT']).map((col, index) => (
            <div key={col} className="flex-1 rounded-sm bg-zinc-800 p-1.5">
              <p className="text-[7px] font-semibold tracking-widest text-fire-400">{col}</p>
              <div
                className={cn(
                  'mt-1.5 rounded-sm bg-zinc-700',
                  featured ? 'h-12' : 'h-8',
                  index === 1 ? 'animate-pulse bg-fire-500/30' : ''
                )}
              />
              <div className={cn('mt-1.5 rounded-sm bg-zinc-700/50', featured ? 'h-8' : 'h-6')} />
            </div>
          ))}
        </div>
      ) : null}
      {kind === 'DSP' ? (
        <div
          className={cn(
            'flex h-full items-center justify-center overflow-hidden rounded-t-md border border-b-0 border-white/15 bg-black',
            featured ? 'w-full max-w-md gap-10' : 'w-full max-w-[180px] gap-4'
          )}
        >
          <span
            className={cn(
              'font-black tabular-nums text-zinc-600',
              featured ? 'text-5xl md:text-6xl' : 'text-2xl'
            )}
          >
            047
          </span>
          <span
            className={cn(
              'animate-pulse font-black tabular-nums text-fire-500',
              featured ? 'text-5xl md:text-6xl' : 'text-2xl'
            )}
          >
            048
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PathSection({
  lang,
  copy,
}: {
  lang: StoryLang;
  copy: HomeStoryCopy['path'];
}) {
  const [tab, setTab] = useState<'web' | 'kiosk' | 'app'>('web');
  const paths = PATHS[lang];
  const steps = paths[tab];

  return (
    <section
      id="journeys"
      className="scroll-mt-36 bg-[#f6f1e8] px-6 py-20 dark:bg-[#161410] sm:px-10 md:py-28 lg:px-16 xl:px-24"
    >
      <div className="mx-auto max-w-xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-fire-600 dark:text-fire-400">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-center text-4xl font-extrabold tracking-tight md:text-5xl">
          {copy.title}{' '}
          <span className="italic font-medium text-fire-500">{copy.titleAccent}</span>
        </h2>

        <div className="relative mx-auto mt-12 overflow-hidden border border-zinc-900/10 bg-[#fbf7f0] shadow-[8px_12px_0_0_rgba(240,90,32,0.2)] dark:border-white/10 dark:bg-[#1c1914] dark:shadow-[8px_12px_0_0_rgba(240,90,32,0.25)]">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-[radial-gradient(circle_at_0_12px,transparent_5px,rgba(0,0,0,0.08)_6px)] bg-[length:12px_24px] dark:bg-[radial-gradient(circle_at_0_12px,transparent_5px,rgba(255,255,255,0.08)_6px)]"
            aria-hidden
          />

          <div className="flex border-b border-dashed border-zinc-900/15 dark:border-white/15">
            {paths.tabs.map((item) => {
              const id = item.id as 'web' | 'kiosk' | 'app';
              const active = tab === id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-colors',
                    active
                      ? 'bg-fire-500 text-white'
                      : 'text-zinc-500 hover:bg-zinc-900/5 dark:hover:bg-white/5'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <ol className="px-8 py-2">
            {steps.map((step, index) => (
              <li
                key={`${tab}-${step}`}
                className="flex items-baseline justify-between gap-4 border-b border-dotted border-zinc-900/15 py-5 last:border-0 dark:border-white/15"
              >
                <span className="text-[11px] font-bold tabular-nums text-fire-600 dark:text-fire-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-xl font-bold tracking-tight">{step}</span>
                <span className="text-sm text-zinc-400">×1</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function FloorSection({
  copy,
}: {
  copy: HomeStoryCopy['floor'];
}) {
  return (
    <section id="ops" className="scroll-mt-36 bg-fire-500 py-16 text-white md:py-20">
      <div className="px-6 sm:px-10 lg:px-16 xl:px-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 max-w-xl text-4xl font-extrabold tracking-tight md:text-5xl">
          {copy.title} {copy.titleAccent}
        </h2>

        <ul className="mt-12 divide-y divide-white/20 border-y border-white/20">
          {copy.items.map((item, index) => {
            const Icon = FLOOR_ICONS[index];
            return (
              <li
                key={item.name}
                className="flex items-center gap-5 py-5 sm:gap-8"
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                <span className="min-w-[7rem] text-lg font-bold sm:min-w-[9rem]">
                  {item.name}
                </span>
                <span className="text-sm text-white/75">{item.line}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
