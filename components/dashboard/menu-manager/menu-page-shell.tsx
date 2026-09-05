'use client';

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  loading: boolean;
  children: ReactNode;
};

export function MenuPageShell({ title, description, loading, children }: Props) {

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-5 sm:gap-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {loading && (
        <Loader2 className="mx-auto animate-spin text-primary text-center" />
      )}
      {children}
    </div>
  );
}
