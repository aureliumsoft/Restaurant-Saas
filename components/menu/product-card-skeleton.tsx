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
          'flex flex-col overflow-hidden rounded-2xl p-2.5 text-left text-foreground',
          className
        )}
        aria-hidden
      >
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="mt-2.5 flex min-h-[3.25rem] flex-col justify-between px-0.5">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full rounded-sm" />
            <Skeleton className="h-3.5 w-[88%] rounded-sm" />
          </div>
          <Skeleton className="mt-1 h-3 w-[36%] rounded-sm" />
        </div>
      </div>
    );
  }

  if (variant === 'kiosk') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg  p-3 shadow-sm',
          className
        )}
        aria-hidden
      >
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/3" />
        <Skeleton className="mt-3 h-9 w-full rounded-md" />
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
      className={cn('h-10 w-28 shrink-0 rounded-full', className)}
      aria-hidden
    />
  );
}
