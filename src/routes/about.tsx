import { createFileRoute } from "@tanstack/react-router";
import WhoWeArePage from "@/pages/WhoWeArePage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

export const Route = createFileRoute("/about")({
  head: () => {
    const title = routeText("seo.whoWeAreTitle");
    const description = routeText("seo.whoWeAreDesc");
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
            { name: routeText("nav.about"), path: "/about" },
          ]),
        ),
      ],
    };
  },
  component: WhoWeArePage,
});
