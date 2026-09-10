'use client';

import { Children, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LazyProductImage } from './lazy-product-image';

export function SelectableRow({
  active,
  title,
  subtitle,
  imageUrl,
  onClick,
  multi = false,
  badge,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  onClick: () => void;
  multi?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
        active ? 'bg-muted/70' : 'hover:bg-muted/40'
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center border',
          multi ? 'rounded-sm' : 'rounded-full',
          active
            ? 'border-foreground bg-foreground'
            : 'border-muted-foreground/40'
        )}
        aria-hidden
      >
        {active ? (
          <span className="h-1.5 w-1.5 rounded-[1px] bg-background" />
        ) : null}
      </span>
      <LazyProductImage
        src={imageUrl}
        hasImage={Boolean(imageUrl)}
        alt=""
        emptyLabel="—"
        className="h-10 w-10 shrink-0 rounded-md"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </button>
  );
}

export function SelectableList({
  children,
  className,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  emptyMessage,
  maxHeightClass = 'max-h-56',
}: {
  children: ReactNode;
  className?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxHeightClass?: string;
}) {
  const hasSearch = typeof onSearchChange === 'function';
  const isEmpty = Children.count(children) === 0;

  return (
    <div className={cn('rounded-xl border border-border bg-background', className)}>
      {hasSearch ? (
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
      ) : null}
      <div className={cn('divide-y divide-border overflow-y-auto overscroll-contain', maxHeightClass)}>
        {isEmpty ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {emptyMessage ?? 'No matches.'}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
