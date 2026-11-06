'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { format } from 'date-fns';
import { ArrowDown, FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useUiLanguage } from '@/hooks/use-ui-language';
import type { UiLanguage } from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { cn } from '@/lib/utils';

export type PublicBlogCard = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  shortDescription: string;
  publishedAt: string | null;
  english?: boolean;
  spanish?: boolean;
};

type Props = {
  initialPosts: PublicBlogCard[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  initialLang: UiLanguage;
};

export function PublicBlogList({
  initialPosts,
  initialNextCursor,
  initialHasMore,
  initialLang,
}: Props) {
  const { t } = useTranslation();
  const lang = useUiLanguage();
  const [posts, setPosts] = useState(initialPosts);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedLang = useRef(initialLang);

  const fetchPage = useCallback(
    async (opts: { cursor?: string | null; replace: boolean; forLang: UiLanguage }) => {
      const params = new URLSearchParams({
        limit: '9',
        lang: opts.forLang,
      });
      if (opts.cursor) params.set('cursor', opts.cursor);
      const res = await axios.get<{
        data: {
          posts: PublicBlogCard[];
          nextCursor: string | null;
          hasMore: boolean;
        };
      }>(`/api/blog?${params}`);
      const page = res.data.data;
      setPosts((prev) =>
        opts.replace ? page.posts : [...prev, ...page.posts]
      );
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      loadedLang.current = opts.forLang;
    },
    []
  );

  useEffect(() => {
    if (lang === loadedLang.current) return;
    let cancelled = false;
    setReloading(true);
    setError(null);
    void (async () => {
      try {
        await fetchPage({ replace: true, forLang: lang });
      } catch {
        if (!cancelled) setError(t('marketingExtras.blog.loadMoreError'));
      } finally {
        if (!cancelled) setReloading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, fetchPage, t]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || reloading) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({
        cursor: nextCursor,
        replace: false,
        forLang: lang,
      });
    } catch {
      setError(t('marketingExtras.blog.loadMoreError'));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, nextCursor, lang, reloading, t]);

  if (reloading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-fire-500" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
        <FileText className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t('marketingExtras.blog.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const title = resolveBilingualText(post.title, lang);
          const shortDescription = resolveBilingualText(
            post.shortDescription,
            lang
          );
          return (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <FileText className="h-10 w-10 opacity-50" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                {post.publishedAt ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-fire-500">
                    {format(new Date(post.publishedAt), 'MMM d, yyyy')}
                  </p>
                ) : null}
                <h2 className="text-lg font-semibold leading-snug text-zinc-900 group-hover:text-fire-600 dark:text-white dark:group-hover:text-fire-400">
                  {title}
                </h2>
                <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {shortDescription}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {error ? (
        <p className="text-center text-sm text-destructive">{error}</p>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="default"
            size="lg"
            className={cn('min-w-[160px] rounded-xl')}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('marketingExtras.blog.loading')}
              </>
            ) : (
              <>
                <ArrowDown className="mr-2 h-4 w-4" />
                {t('marketingExtras.blog.loadMore')}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
