import { createFileRoute } from "@tanstack/react-router";
import ServicesPage from "@/pages/ServicesPage";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "خدمات درب | طريقك للدراسة في ألمانيا" },
      { name: "description", content: "تعرّف على خدمات درب للقبول الجامعي وتجهيز الوثائق والتأشيرة والسكن والدعم بعد الوصول." },
      { property: "og:title", content: "خدمات درب | طريقك للدراسة في ألمانيا" },
      { property: "og:description", content: "دعم عربي متكامل لرحلتك الدراسية إلى ألمانيا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServicesPage,
});
