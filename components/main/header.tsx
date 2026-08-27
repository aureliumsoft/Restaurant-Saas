'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import LandingAuthActions from '@/components/marketing/LandingAuthActions';
import { cn } from '@/lib/utils';

import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';

function isNavLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const authLoggedOutClass =
    'rounded-lg bg-gradient-to-br from-fire-400 via-fire-500 to-fire-600 text-sm font-semibold text-white shadow-[0_10px_28px_-8px] shadow-fire-500/60 transition-all hover:from-fire-500 hover:to-fire-700 hover:shadow-fire-500/80';

  const navLinks = [
    { href: '/#stations', label: t('marketing.nav.platform') },
    { href: '/demo-request', label: t('marketing.nav.demoRequest') },
    { href: '/restaurant-signup', label: t('marketing.nav.restaurantSignup') },
    { href: '/pricing', label: t('marketing.nav.pricing') },
    { href: '/blog', label: t('marketing.nav.blog') },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full px-3 py-3 backdrop-blur-xl bg-transparent sm:px-4">
        <div className="relative mx-auto flex h-16 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/85 px-3 shadow-[0_10px_40px_-10px] shadow-black/10 backdrop-blur-md dark:border-zinc-800/80 dark:bg-black/80 dark:shadow-black/60 sm:px-4">
          {/* Logo tile */}
          <Link
            href="/"
            aria-label="FoodLuk home"
            className="flex h-12 shrink-0 items-center justify-center"
          >
            <Image
              src="/Logo.png"
              alt="Foodluk"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="ml-2 text-base font-semibold text-zinc-900 dark:text-white sm:text-lg">
              FoodLuk
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-zinc-700 dark:text-white md:flex">
            {navLinks.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'transition-colors hover:text-fire-500 dark:hover:text-fire-400',
                    active && 'font-semibold text-fire-500 dark:text-fire-400'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher variant="inline" />
            <ThemeToggle />
            <LandingAuthActions
              loggedOutLabel={t('marketing.nav.getStarted')}
              loggedOutClassName={`h-10 shrink-0 px-6 ${authLoggedOutClass}`}
              loggedInTriggerClassName="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              loadingClassName="h-10 shrink-0"
            />
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher variant="inline" />
            <ThemeToggle />

            <details className="group">
              <summary
                aria-label={t('marketing.nav.openMenu') as string}
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 transition-colors hover:border-fire-500 hover:text-fire-500 dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-white dark:hover:border-fire-400 dark:hover:text-fire-400 [&::-webkit-details-marker]:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </summary>

              <div className="absolute left-3 right-3 top-[calc(100%+0.75rem)] overflow-visible rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-[0_18px_50px_-20px] shadow-black/30 backdrop-blur-md dark:border-zinc-800 dark:bg-black/95 dark:shadow-black">
                <nav className="flex flex-col gap-1 text-sm font-medium text-zinc-800 dark:text-white">
                  {navLinks.map((link) => {
                    const active = isNavLinkActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'rounded-lg px-3 py-3 transition-colors hover:bg-zinc-100 hover:text-fire-500 dark:hover:bg-zinc-900 dark:hover:text-fire-400',
                          active &&
                            'bg-fire-50 font-semibold text-fire-500 dark:bg-fire-950/40 dark:text-fire-400'
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                <LandingAuthActions
                  loggedOutLabel={t('marketing.nav.getStarted')}
                  loggedOutClassName={`mt-3 h-11 w-full ${authLoggedOutClass}`}
                  loggedInTriggerClassName="mt-3 h-11 w-full justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  loadingClassName="mt-3 h-11 w-full"
                  menuClassName="bottom-full left-1/2 mb-2 top-auto right-auto w-44 max-w-[min(11rem,calc(100vw-2rem))] -translate-x-1/2 shadow-lg"
                />
              </div>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}
