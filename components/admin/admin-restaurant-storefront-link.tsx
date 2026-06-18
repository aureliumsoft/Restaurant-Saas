'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function restaurantWebAppHref(slug: string) {
  return `/web-app/${encodeURIComponent(slug.trim())}`;
}

export function AdminRestaurantStorefrontLink({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground',
        className
      )}
      asChild
    >
      <Link
        href={restaurantWebAppHref(trimmed)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${trimmed} storefront`}
        title="Open restaurant website"
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
    </Button>
  );
}
