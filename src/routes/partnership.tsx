import { createFileRoute } from "@tanstack/react-router";
import PartnershipPage from "@/pages/PartnershipPage";

export const Route = createFileRoute("/partnership")({
  head: () => ({
    meta: [
      { title: "الشراكة مع درب | DARB Partnership" },
      { name: "description", content: "تعرّف على فرص التعاون مع درب لدعم الطلاب في طريقهم إلى الدراسة في ألمانيا." },
      { property: "og:title", content: "الشراكة مع درب | DARB Partnership" },
      { property: "og:description", content: "تعرّف على فرص التعاون مع درب لدعم الطلاب في طريقهم إلى الدراسة في ألمانيا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnershipPage,
});
