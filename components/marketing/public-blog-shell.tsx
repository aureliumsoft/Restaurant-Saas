import type { ReactNode } from 'react';

import { BlogFeaturedSidebar } from '@/components/marketing/blog-featured-sidebar';
import { BlogRecentSidebar } from '@/components/marketing/blog-recent-sidebar';
import type { PublicBlogSidebarCard } from '@/lib/blog/public-queries';
import { cn } from '@/lib/utils';

type Props = {
  featured: PublicBlogSidebarCard[];
  recent: PublicBlogSidebarCard[];
  children: ReactNode;
  className?: string;
};

/** Three-column public blog shell: featured | main | recent. */
export function PublicBlogShell({
  featured,
  recent,
  children,
  className,
}: Props) {
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
