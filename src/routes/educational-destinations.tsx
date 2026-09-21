import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";

export const Route = createFileRoute("/educational-destinations")({
  head: () => ({
    meta: [
      { title: "وجهات الدراسة في ألمانيا | درب" },
      { name: "description", content: "استكشف خمس مدن ألمانية مدعومة ضمن مسار درب، وقارن بيئة اللغة والدراسة والحياة والخطوة التالية." },
      { property: "og:title", content: "وجهات الدراسة في ألمانيا | درب" },
      { property: "og:description", content: "نفس الحلم، وجهة مختلفة. تعرّف على المدن الألمانية التي يمكن أن يبدأ منها طريقك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EducationalDestinationsPage,
});
