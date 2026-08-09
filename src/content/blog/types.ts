export type BlogCategory = 'before-arrival' | 'university' | 'money' | 'life';

export interface BlogSource {
  /** Human readable name of the official source. */
  label: string;
  /** Absolute URL. Must be an official / primary source whenever one exists. */
  url: string;
}

export interface BlogSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Optional short caution/callout rendered as a highlighted box. */
  note?: string;
}

export interface BlogLocaleContent {
  title: string;
  /** Meta description, < 160 chars. */
  description: string;
  /** Short intro paragraph shown on the index card and at the top of the article. */
  excerpt: string;
  sections: BlogSection[];
}

export interface BlogArticle {
  slug: string;
  category: BlogCategory;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  /** ISO date (YYYY-MM-DD) of the last factual review. */
  updatedAt: string;
  /** Verified official sources backing the factual claims in this article. */
  sources: BlogSource[];
  /** Internal links to related DARB pages — a few meaningful ones only. */
  relatedPaths: string[];
  ar: BlogLocaleContent;
  en: BlogLocaleContent;
}
