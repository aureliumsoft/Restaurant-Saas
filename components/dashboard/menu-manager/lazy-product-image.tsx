'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

const SKELETON_BONE = 'bg-[#e2e8f0] dark:bg-[#3f3f46] animate-pulse';

type LazyProductImageProps = {
  src: string | null | undefined;
  hasImage?: boolean;
  alt?: string;
  /** Outer frame classes (size/shape). */
  className?: string;
  /** Empty / failed placeholder text. */
  emptyLabel?: string;
  imgClassName?: string;
};

/**
 * Lazy product photo: list APIs return lightweight `/image` proxy URLs (or http).
 * Browser loads bytes after the row/card is painted — does not block list JSON.
 */
export function LazyProductImage({
  src,
  hasImage,
  alt = '',
  className,
  emptyLabel = '—',
  imgClassName,
}: LazyProductImageProps) {
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
      {/* eslint-disable-next-line @next/next/no-img-element -- lazy list/proxy thumbs */}
      <img
        src={src!}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
