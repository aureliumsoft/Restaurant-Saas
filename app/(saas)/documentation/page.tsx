import {
  docHeadingPath,
  docPath,
  loadPublicDocNav,
  type PublicDocNav,
} from '@/lib/documentation/public';
import {
  DocumentationPageContent,
  type DocumentationGuideLink,
} from '@/components/marketing/documentation-page-content';

export const metadata = {
  title: 'Documentation | Foodluk',
  description:
    'Overview of Foodluk dashboard modules, customer website, kiosk, POS, and kitchen display (KDS).',
};

export const dynamic = 'force-dynamic';

function publishedGuideLinks(nav: PublicDocNav): DocumentationGuideLink[] {
  const links: DocumentationGuideLink[] = [];
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
  const nav = await loadPublicDocNav();
  const guides = publishedGuideLinks(nav);

  return <DocumentationPageContent guides={guides} />;
}
