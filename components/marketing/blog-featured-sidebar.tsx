'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useUiLanguage } from '@/hooks/use-ui-language';
import type { PublicBlogSidebarCard } from '@/lib/blog/public-queries';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { cn } from '@/lib/utils';

type Props = {
  posts: PublicBlogSidebarCard[];
  className?: string;
};

export function BlogFeaturedSidebar({ posts, className }: Props) {
  const { t } = useTranslation();
  const lang = useUiLanguage();

  return (
    <aside className={cn('space-y-4', className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-fire-500">
          {t('marketingExtras.blog.featuredEyebrow')}
        </p>
        <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
          {t('marketingExtras.blog.featuredTitle')}
        </h2>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('marketingExtras.blog.featuredEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <FileText className="h-8 w-8 opacity-50" />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-zinc-900 group-hover:text-fire-600 dark:text-white dark:group-hover:text-fire-400 sm:text-sm">
                  {resolveBilingualText(post.title, lang)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
