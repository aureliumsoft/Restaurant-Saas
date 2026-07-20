'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

const SKELETON_BONE = 'bg-[#e2e8f0] dark:bg-[#4d4d4f] animate-pulse';

type Props = {
  src?: string | null;
  hasImage?: boolean;
  alt: string;
  className?: string;
  emptyLabel?: string;
};

/** Lazy product photo for kiosk / online menus. */
export function LazyMenuProductImage({
  src,
  hasImage,
  alt,
  className,
  emptyLabel = 'No photo',
}: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (!showImage) {
    return (
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden bg-muted text-xs text-muted-foreground',
          className
        )}
      >
        {hasImage ? '…' : emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {!loaded ? (
        <div className={cn('absolute inset-0', SKELETON_BONE)} aria-hidden />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src!}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
