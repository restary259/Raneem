import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";

export const Route = createFileRoute("/educational-destinations")({
  component: EducationalDestinationsPage,
});
