import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { routeText } from "@/lib/routeMeta";

export const Route = createFileRoute("/")({
  head: () => {
    const title = routeText("seo.indexTitle");
    const description = routeText("seo.indexDesc");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://darb.agency/" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: "https://darb.agency/" }],
    };
  },
  component: Index,
});
