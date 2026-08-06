import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocumentationArticleView } from '@/components/marketing/documentation-article';
import { loadPublicDocArticleByHeading } from '@/lib/documentation/public';

type Props = {
  params: Promise<{ headingSlug: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { headingSlug } = await params;
  const article = await loadPublicDocArticleByHeading(headingSlug);
  if (!article) {
    return { title: 'Documentation | Foodluk' };
  }
  const primary = article.pages[0];
  return {
    title: `${primary?.name ?? article.heading.name} | Foodluk Docs`,
    description: primary?.shortDescription || article.heading.name,
  };
}

export default async function DocumentationHeadingPage({ params }: Props) {
  const { headingSlug } = await params;
  const article = await loadPublicDocArticleByHeading(headingSlug);

  if (!article) notFound();

  return <DocumentationArticleView article={article} />;
}
