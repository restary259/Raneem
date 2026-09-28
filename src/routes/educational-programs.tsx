import { createFileRoute } from "@tanstack/react-router";
import EducationalProgramsPage from "@/pages/EducationalProgramsPage";
import { jsonLdScript, routeText } from "@/lib/routeMeta";
import { buildBreadcrumbList } from "@/lib/breadcrumbs";
import { majorsData } from "@/data/majorsData";
import i18n from "@/i18n";

const SITE = "https://darb.agency";

/**
 * Every sub-major as a `Course` in the ItemList. Derived from
 * `src/data/majorsData.ts` (the single source of truth) so the structured data
 * can never drift from the cards rendered below it.
 */
const allSubMajors = majorsData.flatMap((category) =>
  category.subMajors.map((subMajor) => ({
    ...subMajor,
    categoryTitle: category.title,
    categoryTitleEN: category.titleEN,
  })),
);

export const Route = createFileRoute("/educational-programs")({
  head: () => {
    const title = routeText("seo.edProgTitle");
    const description = routeText("seo.edProgDesc");
    const lang = i18n.language === "en" ? "en" : "ar";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/educational-programs` }],
      scripts: [
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE}/educational-programs`,
          inLanguage: lang,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: allSubMajors.length,
            itemListElement: allSubMajors.slice(0, 30).map((major, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Course",
                name: lang === "ar" ? major.nameAR : major.nameEN,
                description:
                  lang === "ar" ? major.description : major.descriptionEN,
                provider: {
                  "@type": "EducationalOrganization",
                  name: "Darb Study Pathways",
                  url: SITE,
                },
              },
            })),
          },
        }),
        jsonLdScript(
          buildBreadcrumbList([
            { name: routeText("nav.home"), path: "/" },
            { name: routeText("nav.majors"), path: "/educational-programs" },
          ]),
        ),
      ],
    };
  },
  component: EducationalProgramsPage,
});
