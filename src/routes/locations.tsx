import { createFileRoute } from "@tanstack/react-router";
import LocationsPage from "@/pages/LocationsPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SITE = "https://darb.agency";

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
        { property: "og:url", content: `${SITE}/locations` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/locations` }],
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
