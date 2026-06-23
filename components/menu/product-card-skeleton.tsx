'use client';

import { cn } from '@/lib/utils';

type ProductCardSkeletonVariant = 'kiosk' | 'online' | 'pos';

type ProductCardSkeletonProps = {
  variant?: ProductCardSkeletonVariant;
  className?: string;
};

function Pulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function ProductCardSkeleton({
  variant = 'online',
  className,
}: ProductCardSkeletonProps) {
  if (variant === 'pos') {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border bg-background p-3 text-center',
          className
        )}
      >
        <Pulse className="h-14 w-14 rounded-full" />
        <Pulse className="h-3 w-20" />
        <Pulse className="h-4 w-12" />
      </div>
    );
  }

  if (variant === 'kiosk') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-[#e2e8f0] bg-white p-3 shadow-sm',
          className
        )}
      >
        <Pulse className="aspect-square w-full rounded-lg" />
        <Pulse className="mt-2 h-4 w-3/4" />
        <Pulse className="mt-2 h-4 w-1/3" />
        <Pulse className="mt-3 h-9 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm',
        className
      )}
    >
      <Pulse className="h-44 w-full rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <Pulse className="h-5 w-4/5" />
        <Pulse className="mt-2 h-3 w-full" />
        <Pulse className="mt-2 h-3 w-2/3" />
        <Pulse className="mt-4 h-5 w-1/4" />
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
    <Pulse
      className={cn('h-10 w-28 shrink-0 rounded-full', className)}
    />
  );
}
