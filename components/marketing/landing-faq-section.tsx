'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PublicFaq = {
  id: string;
  question: string;
  answer: string;
};

const FALLBACK_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

export function LandingFaqSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PublicFaq[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/faqs');
        if (!res.ok) throw new Error('load failed');
        const json = (await res.json()) as { data?: PublicFaq[] };
        if (cancelled) return;
        const list = Array.isArray(json.data) ? json.data : [];
        setItems(list);
        if (list.length > 0) setOpenId(list[0].id);
        else setOpenId('q1');
      } catch {
        if (!cancelled) {
          setItems([]);
          setOpenId('q1');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const useDb = (items?.length ?? 0) > 0;
  const rows: { id: string; question: string; answer: string }[] = useDb
    ? (items as PublicFaq[])
    : FALLBACK_KEYS.map((key) => ({
        id: key,
        question: t(`marketing.faq.items.${key}.question`),
        answer: t(`marketing.faq.items.${key}.answer`),
      }));

  return (
    <section className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-fire-500">
            {t('marketing.faq.eyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
            {t('marketing.faq.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
            {t('marketing.faq.subtitle')}
          </p>
        </div>

        {items === null ? (
          <div className="mt-10 flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-fire-500" />
          </div>
        ) : (
          <div className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {rows.map((row) => {
              const isOpen = openId === row.id;
              const panelId = `faq-panel-${row.id}`;
              const buttonId = `faq-button-${row.id}`;
              return (
                <div key={row.id}>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : row.id)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-fire-500"
                  >
                    <span className="text-base font-semibold text-zinc-900 dark:text-white md:text-lg">
                      {row.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-fire-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="whitespace-pre-wrap pb-5 pr-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
                        {row.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
