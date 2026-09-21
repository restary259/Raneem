import { createFileRoute } from "@tanstack/react-router";
import ApplyPage from "@/pages/ApplyPage";

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "ابدأ طلبك مع درب | الدراسة في ألمانيا" },
      { name: "description", content: "أرسل معلوماتك إلى فريق درب لبدء تقييم مسارك الدراسي في ألمانيا." },
      { property: "og:title", content: "ابدأ طلبك مع درب | الدراسة في ألمانيا" },
      { property: "og:description", content: "ابدأ تقييم مسارك الدراسي في ألمانيا مع فريق درب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplyPage,
});
