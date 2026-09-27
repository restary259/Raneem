import { createFileRoute } from "@tanstack/react-router";
import BlogIndexPage from "@/pages/blog/BlogIndexPage";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "مدونة درب | دليل الدراسة في ألمانيا" },
      { name: "description", content: "مقالات عملية عن تكاليف المعيشة، مستويات اللغة الألمانية، التأشيرة والاعتراف بالبجروت." },
      { property: "og:title", content: "مدونة درب | دليل الدراسة في ألمانيا" },
      { property: "og:description", content: "مقالات عملية عن تكاليف المعيشة، مستويات اللغة الألمانية، التأشيرة والاعتراف بالبجروت." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://darb.agency/blog" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://darb.agency/blog" }],
  }),
  component: BlogIndexPage,
});
