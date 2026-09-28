import { createFileRoute } from "@tanstack/react-router";
import BlogArticlePage from "@/pages/blog/BlogArticlePage";
import { jsonLdScript, pickLang } from "@/lib/routeMeta";
import i18n from "@/i18n";
import { getArticle, localeContent } from "@/content/blog";
import arBlog from "../../public/locales/ar/blog.json";
import enBlog from "../../public/locales/en/blog.json";
import heBlog from "../../public/locales/he/blog.json";

const SITE = "https://darb.agency";

const BLOG_BRAND = { ar: arBlog.brand, en: enBlog.brand, he: heBlog.brand };
const BLOG_INDEX_TITLE = {
  ar: arBlog.index.title,
  en: enBlog.index.title,
  he: heBlog.index.title,
};

/**
 * Article + BreadcrumbList schema emitted through `head()` so crawlers that do
 * not run JavaScript still see the article metadata. Content comes from
 * `src/content/blog` — the same source the page renders — so the two cannot
 * drift. An unknown slug emits nothing; the page redirects to /blog.
 */
export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => {
    const lang = i18n.language ?? "ar";
    const article = getArticle(params.slug);
    if (!article) return { meta: [] };
    const content = localeContent(article, lang);
    return {
      meta: [
        { title: `${content.title} | ${pickLang(BLOG_BRAND)}` },
        { name: "description", content: content.description },
        {
          property: "og:title",
          content: `${content.title} | ${pickLang(BLOG_BRAND)}`,
        },
        { property: "og:description", content: content.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${SITE}/blog/${article.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/blog/${article.slug}` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: content.title,
          description: content.description,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          inLanguage: lang.startsWith("en") ? "en" : "ar",
          mainEntityOfPage: `${SITE}/blog/${article.slug}`,
          author: { "@type": "Organization", name: "Darb Agency" },
          publisher: {
            "@type": "Organization",
            name: "Darb Agency",
            url: SITE,
          },
          citation: article.sources.map((source) => source.url),
        }),
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Darb",
              item: `${SITE}/`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: pickLang(BLOG_INDEX_TITLE),
              item: `${SITE}/blog`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: content.title,
              item: `${SITE}/blog/${article.slug}`,
            },
          ],
        }),
      ],
    };
  },
  component: BlogArticlePage,
});
