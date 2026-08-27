'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ProductCardSkeletonVariant = 'kiosk' | 'online' | 'pos';

type ProductCardSkeletonProps = {
  variant?: ProductCardSkeletonVariant;
  className?: string;
};

export function ProductCardSkeleton({
  variant = 'online',
  className,
}: ProductCardSkeletonProps) {
  if (variant === 'pos') {
    return (
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left',
          className
        )}
        aria-hidden
      >
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="flex items-stretch border-t border-border">
          <div className="min-w-0 flex-1 space-y-1.5 px-2 py-2">
            <Skeleton className="h-3 w-[85%] rounded-sm" />
            <Skeleton className="h-4 w-[40%] rounded-sm" />
          </div>
          <Skeleton className="w-9 shrink-0 rounded-none sm:w-10" />
        </div>
      </div>
    );
  }

  if (variant === 'kiosk') {
    // Match live kiosk cards; use opaque slate bones (theme muted blends on light bg).
    const bone = 'bg-[#e2e8f0]';
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-sm',
          className
        )}
        aria-hidden
      >
        <Skeleton className={cn('aspect-square w-full rounded-lg', bone)} />
        <Skeleton className={cn('mt-2 h-4 w-3/4', bone)} />
        <Skeleton className={cn('mt-2 h-4 w-1/3', bone)} />
        <Skeleton className={cn('mt-3 h-9 w-full rounded-md', bone)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-2xl shadow-sm',
        className
      )}
      aria-hidden
    >
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-2/3" />
        <Skeleton className="mt-4 h-5 w-1/4" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({
  count = 6,
  variant = 'online',
  className,
  gridClassName,
}: {
  count?: number;
  variant?: ProductCardSkeletonVariant;
  className?: string;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton
          key={`product-skeleton-${index}`}
          variant={variant}
          className={className}
        />
      ))}
    </div>
  );
}

export function CategoryPillSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn(
        'h-10 w-28 shrink-0 rounded-full bg-[#e2e8f0]',
        className
      )}
      aria-hidden
    />
  );
}
