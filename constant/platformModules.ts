/**
 * SaaS admin area (/admin/*) — keys used in Role Permission.name tokens (moduleKey:action).
 */
export const PLATFORM_ADMIN_MODULES = [
  { moduleKey: 'admin_dashboard', title: 'Admin dashboard', path: '/admin/dashboard' },
  { moduleKey: 'admin_restaurants', title: 'Restaurants', path: '/admin/restaurants' },
  { moduleKey: 'admin_subscriptions', title: 'Subscriptions', path: '/admin/subscriptions' },
  { moduleKey: 'admin_seo', title: 'SEO & analytics', path: '/admin/seo' },
  { moduleKey: 'admin_settings', title: 'Platform settings', path: '/admin/settings' },
] as const;

export type PlatformAdminModuleKey =
  (typeof PLATFORM_ADMIN_MODULES)[number]['moduleKey'];
