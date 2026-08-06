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
  shortDescription: true,
  contentHtml: true,
  sortOrder: true,
} as const;

const pageListSelect = {
  id: true,
  name: true,
  shortDescription: true,
  sortOrder: true,
} as const;

/** Flat list of published pages for the index modules section (list fields only). */
export async function loadPublicDocModules(): Promise<PublicDocModuleListItem[]> {
  return db.documentationModule.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: pageListSelect,
  });
}

export async function loadPublicDocModuleById(
  id: string
): Promise<PublicDocModuleCard | null> {
  return db.documentationModule.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: pageSelect,
  });
}

export async function loadPublicDocNav(): Promise<PublicDocNav> {
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

  return { headings };
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
  headingSlug: string
): Promise<PublicDocArticle | null> {
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
    heading: { id: heading.id, name: heading.name, slug: heading.slug },
    subHeading: null,
    pages: heading.pages,
  };
}

export async function loadPublicDocArticle(
  headingSlug: string,
  subheadingSlug: string
): Promise<PublicDocArticle | null> {
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
    heading: { id: heading.id, name: heading.name, slug: heading.slug },
    subHeading: {
      id: subHeading.id,
      name: subHeading.name,
      slug: subHeading.slug,
    },
    pages: subHeading.pages,
  };
}
