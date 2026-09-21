import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "درب | الدراسة في ألمانيا بدعم عربي" },
      { name: "description", content: "ابدأ طريقك للدراسة في ألمانيا مع إرشاد عربي من درب للقبول واللغة والتأشيرة والسكن." },
      { property: "og:title", content: "درب | الدراسة في ألمانيا بدعم عربي" },
      { property: "og:description", content: "ابدأ طريقك للدراسة في ألمانيا مع إرشاد عربي من درب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
