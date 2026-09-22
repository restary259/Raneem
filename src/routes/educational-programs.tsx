import { createFileRoute } from "@tanstack/react-router";
import EducationalProgramsPage from "@/pages/EducationalProgramsPage";

export const Route = createFileRoute("/educational-programs")({
  head: () => ({
    meta: [
      { title: "التخصصات والبرامج الدراسية | درب" },
      { name: "description", content: "ابحث في التخصصات والبرامج الدراسية المناسبة لمسارك نحو الدراسة في ألمانيا." },
      { property: "og:title", content: "التخصصات والبرامج الدراسية | درب" },
      { property: "og:description", content: "اكتشف تخصصك ومسارك الدراسي مع درب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EducationalProgramsPage,
});
