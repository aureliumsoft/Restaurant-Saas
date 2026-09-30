'use client';

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  loading: boolean;
  children: ReactNode;
  actions?: ReactNode;
};

export function MenuPageShell({
  title,
  description,
  loading,
  children,
  actions,
}: Props) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {loading && (
        <Loader2 className="mx-auto animate-spin text-center text-primary" />
      )}
      {children}
    </div>
  );
}
