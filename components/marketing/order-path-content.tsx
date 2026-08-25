'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { storyLangFromI18n } from '@/lib/marketing/home-story';

const PAGES = {
  'click-and-collect': {
    title: { en: 'Click and Collect', es: 'Click and Collect' },
    line: {
      en: 'Order on your site. Pick a slot. Collect without the queue.',
      es: 'Pide en tu web. Elige hora. Recoge sin cola.',
    },
    steps: {
      en: ['Browse', 'Slot', 'Pay', 'Collect'],
      es: ['Menú', 'Franja', 'Pagar', 'Recoger'],
    },
  },
  'curbside-pickup': {
    title: { en: 'Curbside pickup', es: 'Recogida en el coche' },
    line: {
      en: 'They wait in the car. The ticket tells the counter they arrived.',
      es: 'Esperan en el coche. El ticket avisa al mostrador.',
    },
    steps: {
      en: ['Order', 'Arrive', 'Ready', 'Handoff'],
      es: ['Pedir', 'Llegar', 'Listo', 'Entregar'],
    },
  },
  'customer-facing-delivery': {
    title: { en: 'Your delivery', es: 'Tu delivery' },
    line: {
      en: 'Direct orders on your website and app. You keep the ticket.',
      es: 'Pedidos directos en tu web y app. Te quedas el ticket.',
    },
    steps: {
      en: ['Address', 'Menu', 'Pay', 'Out'],
      es: ['Dirección', 'Menú', 'Pagar', 'Salida'],
    },
  },
  'table-orders': {
    title: { en: 'Table orders', es: 'Pedidos de mesa' },
    line: {
      en: 'Scan the QR. Order at the table. Kitchen gets the ticket.',
      es: 'Escanean el QR. Piden en mesa. Cocina recibe el ticket.',
    },
    steps: {
      en: ['Scan', 'Order', 'Pay', 'Serve'],
      es: ['Escanear', 'Pedir', 'Pagar', 'Servir'],
    },
  },
  'mobile-ordering-application': {
    title: { en: 'Branded app', es: 'App de marca' },
    line: {
      en: 'The same menu on their phone. They come back without the aggregator.',
      es: 'El mismo menú en su móvil. Vuelven sin el agregador.',
    },
    steps: {
      en: ['Open', 'Customize', 'Pay', 'Reorder'],
      es: ['Abrir', 'Extras', 'Pagar', 'Repetir'],
    },
  },
} as const;

export type OrderPathSlug = keyof typeof PAGES;

export function OrderPathContent({ slug }: { slug: OrderPathSlug }) {
  const { i18n } = useTranslation();
  const lang = storyLangFromI18n(i18n.language);
  const page = PAGES[slug];

  return (
    <div className="relative min-h-[70vh] bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-white sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{page.title[lang]}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          {page.line[lang]}
        </p>

        <ol className="mt-14 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {page.steps[lang].map((step, index) => (
            <li key={step} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fire-500 text-lg font-bold text-white shadow-[0_10px_25px_-8px] shadow-fire-500/60">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold">{step}</p>
              </div>
              {index < page.steps[lang].length - 1 ? (
                <span className="mb-6 hidden h-px w-10 bg-fire-500/40 sm:block" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        <Link
          href="/demo-request"
          className="mt-14 inline-flex items-center gap-2 text-sm font-semibold text-fire-600 hover:text-fire-500 dark:text-fire-400"
        >
          {lang === 'es' ? 'Solicitar demo' : 'Request a demo'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
