import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/ContactPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل مع درب | الدراسة في ألمانيا" },
      { name: "description", content: "تواصل مع فريق درب للحصول على إرشاد عربي موثوق حول الدراسة والقبول والتأشيرة في ألمانيا." },
      { property: "og:title", content: "تواصل مع درب | الدراسة في ألمانيا" },
      { property: "og:description", content: "ابدأ رحلتك الدراسية في ألمانيا مع فريق درب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});
