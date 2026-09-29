'use client';

/**
 * @deprecated Use separate routes: /categories, /product, /recommendations
 * Kept for backward compatibility; redirects users to the catalog overview.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MenuManager() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Menu catalog</h1>
      <p className="text-sm text-muted-foreground">
        Categories, products, and recommendations each have their own page. Use the sidebar to open
        them.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/categories">Categories</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/product">Products</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/product/swatches">Swatches</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings?section=branches">Tables</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/recommendations">Recommendations</Link>
        </Button>
      </div>
    </div>
  );
}
