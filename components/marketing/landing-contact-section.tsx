'use client';

import { useState } from 'react';
import { Clock, Loader2, Mail, Phone, SendHorizonal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LandingContactSection() {
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
    <section id="contact" className="relative bg-white py-20 dark:bg-black md:py-24">
      <div className="mx-auto w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
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
                <a
                  href={`tel:${t('marketing.contact.phone')}`}
                  className="hover:text-fire-500"
                >
                  {t('marketing.contact.phone')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Mail className="h-4 w-4" />
                </span>
                <a
                  href={`mailto:${t('marketing.contact.email')}`}
                  className="hover:text-fire-500"
                >
                  {t('marketing.contact.email')}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-fire-500/15 text-fire-500 ring-1 ring-fire-500/30">
                  <Clock className="h-4 w-4" />
                </span>
                {t('marketing.contact.businessHours')}
              </li>
            </ul>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-fire-500/40 via-fire-700/10 to-transparent blur-2xl"
              aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-3xl border border-fire-200/70 bg-gradient-to-br from-white via-fire-50/50 to-zinc-50 p-6 shadow-[0_30px_80px_-20px] shadow-fire-500/20 backdrop-blur-2xl dark:border-white/10 dark:from-fire-500/25 dark:via-fire-700/15 dark:to-zinc-900/70 dark:shadow-fire-500/30 md:p-8">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fire-500/40 blur-3xl"
                aria-hidden="true"
              />
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>{t('marketing.contact.submit')}</span>
                      <SendHorizonal className="ml-1 h-4 w-4" />
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
