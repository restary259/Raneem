import { createFileRoute } from "@tanstack/react-router";
import BlogArticlePage from "@/pages/blog/BlogArticlePage";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogArticlePage,
  head: ({ params }) => ({
    meta: [{ property: "og:type", content: "article" }, { property: "og:url", content: `https://darb.agency/blog/${params.slug}` }],
    links: [{ rel: "canonical", href: `https://darb.agency/blog/${params.slug}` }],
  }),
});
