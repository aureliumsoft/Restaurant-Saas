'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  sidebarOpen: boolean;
  sidebarHeader: ReactNode;
  sidebarNav: ReactNode;
  sidebarFooter: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export function DashboardAppShell({
  sidebarOpen,
  sidebarHeader,
  sidebarNav,
  sidebarFooter,
  header,
  children,
}: Props) {
  return (
    <div className="h-screen overflow-hidden bg-[#eef0f3] dark:bg-[#0d0d0d]">
      <div
        className={cn(
          'grid h-screen w-full overflow-hidden',
          sidebarOpen
            ? 'md:grid-cols-[minmax(0,15rem)_1fr]'
            : 'grid-cols-1'
        )}
      >
        <aside
          className={cn(
            'hidden h-screen w-full max-w-60 overflow-hidden border-r border-border/60 bg-white dark:bg-[#141414] md:sticky md:top-0 md:flex md:flex-col',
            !sidebarOpen && 'md:hidden'
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-14 shrink-0 items-center border-b px-4">
              {sidebarHeader}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebarNav}</div>
            <div className="shrink-0 px-2 pb-4 pt-2">{sidebarFooter}</div>
          </div>
        </aside>

        <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-muted/40 px-4 sm:gap-4">
            {header}
          </header>
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
