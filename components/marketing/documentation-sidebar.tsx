'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { BookOpen, ChevronRight, Search } from 'lucide-react';

import {
  docHeadingPath,
  docPath,
  type PublicDocHeading,
  type PublicDocNav,
} from '@/lib/documentation/public';
import { cn } from '@/lib/utils';

type Props = {
  nav: PublicDocNav;
};

export function DocumentationSidebar({ nav }: Props) {
  const pathname = usePathname();
  const params = useParams<{
    headingSlug?: string;
    subheadingSlug?: string;
  }>();
  const activeHeadingSlug =
    typeof params.headingSlug === 'string' ? params.headingSlug : null;
  const activeSubSlug =
    typeof params.subheadingSlug === 'string' ? params.subheadingSlug : null;

  const [query, setQuery] = useState('');
  /** Headings closed by default; `true` means expanded. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Open the active branch so the current page is visible in the tree.
  useEffect(() => {
    if (!activeHeadingSlug) return;
    const heading = nav.headings.find((h) => h.slug === activeHeadingSlug);
    if (!heading?.subHeadings.some((s) => s.pages[0])) return;
    setExpanded((prev) => {
      if (prev[heading.id]) return prev;
      return { ...prev, [heading.id]: true };
    });
  }, [activeHeadingSlug, nav.headings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nav.headings;

    const headings: PublicDocHeading[] = [];
    for (const h of nav.headings) {
      const headingMatch =
        h.name.toLowerCase().includes(q) || h.slug.includes(q);
      const directPages = h.pages.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q)
      );
      if (headingMatch) {
        headings.push(h);
        continue;
      }
      const subs = h.subHeadings.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.includes(q) ||
          s.pages.some(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.shortDescription.toLowerCase().includes(q)
          )
      );
      if (directPages.length || subs.length) {
        headings.push({
          ...h,
          pages: headingMatch || directPages.length ? h.pages : directPages,
          subHeadings: subs,
        });
      }
    }
    return headings;
  }, [nav.headings, query]);

  const isIndex = pathname === '/documentation' || pathname === '/documentation/';

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 md:sticky md:top-[5.5rem] md:h-[calc(100vh-5.5rem)] md:w-72 md:border-b-0 md:border-r lg:w-80">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800 md:p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this site…"
            className="h-9 w-full rounded-md border border-zinc-200 bg-white py-1 pl-8 pr-3 text-sm text-zinc-900 outline-none ring-fire-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
        </label>
      </div>

      <nav
        aria-label="Documentation"
        className="flex-1 space-y-1 overflow-y-auto p-3 text-sm md:p-4"
      >
        <Link
          href="/documentation"
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-medium',
            isIndex
              ? 'bg-fire-500/15 text-fire-700 dark:text-fire-300'
              : 'text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-200 dark:hover:bg-zinc-800'
          )}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          Documentation
        </Link>

        {filtered.map((h) => {
          const hasSubHeadings = h.subHeadings.some((s) => s.pages[0]);
          const childrenVisible =
            hasSubHeadings &&
            (Boolean(query.trim()) || expanded[h.id] === true);
          const hasDirect = Boolean(h.pages[0]);
          const headingSelected =
            h.slug === activeHeadingSlug && !activeSubSlug;
          const headingHref = docHeadingPath(h.slug);

          function toggleExpanded() {
            setExpanded((prev) => ({
              ...prev,
              [h.id]: !prev[h.id],
            }));
          }

          return (
            <div key={h.id} className="pt-1">
              <div className="flex items-center gap-0.5">
                {hasSubHeadings ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="rounded-md p-1 text-zinc-500 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label={childrenVisible ? 'Collapse' : 'Expand'}
                    aria-expanded={childrenVisible}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform',
                        childrenVisible && 'rotate-90'
                      )}
                    />
                  </button>
                ) : null}
                {hasDirect ? (
                  <Link
                    href={headingHref}
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide',
                      headingSelected
                        ? 'bg-fire-500/15 text-fire-700 dark:text-fire-300'
                        : 'text-zinc-500 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    )}
                  >
                    {h.name}
                  </Link>
                ) : hasSubHeadings ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {h.name}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {h.name}
                  </span>
                )}
              </div>
              {childrenVisible ? (
                <ul className="ml-5 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
                  {h.subHeadings.map((s) => {
                    const hasPage = Boolean(s.pages[0]);
                    const href = docPath(h.slug, s.slug);
                    const selected =
                      h.slug === activeHeadingSlug &&
                      s.slug === activeSubSlug;

                    if (!hasPage) {
                      return (
                        <li key={s.id}>
                          <span className="block cursor-not-allowed rounded-md px-2 py-1.5 text-zinc-400">
                            {s.name}
                          </span>
                        </li>
                      );
                    }

                    return (
                      <li key={s.id}>
                        <Link
                          href={href}
                          className={cn(
                            'block w-full rounded-md px-2 py-1.5 text-left',
                            selected
                              ? 'bg-fire-500/15 font-medium text-fire-700 dark:text-fire-300'
                              : 'text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          )}
                        >
                          {s.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}

        {!filtered.length ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            No published documentation yet.
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
