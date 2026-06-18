'use client';

import * as React from 'react';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { setUiLanguage } from '@/lib/i18n/client';
import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import { DEFAULT_UI_LANGUAGE, type UiLanguage } from '@/lib/i18n/resources';
import { cn } from '@/lib/utils';

const LANGUAGES: { code: UiLanguage; nativeLabel: string; short: string }[] = [
  { code: 'en', nativeLabel: 'English', short: 'EN' },
  { code: 'es', nativeLabel: 'Español', short: 'ES' },
];

type LanguageSwitcherProps = {
  /** Floating action button (marketing) vs inline dropdown vs segmented toggle (web-app). */
  variant?: 'fab' | 'inline' | 'toggle';
  /** Styles for primary-colored headers (web-app). */
  tone?: 'default' | 'onPrimary';
  className?: string;
};

export function LanguageSwitcher({
  variant = 'fab',
  tone = 'default',
  className,
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [activeLang, setActiveLang] = React.useState<UiLanguage>(DEFAULT_UI_LANGUAGE);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
    const sync = () => {
      setActiveLang(normalizeUiLanguage(i18n.resolvedLanguage ?? i18n.language));
    };
    sync();
    i18n.on('languageChanged', sync);
    return () => {
      i18n.off('languageChanged', sync);
    };
  }, [i18n]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentCode: UiLanguage = mounted ? activeLang : DEFAULT_UI_LANGUAGE;
  const current = LANGUAGES.find((l) => l.code === currentCode) ?? LANGUAGES[1];

  const apply = (lang: UiLanguage) => {
    if (lang === currentCode) return;
    setActiveLang(lang);
    setUiLanguage(lang);
    void i18n.changeLanguage(lang);
    setOpen(false);
  };

  const label = t('marketing.languageSwitcher.label');

  const isFab = variant === 'fab';
  const isToggle = variant === 'toggle';
  const onPrimary = tone === 'onPrimary';

  if (isToggle) {
    const nextLang: UiLanguage = currentCode === 'en' ? 'es' : 'en';

    return (
      <button
        type="button"
        aria-label={`${label}: ${current.nativeLabel}. Switch to ${LANGUAGES.find((l) => l.code === nextLang)?.nativeLabel ?? nextLang}.`}
        onClick={() => apply(nextLang)}
        className={cn(
          'inline-flex h-9 min-w-[3rem] items-center justify-center rounded-lg px-3 text-xs font-bold uppercase tracking-wide transition-colors',
          onPrimary
            ? 'border-0 bg-white text-[#1a1033] shadow-sm hover:bg-white/90'
            : 'border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-primary/40 hover:text-primary dark:border-zinc-700 dark:bg-zinc-950 dark:text-white',
          className
        )}
      >
        {current.short}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        isFab
          ? 'fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6'
          : 'relative flex flex-col items-end',
        className
      )}
    >
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={cn(
            'z-50 w-48 overflow-hidden rounded-xl border p-1.5 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md',
            isFab ? 'mb-0' : 'absolute right-0 top-full mt-2',
            onPrimary
              ? 'border-white/25 bg-white/95'
              : 'border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-black/95'
          )}
        >
          <p
            className={cn(
              'px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider',
              onPrimary ? 'text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            {label}
          </p>
          {LANGUAGES.map((lang) => {
            const active = lang.code === currentCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => apply(lang.code)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? onPrimary
                      ? 'bg-primary/10 text-primary'
                      : 'bg-fire-500/10 text-fire-500 dark:text-fire-400'
                    : onPrimary
                      ? 'text-zinc-800 hover:bg-zinc-100'
                      : 'text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900'
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold tracking-wider',
                      active && onPrimary
                        ? 'bg-primary/15 text-primary'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    )}
                  >
                    {lang.short}
                  </span>
                  <span className="font-medium">{lang.nativeLabel}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          'group flex items-center gap-2 rounded-full border text-sm font-semibold transition-all',
          isFab ? 'h-12 pl-2 pr-4' : 'h-10 pl-1.5 pr-3.5',
          onPrimary
            ? 'border-white/30 bg-white/15 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:border-white/50 hover:bg-white/25'
            : 'border-zinc-200 bg-white pl-2 pr-4 text-zinc-900 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.3)] hover:border-fire-500 hover:text-fire-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:border-fire-400 dark:hover:text-fire-400'
        )}
      >
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full transition-colors',
            isFab ? 'h-8 w-8' : 'h-7 w-7',
            onPrimary
              ? 'bg-white/20 text-white group-hover:bg-white/30'
              : 'bg-fire-500/15 text-fire-500 group-hover:bg-fire-500/20 dark:text-fire-400'
          )}
        >
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider">{current.short}</span>
      </button>
    </div>
  );
}
