import { createFileRoute } from "@tanstack/react-router";
import ResourcesPage from "@/pages/ResourcesPage";

export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title: "أدوات وموارد الدراسة في ألمانيا | درب" },
      { name: "description", content: "أدوات وموارد مجانية تساعدك على الاستعداد للدراسة في ألمانيا." },
      { property: "og:title", content: "أدوات وموارد الدراسة في ألمانيا | درب" },
      { property: "og:description", content: "أدوات وموارد مجانية تساعدك على الاستعداد للدراسة في ألمانيا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResourcesPage,
});
