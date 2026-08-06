import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocumentationArticleView } from '@/components/marketing/documentation-article';
import { loadPublicDocArticle } from '@/lib/documentation/public';

type Props = {
  params: Promise<{ headingSlug: string; subheadingSlug: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { headingSlug, subheadingSlug } = await params;
  const article = await loadPublicDocArticle(headingSlug, subheadingSlug);
  if (!article) {
    return { title: 'Documentation | Foodluk' };
  }
  const primary = article.pages[0];
  return {
    title: `${primary?.name ?? article.subHeading?.name ?? article.heading.name} | Foodluk Docs`,
    description:
      primary?.shortDescription ||
      [article.heading.name, article.subHeading?.name].filter(Boolean).join(' · '),
  };
}

export default async function DocumentationSubHeadingPage({ params }: Props) {
  const { headingSlug, subheadingSlug } = await params;
  const article = await loadPublicDocArticle(headingSlug, subheadingSlug);

  if (!article) notFound();

  return <DocumentationArticleView article={article} />;
}
