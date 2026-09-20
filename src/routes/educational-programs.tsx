import { createFileRoute } from "@tanstack/react-router";
import EducationalProgramsPage from "@/pages/EducationalProgramsPage";

export const Route = createFileRoute("/educational-programs")({
  component: EducationalProgramsPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/educational-programs" }],
    links: [{ rel: "canonical", href: "https://darb.agency/educational-programs" }],
  }),
});
