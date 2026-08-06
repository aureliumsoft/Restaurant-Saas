import Link from 'next/link';

import { DocumentationModulesSection } from '@/components/marketing/documentation-modules-section';
import { DASHBOARD_MODULES } from '@/constant/dashboardModules';
import {
  docHeadingPath,
  docPath,
  loadPublicDocModules,
  loadPublicDocNav,
  type PublicDocNav,
} from '@/lib/documentation/public';

export const metadata = {
  title: 'Documentation | Foodluk',
  description:
    'Overview of Foodluk dashboard modules, customer website, kiosk, POS, and kitchen display (KDS).',
};

export const dynamic = 'force-dynamic';

const channels = [
  {
    id: 'customer-website',
    title: 'Customer website (online ordering)',
    body: `Your branded storefront lets guests browse the menu, build a cart, and place orders for delivery or pick-up. It uses your restaurant slug, logo, banners, and theme colors (when included on your plan). Customers reach it at your public web-app URL—share it from Settings after setup.`,
  },
  {
    id: 'kiosk',
    title: 'Kiosk',
    body: `Self-service ordering on a tablet or dedicated device: guests choose dine-in or take-away, optional table, add items, and pay or place the order. Ideal for queues and front-of-house. Each kiosk session is tied to your restaurant slug.`,
  },
  {
    id: 'pos',
    title: 'POS (point of sale)',
    body: `Staff-facing point of sale for in-venue orders: quick product grid, modifiers, cart, and checkout. Opens in a focused window from the dashboard. Use it alongside or instead of written tickets for walk-in and counter service.`,
  },
  {
    id: 'kds',
    title: 'KDS (kitchen display system)',
    body: `Kitchen screen lists open tickets from POS, kiosk, and online orders so the line can bump, prioritize, and complete items. Reduces paper tickets and keeps prep aligned with live order flow.`,
  },
] as const;

function moduleBlurb(
  key: (typeof DASHBOARD_MODULES)[number]['moduleKey']
): string {
  switch (key) {
    case 'dashboard':
      return 'Overview metrics, quick links to other modules, and shortcuts to open your public storefront and kiosk.';
    case 'sales':
      return 'Sales-focused views and workflows to review order activity and revenue-oriented tasks.';
    case 'pos':
      return 'In-venue point of sale: browse menu, modifiers, cart, and take payment or send orders to the kitchen.';
    case 'kds':
      return 'Kitchen display for open tickets: statuses, items, and completion flow for back-of-house.';
    case 'branched':
      return 'Create and edit branch locations (addresses, phones) when your plan allows multiple branches.';
    case 'categories':
      return 'Organize the menu into categories; order and visibility feed the website, kiosk, and POS.';
    case 'product':
      return 'Create and edit menu items, prices, images, and assign variation rates per product.';
    case 'variations':
      return 'Define size templates (Small, Medium, Large) with short labels used on products and configuration add-ons.';
    case 'tables':
      return 'Define dining tables or service labels used for dine-in flows (e.g. kiosk table selection).';
    case 'recommendations':
      return 'Link add-on categories to products (configuration / upsell) when your plan includes this feature.';
    case 'records':
      return 'Historical records and transaction-oriented views for reconciliation and lookup.';
    case 'settings':
      return 'Restaurant profile, branding, team & roles, customer entry links, and account-related options.';
    default:
      return 'Operator tool in your workspace.';
  }
}

const fallbackModules = DASHBOARD_MODULES.map((m) => ({
  id: m.moduleKey,
  name: m.title,
  shortDescription: moduleBlurb(m.moduleKey),
  contentHtml: `<p>${moduleBlurb(m.moduleKey)}</p>`,
}));

function publishedGuideLinks(nav: PublicDocNav) {
  const links: { href: string; label: string; description: string }[] = [];
  for (const h of nav.headings) {
    if (h.pages[0]) {
      links.push({
        href: docHeadingPath(h.slug),
        label: h.name,
        description: h.pages[0].shortDescription || h.pages[0].name,
      });
    }
    for (const s of h.subHeadings) {
      const page = s.pages[0];
      if (!page) continue;
      links.push({
        href: docPath(h.slug, s.slug),
        label: `${h.name} · ${s.name}`,
        description: page.shortDescription || page.name,
      });
    }
  }
  return links;
}

export default async function DocumentationIndexPage() {
  const [nav, modules] = await Promise.all([
    loadPublicDocNav(),
    loadPublicDocModules(),
  ]);
  const guides = publishedGuideLinks(nav);

  return (
    <div className="w-full max-w-4xl pb-8">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        Documentation
      </h1>
      <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Foodluk is a SaaS operating layer for restaurants: one account, one
        dashboard, and connected channels for web, kiosk, counter, and kitchen.
        Below is a map of what each area does. In-app behavior may vary by
        subscription plan.
      </p>

      <nav
        aria-label="On this page"
        className="mt-10 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <p className="font-medium text-zinc-900 dark:text-white">On this page</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <a
              href="#channels"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              Website, kiosk, POS &amp; KDS
            </a>
          </li>
          <li>
            <a
              href="#modules"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              Dashboard modules
            </a>
          </li>
          <li>
            <a
              href="#getting-started"
              className="text-fire-600 hover:underline dark:text-fire-400"
            >
              Getting started
            </a>
          </li>
          {guides.length > 0 ? (
            <li>
              <a
                href="#guides"
                className="text-fire-600 hover:underline dark:text-fire-400"
              >
                Published guides
              </a>
            </li>
          ) : null}
        </ul>
      </nav>

      <section id="channels" className="mt-14 scroll-mt-24">
        <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
          Customer channels
        </h2>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          These surfaces are how guests and staff interact with live menu and
          order data. They complement the dashboard modules listed in the next
          section.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {channels.map((c) => (
            <article
              key={c.id}
              id={c.id}
              className="scroll-mt-24 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {c.body}
              </p>
            </article>
          ))}
        </div>
      </section>
      
{/* 
      <DocumentationModulesSection
        modules={modules}
        fallbackModules={fallbackModules}
      /> */}

      <section id="getting-started" className="mt-16 scroll-mt-24">
        <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
          Getting started
        </h2>
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            Create an account and complete onboarding (restaurant name, domain,
            optional branches).
          </li>
          <li>
            Build categories and products, then review{' '}
            <strong className="text-zinc-900 dark:text-white">Settings</strong>{' '}
            for team invites, branding, and customer links.
          </li>
          <li>
            Open <strong className="text-zinc-900 dark:text-white">POS</strong>{' '}
            or <strong className="text-zinc-900 dark:text-white">KDS</strong> on
            venue devices; share your web storefront and kiosk URLs from the
            dashboard when you go live.
          </li>
          <li>
            Use{' '}
            <Link
              href="/pricing"
              className="text-fire-600 underline dark:text-fire-400"
            >
              Pricing
            </Link>{' '}
            to compare plans and upgrade when you need more branches,
            recommendations, or advanced analytics.
          </li>
        </ol>
      </section>

      {guides.length > 0 ? (
        <section id="guides" className="mt-16 scroll-mt-24">
          <h2 className="border-b border-zinc-200 pb-2 text-2xl font-semibold dark:border-zinc-800">
            Published guides
          </h2>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Open detailed guides from the sidebar or the links below.
          </p>
          <ul className="mt-6 space-y-3">
            {guides.map((g) => (
              <li key={g.href}>
                <Link
                  href={g.href}
                  className="block rounded-xl border border-zinc-200/80 px-4 py-3 transition-colors hover:border-fire-500/40 dark:border-zinc-800 dark:hover:border-fire-500/40"
                >
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {g.label}
                  </span>
                  {g.description ? (
                    <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
                      {g.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-12 text-sm text-zinc-600 dark:text-zinc-400">
        Need a walkthrough?{' '}
        <Link
          href="/demo-request"
          className="text-fire-600 underline dark:text-fire-400"
        >
          Request a demo
        </Link>
        .
      </p>
    </div>
  );
}
