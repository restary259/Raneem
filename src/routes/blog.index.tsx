import { createFileRoute } from "@tanstack/react-router";
import BlogIndexPage from "@/pages/blog/BlogIndexPage";
import { jsonLdScript, pickLang } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import i18n from "@/i18n";
import { blogArticles, localeContent } from "@/content/blog";
import arBlog from "../../public/locales/ar/blog.json";
import enBlog from "../../public/locales/en/blog.json";
import heBlog from "../../public/locales/he/blog.json";

const SITE = "https://darb.agency";

const BLOG_INDEX = { ar: arBlog.index, en: enBlog.index, he: heBlog.index };

const BLOG_BRAND = { ar: arBlog.brand, en: enBlog.brand, he: heBlog.brand };

/**
 * The `blog` namespace is not eagerly bundled, so its locale JSON is imported
 * directly for the head values. The article list comes from `src/content/blog`
 * (the same source the page renders), emitted through `head()` so the Blog
 * schema reaches crawlers that do not run JavaScript.
 */
export const Route = createFileRoute("/blog/")({
  head: () => {
    const lang = i18n.language ?? "ar";
    const index = pickLang(BLOG_INDEX);
    const brand = pickLang(BLOG_BRAND);
    const posts = blogArticles.map((article) => {
      const content = localeContent(article, lang);
      return {
        "@type": "BlogPosting",
        headline: content.title,
        description: content.description,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        url: `${SITE}/blog/${article.slug}`,
      };
    });
    return {
      meta: [
        { title: index.metaTitle },
        { name: "description", content: index.metaDescription },
        { property: "og:title", content: index.metaTitle },
        { property: "og:description", content: index.metaDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/blog` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/blog` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: index.title,
          url: `${SITE}/blog`,
          blogPost: posts,
        }),
        jsonLdScript(
          buildBreadcrumbList([
            { name: brand, path: "/" },
            { name: index.title, path: "/blog" },
          ]),
        ),
      ],
    };
  },
  component: BlogIndexPage,
});
