import { createFileRoute } from "@tanstack/react-router";
import AIAdvisorPage from "@/pages/AIAdvisorPage";

export const Route = createFileRoute("/ai-advisor")({
  head: () => ({
    meta: [
      { title: "Contact & AI Study Advisor — DARB" },
      {
        name: "description",
        content: "Contact the DARB team by WhatsApp or email, or ask the bilingual AI study advisor about studying in Germany.",
      },
      { property: "og:title", content: "Contact & AI Study Advisor — DARB" },
      {
        property: "og:description",
        content: "Reach DARB's human team or get quick bilingual guidance about studying in Germany.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AIAdvisorPage,
});
