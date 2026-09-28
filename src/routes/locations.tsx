import { createFileRoute } from "@tanstack/react-router";
import LocationsPage from "@/pages/LocationsPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

export const Route = createFileRoute("/locations")({
  head: () => {
    const title = routeText("seo.locationsTitle");
    const description = routeText("seo.locationsDesc");
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
            { name: routeText("nav.locations"), path: "/locations" },
          ]),
        ),
      ],
    };
  },
  component: LocationsPage,
});
