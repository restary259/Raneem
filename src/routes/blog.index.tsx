import { createFileRoute } from "@tanstack/react-router";
import BlogIndexPage from "@/pages/blog/BlogIndexPage";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/blog" }],
    links: [{ rel: "canonical", href: "https://darb.agency/blog" }],
  }),
});
