import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/FaqPage";
import { jsonLdScript, pickLang, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import arFaq from "../../public/locales/ar/faq.json";
import enFaq from "../../public/locales/en/faq.json";
import heFaq from "../../public/locales/he/faq.json";

const SITE = "https://darb.agency";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  items: FaqItem[];
}

type FaqDict = {
  seo: { title: string; description: string };
  categories: FaqCategory[];
};

const FAQS = {
  ar: arFaq as unknown as FaqDict,
  en: enFaq as unknown as FaqDict,
  he: heFaq as unknown as FaqDict,
};

/**
 * The FAQPage schema and the page title both come from the `faq` locale JSON,
 * imported directly because the namespace is not eagerly bundled (so
 * `routeText` cannot reach it during SSR). Emitting the schema through `head()`
 * is what makes the answers visible to crawlers that do not run JavaScript.
 */
export const Route = createFileRoute("/faq")({
  head: () => {
    const faq = pickLang(FAQS);
    const title = faq.seo.title;
    const description = faq.seo.description;
    const questions = faq.categories.flatMap((category) =>
      category.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    );
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE}/faq` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/faq` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: questions,
        }),
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.faq"), path: "/faq" },
          ]),
        ),
      ],
    };
  },
  component: FaqPage,
});
