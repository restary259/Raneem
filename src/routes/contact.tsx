import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/ContactPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";

const SITE = "https://darb.agency";

export const Route = createFileRoute("/contact")({
  head: () => {
    const title = routeText("seo.contactTitle");
    const description = routeText("seo.contactDesc");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/contact` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/contact` }],
      scripts: [
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.contact"), path: "/contact" },
          ]),
        ),
      ],
    };
  },
  component: ContactPage,
});
