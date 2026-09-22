import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";

export const Route = createFileRoute("/educational-destinations")({
  head: () => ({
    meta: [
      { title: "وجهات الدراسة في ألمانيا | Educational Destinations | DARB" },
      { name: "description", content: "استكشف وجهات درب المدعومة في ألمانيا. Explore supported German destinations, language environments, study research, and next steps." },
      { property: "og:title", content: "نفس الحلم، وجهة مختلفة | Same Dream, Different Destination | DARB" },
      { property: "og:description", content: "اكتشف المدن التي يمكن أن يبدأ منها طريقك إلى ألمانيا. Explore the cities where your path to Germany can begin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EducationalDestinationsPage,
});
