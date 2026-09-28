import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SITE = "https://darb.agency";

export const Route = createFileRoute("/educational-destinations")({
  head: () => {
    const title = routeText("seo.edDestTitle");
    const description = routeText("seo.edDestDesc");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/educational-destinations` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/educational-destinations` }],
      scripts: [
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            {
              name: routeText("nav.educationalDestinations"),
              path: "/educational-destinations",
            },
          ]),
        ),
      ],
    };
  },
  component: EducationalDestinationsPage,
});
