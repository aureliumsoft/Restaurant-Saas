import Link from 'next/link';

import type { PublicDocArticle } from '@/lib/documentation/public';
import { docHeadingPath } from '@/lib/documentation/public';

export function DocumentationArticleView({
  article,
}: {
  article: PublicDocArticle;
}) {
  const primary = article.pages[0];
  const extraPages = article.pages.slice(1);

  return (
    <article className="w-full">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <Link
          href="/documentation"
          className="hover:text-fire-600 dark:hover:text-fire-400"
        >
          Documentation
        </Link>
        <span aria-hidden>/</span>
        {article.subHeading ? (
          <>
            <Link
              href={docHeadingPath(article.heading.slug)}
              className="hover:text-fire-600 dark:hover:text-fire-400"
            >
              {article.heading.name}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-zinc-700 dark:text-zinc-200">
              {article.subHeading.name}
            </span>
          </>
        ) : (
          <span className="text-zinc-700 dark:text-zinc-200">
            {article.heading.name}
          </span>
        )}
      </nav>

      <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
        {primary.name}
      </h1>
      {primary.shortDescription ? (
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          {primary.shortDescription}
        </p>
      ) : null}

      <div
        className="prose prose-zinc mt-8 max-w-none dark:prose-invert prose-a:text-fire-600 dark:prose-a:text-fire-400 lg:prose-lg"
        dangerouslySetInnerHTML={{
          __html: primary.contentHtml || '<p></p>',
        }}
      />

      {extraPages.map((page) => (
        <section
          key={page.id}
          className="mt-12 border-t border-zinc-200 pt-10 dark:border-zinc-800"
        >
          <h2 className="text-2xl font-bold tracking-tight">{page.name}</h2>
          {page.shortDescription ? (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {page.shortDescription}
            </p>
          ) : null}
          <div
            className="prose prose-zinc mt-6 max-w-none dark:prose-invert prose-a:text-fire-600 dark:prose-a:text-fire-400 lg:prose-lg"
            dangerouslySetInnerHTML={{
              __html: page.contentHtml || '<p></p>',
            }}
          />
        </section>
      ))}
    </article>
  );
}
