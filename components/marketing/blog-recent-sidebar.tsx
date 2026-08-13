import Link from 'next/link';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';

import type { PublicBlogSidebarCard } from '@/lib/blog/public-queries';
import { cn } from '@/lib/utils';

type Props = {
  posts: PublicBlogSidebarCard[];
  className?: string;
};

export function BlogRecentSidebar({ posts, className }: Props) {
  return (
    <aside className={cn('space-y-4', className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-fire-500">
          Latest
        </p>
        <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
          Recent blogs
        </h2>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No recent posts yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <FileText className="h-6 w-6 opacity-50" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  {post.publishedAt ? (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-fire-500">
                      {format(new Date(post.publishedAt), 'MMM d, yyyy')}
                    </p>
                  ) : null}
                  <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-fire-600 dark:text-white dark:group-hover:text-fire-400">
                    {post.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {post.shortDescription}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
