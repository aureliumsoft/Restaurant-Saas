import type { MetadataRoute } from 'next';

import {
  docHeadingPath,
  docPath,
  loadPublicDocNav,
} from '@/lib/documentation/public';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  const routes = [
    '/',
    '/pricing',
    '/documentation',
    '/demo-request',
    '/restaurant-signup',
    '/order-path/click-and-collect',
    '/order-path/curbside-pickup',
    '/order-path/customer-facing-delivery',
    '/order-path/table-orders',
    '/order-path/mobile-ordering-application',
    '/privacy-policy',
    '/refund-policy',
    '/policies',
    '/subscription-returns',
    '/sitemap',
    '/login',
    '/register',
    '/reset-password',
  ];

  const entries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }));

  try {
    const { headings } = await loadPublicDocNav();
    for (const h of headings) {
      if (h.pages[0]) {
        entries.push({
          url: `${baseUrl}${docHeadingPath(h.slug)}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
      for (const s of h.subHeadings) {
        if (!s.pages[0]) continue;
        entries.push({
          url: `${baseUrl}${docPath(h.slug, s.slug)}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Sitemap still returns static routes if docs DB is unavailable.
  }

  return entries;
}
