'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { setUiLanguage } from '@/lib/i18n/client';
import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import { DEFAULT_UI_LANGUAGE, type UiLanguage } from '@/lib/i18n/resources';
import { cn } from '@/lib/utils';

const LANGUAGES: {
  code: UiLanguage;
  nativeLabel: string;
  short: string;
  flagLabel: string;
}[] = [
  {
    code: 'en',
    nativeLabel: 'English',
    short: 'EN',
    flagLabel: 'United Kingdom',
  },
  {
    code: 'es',
    nativeLabel: 'Español',
    short: 'ES',
    flagLabel: 'Spain',
  },
];

function LanguageFlag({
  code,
  flagLabel,
  className,
}: {
  code: UiLanguage;
  flagLabel: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)]',
        className
      )}
      role="img"
      aria-label={flagLabel}
    >
      {code === 'en' ? (
        <svg viewBox="0 0 60 40" className="h-full w-full" aria-hidden>
          <rect width="60" height="40" fill="#012169" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="5" />
          <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="12" />
          <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="7" />
        </svg>
      ) : (
        <svg viewBox="0 0 60 40" className="h-full w-full" aria-hidden>
          <rect width="60" height="40" fill="#AA151B" />
          <rect y="10" width="60" height="20" fill="#F1BF00" />
        </svg>
      )}
    </span>
  );
}

type LanguageSwitcherProps = {
  /** Floating action button (marketing) vs inline dropdown vs segmented toggle (web-app). */
  variant?: 'fab' | 'inline' | 'toggle';
  /** Styles for primary-colored headers (web-app) or brand primary button. */
  tone?: 'default' | 'onPrimary' | 'brand';
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
  const brandTone = tone === 'brand';

  if (isToggle) {
    return (
      <div
        ref={containerRef}
        className={cn('relative w-full', className)}
      >
        <button
          type="button"
          aria-label={`${label}: ${current.nativeLabel}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-xs font-bold uppercase tracking-wide transition-colors',
            onPrimary
              ? 'border-0 bg-white text-[#1a1033] shadow-sm hover:bg-white/90'
              : brandTone
                ? 'border-0 bg-primary text-primary-foreground shadow-sm hover:brightness-95'
                : 'border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-primary/40 hover:text-primary dark:border-zinc-700 dark:bg-zinc-950 dark:text-white'
          )}
        >
          <span className="inline-flex items-center gap-2">
            <LanguageFlag code={current.code} flagLabel={current.flagLabel} />
            <span>{current.short}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 opacity-70 transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={label}
            className={cn(
              'absolute inset-x-0 z-[60] overflow-hidden rounded-xl border p-1.5 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)]',
              brandTone || !onPrimary
                ? 'bottom-full mb-2'
                : 'top-full mt-2',
              onPrimary || brandTone
                ? 'border-[#e8eaef] bg-white text-[#1f1f2e]'
                : 'border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white'
            )}
          >
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
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : onPrimary || brandTone
                        ? 'text-[#1f1f2e] hover:bg-[#f4f4f6]'
                        : 'text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <LanguageFlag code={lang.code} flagLabel={lang.flagLabel} />
                    <span className="truncate font-medium">{lang.nativeLabel}</span>
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
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
                  <LanguageFlag code={lang.code} flagLabel={lang.flagLabel} />
                  <span className="font-medium">{lang.nativeLabel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {lang.short}
                  </span>
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
          isFab ? 'h-12 pl-2.5 pr-4' : 'h-10 pl-2.5 pr-3.5',
          onPrimary
            ? 'border-white/30 bg-white/15 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] hover:border-white/50 hover:bg-white/25'
            : 'border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-fire-500 hover:text-fire-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:border-fire-400 dark:hover:text-fire-400'
        )}
      >
        <LanguageFlag
          code={current.code}
          flagLabel={current.flagLabel}
          className={isFab ? 'h-5 w-7' : 'h-4 w-6'}
        />
        <span className="text-xs font-bold uppercase tracking-wider">
          {current.short}
        </span>
        {!isFab ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}
