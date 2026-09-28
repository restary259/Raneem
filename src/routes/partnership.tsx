import { createFileRoute } from "@tanstack/react-router";
import PartnershipPage from "@/pages/PartnershipPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SITE = "https://darb.agency";

export const Route = createFileRoute("/partnership")({
  head: () => {
    const title = routeText("seo.partnershipTitle");
    const description = routeText("seo.partnershipDesc");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/partnership` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/partnership` }],
      scripts: [
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.partnership"), path: "/partnership" },
          ]),
        ),
      ],
    };
  },
  component: PartnershipPage,
});
