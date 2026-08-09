import type { BlogArticle } from './types';
import costOfLiving from './articles/cost-of-living-germany-students';
import visaSteps from './articles/german-student-visa-steps';
import bagrut from './articles/recognition-of-bagrut-and-anabin';
import language from './articles/german-language-levels-for-study';

export type { BlogArticle, BlogCategory, BlogSection, BlogSource, BlogLocaleContent } from './types';

/** Newest first — this order drives the blog index and the sitemap. */
export const blogArticles: BlogArticle[] = [
  visaSteps,
  bagrut,
  language,
  costOfLiving,
];

export const getArticle = (slug: string): BlogArticle | undefined =>
  blogArticles.find((article) => article.slug === slug);

/** Locale content for the active language, falling back to Arabic. */
export const localeContent = (article: BlogArticle, lang: string) =>
  lang.startsWith('en') ? article.en : article.ar;
