import { createFileRoute } from "@tanstack/react-router";
import ResourcesPage from "@/pages/ResourcesPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SITE = "https://darb.agency";

export const Route = createFileRoute("/resources/")({
  head: () => {
    const title = routeText("seo.resourcesTitle");
    const description = routeText("seo.resourcesDesc");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/resources` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          mainEntityOfPage: `${SITE}/resources`,
          datePublished: "2026-02-18",
          author: {
            "@type": "Organization",
            name: "Darb Study Pathways",
            url: SITE,
          },
          publisher: {
            "@type": "EducationalOrganization",
            name: "Darb Study Pathways",
            logo: {
              "@type": "ImageObject",
              url: `${SITE}/icons/icon-512-v2.png`,
            },
          },
        }),
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.resources"), path: "/resources" },
          ]),
        ),
      ],
    };
  },
  component: ResourcesPage,
});
