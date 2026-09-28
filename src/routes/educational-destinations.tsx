import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

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
        { name: "twitter:card", content: "summary_large_image" },
      ],
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
