import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";

export const Route = createFileRoute("/educational-destinations")({
  component: EducationalDestinationsPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/educational-destinations" }],
    links: [{ rel: "canonical", href: "https://darb.agency/educational-destinations" }],
  }),
});
