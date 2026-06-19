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
    <div className="relative flex h-screen overflow-hidden bg-[#f4f4f5] dark:bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.05),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(237,110,64,0.05),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.04),transparent_50%)]"
        aria-hidden
      />

      <div className="relative flex h-full w-full gap-0 p-0 md:gap-3 md:p-3">
        <aside
          className={cn(
            'hidden h-full min-h-0 w-[17rem] shrink-0 flex-col overflow-hidden rounded-none bg-white shadow-none dark:bg-zinc-900 md:flex md:rounded-2xl md:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.1)] dark:md:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.5)]',
            !sidebarOpen && 'md:hidden'
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-16 shrink-0 items-center border-b border-border/40 px-4">
              {sidebarHeader}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
              {sidebarNav}
            </div>
            <div className="shrink-0 border-t border-border/40 p-3">{sidebarFooter}</div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none bg-white shadow-none dark:bg-zinc-900 md:rounded-2xl md:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.1)] dark:md:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.5)]">
          <header className="relative z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-4 sm:gap-3 sm:px-6">
            {header}
          </header>

          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="dashboard-content w-full min-w-0 flex-1 space-y-5 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
