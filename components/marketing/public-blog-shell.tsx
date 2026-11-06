'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';

import { BlogFeaturedSidebar } from '@/components/marketing/blog-featured-sidebar';
import { BlogRecentSidebar } from '@/components/marketing/blog-recent-sidebar';
import { useUiLanguage } from '@/hooks/use-ui-language';
import type { PublicBlogSidebarCard } from '@/lib/blog/public-queries';
import type { UiLanguage } from '@/lib/i18n/resources';
import { cn } from '@/lib/utils';

type Props = {
  featured: PublicBlogSidebarCard[];
  recent: PublicBlogSidebarCard[];
  children: ReactNode;
  className?: string;
  /** Language used to SSR the initial sidebars. */
  initialLang?: UiLanguage;
  /** Exclude current article from recent when on a post page. */
  excludeSlug?: string;
};

type BlogApiCard = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  shortDescription: string;
  publishedAt: string | null;
  featured?: boolean;
};

function mapApiCard(p: BlogApiCard, featured: boolean): PublicBlogSidebarCard {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    imageUrl: p.imageUrl,
    shortDescription: p.shortDescription,
    publishedAt: p.publishedAt,
    featured,
  };
}

/** Three-column public blog shell: featured | main | recent. */
export function PublicBlogShell({
  featured: initialFeatured,
  recent: initialRecent,
  children,
  className,
  initialLang,
  excludeSlug,
}: Props) {
  const lang = useUiLanguage();
  const [featured, setFeatured] = useState(initialFeatured);
  const [recent, setRecent] = useState(initialRecent);
  const loadedLang = useRef(initialLang ?? lang);

  useEffect(() => {
    if (lang === loadedLang.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const [featuredRes, recentRes] = await Promise.all([
          axios.get<{ data: { posts: BlogApiCard[] } }>(
            `/api/blog?${new URLSearchParams({
              lang,
              limit: '6',
              featured: '1',
            })}`
          ),
          axios.get<{ data: { posts: BlogApiCard[] } }>(
            `/api/blog?${new URLSearchParams({
              lang,
              limit: '8',
            })}`
          ),
        ]);
        if (cancelled) return;
        setFeatured(
          (featuredRes.data.data.posts ?? []).map((p) => mapApiCard(p, true))
        );
        setRecent(
          (recentRes.data.data.posts ?? [])
            .filter((p) => !excludeSlug || p.slug !== excludeSlug)
            .slice(0, 8)
            .map((p) => mapApiCard(p, Boolean(p.featured)))
        );
        loadedLang.current = lang;
      } catch {
        // Keep previous sidebars on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, excludeSlug]);

  return (
    <div
      className={cn(
        'grid gap-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,280px)] xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,300px)]',
        className
      )}
    >
      <div className="order-2 lg:order-1">
        <div className="lg:sticky lg:top-28">
          <BlogFeaturedSidebar posts={featured} />
        </div>
      </div>

      <div className="order-1 min-w-0 lg:order-2">{children}</div>

      <div className="order-3">
        <div className="lg:sticky lg:top-28">
          <BlogRecentSidebar posts={recent} />
        </div>
      </div>
    </div>
  );
}
