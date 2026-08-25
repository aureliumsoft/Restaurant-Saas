'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LandingNewsletterSection() {
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
    <section className="relative overflow-hidden border-y border-zinc-200 bg-zinc-50 py-20 dark:border-zinc-900 dark:bg-zinc-950 md:py-24 sm:px-10 lg:px-16 xl:px-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(237,110,64,0.12),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(237,110,64,0.18),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full px-6 text-center">
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
