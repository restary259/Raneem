import { createFileRoute } from "@tanstack/react-router";
import HeidelbergPage from "@/pages/HeidelbergPage";
import { HEIDELBERG_HERO, HEIDELBERG_SEO } from "@/data/heidelberg";

const SITE = "https://darb.agency";

export const Route = createFileRoute("/heidelberg")({
  head: () => {
    const image = `${SITE}${HEIDELBERG_HERO.url}`;
    return {
      meta: [
        { title: HEIDELBERG_SEO.title },
        { name: "description", content: HEIDELBERG_SEO.description },
        { property: "og:title", content: HEIDELBERG_SEO.title },
        { property: "og:description", content: HEIDELBERG_SEO.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${SITE}/heidelberg` },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: `${SITE}/heidelberg` }],
    };
  },
  component: HeidelbergPage,
});
