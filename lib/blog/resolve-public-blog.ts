import { resolveBilingualText } from '@/lib/menu/bilingual-text';
import type { UiLanguage } from '@/lib/i18n/resources';

export type BlogPostCmsRow = {
  title: string;
  shortDescription: string;
  contentHtml?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

/** Resolve blog bilingual fields (JSON / &&&&) for the active UI language. */
export function resolveBlogPostCms<T extends BlogPostCmsRow>(
  post: T,
  lang: UiLanguage
): T & {
  title: string;
  shortDescription: string;
  contentHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
} {
  const title = resolveBilingualText(post.title, lang);
  const shortDescription = resolveBilingualText(post.shortDescription, lang);
  const contentHtml = resolveBilingualText(post.contentHtml, lang);
  const seoTitleRaw = resolveBilingualText(post.seoTitle, lang);
  const seoDescriptionRaw = resolveBilingualText(post.seoDescription, lang);

  return {
    ...post,
    title,
    shortDescription,
    contentHtml,
    seoTitle: seoTitleRaw || null,
    seoDescription: seoDescriptionRaw || null,
  };
}
