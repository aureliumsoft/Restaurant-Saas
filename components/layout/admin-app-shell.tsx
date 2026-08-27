'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AdminAppShellProps = {
  sidebarOpen: boolean;
  sidebarHeader: ReactNode;
  sidebarNav: ReactNode;
  sidebarFooter: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export function AdminAppShell({
  sidebarOpen,
  sidebarHeader,
  sidebarNav,
  sidebarFooter,
  header,
  children,
}: AdminAppShellProps) {
  return (
    <div className="fire-mesh-bg relative flex h-screen overflow-hidden">
      <div className="relative flex h-full w-full">
        <aside
          className={cn(
            'hidden h-full min-h-0 w-[18.5rem] shrink-0 flex-col overflow-hidden md:flex',
            'bg-white/35 backdrop-blur-2xl dark:bg-black/35',
            !sidebarOpen && 'md:hidden'
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-[4.25rem] shrink-0 items-center px-4 pt-1">
              {sidebarHeader}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-1">
              {sidebarNav}
            </div>
            <div className="shrink-0 px-3 pb-3 pt-1">{sidebarFooter}</div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <header className="relative z-10 flex h-14 w-full shrink-0 items-center gap-2 bg-white/50 px-3 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:bg-black/45 dark:shadow-[0_8px_30px_-18px_rgba(0,0,0,0.7)] sm:gap-3 sm:px-4 lg:px-5">
            {header}
          </header>

          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="w-full min-w-0 flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
