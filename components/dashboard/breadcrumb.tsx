'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { dashboardPathSegmentTitleKey } from '@/lib/dashboard-nav-i18n';

function formatSegment(segment: string) {
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Bread() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const pathSegments = pathname.split('/').filter((segment) => segment !== '');

  const segmentLabel = (segment: string) => {
    const key = dashboardPathSegmentTitleKey(segment);
    return key ? t(key) : formatSegment(segment);
  };

  const pageTitle = pathSegments.length
    ? segmentLabel(pathSegments[pathSegments.length - 1])
    : t('dashboard.nav.modules.dashboard');

  const breadcrumbItems = pathSegments.map((segment, index) => {
    const currentPath = `/${pathSegments.slice(0, index + 1).join('/')}`;
    const isLast = index === pathSegments.length - 1;
    const label = segmentLabel(segment);

    return (
      <React.Fragment key={currentPath}>
        <BreadcrumbItem>
          {isLast ? (
            <BreadcrumbPage className="rounded-lg bg-fire-500/10 px-2.5 py-1 text-sm font-semibold text-fire-700 dark:text-fire-300">
              {label.toLowerCase().slice(0, 15)}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink>
              {label.toLowerCase().slice(0, 15)}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {!isLast ? (
          <BreadcrumbSeparator className="text-muted-foreground/40" />
        ) : null}
      </React.Fragment>
    );
  });

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold tracking-tight md:hidden">
        {pageTitle}
      </p>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList className="gap-1 sm:gap-1.5">
          {breadcrumbItems.length > 0 ? (
            breadcrumbItems
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage className="rounded-lg bg-fire-500/10 px-2.5 py-1 text-sm font-semibold text-fire-700 dark:text-fire-300">
                {t('dashboard.nav.modules.dashboard')}
              </BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export default Bread;
