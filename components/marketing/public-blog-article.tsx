'use client';

import { format } from 'date-fns';

import { PublicBlogBackLink } from '@/components/marketing/public-blog-chrome';
import { useUiLanguage } from '@/hooks/use-ui-language';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';

type Props = {
  title: string;
  shortDescription: string;
  contentHtml: string;
  imageUrl: string | null;
  publishedAt: string | null;
};

/** Article body that switches EN/ES immediately with the language toggle. */
export function PublicBlogArticle({
  title,
  shortDescription,
  contentHtml,
  imageUrl,
  publishedAt,
}: Props) {
  const lang = useUiLanguage();
  const displayTitle = resolveBilingualText(title, lang);
  const displayShort = resolveBilingualText(shortDescription, lang);
  const displayHtml = resolveBilingualText(contentHtml, lang);

  return (
    <article>
      <PublicBlogBackLink />

      {publishedAt ? (
        <p className="text-sm font-medium uppercase tracking-wide text-fire-500">
          {format(new Date(publishedAt), 'MMMM d, yyyy')}
        </p>
      ) : null}

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
        {displayTitle}
      </h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        {displayShort}
      </p>

      {imageUrl ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      <div
        className="prose prose-zinc mt-10 max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-fire-600 dark:prose-a:text-fire-400 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </article>
  );
}
