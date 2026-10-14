'use client';

/**
 * @deprecated Use separate routes: /categories, /product, /recommendations
 * Kept for backward compatibility; redirects users to the catalog overview.
 */
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export default function MenuManager() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">
        {t('dashboard.menuManager.legacy.title')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('dashboard.menuManager.legacy.description')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/categories">
            {t('dashboard.menuManager.legacy.categories')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/product">{t('dashboard.menuManager.legacy.products')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/product/swatches">
            {t('dashboard.menuManager.legacy.swatches')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings?section=branches">
            {t('dashboard.menuManager.legacy.tables')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/recommendations">
            {t('dashboard.menuManager.legacy.recommendations')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
