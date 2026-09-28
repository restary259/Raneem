import { createFileRoute } from "@tanstack/react-router";
import PartnershipPage from "@/pages/PartnershipPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

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
        { name: "twitter:card", content: "summary_large_image" },
      ],
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
