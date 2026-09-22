import { pickCmsText } from '@/lib/i18n/cms-locale';
import { getServerUiLanguage } from '@/lib/i18n/server-ui-language';
import type { UiLanguage } from '@/lib/i18n/resources';
import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import { db } from '@/lib/db';

export type PublicDocPage = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
  sortOrder: number;
};

export type PublicDocSubHeading = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  pages: PublicDocPage[];
};

export type PublicDocHeading = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  /** Pages assigned to the heading only (no sub heading). */
  pages: PublicDocPage[];
  subHeadings: PublicDocSubHeading[];
};

export type PublicDocNav = {
  headings: PublicDocHeading[];
};

export type PublicDocModuleCard = {
  id: string;
  name: string;
  shortDescription: string;
  contentHtml: string;
  sortOrder: number;
};

/** List payload for index cards (omit huge HTML until Read more). */
export type PublicDocModuleListItem = {
  id: string;
  name: string;
  shortDescription: string;
  sortOrder: number;
};

const pageSelect = {
  id: true,
  name: true,
  nameEs: true,
  shortDescription: true,
  shortDescriptionEs: true,
  contentHtml: true,
  contentHtmlEs: true,
  sortOrder: true,
} as const;

const pageListSelect = {
  id: true,
  name: true,
  nameEs: true,
  shortDescription: true,
  shortDescriptionEs: true,
  sortOrder: true,
} as const;

type PageRow = {
  id: string;
  name: string;
  nameEs: string | null;
  shortDescription: string;
  shortDescriptionEs: string | null;
  contentHtml: string;
  contentHtmlEs: string | null;
  sortOrder: number;
};

type PageListRow = Omit<PageRow, 'contentHtml' | 'contentHtmlEs'>;

function mapPublicDocPage(row: PageRow, lang: UiLanguage): PublicDocPage {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    name: pickCmsText({ en: row.name, es: row.nameEs }, lang),
    shortDescription: pickCmsText(
      { en: row.shortDescription, es: row.shortDescriptionEs },
      lang
    ),
    contentHtml: pickCmsText(
      { en: row.contentHtml, es: row.contentHtmlEs },
      lang
    ),
  };
}

function mapPublicDocPageList(
  row: PageListRow,
  lang: UiLanguage
): PublicDocModuleListItem {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    name: pickCmsText({ en: row.name, es: row.nameEs }, lang),
    shortDescription: pickCmsText(
      { en: row.shortDescription, es: row.shortDescriptionEs },
      lang
    ),
  };
}

export type PublicDocLoadOptions = {
  lang?: UiLanguage;
};

async function resolveLang(opts?: PublicDocLoadOptions): Promise<UiLanguage> {
  return opts?.lang ?? (await getServerUiLanguage());
}

/** Flat list of published pages for the index modules section (list fields only). */
export async function loadPublicDocModules(
  opts?: PublicDocLoadOptions
): Promise<PublicDocModuleListItem[]> {
  const lang = await resolveLang(opts);
  const rows = await db.documentationModule.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: pageListSelect,
  });
  return rows.map((row) => mapPublicDocPageList(row, lang));
}

export async function loadPublicDocModuleById(
  id: string,
  opts?: PublicDocLoadOptions
): Promise<PublicDocModuleCard | null> {
  const lang = await resolveLang(opts);
  const row = await db.documentationModule.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: pageSelect,
  });
  if (!row) return null;
  return mapPublicDocPage(row, lang);
}

export async function loadPublicDocNav(
  opts?: PublicDocLoadOptions
): Promise<PublicDocNav> {
  const lang = await resolveLang(opts);
  const headings = await db.documentationHeading.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      pages: {
        where: { status: 'PUBLISHED', subHeadingId: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: pageSelect,
      },
      subHeadings: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          pages: {
            where: { status: 'PUBLISHED' },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: pageSelect,
          },
        },
      },
    },
  });

  return {
    headings: headings.map((heading) => ({
      id: heading.id,
      slug: heading.slug,
      sortOrder: heading.sortOrder,
      name: resolveBilingualText(heading.name, lang),
      pages: heading.pages.map((p) => mapPublicDocPage(p, lang)),
      subHeadings: heading.subHeadings.map((sub) => ({
        id: sub.id,
        slug: sub.slug,
        sortOrder: sub.sortOrder,
        name: resolveBilingualText(sub.name, lang),
        pages: sub.pages.map((p) => mapPublicDocPage(p, lang)),
      })),
    })),
  };
}

export function docHeadingPath(headingSlug: string): string {
  return `/documentation/${headingSlug}`;
}

export function docPath(headingSlug: string, subheadingSlug: string): string {
  return `/documentation/${headingSlug}/${subheadingSlug}`;
}

/** Prefer heading-only page; else first subheading with content. */
export function firstDocPath(nav: PublicDocNav): string | null {
  for (const h of nav.headings) {
    if (h.pages[0]) return docHeadingPath(h.slug);
    for (const s of h.subHeadings) {
      if (s.pages[0]) return docPath(h.slug, s.slug);
    }
  }
  return null;
}

export type PublicDocArticle = {
  heading: { id: string; name: string; slug: string };
  subHeading: { id: string; name: string; slug: string } | null;
  pages: PublicDocPage[];
};

export async function loadPublicDocArticleByHeading(
  headingSlug: string,
  opts?: PublicDocLoadOptions
): Promise<PublicDocArticle | null> {
  const lang = await resolveLang(opts);
  const heading = await db.documentationHeading.findFirst({
    where: { slug: headingSlug, status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      slug: true,
      pages: {
        where: { status: 'PUBLISHED', subHeadingId: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: pageSelect,
      },
    },
  });

  if (!heading || heading.pages.length === 0) return null;

  return {
    heading: {
      id: heading.id,
      slug: heading.slug,
      name: resolveBilingualText(heading.name, lang),
    },
    subHeading: null,
    pages: heading.pages.map((p) => mapPublicDocPage(p, lang)),
  };
}

export async function loadPublicDocArticle(
  headingSlug: string,
  subheadingSlug: string,
  opts?: PublicDocLoadOptions
): Promise<PublicDocArticle | null> {
  const lang = await resolveLang(opts);
  const heading = await db.documentationHeading.findFirst({
    where: { slug: headingSlug, status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      slug: true,
      subHeadings: {
        where: { slug: subheadingSlug, status: 'PUBLISHED' },
        take: 1,
        select: {
          id: true,
          name: true,
          slug: true,
          pages: {
            where: { status: 'PUBLISHED' },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: pageSelect,
          },
        },
      },
    },
  });

  const subHeading = heading?.subHeadings[0];
  if (!heading || !subHeading || subHeading.pages.length === 0) {
    return null;
  }

  return {
    heading: {
      id: heading.id,
      slug: heading.slug,
      name: resolveBilingualText(heading.name, lang),
    },
    subHeading: {
      id: subHeading.id,
      slug: subHeading.slug,
      name: resolveBilingualText(subHeading.name, lang),
    },
    pages: subHeading.pages.map((p) => mapPublicDocPage(p, lang)),
  };
}
