'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { AcceptedPaymentMethods } from '@/components/payments/accepted-payment-methods';

export default function Footer() {
  const { t } = useTranslation();

  const orderPath = [
    { label: t('marketing.footer.orderPathItems.clickAndCollect'), href: '/order-path/click-and-collect' },
    { label: t('marketing.footer.orderPathItems.curbside'), href: '/order-path/curbside-pickup' },
    { label: t('marketing.footer.orderPathItems.delivery'), href: '/order-path/customer-facing-delivery' },
    { label: t('marketing.footer.orderPathItems.tableOrders'), href: '/order-path/table-orders' },
    { label: t('marketing.footer.orderPathItems.mobileOrdering'), href: '/order-path/mobile-ordering-application' },
  ];

  const operations = [
    { label: t('marketing.footer.operationsItems.aggregator'), href: '/documentation' },
    { label: t('marketing.footer.operationsItems.reviews'), href: '/documentation' },
    { label: t('marketing.footer.operationsItems.callCenter'), href: '/documentation' },
    { label: t('marketing.nav.blog'), href: '/blog' },
  ];

  const legal = [
    { label: t('marketing.footer.legalItems.esg'), href: '/policies' },
    { label: t('marketing.footer.legalItems.legalInfo'), href: '/privacy-policy' },
    { label: t('marketing.footer.legalItems.subscriptionReturns'), href: '/refund-policy' },
    { label: t('marketing.footer.legalItems.sitemap'), href: '/sitemap' },
  ];

  return (
    <footer className="relative border-t border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-900 dark:bg-black dark:text-zinc-300">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-white">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-fire-500/15 ring-1 ring-fire-500/40">
                <Image
                  src="/Logo.png"
                  alt="Foodluk"
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 object-contain"
                />
              </span>
              <span className="text-lg font-semibold">Foodluk</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
              {t('marketing.footer.tagline')}
            </p>
          </div>

          {/* Order path */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
              {t('marketing.footer.orderPath')}
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              {orderPath.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-fire-500 dark:hover:text-fire-400">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Operational management */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
              {t('marketing.footer.operations')}
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              {operations.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-fire-500 dark:hover:text-fire-400">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
              {t('marketing.footer.legal')}
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              {legal.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-fire-500 dark:hover:text-fire-400">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <AcceptedPaymentMethods size="sm" showPayPal />
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-900 sm:flex-row sm:items-center">
          <p>{t('marketing.footer.rights', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-2 text-xs">
            <span>Launched by</span>
            <Link
              href="https://aureliumsoft.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-fire-600 underline decoration-fire-500/50 underline-offset-4 transition-colors hover:text-fire-500 dark:text-fire-400 dark:hover:text-fire-300"
            >
              Aurelium Soft
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
