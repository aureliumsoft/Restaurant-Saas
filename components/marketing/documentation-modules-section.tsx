'use client';

import { useState } from 'react';
import { ArrowRight, BookOpen, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type PublicDocModuleListItem = {
  id: string;
  name: string;
  shortDescription: string;
  sortOrder?: number;
};

type FallbackModule = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
};

type ActiveDetail = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
};

type Props = {
  /** Published modules from the server (dynamic). */
  modules?: PublicDocModuleListItem[];
  /** Static blurbs only if no published modules exist. */
  fallbackModules?: FallbackModule[];
};

/**
 * Index “Dashboard modules” cards from published DocumentationModule rows.
 * Full HTML is loaded on Read more so the page payload stays small.
 */
export function DocumentationModulesSection({
  modules = [],
  fallbackModules = [],
}: Props) {
  const usingDynamic = modules.length > 0;
  const rows: (PublicDocModuleListItem | FallbackModule)[] = usingDynamic
    ? modules
    : fallbackModules;

  const [active, setActive] = useState<ActiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openReadMore(
    item: PublicDocModuleListItem | FallbackModule
  ) {
    // Static fallback already has body HTML.
    if ('contentHtml' in item && item.contentHtml) {
      setActive({
        id: item.id,
        name: item.name,
        shortDescription: item.shortDescription,
        contentHtml: item.contentHtml,
      });
      return;
    }

    setDetailLoading(true);
    setActive({
      id: item.id,
      name: item.name,
      shortDescription: item.shortDescription,
      contentHtml: '',
    });
    try {
      const res = await fetch(
        `/api/documentation/${encodeURIComponent(item.id)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('load failed');
      const json = (await res.json()) as { data?: ActiveDetail };
      if (json.data) {
        setActive(json.data);
      }
    } catch {
      setActive({
        id: item.id,
        name: item.name,
        shortDescription: item.shortDescription,
        contentHtml: '<p>Could not load details. Please try again.</p>',
      });
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section id="modules" className="mt-16 scroll-mt-24">
      <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
        Dashboard modules
      </h2>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        After you sign in and open the operator workspace, the sidebar lists
        modules. Access depends on your role and your restaurant&apos;s
        subscription tier. Open Read more for full detail.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <BookOpen className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Documentation modules will appear here once published.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((m) => (
            <li key={m.id} className="group relative w-full">
              <article
                className={cn(
                  'w-full rounded-2xl border border-zinc-200/80 bg-white/80 p-5 transition-all duration-200',
                  'dark:border-zinc-800 dark:bg-zinc-900/40',
                  'hover:-translate-y-0.5 hover:border-fire-500/40 hover:shadow-md hover:shadow-fire-500/10'
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {m.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {m.shortDescription}
                    </p>
                  </div>
                  <div className="shrink-0 self-start">
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => void openReadMore(m)}
                    >
                      Read more
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) {
            setActive(null);
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl leading-snug">
                  {active.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-1">
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wider text-fire-500">
                    Overview
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {active.shortDescription}
                  </p>
                </section>
                <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-fire-500">
                    Details
                  </p>
                  {detailLoading ? (
                    <div className="mt-6 flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-fire-500" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'prose prose-sm mt-3 max-w-none dark:prose-invert',
                        'prose-headings:font-semibold prose-a:text-fire-600 dark:prose-a:text-fire-400',
                        '[&_h2]:text-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6'
                      )}
                      dangerouslySetInnerHTML={{
                        __html: active.contentHtml || '<p></p>',
                      }}
                    />
                  )}
                </section>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
