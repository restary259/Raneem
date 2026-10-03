import { createFileRoute } from "@tanstack/react-router";
import ServicesPage from "@/pages/ServicesPage";
import { jsonLdScript, pickLang, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import arServices from "../../public/locales/ar/services.json";
import enServices from "../../public/locales/en/services.json";
import heServices from "../../public/locales/he/services.json";

const SITE = "https://darb.agency";

interface ServiceStage {
  title: string;
  darb: string;
}

/**
 * The `services` namespace is not eagerly bundled, so `routeText` cannot reach
 * it during SSR; the locale JSON is imported directly instead (still a
 * route-scoped code-split chunk). The stages are the same data the page renders.
 */
export const Route = createFileRoute("/services")({
  head: () => {
    const title = routeText("seo.servicesTitle");
    const description = routeText("seo.servicesDesc");
    const stages = pickLang({
      ar: arServices.servicesJourney.stages,
      en: enServices.servicesJourney.stages,
      he: heServices.servicesJourney.stages,
    }) as ServiceStage[];
    const offers = stages.map((stage) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: stage.title,
        description: stage.darb,
      },
    }));
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/services` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/services` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Service",
          name: title,
          description,
          serviceType: "Study abroad consultancy",
          url: `${SITE}/services`,
          areaServed: [
            { "@type": "Country", name: "Israel" },
            { "@type": "Country", name: "Germany" },
          ],
          provider: {
            "@type": "EducationalOrganization",
            name: "Darb Study International",
            url: SITE,
          },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: title,
            itemListElement: offers,
          },
        }),
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.services"), path: "/services" },
          ]),
        ),
      ],
    };
  },
  component: ServicesPage,
});
