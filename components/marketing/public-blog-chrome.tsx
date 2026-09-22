'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PublicBlogIndexHeader() {
  const { t } = useTranslation();

  return (
    <header className="mb-10 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-fire-500">
        {t('marketingExtras.blog.eyebrow')}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
        {t('marketingExtras.blog.title')}
      </h1>
      <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
        {t('marketingExtras.blog.subtitle')}
      </p>
    </header>
  );
}

export function PublicBlogBackLink() {
  const { t } = useTranslation();

  return (
    <Link
      href="/blog"
      className="mb-8 inline-flex items-center text-sm font-medium text-zinc-600 transition-colors hover:text-fire-500 dark:text-zinc-400 dark:hover:text-fire-400"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {t('marketingExtras.blog.allPosts')}
    </Link>
  );
}
